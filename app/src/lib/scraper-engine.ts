/**
 * Unified Scraper Engine — shared by /api/locinsight/scrape (keyword mode)
 * and /api/locinsight/scrape-competitors (brand sweep mode).
 *
 * KEY FIX (vs. old /scrape route):
 *   - The old route called db.kelurahan.findMany() INSIDE the per-result loop,
 *     which caused FUNCTION_INVOCATION_TIMEOUT on Vercel (200 results × 50ms = 10s
 *     just for geocoding, plus Overpass time = >60s).
 *   - This engine loads the kelurahan cache ONCE per request and reuses it
 *     for all reverse-geocoding calls (same pattern as the working competitor scraper).
 *
 * Two scrape modes:
 *   1. keyword  — free-text query (e.g., "Starbucks Kuta") → Nominatim geocode → bbox Overpass
 *   2. brand    — predefined brand catalog → full Bali bbox Overpass (one query per brand)
 *
 * Both modes accept an optional `location` filter (kab_code/kec_code/kel_code) that
 * narrows the scrape bbox to a specific kabupaten / kecamatan / kelurahan.
 *
 * Sources:
 *   - Nominatim: https://nominatim.openstreetmap.org/search (1 req/sec, valid UA,
 *     AbortController timeout, addressdetails for admin-boundary scoping)
 *   - Overpass:  multi-endpoint failover via @/lib/overpass
 *                (overpass-api.de + kumi.systems + maps.mail.ru)
 */

import { db } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { isOnBaliLand } from '@/lib/data/bali-land'
import { haversineKm } from '@/lib/data/bali-kelurahan'
import { COMPETITOR_BRANDS } from '@/lib/data/competitor-brands'
import type { ScraperResultRow, GeocodedResult } from '@/lib/scraper-types'
import {
  runOverpass,
  elementCoords,
  type OverpassElement,
} from '@/lib/overpass'

const USER_AGENT = 'LocInsights/1.0 (MAP Active Adiperkasa Data Team)'

/**
 * Internal wall-clock budget for one scrape request.
 *
 * The route runs with maxDuration=60 and the ALB idles out at ~60s; when the
 * scraper exceeds it, the gateway returns an HTML 504 page which the client
 * chokes on ("Unexpected token '<'"). We now stop work gracefully at 45s and
 * return whatever was collected as JSON instead.
 */
const SCRAPE_BUDGET_MS = 45_000

// ============================================================================
// TYPES
// ============================================================================

export type ScrapeMode = 'keyword' | 'brand'
export type ItemKind = 'store' | 'mall' | 'poi'

export interface LocationFilter {
  country_id?: string
  province_code?: string
  kab_code?: string
  kec_code?: string
  kel_code?: string
}

export interface ScrapeRequest {
  mode: ScrapeMode
  query?: string           // required for mode='keyword'
  brands?: string[]        // optional for mode='brand' (defaults to all)
  kinds?: ItemKind[]       // for mode='keyword': which kinds to scrape
  radius_km?: number       // for mode='keyword' when no kelurahan is selected
  location?: LocationFilter
}

export interface ScrapeOutput {
  geocoded?: GeocodedResult
  used_fallback: boolean
  source: 'nominatim' | 'overpass'
  results: ScraperResultRow[]
  meta: {
    mode: ScrapeMode
    location_label: string
    bbox: [number, number, number, number]
    // keyword mode (Task 10-a)
    /** true when results were matched by name~"query" (not just "everything in radius") */
    name_matched?: boolean
    /** OSM admin boundary (city/county/state) used to bound the Overpass area, if resolved */
    admin_area?: string
    /** true when the primary name-matched query failed over to the wider all-tags query */
    query_widened?: boolean
    // brand mode
    brands_scraped?: string[]
    brands_with_data?: number
    /** true when the internal time budget stopped the sweep before all brands ran */
    partial?: boolean
    brands_skipped?: string[]
  }
}

// ============================================================================
// OVERPASS — moved to @/lib/overpass (multi-endpoint failover: overpass-api.de
// + kumi.systems + maps.mail.ru, per-attempt AbortController timeout, honest
// empty-vs-failed distinction, connection cleanup). See src/lib/overpass.ts.
// ============================================================================

// ============================================================================
// CACHED REVERSE GEOCODER — load kelurahan + malls ONCE per request
// ============================================================================

interface KelurahanRow {
  id: string
  name: string
  kec_name: string
  kab_name: string
  lat: number
  lng: number
}

interface MallRow {
  id: string
  name: string
  lat: number
  lng: number
}

class RequestCache {
  private kelurahanCache: KelurahanRow[] | null = null
  private mallsCache: MallRow[] | null = null

  async getKelurahan(): Promise<KelurahanRow[]> {
    if (this.kelurahanCache !== null) return this.kelurahanCache
    try {
      const rows = await prisma.kelurahan.findMany({
        select: { id: true, name: true, kec_name: true, kab_name: true, lat: true, lng: true },
        take: 5000,
      })
      this.kelurahanCache = rows.filter(k => k.lat != null && k.lng != null) as KelurahanRow[]
    } catch {
      this.kelurahanCache = []
    }
    return this.kelurahanCache
  }

