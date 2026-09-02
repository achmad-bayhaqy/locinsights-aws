/**
 * A/B Weight Simulator — Phase 2.
 *
 * POST /api/locinsight/ab-test
 *   body: {
 *     config_a: Partial<ScoringWeights>,
 *     config_b: Partial<ScoringWeights>,
 *     brand_id?: string,
 *     tier?: 1|2|3,
 *     limit?: number
 *   }
 *   returns: {
 *     a: { top: OpportunityScore[], stats: {...} },
 *     b: { top: OpportunityScore[], stats: {...} },
 *     diff: { rank_changes: [...], new_in_top: [...], dropped_from_top: [...] }
 *   }
 *
 * Lets the user compare two scoring-weight configurations side-by-side to see
 * how the top-N opportunity ranking changes — best-practice A/B testing for
 * retail site selection (cf. Placer.ai 2024 "Iterative Site Selection").
 */
import { NextRequest, NextResponse } from 'next/server'
import { scoreAllKelurahan, DEFAULT_WEIGHTS, type ScoringWeights, type OpportunityScore } from '@/lib/scoring/engine'
import { buildScoringConfig } from '@/lib/scoring/db-engine'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('ab', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    const {
      config_a = {},
      config_b = {},
      brand_id,
      tier,
      limit = 20,
    } = body as {
      config_a?: Partial<ScoringWeights>
      config_b?: Partial<ScoringWeights>
      brand_id?: string
      tier?: 1 | 2 | 3
      limit?: number
    }

    const weightsA: ScoringWeights = { ...DEFAULT_WEIGHTS, ...config_a }
    const weightsB: ScoringWeights = { ...DEFAULT_WEIGHTS, ...config_b }

    // Verify weights sum to ~1.0 (warn but proceed)
    const sumA = Object.values(weightsA).reduce((a, b) => a + b, 0)
    const sumB = Object.values(weightsB).reduce((a, b) => a + b, 0)
    if (Math.abs(sumA - 1.0) > 0.05 || Math.abs(sumB - 1.0) > 0.05) {
      return NextResponse.json({
        success: false,
        error: `Weights must sum to ~1.0 (A=${sumA.toFixed(3)}, B=${sumB.toFixed(3)})`,
      }, { status: 400 })
    }

    // Load competitors from DB (Phase 2)
    const baseConfigA = await buildScoringConfig({ brand_id, weights: weightsA })
    const baseConfigB = await buildScoringConfig({ brand_id, weights: weightsB })

    let scoresA = scoreAllKelurahan(baseConfigA)
    let scoresB = scoreAllKelurahan(baseConfigB)

    if (tier) {
      scoresA = scoresA.filter(s => s.tier === tier)
      scoresB = scoresB.filter(s => s.tier === tier)
    }

    const topA = scoresA.slice(0, limit)
    const topB = scoresB.slice(0, limit)

    // Compute rank changes
    const rankMapA = new Map<string, number>()
    topA.forEach((s, i) => rankMapA.set(s.kelurahan_id, i + 1))
    const rankMapB = new Map<string, number>()
    topB.forEach((s, i) => rankMapB.set(s.kelurahan_id, i + 1))

    const newInTop = topB.filter(s => !rankMapA.has(s.kelurahan_id)).map(s => ({
      kelurahan_id: s.kelurahan_id,
      kelurahan_name: s.kelurahan_name,
      kab_name: s.kab_name,
      rank_in_b: rankMapB.get(s.kelurahan_id),
      composite_b: s.composite_score,
    }))

    const droppedFromTop = topA.filter(s => !rankMapB.has(s.kelurahan_id)).map(s => ({
      kelurahan_id: s.kelurahan_id,
      kelurahan_name: s.kelurahan_name,
      kab_name: s.kab_name,
      rank_in_a: rankMapA.get(s.kelurahan_id),
      composite_a: s.composite_score,
    }))

    const rankChanges = topB
      .filter(s => rankMapA.has(s.kelurahan_id))
      .map(s => ({
        kelurahan_id: s.kelurahan_id,
        kelurahan_name: s.kelurahan_name,
        rank_a: rankMapA.get(s.kelurahan_id)!,
        rank_b: rankMapB.get(s.kelurahan_id)!,
        delta: rankMapA.get(s.kelurahan_id)! - rankMapB.get(s.kelurahan_id)!, // positive = moved up
        composite_a: topA.find(a => a.kelurahan_id === s.kelurahan_id)?.composite_score ?? 0,
        composite_b: s.composite_score,
      }))
      .filter(c => c.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const statsA = computeStats(topA)
    const statsB = computeStats(topB)

    return NextResponse.json({
      success: true,
      weights_a: weightsA,
      weights_b: weightsB,
      a: { top: topA, stats: statsA },
      b: { top: topB, stats: statsB },
      diff: {
        new_in_top_b: newInTop,
        dropped_from_top_b: droppedFromTop,
        rank_changes: rankChanges.slice(0, 50),
        summary: {
          total_changes: rankChanges.length,
          biggest_winner: rankChanges[0] || null,
          biggest_loser: rankChanges[rankChanges.length - 1] || null,
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

function computeStats(scores: OpportunityScore[]) {
  if (scores.length === 0) {
    return { avg_score: 0, avg_revenue: 0, by_tier: {}, by_kab: {} }
  }
  const byTier: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const byKab: Record<string, number> = {}
  let totalScore = 0
  let totalRev = 0
  for (const s of scores) {
    byTier[s.tier] = (byTier[s.tier] || 0) + 1
    byKab[s.kab_name] = (byKab[s.kab_name] || 0) + 1
    totalScore += s.composite_score
    totalRev += s.projected_monthly_revenue_juta
  }
  return {
    avg_score: Math.round(totalScore / scores.length),
    avg_revenue: Math.round(totalRev / scores.length),
    by_tier: byTier,
    by_kab: byKab,
  }
}
