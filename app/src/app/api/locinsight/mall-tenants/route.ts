/**
 * Mall Tenant Directory — Phase 3.
 *
 * GET /api/locinsight/mall-tenants — list tenants (optionally filter by mall_id)
 * POST /api/locinsight/mall-tenants — scrape tenants for a given mall (uses Nominatim/Overpass)
 *   body: { mall_id, mall_name, lat, lng, radius_km? }
 *
 * Task 10-a fixes:
 *   - Shared multi-endpoint Overpass failover (overpass-api.de, kumi.systems,
 *     maps.mail.ru) with per-attempt AbortController timeouts.
 *   - TIERED fallback queries: the simple `shop=*` bbox query frequently
 *     returns 0 elements because tenants are mapped as MEMBERS of the mall
 *     polygon (shop=mall / building=retail / shop=department_store /
 *     landuse=retail) instead of as tagged nodes/ways. We now recurse into
 *     those containers (`(._;>;)` → member nodes) tier by tier.
 *   - If everything still returns 0 elements, we return a CLEAR JSON error
 *     (with suggestions) — never an HTML page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { haversineKm } from '@/lib/data/bali-kelurahan'
import { BRANDS } from '@/lib/data/brands'
import { COMPETITOR_BRANDS } from '@/lib/data/competitor-brands'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'
import { runOverpass, dedupeOverpassElements, elementCoords, type OverpassElement } from '@/lib/overpass'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Wall-clock budget for the whole scrape — stay under the 60s function/ALB limit. */
const SCRAPE_BUDGET_MS = 45_000
/** Skip the next tier when less than this much budget is left. */
const MIN_TIER_BUDGET_MS = 10_000

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

// ============================================================================
// TIERED OVERPASS QUERIES — tenant tags first, then mall containers + members
// ============================================================================

interface Tier {
  /** What this tier looks for (used in error messages). */
  label: string
  /** Overpass QL query body (without [out:json] wrapper). */
  query: string
}

function buildTiers(bbox: string): Tier[] {
  // Tier 0 — tenants tagged directly as nodes/ways in the bbox (original query).
  const tenantTags = `(
      nwr["shop"](${bbox});
      nwr["amenity"~"cafe|restaurant|fast_food|bar|pub|pharmacy|bank|cinema|ice_cream|food_court"](${bbox});
    );out center 250;`

  // Container tiers — find the mall structure itself, then pull its named
  // members (`node(w.c)` / `node(r.c)` / `way(r.c)` / `relation(r.c)`) to
  // catch tenants mapped as members of the mall polygon instead of as
  // independent POIs. Only named members are returned, so polygon corner
  // nodes can't crowd real tenants out of the output cap.
  // (Syntax verified live against Overpass 0.7.62: `( .c; >; );` and
  // `nwr(._)["name"]` are NOT valid QL — member filters are.)
  const containerTier = (selector: string): string =>
    `(
      nwr[${selector}](${bbox});
    )->.c;
    (
      node(w.c)["name"];
      node(r.c)["name"];
      way(r.c)["name"];
      relation(r.c)["name"];
    );
    out center 500;`

  return [
    // (a) direct tenant tags
    { label: 'tenant shop/amenity tags', query: tenantTags },
    // (b) shop=mall → members
    { label: 'shop=mall members', query: containerTier('"shop"="mall"') },
    // (c) building=retail + name → members
    { label: 'building=retail members', query: containerTier('"building"="retail"]["name"') },
    // (d) shop=department_store → members
    { label: 'shop=department_store members', query: containerTier('"shop"="department_store"') },
    // (e) landuse=retail + name → members
    { label: 'landuse=retail members', query: containerTier('"landuse"="retail"]["name"') },
  ]
}

/**
 * Container tags identify the mall structure itself (not a tenant).
 * A tier that only surfaced the mall's own polygon must not stop the search —
 * we keep going into member recursion to find the actual tenants.
 */