  async getMalls(): Promise<MallRow[]> {
    if (this.mallsCache !== null) return this.mallsCache
    try {
      const rows = await prisma.mall.findMany({
        select: { id: true, name: true, lat: true, lng: true },
      })
      this.mallsCache = rows.filter(m => m.lat != null && m.lng != null) as MallRow[]
    } catch {
      this.mallsCache = []
    }
    return this.mallsCache
  }

  /** Reverse-geocode a coordinate to the nearest kelurahan (within 10km). */
  async reverseGeocode(lat: number, lng: number): Promise<{
    kec: string
    kab: string
    city: string
    kelurahanName: string
  }> {
    const cache = await this.getKelurahan()
    if (cache.length === 0) return { kec: '', kab: '', city: '', kelurahanName: '' }

    let best: { kec: string; kab: string; city: string; kelurahanName: string } | null = null
    let bestDist = Infinity
    for (const k of cache) {
      const d = haversineKm(lat, lng, k.lat, k.lng)
      if (d < bestDist) {
        bestDist = d
        if (d <= 10) {
          best = {
            kec: k.kec_name || '',
            kab: k.kab_name || '',
            city: k.kab_name || '',
            kelurahanName: k.name || '',
          }
        }
      }
    }
    return best || { kec: '', kab: '', city: '', kelurahanName: '' }
  }

  /** Detect if a point is inside a known mall (within 250m). */
  async detectMall(lat: number, lng: number): Promise<{ is_in_mall: boolean; mall_name: string | null }> {
    const malls = await this.getMalls()
    for (const m of malls) {
      if (haversineKm(lat, lng, m.lat, m.lng) <= 0.25) {
        return { is_in_mall: true, mall_name: m.name }
      }
    }
    return { is_in_mall: false, mall_name: null }
  }
}

// ============================================================================
// LOCATION FILTER — resolve to a bbox + human label
// ============================================================================

interface ResolvedLocation {
  bbox: [number, number, number, number]  // [s, w, n, e]
  label: string
  centerLat?: number
  centerLng?: number
}

/**
 * Real bounding boxes for countries whose centroid rows may not exist yet in
 * the countries table. Values are the official OSM/ISO extents — NOT synthetic.
 */
const COUNTRY_FALLBACK_BOXES: Record<string, { bbox: [number, number, number, number]; center: [number, number] }> = {
  ID: { bbox: [-11.0, 94.9, 6.28, 141.02], center: [-2.2, 117.4] },
  SG: { bbox: [1.13, 103.6, 1.47, 104.1], center: [1.3521, 103.8198] },
  MY: { bbox: [0.85, 108.9, 7.4, 119.3], center: [4.2, 109.6] },
  TH: { bbox: [5.6, 97.3, 20.5, 105.6], center: [15.1, 101.0] },
  KH: { bbox: [10.4, 102.3, 14.7, 107.6], center: [12.6, 104.9] },
  VN: { bbox: [8.2, 102.1, 23.4, 109.5], center: [16.0, 106.0] },
  PH: { bbox: [4.5, 116.9, 18.5, 126.6], center: [12.9, 121.8] },
  IN: { bbox: [6.7, 68.1, 35.5, 97.4], center: [22.0, 79.0] },
  AU: { bbox: [-43.7, 112.9, -10.7, 153.6], center: [-25.3, 133.8] },
}

/** Point-in-bbox test with a small margin (km) — replaces the old Bali-only
 *  land check so scrapes work for every country in the Data Manager. */
export function isPointInBbox(lat: number, lng: number, bbox: [number, number, number, number], marginKm = 2): boolean {
  const dLat = marginKm / 111
  const dLng = marginKm / (111 * Math.cos((Math.max(-80, Math.min(80, lat)) * Math.PI) / 180))
  return lat >= bbox[0] - dLat && lat <= bbox[2] + dLat && lng >= bbox[1] - dLng && lng <= bbox[3] + dLng
}

