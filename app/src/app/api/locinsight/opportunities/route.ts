import { NextRequest, NextResponse } from 'next/server'
import { getTopOpportunities, type ScoringConfig, type ScoringWeights, DEFAULT_WEIGHTS } from '@/lib/scoring/engine'
import { buildScoringConfig, loadKelurahanFromDB } from '@/lib/scoring/db-engine'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/locinsight/opportunities?brand_id=&tier=&limit=&min_score=&useTravelTime=
 *      &w_market=&w_access=&w_foot=&w_comp=&w_soc=&w_synergy=
 * Returns sorted list of expansion opportunities. Supports custom weights (Phase 2 A/B).
 *
 * Phase 5 update: Uses DB-loaded 716 real villages (with migration 0009 demographic indices)
 * instead of static BALI_KELURAHAN (~161 fake villages).
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission('opportunities', 'read')
  if (!auth.ok) return auth.response
  await setTenantContext(auth.session)

  const sp = req.nextUrl.searchParams
  const brandId = sp.get('brand_id') || undefined
  const tier = sp.get('tier') ? Number(sp.get('tier')) as 1 | 2 | 3 : undefined
  const limit = Number(sp.get('limit') || 100)
  const minScore = Number(sp.get('min_score') || 0)
  const useTravelTime = sp.get('useTravelTime') !== 'false'

  // Optional custom weights (Phase 2 A/B test feature)
  const customWeights: Partial<ScoringWeights> = {}
  const wKeys: (keyof ScoringWeights)[] = ['market_potential', 'accessibility', 'foot_traffic', 'competition', 'socioeconomic', 'network_synergy']
  const wParams: Record<keyof ScoringWeights, string> = {
    market_potential: 'w_market',
    accessibility: 'w_access',
    foot_traffic: 'w_foot',
    competition: 'w_comp',
    socioeconomic: 'w_soc',
    network_synergy: 'w_synergy',
  }
  let hasCustomWeights = false
  for (const k of wKeys) {
    const v = sp.get(wParams[k])
    if (v !== null) {
      const num = Number(v)
      if (!Number.isNaN(num) && num >= 0 && num <= 1) {
        customWeights[k] = num
        hasCustomWeights = true
      }
    }
  }

  const kelurahanList = await loadKelurahanFromDB()
  const baseConfig: ScoringConfig = {
    brand_id: brandId,
    weights: hasCustomWeights ? customWeights : undefined,
    kelurahanList,
  }
  const config = await buildScoringConfig(baseConfig, { useTravelTime })

  let opps = getTopOpportunities(limit, config, tier)
  if (minScore > 0) opps = opps.filter(o => o.composite_score >= minScore)

  return NextResponse.json({
    success: true,
    filter: { brand_id: brandId || null, tier: tier || null, limit, min_score: minScore, useTravelTime, custom_weights: hasCustomWeights ? customWeights : null, default_weights: DEFAULT_WEIGHTS },
    count: opps.length,
    data: opps,
  })
}
