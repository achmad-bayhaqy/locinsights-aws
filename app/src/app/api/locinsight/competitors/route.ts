import { NextRequest, NextResponse } from 'next/server'
import { db, paginate, handleError } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

/**
 * Deduplicate competitor outlets that share the same brand AND the same
 * physical location (within ~11m). The scraper historically created
 * synthetic numbered siblings (e.g. "Indomaret - 1", "Indomaret - 2") at
 * identical coordinates — these are visually duplicate rows in the UI.
 *
 * Strategy: round lat/lng to 4 decimal places (~11m precision) and keep only
 * the first row per (brand_name, lat_rounded, lng_rounded) tuple. We keep the
 * row with the shortest outlet name as the canonical one (so "Indomaret"
 * wins over "Indomaret - 1").
 */
function dedupeCompetitors(rows: any[]): any[] {
  const seen = new Map<string, any>()
  for (const r of rows) {
    const lat = typeof r.lat === 'object' ? parseFloat(String(r.lat)) : Number(r.lat)
    const lng = typeof r.lng === 'object' ? parseFloat(String(r.lng)) : Number(r.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      // Keep rows without valid coords as-is (separate key)
      const k = `${r.brand_name || ''}__nocoord__${r.id}`
      if (!seen.has(k)) seen.set(k, r)
      continue
    }
    const key = `${r.brand_name || ''}__${lat.toFixed(4)}__${lng.toFixed(4)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, r)
    } else {
      // Prefer the row with the shorter outlet name (less likely to be the
      // synthetic numbered sibling)
      const aName = String(existing.name || '')
      const bName = String(r.name || '')
      if (bName.length < aName.length) seen.set(key, r)
    }
  }
  return Array.from(seen.values())
}

/**
 * GET /api/locinsight/competitors
 *
 * Query params:
 *   - paginated (default)   — page=1&page_size=50 (max 200) + optional search, kab, brand_name, brand_category
 *   - ?all=true              — returns up to 5000 rows in a single response (for analytics views)
 *   - ?dedupe=true (default) — strips duplicate outlets at the same lat/lng/brand
 *
 * Response (paginated): { success, data[], total, page, page_size, total_pages }
 * Response (?all=true): { success, data[], count }
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('competitors', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const kab = sp.get('kab')
    const brand = sp.get('brand_name')
    const category = sp.get('brand_category')
    const all = sp.get('all') === 'true'
    const dedupe = sp.get('dedupe') !== 'false' // default: dedupe ON

    const where: any = { ...tenantFilter(auth.session) }
    if (kab) where.kab = kab
    if (brand) where.brand_name = brand
    if (category) where.brand_category = category

    if (all) {
      // Single-shot full fetch for the Competitor Intel summary view.
      // Capped at 5000 to protect memory; for larger workloads use pagination.
      let data = await db.competitorStore.findMany({
        where,
        orderBy: [{ kab: 'asc' }, { brand_name: 'asc' }],
        take: 5000,
      })
      // Normalize Decimal/enum fields
      data = data.map(r => ({
        ...r,
        lat: typeof r.lat === 'object' ? parseFloat(String(r.lat)) : r.lat,
        lng: typeof r.lng === 'object' ? parseFloat(String(r.lng)) : r.lng,
      }))
      if (dedupe) {
        const before = data.length
        data = dedupeCompetitors(data)
        return NextResponse.json({
          success: true,
          data,
          count: data.length,
          deduped_from: before,
          dedupe_applied: before !== data.length,
        })
      }
      return NextResponse.json({ success: true, data, count: data.length })
    }

    return paginate(db.competitorStore, req, {
      where,
      orderBy: [{ kab: 'asc' }, { brand_name: 'asc' }],
      search: { fields: ['name', 'brand_name', 'address', 'kec', 'kab'], term },
    })
  } catch (e) {
    return handleError(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('competitors', 'create')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    delete body.tenant_id
    const competitor = await db.competitorStore.create({ data: withTenantId(auth.session, body) })
    return NextResponse.json({ success: true, data: competitor }, { status: 201 })
  } catch (e) {
    return handleError(e)
  }
}