export async function resolveLocation(loc: LocationFilter | undefined): Promise<ResolvedLocation> {
  // No filter — Indonesia-wide (the platform's home market), real bounds
  if (!loc || (!loc.country_id && !loc.province_code && !loc.kab_code && !loc.kec_code && !loc.kel_code)) {
    return { bbox: COUNTRY_FALLBACK_BOXES.ID.bbox, label: 'Indonesia (all)', centerLat: COUNTRY_FALLBACK_BOXES.ID.center[0], centerLng: COUNTRY_FALLBACK_BOXES.ID.center[1] }
  }

  // Kelurahan-level: tight bbox around the kelurahan centroid
  if (loc.kel_code) {
    const k = await prisma.kelurahan.findUnique({
      where: { code: loc.kel_code },
      select: { name: true, kec_name: true, kab_name: true, lat: true, lng: true },
    })
    if (k && k.lat != null && k.lng != null) {
      const r = 1.5 // 1.5km radius for kelurahan
      const dLat = r / 111
      const dLng = r / (111 * Math.cos((k.lat * Math.PI) / 180))
      return {
        bbox: [k.lat - dLat, k.lng - dLng, k.lat + dLat, k.lng + dLng],
        label: `Kel. ${k.name}, ${k.kec_name}, ${k.kab_name}`,
        centerLat: k.lat,
        centerLng: k.lng,
      }
    }
  }

  // Kecamatan-level: 5km radius around centroid
  if (loc.kec_code) {
    const k = await prisma.kecamatan.findUnique({
      where: { code: loc.kec_code },
      select: { name: true, lat: true, lng: true, kabupaten: { select: { name: true } } },
    })
    if (k && k.lat != null && k.lng != null) {
      const r = 5
      const dLat = r / 111
      const dLng = r / (111 * Math.cos((k.lat * Math.PI) / 180))
      return {
        bbox: [k.lat - dLat, k.lng - dLng, k.lat + dLat, k.lng + dLng],
        label: `Kec. ${k.name}, ${k.kabupaten?.name || ''}`,
        centerLat: k.lat,
        centerLng: k.lng,
      }
    }
  }

  // Kabupaten-level: use stored bbox if available, else 15km radius
  if (loc.kab_code) {
    const k = await prisma.kabupaten.findUnique({
      where: { code: loc.kab_code },
      select: { name: true, lat: true, lng: true, type: true },
    })
    if (k && k.lat != null && k.lng != null) {
      const r = 15
      const dLat = r / 111
      const dLng = r / (111 * Math.cos((k.lat * Math.PI) / 180))
      return {
        bbox: [k.lat - dLat, k.lng - dLng, k.lat + dLat, k.lng + dLng],
        label: `${k.type === 'Kota' ? 'Kota' : 'Kab.'} ${k.name}`,
        centerLat: k.lat,
        centerLng: k.lng,
      }
    }
  }

  // Province-level: 50km radius around centroid
  if (loc.province_code) {
    const p = await prisma.province.findUnique({
      where: { code: loc.province_code },
      select: { name: true, lat: true, lng: true, country: true },
    })
    if (p && p.lat != null && p.lng != null) {
      const r = 50
      const dLat = r / 111
      const dLng = r / (111 * Math.cos((p.lat * Math.PI) / 180))
      return {
        bbox: [p.lat - dLat, p.lng - dLng, p.lat + dLat, p.lng + dLng],
        label: `Prov. ${p.name}, ${p.country}`,
        centerLat: p.lat,
        centerLng: p.lng,
      }
    }
  }

  // Country-level: use DB centroid when present, else official country bbox
  if (loc.country_id) {
    const c = await prisma.country.findUnique({
      where: { id: loc.country_id },
      select: { id: true, name: true, iso2: true, lat: true, lng: true, radius_km: true },
    })
    if (c) {
      const iso = (c.iso2 || c.id).toUpperCase()
      const fb = COUNTRY_FALLBACK_BOXES[iso]
      const r = c.radius_km ?? 1200
      const clat = c.lat ?? fb?.center[0]
      const clng = c.lng ?? fb?.center[1]
      const bbox: [number, number, number, number] = (iso === 'ID')
        ? COUNTRY_FALLBACK_BOXES.ID.bbox
        : (fb && clat == null)
          ? fb.bbox
          : (() => {
              const dLat = r / 111
              const dLng = r / (111 * Math.cos((clat! * Math.PI) / 180))
              return [clat! - dLat, clng! - dLng, clat! + dLat, clng! + dLng] as [number, number, number, number]
            })()
      return { bbox, label: c.name, centerLat: clat ?? undefined, centerLng: clng ?? undefined }
    }
  }

  // Fallback: Indonesia-wide
  return { bbox: COUNTRY_FALLBACK_BOXES.ID.bbox, label: 'Indonesia (all)', centerLat: COUNTRY_FALLBACK_BOXES.ID.center[0], centerLng: COUNTRY_FALLBACK_BOXES.ID.center[1] }
}

// ============================================================================
// NOMINATIM — geocoding for keyword mode
// ============================================================================

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
  class: string
  osm_type?: string
  osm_id?: number
  address?: Record<string, string>
}

const NOMINATIM_TIMEOUT_MS = 12_000

/** fetch() with an AbortController deadline — Nominatim must never hang a request. */
async function timedFetch(url: string, headers: Record<string, string>, timeoutMs = NOMINATIM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}

async function geocode(
  query: string,
  bbox: [number, number, number, number],
  countryCode: string,
  timeoutMs = NOMINATIM_TIMEOUT_MS,
): Promise<NominatimResult | null> {
  const [s, w, n, e] = bbox
  const viewbox = `${w},${s},${e},${n}`
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&countrycodes=${countryCode}&viewbox=${viewbox}&bounded=1&addressdetails=1`
  const res = await timedFetch(url, { 'Accept-Language': 'id,en' }, timeoutMs)
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  return data[0] || null
}

async function nominatimSearchByName(
  query: string,
  bbox: [number, number, number, number],
  countryCode: string,
  timeoutMs = NOMINATIM_TIMEOUT_MS,
): Promise<NominatimResult[]> {
  const [s, w, n, e] = bbox
  const viewbox = `${w},${s},${e},${n}`
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=20&countrycodes=${countryCode}&viewbox=${viewbox}&bounded=1&addressdetails=1`
  try {
    const res = await timedFetch(url, { 'Accept-Language': 'id,en' }, timeoutMs)
    if (!res.ok) return []
    return (await res.json()) as NominatimResult[]
  } catch {
    return []
  }
}

/**
 * Resolve an OSM admin boundary (city / county / district / state) from the
 * geocoded result's address parts, returning the Overpass area id
 * (3600000000 + OSM relation id).
 *
 * Task 10-a: keyword searches used to query a raw bbox (often the FULL Bali
 * bbox when no location filter was selected). Scoping by admin boundary
 * gives the Overpass engine a much smaller, semantically meaningful area and
 * dramatically reduces false-positive matches.
 */
