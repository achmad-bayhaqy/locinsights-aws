import { NextRequest, NextResponse } from 'next/server'
import { scoreKelurahan, type ScoringConfig, type CompetitorStoreLite } from '@/lib/scoring/engine'
import { getKelurahan, haversineKm } from '@/lib/data/bali-kelurahan'
import { BALI_STORES } from '@/lib/data/bali-stores'
import { BALI_MALLS } from '@/lib/data/bali-malls'
import { BALI_POIS } from '@/lib/data/bali-poi'
import { prisma } from '@/lib/db'
import { getKelurahanFromDB } from '@/lib/scoring/db-engine'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'
import { predictAndPersist } from '@/lib/ml/predict-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/locinsight/analyze?kelurahan_id=...&brand_id=...
 * Deep analysis of one kelurahan for one optional target brand.
 *
 * The kelurahan is resolved from the DB first (716 villages), falling back to
 * the static representative set (~220) for backwards compatibility. This fixes
 * the "kelurahan not found" error users hit when clicking DB-only villages on
 * the Map Explorer.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission('analysis', 'read')
  if (!auth.ok) return auth.response
  await setTenantContext(auth.session)

  const sp = req.nextUrl.searchParams
  const kelurahanId = sp.get('kelurahan_id')
  const brandId = sp.get('brand_id') || undefined

  if (!kelurahanId) {
    return NextResponse.json({ success: false, error: 'kelurahan_id is required' }, { status: 400 })
  }

  // Try DB first (real 716 villages), then static fallback (~220 representatives)
  let kel = await getKelurahanFromDB(kelurahanId)
  if (!kel) {
    kel = getKelurahan(kelurahanId) || null
  }
  if (!kel) {
    return NextResponse.json({ success: false, error: `kelurahan not found (id=${kelurahanId})` }, { status: 404 })
  }

  // Load competitor stores from DB (Phase 2) — tenant-scoped
  const competitorRows = await prisma.competitorStore.findMany({
    where: tenantFilter(auth.session),
    select: { brand_name: true, brand_category: true, lat: true, lng: true, name: true, mall_name: true },
  })
  const competitorStores: CompetitorStoreLite[] = competitorRows.map(r => ({
    brand_name: r.brand_name,
    brand_category: r.brand_category,
    lat: r.lat,
    lng: r.lng,
  }))

  const config: ScoringConfig = { brand_id: brandId, competitorStores, useTravelTime: true }
  const score = scoreKelurahan(kel, config)

  // Resolve tenant id for tenant-scoped raw SQL (superadmin platform-wide → null)
  const tenantWhere = tenantFilter(auth.session)
  const tenantId = (tenantWhere as { tenant_id?: string }).tenant_id ?? null

  // R3: nearby lists via PostGIS ST_DWithin pushdown (GiST-indexed) — works
  // for ALL provinces in the DB (2173 kelurahan), not only the static Bali set.
  // Static fallbacks are kept for resilience if the DB is unreachable.
  const [nearbyStores, nearbyCompetitors, nearbyMalls, nearbyPOIs] = await loadNearbyViaPostGIS(
    kel.lat, kel.lng, tenantId,
  )

  // Phase 2: Travel-time isochrone polygon (approximation)
  // Generate 36-point polygon at N-minute drive from kelurahan centroid.
  // Road network friction derived from urban_index + tier.
  const isochrones = buildIsochrones(kel.lat, kel.lng, kel.tier, kel.urban_index)

  // Phase 3: ML revenue prediction — R1a fix: direct in-process call instead
  // of a cookie-less self-fetch (which 401'd and silently null'd ml_prediction
  // in production). Also persists the prediction (R1c) for ground-truth (R4).
  const ml = await predictAndPersist(kelurahanId, brandId, { tenantId })
  const mlPrediction = ml.ok
    ? {
        model_name: ml.data!.model_name,
        predicted_revenue_juta: ml.data!.predicted_revenue_juta,
        confidence: ml.data!.confidence,
        top_features: ml.data!.top_features,
      }
    : null

  return NextResponse.json({
    success: true,
    data: {
      kelurahan: kel,
      score,
      nearby_stores: nearbyStores,
      nearby_competitors: nearbyCompetitors,
      nearby_malls: nearbyMalls,
      nearby_pois: nearbyPOIs,
      isochrones,
      ml_prediction: mlPrediction,
    },
  })
}

/**
 * Build travel-time isochrone polygons (5, 10, 15 min by motorbike).
 * Approximation: Haversine distance × friction factor by direction.
 * Friction lower along road-aligned axes (Bali roads run NNW-SSE along the island).
 */