function isContainerTag(tags: Record<string, string>): boolean {
  return (
    tags.shop === 'mall' ||
    tags.shop === 'department_store' ||
    tags.building === 'retail' ||
    tags.landuse === 'retail'
  )
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const auth2 = await requirePermission('mall_tenants', 'read')
    if (!auth2.ok) return auth2.response
    await setTenantContext(auth2.session)

    const sp = req.nextUrl.searchParams
    const mallId = sp.get('mall_id')
    const mallName = sp.get('mall_name')
    const onlyMap = sp.get('only_map') === 'true'

    const where: any = { ...tenantFilter(auth2.session) }
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
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Whole handler wrapped so every failure path returns JSON (Task 10-a).
  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const auth2 = await requirePermission('mall_tenants', 'create')
    if (!auth2.ok) return auth2.response
    await setTenantContext(auth2.session)

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    const { mall_id, mall_name, lat, lng, radius_km = 0.8 } = body

    if (!mall_name || lat == null || lng == null) {
      return NextResponse.json({
        success: false,
        error: 'mall_name, lat, lng are required',
      }, { status: 400 })
    }

    // Mall bbox. Default radius 800m (was 500m) — Bali malls have shops tagged
    // across a wider area and 500m frequently returned zero results.
    const r = Math.max(0.3, Math.min(2.0, Number(radius_km) || 0.8))
    const dLat = r / 111
    const dLng = r / (111 * Math.cos((lat * Math.PI) / 180))
    const bbox = `${lat - dLat},${lng - dLng},${lat + dLat},${lng + dLng}`

    // Run the tiered queries within the time budget.
    const startedAt = Date.now()
    const tiers = buildTiers(bbox)
    const attemptedTiers: string[] = []
    const collected: OverpassElement[] = []
    let firstSuccessEndpoint: string | null = null
    let allTierFailures: string[] = []
    let anyTierSucceeded = false

    for (const tier of tiers) {
      const elapsed = Date.now() - startedAt
      if (attemptedTiers.length > 0 && (elapsed > SCRAPE_BUDGET_MS || SCRAPE_BUDGET_MS - elapsed < MIN_TIER_BUDGET_MS)) {
        break
      }
      attemptedTiers.push(tier.label)
      const result = await runOverpass(`[out:json][timeout:20];${tier.query}`, { timeoutMs: 20_000 })
      if (result.failed) {
        allTierFailures = result.errors
        continue
      }
      anyTierSucceeded = true
      if (firstSuccessEndpoint === null && result.endpoint) firstSuccessEndpoint = result.endpoint
      if (result.elements.length > 0) {
        collected.push(...result.elements)
        // Stop early once we have at least one NAMED, non-container element
        // (a real tenant). Only surfacing the mall's own polygon means the
        // tenants are mapped as members — continue to the container tiers.
        const hasNamedTenant = collected.some(el => {
          const t = el.tags || {}
          return !!(t.name || t.brand) && !isContainerTag(t) && !!elementCoords(el)
        })
        if (hasNamedTenant) break
      }
    }

    // Keep only named elements inside a sane distance of the mall center.
    const radiusCapM = r * 1000 * 1.5
    const candidates = dedupeOverpassElements(collected).filter(el => {
      const tags = el.tags || {}
      if (!tags.name && !tags.brand) return false
      const c = elementCoords(el)
      if (!c) return false
      return haversineKm(lat, lng, c.lat, c.lng) * 1000 <= radiusCapM
    })

    // If Overpass returned nothing at all, return a clear, actionable JSON
    // error instead of silently wiping existing tenants (Task 10-a bug 3).
    if (candidates.length === 0) {
      if (!anyTierSucceeded) {
        // Every endpoint failed on every tier — outage / rate-limiting.
        return NextResponse.json({
          success: false,
          error: `Overpass API is temporarily unavailable — all ${attemptedTiers.length || 1} query tier(s) failed on every mirror. Details: ${allTierFailures.join(' | ') || 'all endpoints failed'}. Existing tenants were NOT modified. Please retry in a few minutes.`,
          mall_id: mall_id || null,
          mall_name,
          total_found: 0,
        }, { status: 502 })
      }
      return NextResponse.json({
        success: false,
        error: `Overpass API returned 0 usable elements (tried ${attemptedTiers.length} query tiers: ${attemptedTiers.join(' → ')}, endpoint: ${firstSuccessEndpoint || 'n/a'}). The mall bbox may have no OSM shops tagged, the mall coordinates may be off, or the radius_km may be too small. Suggestions: increase radius_km (e.g. 1.5), verify the mall's lat/lng, add the tenants to OSM, or enter them manually. Existing tenants were NOT modified.`,
        mall_id: mall_id || null,
        mall_name,
        tiers_attempted: attemptedTiers,
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

    for (const el of candidates) {
      const c = elementCoords(el)
      if (!c) continue
      const tags = el.tags || {}
      const name = tags.name || tags.brand || ''
      if (!name) continue

      const distance_m = haversineKm(lat, lng, c.lat, c.lng) * 1000

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
        error: `Overpass returned ${candidates.length} named shop elements (tiers: ${attemptedTiers.join(' → ')}) but none matched a known MAP or competitor brand. Existing tenants were NOT modified. Try increasing radius_km or adding brands to the BRANDS / COMPETITOR_BRANDS lists.`,
        mall_id: mall_id || null,
        mall_name,
        elements_fetched: candidates.length,
        total_found: 0,
      }, { status: 422 })
    }

    // Persist to DB (replace existing tenants for this mall) — only AFTER we
    // know we have at least one valid new tenant. Scoped to current tenant
    // so we don't wipe another tenant's mall_tenants.
    if (mall_id) {
      await prisma.mallTenant.deleteMany({ where: { mall_id, ...tenantFilter(auth2.session) } })
    } else {
      await prisma.mallTenant.deleteMany({ where: { mall_name, ...tenantFilter(auth2.session) } })
    }

    for (const t of deduped) {
      try {
        await prisma.mallTenant.create({
          data: withTenantId(auth2.session, {
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
      tiers_attempted: attemptedTiers,
      data: deduped,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 })
  }
}