async function resolveAdminArea(
  geo: NominatimResult,
  countryCode: string,
  timeoutMs = 6_000,
): Promise<{ areaId: number; label: string } | null> {
  try {
    const a = geo.address || {}
    const candidates = [a.city, a.town, a.municipality, a.county, a.state_district, a.state]
      .filter((c): c is string => !!c)
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .slice(0, 2)
    for (const cand of candidates) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(cand)}&countrycodes=${countryCode}&limit=1`
      const res = await timedFetch(url, { 'Accept-Language': 'id,en' }, timeoutMs)
      if (!res.ok) continue
      const rows = (await res.json()) as NominatimResult[]
      const hit = rows.find(r => r.osm_type === 'relation' && r.osm_id)
      if (hit) {
        return { areaId: 3600000000 + Number(hit.osm_id), label: cand }
      }
    }
  } catch {
    // Graceful degradation — bbox-only scoping still works.
  }
  return null
}

async function resolveCountryCode(loc: LocationFilter | undefined): Promise<string> {
  if (loc?.country_id) {
    try {
      const c = await prisma.country.findUnique({
        where: { id: loc.country_id },
        select: { iso2: true },
      })
      if (c?.iso2) return c.iso2.toLowerCase()
    } catch { /* fall through to default */ }
  }
  // kab/kec/kel codes are Indonesian Kemendagri codes
  return 'id'
}

// ============================================================================
// OVERPASS QUERY BUILDER — for keyword mode (multiple kinds)
// ============================================================================

/**
 * Spatial clause for Overpass statements: intersect the bbox with an OSM
 * admin-boundary area when one was resolved (region filter), so queries are
 * bounded by real admin boundaries instead of a global bbox.
 */
function spatialClause(bbox: [number, number, number, number], areaId?: number): string {
  const [s, w, n, e] = bbox
  const bboxPart = `(${s},${w},${n},${e})`
  return areaId ? `(area:${areaId})${bboxPart}` : bboxPart
}

/**
 * Build a case-insensitive Overpass name regex from a free-text query.
 * "Starbucks Kuta" → `(^|[^a-z0-9_])(starbucks kuta|starbucks)([^a-z0-9_]|$)`
 * — an alternation over progressive token prefixes (≥3 chars) so brand+location
 * queries still match plain brand names in OSM, with word-ish boundaries so
 * "Zara" no longer matches "Bazar".
 *
 * Punctuation is replaced with "." and no backslash escapes are emitted:
 * Overpass QL string escaping of backslashes differs across mirrors, so the
 * pattern must be QL-safe without any `\\` (bonus: "j.co" also matches "jco").
 */
function buildNamePattern(query: string): string {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const candidates: string[] = []
  for (let n = tokens.length; n >= 1; n--) {
    const cand = tokens.slice(0, n).join(' ')
    if (cand.length >= 3 && !candidates.includes(cand)) candidates.push(cand)
  }
  if (candidates.length === 0) candidates.push(query.toLowerCase())
  const safe = candidates.map(c => c.replace(/[^a-z0-9 ]/g, '.'))
  return `(^|[^a-z0-9_])(${safe.join('|')})([^a-z0-9_]|$)`
}

/**
 * PRIMARY keyword query: name~"query" ANDed with relevant
 * amenity/shop/tourism filters per kind, bounded by admin area (when
 * resolved) intersected with the radius bbox.
 */
function buildKeywordQuery(kind: ItemKind, spatial: string, namePattern: string): string {
  const nameSel = `["name"~"${namePattern}",i]`
  const stmts: string[] = []
  if (kind === 'store') {
    stmts.push(
      `nwr${nameSel}["amenity"~"cafe|restaurant|fast_food|bar|pub|food_court|ice_cream"]${spatial};`,
      `nwr${nameSel}["shop"]${spatial};`,
    )
  } else if (kind === 'mall') {
    stmts.push(
      `nwr${nameSel}["shop"~"mall|department_store"]${spatial};`,
      `nwr${nameSel}["building"="retail"]${spatial};`,
      `nwr${nameSel}["landuse"="retail"]${spatial};`,
    )
  } else {
    stmts.push(
      `nwr${nameSel}["tourism"]${spatial};`,
      `nwr${nameSel}["leisure"~"park|sports_centre|stadium|water_park|beach_resort|golf_course"]${spatial};`,
      `nwr${nameSel}["amenity"~"university|college|hospital|bus_station|ferry_terminal|cinema|theatre|place_of_worship"]${spatial};`,
      `nwr${nameSel}["natural"="beach"]${spatial};`,
    )
  }
  return `[out:json][timeout:25];(${stmts.join('')});out center 200;`
}

/**
 * WIDENED fallback query (no name filter): all tagged elements of the
 * requested kinds inside the spatial filter. Only used when the name-matched
 * query returned nothing.
 */
function buildOverpassQueryByKind(bbox: [number, number, number, number], kind: ItemKind, areaId?: number): string {
  const spatial = spatialClause(bbox, areaId)
  const stmts: string[] = []
  if (kind === 'store') {
    stmts.push(
      `nwr["amenity"~"cafe|restaurant|fast_food|bar|pub|food_court|ice_cream"]${spatial};`,
      `nwr["shop"~"clothes|shoes|sports|jewelry|beauty|bakery|confectionery|coffee|bag|fashion_accessories|convenience|supermarket|pharmacy"]${spatial};`,
    )
  } else if (kind === 'mall') {
    stmts.push(
      `nwr["shop"~"mall|department_store"]${spatial};`,
      // Task 10-a: require a name on retail buildings — unnamed ones were a
      // major source of junk rows in keyword mode.
      `nwr["building"="retail"]["name"]${spatial};`,
      `nwr["landuse"="retail"]["name"]${spatial};`,
    )
  } else {
    stmts.push(
      `nwr["tourism"~"hotel|attraction|museum|gallery|theme_park|zoo"]${spatial};`,
      `nwr["leisure"~"park|sports_centre|stadium|swimming_pool|beach_resort"]${spatial};`,
      `nwr["amenity"~"university|hospital|bus_station|ferry_terminal|cinema|theatre"]${spatial};`,
      `nwr["natural"="beach"]${spatial};`,
    )
  }
  return `[out:json][timeout:25];(${stmts.join('')});out center 200;`
}

function buildOverpassQueryByTag(bbox: [number, number, number, number], tag: string): string {
  const [s, w, n, e] = bbox
  const bboxStr = `${s},${w},${n},${e}`
  const q = `[out:json][timeout:20];(nwr[${tag}](${bboxStr}););out center 200;`
  return q
}

// ============================================================================
// CLASSIFIERS — extract brand info from OSM tags
// ============================================================================

function elementName(tags: Record<string, string>, fallback: string): string {
  return tags.name || tags.brand || tags['name:en'] || tags.operator || fallback
}

function classifyPoi(tags: Record<string, string>): { type: string; magnitude: number; notes: string } {
  if (tags.natural === 'beach') return { type: 'beach', magnitude: 100_000, notes: `Beach (${tags.name || 'unnamed'})` }
  if (tags.tourism === 'hotel') return { type: 'hotel_cluster', magnitude: 100, notes: `Hotel: ${tags.name || ''}` }
  if (tags.tourism) return { type: 'tourist_attraction', magnitude: 50_000, notes: `Tourism: ${tags.tourism} — ${tags.name || ''}` }
  if (tags.amenity === 'hospital') return { type: 'hospital', magnitude: 400, notes: `Hospital: ${tags.name || ''}` }
  if (tags.amenity === 'university') return { type: 'university', magnitude: 10_000, notes: `University: ${tags.name || ''}` }
  if (tags.amenity === 'cinema' || tags.amenity === 'theatre') return { type: 'tourist_attraction', magnitude: 1_500, notes: `${tags.amenity}: ${tags.name || ''}` }
  if (tags.amenity === 'bus_station') return { type: 'transit_hub', magnitude: 5_000, notes: `Bus station: ${tags.name || ''}` }
  if (tags.amenity === 'ferry_terminal') return { type: 'port', magnitude: 5_000, notes: `Ferry terminal: ${tags.name || ''}` }
  if (tags.leisure === 'sports_centre' || tags.leisure === 'stadium') return { type: 'tourist_attraction', magnitude: 800, notes: `${tags.leisure}: ${tags.name || ''}` }
  if (tags.leisure === 'park') return { type: 'tourist_attraction', magnitude: 2_000, notes: `Park: ${tags.name || ''}` }
  return { type: 'tourist_attraction', magnitude: 1000, notes: `Other: ${tags.name || ''}` }
}

function classifyStore(tags: Record<string, string>): { brand_category: string; brand_name: string } | null {
  const name = (tags.name || tags.brand || '').toLowerCase()

  if (name.includes('starbucks')) return { brand_category: 'food_beverage', brand_name: 'Starbucks' }
  if (name.includes('pizza marzano') || name.includes('pizza hut')) return { brand_category: 'food_beverage', brand_name: 'Pizza Marzano' }
  if (name.includes('krispy kreme')) return { brand_category: 'food_beverage', brand_name: 'Krispy Kreme' }
  if (name.includes('godiva')) return { brand_category: 'food_beverage', brand_name: 'Godiva' }
  if (name.includes('sushi tei')) return { brand_category: 'food_beverage', brand_name: 'Sushi Tei' }
  if (name.includes('genki sushi')) return { brand_category: 'food_beverage', brand_name: 'Genki Sushi' }
  if (name.includes('subway')) return { brand_category: 'food_beverage', brand_name: 'Subway' }
  if (name.includes('popeyes')) return { brand_category: 'food_beverage', brand_name: 'Popeyes' }
  if (name.includes('cold stone')) return { brand_category: 'food_beverage', brand_name: 'Cold Stone Creamery' }
  if (name.includes('hoka')) return { brand_category: 'sports', brand_name: 'Hoka' }
  if (name.includes('skechers')) return { brand_category: 'sports', brand_name: 'Skechers' }
  if (name.includes('reebok')) return { brand_category: 'sports', brand_name: 'Reebok' }
  if (name.includes('nike')) return { brand_category: 'sports', brand_name: 'Nike' }
  if (name.includes('adidas')) return { brand_category: 'sports', brand_name: 'Adidas' }
  if (name.includes('puma')) return { brand_category: 'sports', brand_name: 'Puma' }
  if (name.includes('converse')) return { brand_category: 'sports', brand_name: 'Converse' }
  if (name.includes('vans')) return { brand_category: 'sports', brand_name: 'Vans' }
  if (name.includes('new balance')) return { brand_category: 'sports', brand_name: 'New Balance' }
  if (name.includes('foot locker')) return { brand_category: 'sports', brand_name: 'Foot Locker' }
  if (name.includes('sports station') || name.includes('planet sports')) return { brand_category: 'sports', brand_name: name.includes('planet') ? 'Planet Sports' : 'Sports Station' }
  if (name.includes('zara')) return { brand_category: 'fashion', brand_name: 'Zara' }
  if (name.includes('marks & spencer') || name.includes('marks and spencer')) return { brand_category: 'fashion', brand_name: 'Marks & Spencer' }
  if (name.includes('sogo')) return { brand_category: 'department_store', brand_name: 'Sogo' }
  if (name.includes('matahari')) return { brand_category: 'department_store', brand_name: 'Matahari Dept Store' }

  if (tags.shop === 'clothes' || tags.shop === 'fashion_accessories') return { brand_category: 'fashion', brand_name: tags.name || 'Fashion Store' }
  if (tags.shop === 'shoes') return { brand_category: 'sports', brand_name: tags.name || 'Shoe Store' }
  if (tags.shop === 'sports') return { brand_category: 'sports', brand_name: tags.name || 'Sports Store' }
  if (tags.shop === 'beauty') return { brand_category: 'beauty', brand_name: tags.name || 'Beauty Store' }
  if (tags.shop === 'mall') return { brand_category: 'department_store', brand_name: tags.name || 'Mall' }
  if (tags.shop === 'convenience') return { brand_category: 'lifestyle', brand_name: tags.name || 'Convenience Store' }
  if (tags.shop === 'supermarket') return { brand_category: 'lifestyle', brand_name: tags.name || 'Supermarket' }
  if (tags.shop === 'pharmacy') return { brand_category: 'lifestyle', brand_name: tags.name || 'Pharmacy' }
  if (tags.amenity === 'cafe' || tags.shop === 'coffee') return { brand_category: 'food_beverage', brand_name: tags.name || 'Cafe' }
  if (tags.amenity === 'restaurant') return { brand_category: 'food_beverage', brand_name: tags.name || 'Restaurant' }
  if (tags.amenity === 'fast_food') return { brand_category: 'food_beverage', brand_name: tags.name || 'Fast Food' }
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return { brand_category: 'food_beverage', brand_name: tags.name || 'Bar' }

  return null
}

function buildOutletName(
  brand: string,
  tags: Record<string, string>,
  geo: { kelurahanName: string; kec: string; kab: string },
  osmId: number,
): string {
  const osmName = tags.name || ''
  const branch = tags.branch || tags['brand:branch'] || tags['addr:branch'] || ''
  if (osmName && osmName.toLowerCase() !== brand.toLowerCase() && osmName.length > brand.length + 2) {
    return osmName
  }
  if (branch) return `${brand} — ${branch}`
  if (geo.kelurahanName) return `${brand} — ${geo.kelurahanName}`
  if (geo.kec) return `${brand} — ${geo.kec}`
  if (geo.kab) return `${brand} — ${geo.kab}`
  return `${brand} #${osmId}`
}

