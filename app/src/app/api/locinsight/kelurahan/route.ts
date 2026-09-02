import { NextRequest, NextResponse } from 'next/server'
import { db, paginate, handleError } from '@/lib/api-helpers'
import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

// GET is public (no auth) — kelurahan are shared reference data.
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const kab = sp.get('kab')
    const tier = sp.get('tier')
    const all = sp.get('all') === 'true'

    const where: any = {}
    if (kab) where.kab_name = kab
    // Tier is an enum (tier_1, tier_2, tier_3). Accept both "1" and "tier_1".
    if (tier) {
      const tierMap: Record<string, string> = { '1': 'tier_1', '2': 'tier_2', '3': 'tier_3' }
      where.tier = tierMap[tier] || tier
    }

    if (all) {
      // Single-shot full fetch for map layers (income heatmap, etc.)
      const data = await db.kelurahan.findMany({
        where,
        orderBy: { id: 'asc' },
        take: 5000,
      })
      return NextResponse.json({ success: true, data, count: data.length })
    }

    return paginate(db.kelurahan, req, {
      where,
      orderBy: { id: 'asc' },
      search: { fields: ['name', 'kec_name', 'kab_name'], term },
    })
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const k = await db.kelurahan.create({ data: body })
    return NextResponse.json({ success: true, data: k }, { status: 201 })
  } catch (e) { return handleError(e) }
}
