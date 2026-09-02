/**
 * Mall Tenant Directory — Phase 3.
 *
 * GET /api/locinsight/mall-tenants — list tenants (optionally filter by mall_id)
 * POST /api/locinsight/mall-tenants — scrape tenants for a given mall (uses Nominatim/Overpass)
 *   body: { mall_id, mall_name, lat, lng, radius_km? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { haversineKm } from '@/lib/data/bali-kelurahan'
import { BRANDS } from '@/lib/data/brands'
import { COMPETITOR_BRANDS } from '@/lib/data/competitor-brands'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const USER_AGENT = 'LocInsights/1.0 (MAP Active Adiperkasa Data Team)'

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function runOverpass(query: string): Promise<OverpassElement[]> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue
      const data = await res.json() as { elements: OverpassElement[] }
      return data.elements || []
    } catch (e) {
      console.warn(`Overpass ${endpoint} failed:`, e)
    }
  }
  return []
}

function classifyBrand(name: string): { brand_name: string; brand_category: string; is_map: boolean; is_competitor: boolean } | null {
  const lower = name.toLowerCase()
  // Check MAP/MAA brands
  for (const b of BRANDS) {
    if (lower.includes(b.name.toLowerCase())) {
      return { brand_name: b.name, brand_category: b.category, is_map: true, is_competitor: false }
    }
  }
  // Check competitor brands
  for (const c of COMPETITOR_BRANDS) {
    if (lower.includes(c.name.toLowerCase())) {
      return { brand_name: c.name, brand_category: c.category, is_map: false, is_competitor: true }
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('mall_tenants', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const mallId = sp.get('mall_id')
    const mallName = sp.get('mall_name')
    const onlyMap = sp.get('only_map') === 'true'

    const where: any = { ...tenantFilter(auth.session) }
    if (mallId) where.mall_id = mallId
    if (mallName) where.mall_name = mallName
    if (onlyMap) where.is_map_brand = true

    const tenants = await prisma.mallTenant.findMany({
      where,
      orderBy: [{ is_map_brand: 'desc' }, { brand_name: 'asc' }],
      take: 500,
    })

    return NextResponse.json({
      success: true,
      count: tenants.length,
      data: tenants,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('mall_tenants', 'create')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    const { mall_id, mall_name, lat, lng, radius_km = 0.8 } = body

    if (!mall_name || lat == null || lng == null) {
      return NextResponse.json({
        success: false,
        error: 'mall_name, lat, lng are required',
      }, { status: 400 })
    }

    // Build Overpass query for shops + amenities within mall bbox.
    // Default radius 800m (was 500m) — Bali malls have shops tagged across a
    // wider area and 500m frequently returned zero results.
    const r = Math.max(0.3, Math.min(2.0, Number(radius_km) || 0.8))
    const dLat = r / 111
    const dLng = r / (111 * Math.cos((lat * Math.PI) / 180))
    const bbox = `${lat - dLat},${lng - dLng},${lat + dLat},${lng + dLng}`
    const query = `[out:json][timeout:25];(
      node["shop"](${bbox});
      way["shop"](${bbox});
      node["amenity"~"cafe|restaurant|fast_food|bar|pub|pharmacy|bank|cinema"](${bbox});
      way["amenity"~"cafe|restaurant|fast_food|bar|pub|pharmacy|bank|cinema"](${bbox});
    );out center 200;`

    const elements = await runOverpass(query)

    // If Overpass returned nothing, return a clear error to the user instead
    // of silently wiping existing tenants.
    if (elements.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Overpass API returned 0 elements. The mall bbox may have no OSM shops tagged, or the Overpass endpoint is temporarily unavailable. Existing tenants were NOT modified.',
        mall_id: mall_id || null,
        mall_name,
        total_found: 0,
      }, { status: 502 })
    }

    // Classify each into MAP brand / competitor / unknown
    const found: {
      brand_name: string
      brand_category: string
      is_map_brand: boolean
      is_competitor: boolean
      outlet_name: string
      category: string
      distance_m: number
    }[] = []

    for (const el of elements) {
      const elat = el.lat ?? el.center?.lat
      const elng = el.lon ?? el.center?.lon
      if (elat == null || elng == null) continue
      const tags = el.tags || {}
      const name = tags.name || tags.brand || ''
      if (!name) continue

      const distance_m = haversineKm(lat, lng, elat, elng) * 1000

      const classification = classifyBrand(name)
      if (classification) {
        found.push({
          brand_name: classification.brand_name,
          brand_category: classification.brand_category,
          is_map_brand: classification.is_map,
          is_competitor: classification.is_competitor,
          outlet_name: name,
          category: tags.shop || tags.amenity || '',
          distance_m: Math.round(distance_m),
        })
      }
    }

    // Dedupe by brand_name + outlet_name
    const seen = new Set<string>()
    const deduped = found.filter(t => {
      const key = `${t.brand_name}_${t.outlet_name}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Safety net: if classification found zero MAP/competitor brands, do NOT
    // wipe existing tenants — return informational response instead.
    if (deduped.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Overpass returned ${elements.length} shop elements but none matched a known MAP or competitor brand. Existing tenants were NOT modified. Try increasing radius_km or adding brands to the BRANDS / COMPETITOR_BRANDS lists.`,
        mall_id: mall_id || null,
        mall_name,
        elements_fetched: elements.length,
        total_found: 0,
      }, { status: 422 })
    }

    // Persist to DB (replace existing tenants for this mall) — only AFTER we
    // know we have at least one valid new tenant. Scoped to current tenant
    // so we don't wipe another tenant's mall_tenants.
    if (mall_id) {
      await prisma.mallTenant.deleteMany({ where: { mall_id, ...tenantFilter(auth.session) } })
    } else {
      await prisma.mallTenant.deleteMany({ where: { mall_name, ...tenantFilter(auth.session) } })
    }

    for (const t of deduped) {
      try {
        await prisma.mallTenant.create({
          data: withTenantId(auth.session, {
            mall_id: mall_id || null,
            mall_name,
            brand_name: t.brand_name,
            brand_category: (t.brand_category as any) || null,
            is_map_brand: t.is_map_brand,
            is_competitor: t.is_competitor,
            category: t.category,
            source: 'osm' as any,
          }),
        })
      } catch (createErr) {
        // Log per-row errors but continue — partial persistence is better than
        // total failure when the user has just waited for Overpass.
        console.warn('mallTenant.create failed:', createErr)
      }
    }

    return NextResponse.json({
      success: true,
      mall_id: mall_id || null,
      mall_name,
      total_found: deduped.length,
      map_brands_found: deduped.filter(t => t.is_map_brand).length,
      competitor_brands_found: deduped.filter(t => t.is_competitor).length,
      data: deduped,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 })
  }
}
