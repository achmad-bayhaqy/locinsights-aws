import { NextRequest, NextResponse } from 'next/server'
import { scoreKelurahan, type ScoringConfig, type CompetitorStoreLite } from '@/lib/scoring/engine'
import { approxTravelTimeMin } from '@/lib/scoring/engine'
import { getKelurahan, haversineKm } from '@/lib/data/bali-kelurahan'
import { BALI_STORES } from '@/lib/data/bali-stores'
import { BALI_MALLS } from '@/lib/data/bali-malls'
import { BALI_POIS } from '@/lib/data/bali-poi'
import { prisma } from '@/lib/db'
import { getKelurahanFromDB, loadStoresFromDB } from '@/lib/scoring/db-engine'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'

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

  // Nearby MAP stores (within 5km)
  const nearbyStores = BALI_STORES
    .map(s => ({ ...s, distance_km: haversineKm(kel.lat, kel.lng, s.lat, s.lng) }))
    .filter(s => s.distance_km <= 5)
    .sort((a, b) => a.distance_km - b.distance_km)

  // Nearby competitor stores (within 5km, Phase 2)
  const nearbyCompetitors = competitorRows
    .map(c => ({ ...c, distance_km: haversineKm(kel.lat, kel.lng, c.lat, c.lng) }))
    .filter(c => c.distance_km <= 5)
    .sort((a, b) => a.distance_km - b.distance_km)

  // Nearby malls (within 10km)
  const nearbyMalls = BALI_MALLS
    .map(m => ({ ...m, distance_km: haversineKm(kel.lat, kel.lng, m.lat, m.lng) }))
    .filter(m => m.distance_km <= 10)
    .sort((a, b) => a.distance_km - b.distance_km)

  // Nearby POIs (within 10km)
  const nearbyPOIs = BALI_POIS
    .map(p => ({ ...p, distance_km: haversineKm(kel.lat, kel.lng, p.lat, p.lng) }))
    .filter(p => p.distance_km <= 10)
    .sort((a, b) => a.distance_km - b.distance_km)

  // Phase 2: Travel-time isochrone polygon (approximation)
  // Generate 36-point polygon at N-minute drive from kelurahan centroid.
  // Road network friction derived from urban_index + tier.
  const isochrones = buildIsochrones(kel.lat, kel.lng, kel.tier, kel.urban_index)

  // Phase 3: ML revenue prediction (if model exists)
  let mlPrediction: { model_name: string; predicted_revenue_juta: number; confidence: number; top_features: { feature: string; contribution: number }[] } | null = null
  try {
    const mlResp = await fetch(`${req.nextUrl.origin}/api/locinsight/ml?action=predict_revenue&kelurahan_id=${kelurahanId}${brandId ? `&brand_id=${brandId}` : ''}`, {
      // avoid external HTTP call in dev
      // @ts-ignore
      next: { revalidate: 0 },
    })
    if (mlResp.ok) {
      const mlJson = await mlResp.json()
      if (mlJson.success) mlPrediction = mlJson.data
    }
  } catch {
    // swallow — ML prediction is optional
  }

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
