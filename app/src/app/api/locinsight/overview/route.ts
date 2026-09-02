import { NextRequest, NextResponse } from 'next/server'
import { getDashboardStats, getTopOpportunities } from '@/lib/scoring/engine'
import { BALI_STORES } from '@/lib/data/bali-stores'
import { BALI_MALLS } from '@/lib/data/bali-malls'
import { BALI_KELURAHAN } from '@/lib/data/bali-kelurahan'
import { BRANDS } from '@/lib/data/brands'
import { BALI_POIS } from '@/lib/data/bali-poi'
import { loadCompetitorStores, loadStoresFromDB, loadKelurahanFromDB } from '@/lib/scoring/db-engine'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/locinsight/overview
 * Returns dashboard overview data: stats, top opportunities, store list, mall list, kelurahan list, brand list, POIs
 *
 * Phase 4 update: Now loads stores + competitor_stores + kelurahan from DB (Supabase)
 * instead of static BALI_STORES / BALI_KELURAHAN. Falls back to static data if DB is unavailable.
 *
 * Phase 5 (migration 0009): All 716 real villages now have backfilled demographic indices
 * (income, urban, tourist, transport, poi_density, coastal) — opportunity scoring uses these.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('dashboard', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const searchParams = req.nextUrl.searchParams
    const brandId = searchParams.get('brand_id') || undefined
    const tierFilter = searchParams.get('tier') ? Number(searchParams.get('tier')) as 1 | 2 | 3 : undefined

    // Phase 2 + 5: load competitor + kelurahan + stores from DB in parallel.
    // NOTE: loadCompetitorStores / loadStoresFromDB use a process-wide cache
    // (60s TTL). The RLS context set above will protect DB queries when the
    // cache misses, but cached results from another tenant could bleed
    // through within the TTL window. Acceptable for v1 (single-tenant
    // deployment is the common case); for true multi-tenant isolation, the
    // cache should be keyed by tenant_id in a future iteration.
    const [competitors, dbStores, dbKelurahan] = await Promise.all([
      loadCompetitorStores(),
      loadStoresFromDB().catch((e) => {
        console.warn('[overview] DB stores load failed, falling back to static:', e)
        return [] as any[]
      }),
      loadKelurahanFromDB(),
    ])

    // Use DB stores if available, otherwise static
    const storesSource = dbStores.length > 0 ? dbStores : BALI_STORES
    const kelurahanSource = dbKelurahan.length > 0 ? dbKelurahan : BALI_KELURAHAN

    const stats = getDashboardStats(competitors, storesSource, kelurahanSource)
    // Per user request (Aug 2026): "All Indicators — Combined Table" should
    // show ALL kelurahan rows, not just the top 100. Bali has ~716 kelurahan,
    // so we pass a large limit (9999) — getTopOpportunities slices to N, but
    // any number larger than the dataset effectively returns everything.
    // The function still sorts by composite_score desc, so the dashboard's
    // top-opportunities list (which uses data.top_opportunities[0]) keeps the
    // highest-scoring kelurahan at the top.
    const topOpps = getTopOpportunities(9999, {
      brand_id: brandId,
      competitorStores: competitors,
      kelurahanList: kelurahanSource,
      useTravelTime: true,
    }, tierFilter)

    // Phase 3: count of field surveys + training runs (tenant-scoped).
    // Include NULL tenant_id (system) rows alongside the current tenant's.
    const tf = tenantFilter(auth.session)
    const tenantClause = Object.keys(tf).length > 0
      ? { OR: [{ tenant_id: null }, tf] }
      : {}

    const [pendingSurveys, latestTrainingRun, competitorBrands] = await Promise.all([
      prisma.fieldSurvey.count({
        where: { review_status: 'pending', ...tenantClause },
      }).catch(() => 0),
      prisma.trainingRun.findFirst({
        where: tenantClause,
        orderBy: { started_at: 'desc' },
      }).catch(() => null),
      prisma.competitorStore.groupBy({
        by: ['brand_name'],
        _count: true,
        orderBy: { _count: { brand_name: 'desc' } },
        where: tf,
      }).catch(() => []),
    ])

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      data: {
        stats,
        top_opportunities: topOpps,
        phase_2_3: {
          pending_field_surveys: pendingSurveys,
          latest_training_run: latestTrainingRun ? {
            id: latestTrainingRun.id,
            model_name: latestTrainingRun.model_name,
            status: latestTrainingRun.status,
            started_at: latestTrainingRun.started_at,
            metrics: latestTrainingRun.metrics,
          } : null,
          competitor_brand_counts: competitorBrands.map((b: any) => ({ brand: b.brand_name, count: b._count?.brand_name ?? b._count ?? 0 })),
        },
        stores: storesSource.map(s => ({
          id: s.id,
          brand_id: s.brand_id,
          brand_name: s.brand_name,
          brand_category: s.brand_category,
          parent: s.parent,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          kec: s.kec,
          kab: s.kab,
          is_in_mall: s.is_in_mall,
          mall_id: s.mall_id,
          mall_name: s.mall_name,
          address: s.address,
          opened_year: s.opened_year,
          confirmed: s.confirmed,
        })),
        malls: BALI_MALLS.map(m => ({
          id: m.id,
          name: m.name,
          lat: m.lat,
          lng: m.lng,
          kec: m.kec,
          kab: m.kab,
          gla_m2: m.gla_m2,
          opened_year: m.opened_year,
          class: m.class,
          visitor_estimate_daily: m.visitor_estimate_daily,
        })),
        kelurahan: kelurahanSource.map(k => ({
          id: k.id,
          name: k.name,
          kec_code: k.kec_code,
          kec_name: k.kec_name,
          kab_code: k.kab_code,
          kab_name: k.kab_name,
          tier: k.tier,
          lat: k.lat,
          lng: k.lng,
          population: k.population,
          area_km2: k.area_km2,
          density: k.density,
          urban_index: k.urban_index,
          income_index: k.income_index,
          tourist_index: k.tourist_index,
          transport_index: k.transport_index,
          poi_density_index: k.poi_density_index,
          is_coastal: k.is_coastal,
        })),
        brands: BRANDS.map(b => ({
          id: b.id,
          name: b.name,
          parent: b.parent,
          category: b.category,
          origin_country: b.origin_country,
          format: b.format,
          location_preference: b.location_preference,
          typical_size_m2: b.typical_size_m2,
          target_audience: b.target_audience,
          price_segment: b.price_segment,
          brand_strength: b.brand_strength,
          notes: b.notes,
        })),
        pois: BALI_POIS.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          lat: p.lat,
          lng: p.lng,
          kec: p.kec,
          kab: p.kab,
          magnitude: p.magnitude,
          notes: p.notes,
        })),
      },
    })
  } catch (e: any) {
    console.error('[overview] Error:', e)
    return NextResponse.json({
      success: false,
      error: e.message || 'Internal server error',
      code: e.code || 'UNKNOWN',
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
    }, { status: 500 })
  }
}