function buildIsochrones(lat: number, lng: number, tier: 1 | 2 | 3, urbanIndex: number) {
  const minutes = [5, 10, 15]
  const speeds = { foot: 5, motorbike: 25, car: 35 } as const
  const baseFriction = tier === 1 ? 1.3 : tier === 2 ? 1.55 : 1.8
  // Adjust friction down a bit if urban area (denser road network = closer to straight-line)
  const friction = baseFriction * (1 - (urbanIndex / 100) * 0.15)
  const roadAlignmentDeg = 160 // NNW-SSE axis of Bali road network

  return minutes.map(min => {
    const points: { lat: number; lng: number }[] = []
    const maxKm = (speeds.motorbike / 60) * min / friction
    for (let i = 0; i < 36; i++) {
      const bearing = (i / 36) * 2 * Math.PI
      // Roads are denser along alignment axis → less friction → further reach
      const bearingDeg = (bearing * 180 / Math.PI) % 360
      const alignmentDelta = Math.abs(((bearingDeg - roadAlignmentDeg + 540) % 180) - 90) // 0 aligned, 90 perpendicular
      const alignmentFactor = 1 - (alignmentDelta / 90) * 0.35 // up to 35% reduction perpendicular
      const radius = maxKm * alignmentFactor
      const latOffset = (radius / 111) * Math.cos(bearing)
      const lngOffset = (radius / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(bearing)
      points.push({
        lat: lat + latOffset,
        lng: lng + lngOffset,
      })
    }
    return { minutes: min, mode: 'motorbike', points }
  })
}

/**
 * R3 — nearby stores / competitors / malls / POIs computed IN POSTGRES with
 * ST_DWithin + ST_Distance on the GiST-indexed geography columns. Replaces
 * the previous O(n) Haversine loops over static Bali-only arrays, so nearby
 * lists now work for Jabodetabek and all 38 provinces. Each list falls back
 * to the static computation when the DB returns nothing (resilience).
 */
async function loadNearbyViaPostGIS(
  lat: number, lng: number, tenantId: string | null,
): Promise<[any[], any[], any[], any[]]> {
  const point = `ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)::geography`
  // tenant_id bound as $1 parameter (no string interpolation of user data)
  const tenantClause = tenantId ? 'AND tenant_id = $1' : ''
  const args = tenantId ? [tenantId] : []

  try {
    const storesQ = `
      SELECT id, brand_id, brand_name, brand_category::text AS brand_category,
             parent::text AS parent, name, lat, lng, kec, kab,
             COALESCE(is_in_mall, false) AS is_in_mall, mall_id, mall_name,
             COALESCE(address, '') AS address, COALESCE(opened_year, 0) AS opened_year,
             COALESCE(confirmed, false) AS confirmed,
             ST_Distance(geom, ${point}) / 1000.0 AS distance_km
      FROM stores
      WHERE ST_DWithin(geom, ${point}, 5000) ${tenantClause}
      ORDER BY geom <-> ${point}
      LIMIT 25`
    const competitorsQ = `
      SELECT id, brand_name, brand_category::text AS brand_category, name,
             lat, lng, mall_name,
             ST_Distance(geom, ${point}) / 1000.0 AS distance_km
      FROM competitor_stores
      WHERE ST_DWithin(geom, ${point}, 5000) ${tenantClause}
      ORDER BY geom <-> ${point}
      LIMIT 25`
    const mallsQ = `
      SELECT id, name, lat, lng, kec, kab, COALESCE(gla_m2, 0) AS gla_m2,
             COALESCE(opened_year, 0) AS opened_year, class::text AS class,
             COALESCE(visitor_estimate_daily, 0) AS visitor_estimate_daily,
             ST_Distance(geom, ${point}) / 1000.0 AS distance_km
      FROM malls
      WHERE ST_DWithin(geom, ${point}, 10000) ${tenantClause}
      ORDER BY geom <-> ${point}
      LIMIT 25`
    const poisQ = `
      SELECT id, name, type::text AS type, lat, lng, kec, kab,
             COALESCE(magnitude, 0) AS magnitude, COALESCE(notes, '') AS notes,
             ST_Distance(geom, ${point}) / 1000.0 AS distance_km
      FROM pois
      WHERE ST_DWithin(geom, ${point}, 10000) ${tenantClause}
      ORDER BY geom <-> ${point}
      LIMIT 25`

    const [dbStores, dbCompetitors, dbMalls, dbPois] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(storesQ, ...args),
      prisma.$queryRawUnsafe<any[]>(competitorsQ, ...args),
      prisma.$queryRawUnsafe<any[]>(mallsQ, ...args),
      prisma.$queryRawUnsafe<any[]>(poisQ, ...args),
    ])

    const roundKm = (r: any) => ({ ...r, distance_km: Math.round(Number(r.distance_km) * 100) / 100 })

    const stores = dbStores.length > 0
      ? dbStores.map(roundKm)
      : BALI_STORES
          .map(s => ({ ...s, distance_km: haversineKm(lat, lng, s.lat, s.lng) }))
          .filter(s => s.distance_km <= 5)
          .sort((a, b) => a.distance_km - b.distance_km)

    const competitors = dbCompetitors.length > 0
      ? dbCompetitors.map(roundKm)
      : [] // competitor fallback requires the earlier DB fetch; empty is fine

    const malls = dbMalls.length > 0
      ? dbMalls.map(roundKm)
      : BALI_MALLS
          .map(m => ({ ...m, distance_km: haversineKm(lat, lng, m.lat, m.lng) }))
          .filter(m => m.distance_km <= 10)
          .sort((a, b) => a.distance_km - b.distance_km)

    const pois = dbPois.length > 0
      ? dbPois.map(roundKm)
      : BALI_POIS
          .map(p => ({ ...p, distance_km: haversineKm(lat, lng, p.lat, p.lng) }))
          .filter(p => p.distance_km <= 10)
          .sort((a, b) => a.distance_km - b.distance_km)

    return [stores, competitors, malls, pois]
  } catch {
    // PostGIS unavailable → legacy static behavior
    const stores = BALI_STORES
      .map(s => ({ ...s, distance_km: haversineKm(lat, lng, s.lat, s.lng) }))
      .filter(s => s.distance_km <= 5)
      .sort((a, b) => a.distance_km - b.distance_km)
    const malls = BALI_MALLS
      .map(m => ({ ...m, distance_km: haversineKm(lat, lng, m.lat, m.lng) }))
      .filter(m => m.distance_km <= 10)
      .sort((a, b) => a.distance_km - b.distance_km)
    const pois = BALI_POIS
      .map(p => ({ ...p, distance_km: haversineKm(lat, lng, p.lat, p.lng) }))
      .filter(p => p.distance_km <= 10)
      .sort((a, b) => a.distance_km - b.distance_km)
    return [stores, [], malls, pois]
  }
}