// ============================================================================
// MAIN ENTRY — runScrape()
// ============================================================================

export async function runScrape(req: ScrapeRequest): Promise<ScrapeOutput> {
  const cache = new RequestCache()
  const resolved = await resolveLocation(req.location)
  const bbox = resolved.bbox

  // -------- KEYWORD MODE --------
  if (req.mode === 'keyword') {
    if (!req.query || !req.query.trim()) {
      throw new Error('query is required for keyword mode')
    }
    const query = req.query.trim()
    const kinds = req.kinds && req.kinds.length > 0 ? req.kinds : (['store', 'mall', 'poi'] as ItemKind[])
    const startedAt = Date.now()
    // Shared deadline: every network call gets min(cap, remaining budget) so
    // the route can never be killed by the 60s function/ALB limit and answer
    // with an HTML error page (Task 10-a bug 1).
    const deadline = startedAt + SCRAPE_BUDGET_MS
    const budgetLeft = (capMs: number, minMs = 8_000) =>
      Math.max(minMs, Math.min(capMs, deadline - Date.now()))

    // 0) Country/region scope for Nominatim (multi-country support; kab/kec/kel
    //    codes are Indonesian, so they imply 'id').
    const countryCode = await resolveCountryCode(req.location)

    // 1) Geocode the query → center point (+ addressdetails for admin scoping)
    const geo = await geocode(query, bbox, countryCode, budgetLeft(NOMINATIM_TIMEOUT_MS))
    if (!geo) {
      throw new Error(`Place not found in ${resolved.label} — try a more specific query`)
    }
    const lat = parseFloat(geo.lat)
    const lng = parseFloat(geo.lon)
    const inScope = isPointInBbox(lat, lng, bbox, 3)

    // 2) Compute scrape bbox = geo center ± radius, intersected with location bbox
    const radius = req.radius_km ?? 5
    const dLat = radius / 111
    const dLng = radius / (111 * Math.cos((lat * Math.PI) / 180))
    const qBbox: [number, number, number, number] = [
      Math.max(lat - dLat, bbox[0]),
      Math.max(lng - dLng, bbox[1]),
      Math.min(lat + dLat, bbox[2]),
      Math.min(lng + dLng, bbox[3]),
    ]

    // 3) Bound the query by an OSM admin boundary (city/county/state derived
    //    from the geocoded address) — Task 10-a. The old code swept a raw
    //    bbox (the FULL Bali bbox when no location filter was selected),
    //    returning every shop/café in the area regardless of the keyword.
    const adminArea = await resolveAdminArea(geo, countryCode, budgetLeft(6_000))
    const spatial = spatialClause(qBbox, adminArea?.areaId)
    const namePattern = buildNamePattern(query)

    const toPairs = (elements: OverpassElement[], k: ItemKind) =>
      elements.map(element => ({ element, kind: k }))

    // 4) PRIMARY: name-matched query per kind, in PARALLEL
    //    name~"query" ANDed with relevant amenity/shop/tourism filters.
    const primary = await Promise.all(
      kinds.map(async (k) => {
        const r = await runOverpass(buildKeywordQuery(k, spatial, namePattern), { timeoutMs: budgetLeft(25_000) })
        return toPairs(r.elements, k)
      })
    )
    let allElements: Array<{ element: OverpassElement; kind: ItemKind }> = primary.flat()
    const nameMatched = allElements.length > 0
    let queryWidened = false

    // 5) FALLBACK 1 — widen to all tagged elements of the requested kinds
    //    (no name filter). Only when the name-matched query found nothing,
    //    e.g. the keyword is a category word that never appears in OSM names.
    if (!nameMatched) {
      queryWidened = true
      const widened = await Promise.all(
        kinds.map(async (k) => {
          const r = await runOverpass(buildOverpassQueryByKind(qBbox, k, adminArea?.areaId), { timeoutMs: budgetLeft(25_000) })
          return toPairs(r.elements, k)
        })
      )
      allElements = widened.flat()
    }

    // 6) FALLBACK 2 — Nominatim free-text search (existing behavior)
    let usedFallback = false
    if (allElements.length === 0) {
      usedFallback = true
      const nomResults = await nominatimSearchByName(query, qBbox, countryCode, budgetLeft(NOMINATIM_TIMEOUT_MS))
      for (const r of nomResults) {
        const k: ItemKind = r.class === 'amenity' ? 'store' : r.class === 'shop' ? 'store' : 'poi'
        allElements.push({
          element: {
            type: 'node',
            id: r.place_id,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            tags: {
              name: r.display_name.split(',')[0],
              ...(r.class === 'amenity' ? { amenity: r.type } : {}),
              ...(r.class === 'shop' ? { shop: r.type } : {}),
              ...(r.class === 'tourism' ? { tourism: r.type } : {}),
              ...(r.class === 'leisure' ? { leisure: r.type } : {}),
              ...(r.class === 'natural' ? { natural: r.type } : {}),
            },
          },
          kind: k,
        })
      }
    }

    // 7) Dedupe — the same OSM feature can arrive from node+way statements or
    //    overlap between kinds (Task 10-a).
    const seenKeys = new Set<string>()
    const dedupedPairs: Array<{ element: OverpassElement; kind: ItemKind }> = []
    for (const pair of allElements) {
      const c = elementCoords(pair.element)
      const key = pair.element.type && pair.element.id
        ? `${pair.element.type}/${pair.element.id}`
        : c
          ? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`
          : `anon_${dedupedPairs.length}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      dedupedPairs.push(pair)
    }

    // 8) Build result rows (uses cached reverse-geocoder — fast)
    const results: ScraperResultRow[] = []
    for (const { element, kind: elKind } of dedupedPairs) {
      const coords = elementCoords(element)
      if (!coords) continue
      const elat = coords.lat
      const elng = coords.lng

      const tags = element.tags || {}
      const name = elementName(tags, `${elKind}_${element.id}`)
      const onLand = isPointInBbox(elat, elng, bbox, 2)
      const geo = await cache.reverseGeocode(elat, elng)
      const mallInfo = await cache.detectMall(elat, elng)
      const address = tags['addr:street']
        ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}${geo.kec ? ', ' + geo.kec : ''}${geo.kab ? ', ' + geo.kab : ''}`.trim()
        : (geo.kelurahanName ? `${geo.kelurahanName}, ${geo.kec}, ${geo.kab}` : geo.kab || geo.kec || '')

      let category = 'unknown'
      let brand_name: string | undefined
      let brand_category: string | undefined
      let poi_type: string | undefined
      let poi_magnitude: number | undefined
      let poi_notes: string | undefined

      if (elKind === 'store') {
        const cls = classifyStore(tags)
        if (cls) {
          category = `${cls.brand_name} (${cls.brand_category})`
          brand_name = cls.brand_name
          brand_category = cls.brand_category
        } else {
          category = `Unknown store: ${name}`
          brand_name = name
          brand_category = 'other'
        }
      } else if (elKind === 'mall') {
        category = `Mall: ${name}`
      } else {
        const cls = classifyPoi(tags)
        category = `${cls.type}: ${name}`
        poi_type = cls.type
        poi_magnitude = cls.magnitude
        poi_notes = cls.notes
      }

      results.push({
        name,
        type: category,
        lat: elat,
        lng: elng,
        category,
        kind: elKind,
        tags,
        on_land: onLand,
        address,
        brand_name,
        brand_category,
        poi_type,
        poi_magnitude,
        poi_notes,
        // Inject mall info via tags (consumed by /scrape-save)
        source: `OSM scrape: "${query}" @ ${resolved.label} — ${new Date().toISOString()}`,
        // Extra context for save logic — encoded into tags to avoid type churn
        ...(mallInfo.is_in_mall ? { tags: { ...tags, _mall_name: mallInfo.mall_name || '', _is_in_mall: 'true' } } : {}),
      })
    }

    return {
      geocoded: { lat, lng, display_name: geo.display_name, is_in_bali: inScope, address: geo.address },
      used_fallback: usedFallback,
      source: usedFallback ? 'nominatim' : 'overpass',
      results,
      meta: {
        mode: 'keyword',
        location_label: resolved.label,
        bbox: qBbox,
        name_matched: nameMatched,
        query_widened: queryWidened,
        admin_area: adminArea?.label,
        ...(Date.now() - startedAt > SCRAPE_BUDGET_MS ? { partial: true } : {}),
      },
    }
  }

  // -------- BRAND SWEEP MODE --------
  if (req.mode === 'brand') {
    const requestedBrands = Array.isArray(req.brands) ? req.brands : null
    const brandsToScrape = requestedBrands
      ? COMPETITOR_BRANDS.filter(b => requestedBrands.includes(b.name))
      : COMPETITOR_BRANDS

    if (brandsToScrape.length === 0) {
      throw new Error('No matching brands to scrape')
    }

    const BATCH_SIZE = 5
    const allResults: ScraperResultRow[] = []
    let usedFallback = false
    let brandsWithData = 0
    let anyEndpointFailed = false
    const startedAt = Date.now()
    const brandsSkipped: string[] = []
    let partial = false

    for (let i = 0; i < brandsToScrape.length; i += BATCH_SIZE) {
      // Graceful degradation: stop before the 60s function/ALB limit and
      // return what we have as JSON instead of letting the gateway answer
      // with an HTML 504 page (Task 10-a bug 1).
      if (Date.now() - startedAt > SCRAPE_BUDGET_MS) {
        partial = true
        for (const b of brandsToScrape.slice(i)) brandsSkipped.push(b.name)
        break
      }

      const batch = brandsToScrape.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (brand) => {
          const buildQuery = (tag: string) => buildOverpassQueryByTag(bbox, tag)
          const primary = await runOverpass(buildQuery(brand.osm_tag), { timeoutMs: 20_000 })
          if (primary.failed) anyEndpointFailed = true
          let elements = primary.elements
          if (elements.length === 0 && brand.osm_tag_fallback) {
            const fallback = await runOverpass(buildQuery(brand.osm_tag_fallback), { timeoutMs: 20_000 })
            if (fallback.failed) anyEndpointFailed = true
            elements = fallback.elements
          }
          return { brand, elements }
        })
      )

      for (const { brand, elements } of batchResults) {
        if (elements.length === 0) {
          usedFallback = true
          continue
        }
        brandsWithData += 1

        for (const el of elements) {
          const elat = el.lat ?? el.center?.lat
          const elng = el.lon ?? el.center?.lon
          if (elat == null || elng == null) continue
          const onLand = isPointInBbox(elat, elng, bbox, 2)
          const tags = el.tags || {}
          const geo = await cache.reverseGeocode(elat, elng)
          const mallInfo = await cache.detectMall(elat, elng)
          const outletName = buildOutletName(brand.name, tags, geo, el.id)
          const addressParts = [
            tags['addr:street'],
            tags['addr:housenumber'],
            geo.kec,
            geo.kab,
          ].filter(Boolean).join(' ')

          allResults.push({
            name: outletName,
            type: `${brand.name} (${brand.category})`,
            lat: elat,
            lng: elng,
            category: `${brand.name} (${brand.category})`,
            kind: 'store',
            tags: { ...tags, _mall_name: mallInfo.mall_name || '', _is_in_mall: mallInfo.is_in_mall ? 'true' : '' },
            on_land: onLand,
            address: addressParts || '',
            brand_name: brand.name,
            brand_category: brand.category,
            source: `OSM Overpass: brand="${brand.name}" @ ${resolved.label} — ${new Date().toISOString()}`,
          })
        }
      }
    }

    if (brandsWithData === 0) {
      throw new Error(
        partial
          ? `Brand sweep hit its internal ${Math.round(SCRAPE_BUDGET_MS / 1000)}s time budget before any brand returned data (Overpass was too slow or rate-limiting). Brands skipped: ${brandsSkipped.join(', ') || 'remaining'}. Select fewer brands and retry.`
          : anyEndpointFailed
            ? 'All Overpass endpoints failed or returned no data for the selected brands (possible rate-limiting or temporary outage). Try again in a minute, or select fewer brands.'
            : 'Overpass API returned no data for any of the selected brands. Try again in a minute, select fewer brands, or narrow the location filter.',
      )
    }

    // Dedupe by lat+lng (~1m)
    const seen = new Set<string>()
    const deduped = allResults.filter(r => {
      const key = `${r.lat.toFixed(5)}_${r.lng.toFixed(5)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      used_fallback: usedFallback,
      source: 'overpass',
      results: deduped,
      meta: {
        mode: 'brand',
        location_label: resolved.label,
        bbox,
        brands_scraped: brandsToScrape.map(b => b.name),
        brands_with_data: brandsWithData,
        partial,
        ...(brandsSkipped.length > 0 ? { brands_skipped: brandsSkipped } : {}),
      },
    }
  }

  throw new Error(`Unknown mode: ${(req as any).mode}`)
}
