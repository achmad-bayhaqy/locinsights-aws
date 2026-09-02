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
 *   - Nominatim: https://nominatim.openstreetmap.org/search (1 req/sec, valid UA)
 *   - Overpass:  https://overpass-api.de/api/interpreter (race against kumi.systems + osm.ch)
 */

import { db } from '@/lib/api-helpers'
import { prisma } from '@/lib/db'
import { isOnBaliLand } from '@/lib/data/bali-land'
import { haversineKm } from '@/lib/data/bali-kelurahan'
import { COMPETITOR_BRANDS, BALI_BBOX } from '@/lib/data/competitor-brands'
import type { ScraperResultRow, GeocodedResult } from '@/lib/scraper-types'

const USER_AGENT = 'LocInsights/1.0 (MAP Active Adiperkasa Data Team)'

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
    brands_scraped?: string[]
    brands_with_data?: number
    bbox: [number, number, number, number]
  }
}

// ============================================================================
// OVERPASS — race 3 endpoints, throw on empty so Promise.any keeps waiting
// ============================================================================

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function runOverpass(query: string, timeoutMs = 20000): Promise<OverpassElement[]> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
  ]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const promises = endpoints.map(endpoint =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json() as Promise<{ elements: OverpassElement[] }>
      })
      .then(data => {
        const elements = data.elements || []
        if (elements.length === 0) throw new Error('empty')
        return elements
      })
  )

  try {
    const winner = await Promise.any(promises)
    clearTimeout(timeout)
    return winner
  } catch {
    clearTimeout(timeout)
    return []
  }
}

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

async function resolveLocation(loc: LocationFilter | undefined): Promise<ResolvedLocation> {
  // No filter — full Bali bbox
  if (!loc || (!loc.country_id && !loc.province_code && !loc.kab_code && !loc.kec_code && !loc.kel_code)) {
    return { bbox: BALI_BBOX, label: 'Bali (all)' }
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

  // Country-level: 200km radius around centroid (or fallback to Bali for ID)
  if (loc.country_id) {
    const c = await prisma.country.findUnique({
      where: { id: loc.country_id },
      select: { id: true, name: true, iso2: true },
    })
    if (c) {
      // For Indonesia, default to Bali bbox (we don't have a country centroid)
      if (c.id === 'ID' || c.iso2 === 'ID') {
        return { bbox: BALI_BBOX, label: `Indonesia (Bali)` }
      }
      // For other countries, use a wide bbox — would need a country centroid table
      return { bbox: BALI_BBOX, label: c.name }
    }
  }

  // Fallback: full Bali
  return { bbox: BALI_BBOX, label: 'Bali (all)' }
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
  address?: Record<string, string>
}

async function geocode(query: string, bbox: [number, number, number, number]): Promise<NominatimResult | null> {
  const [s, w, n, e] = bbox
  const viewbox = `${w},${s},${e},${n}`
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&countrycodes=id&viewbox=${viewbox}&bounded=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'id,en' },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  return data[0] || null
}

async function nominatimSearchByName(query: string, bbox: [number, number, number, number]): Promise<NominatimResult[]> {
  const [s, w, n, e] = bbox
  const viewbox = `${w},${s},${e},${n}`
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=20&countrycodes=id&viewbox=${viewbox}&bounded=1&addressdetails=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'id,en' },
    })
    if (!res.ok) return []
    return (await res.json()) as NominatimResult[]
  } catch {
    return []
  }
}

// ============================================================================
// OVERPASS QUERY BUILDER — for keyword mode (multiple kinds)
// ============================================================================

function buildOverpassQueryByKind(bbox: [number, number, number, number], kind: ItemKind): string {
  const [s, w, n, e] = bbox
  const bboxStr = `${s},${w},${n},${e}`
  const tagFilters: string[] = []
  if (kind === 'store') {
    tagFilters.push(
      'node["amenity"~"cafe|restaurant|fast_food|bar|pub"](bbox);',
      'node["shop"~"clothes|shoes|sports|jewelry|beauty|bakery|confectionery|coffee|bag|fashion_accessories|convenience|supermarket|pharmacy"](bbox);',
      'way["amenity"~"cafe|restaurant|fast_food|bar|pub"](bbox);',
      'way["shop"~"clothes|shoes|sports|jewelry|beauty|bakery|confectionery|coffee|bag|fashion_accessories|convenience|supermarket|pharmacy"](bbox);',
    )
  } else if (kind === 'mall') {
    tagFilters.push(
      'node["shop"="mall"](bbox);',
      'way["shop"="mall"](bbox);',
      'relation["shop"="mall"](bbox);',
      'way["building"="retail"](bbox);',
    )
  } else {
    tagFilters.push(
      'node["tourism"~"hotel|attraction|museum|gallery|theme_park|zoo"](bbox);',
      'way["tourism"~"hotel|attraction|museum|gallery|theme_park|zoo"](bbox);',
      'node["leisure"~"park|sports_centre|stadium|swimming_pool|beach_resort"](bbox);',
      'node["amenity"~"university|hospital|bus_station|ferry_terminal|cinema|theatre"](bbox);',
      'node["natural"="beach"](bbox);',
      'way["natural"="beach"](bbox);',
    )
  }
  const q = `[out:json][timeout:15];(${tagFilters.join('')});out center 200;`
  return q.replace(/bbox/g, bboxStr)
}

function buildOverpassQueryByTag(bbox: [number, number, number, number], tag: string): string {
  const [s, w, n, e] = bbox
  const bboxStr = `${s},${w},${n},${e}`
  const q = `[out:json][timeout:15];(node[${tag}](${bboxStr});way[${tag}](${bboxStr}););out center 200;`
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

    // 1) Geocode the query → center point
    const geo = await geocode(query, bbox)
    if (!geo) {
      throw new Error(`Place not found in ${resolved.label} — try a more specific query`)
    }
    const lat = parseFloat(geo.lat)
    const lng = parseFloat(geo.lon)
    const isBali = isOnBaliLand(lat, lng, 2)

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

    // 3) Run all kinds in PARALLEL (was sequential → 60s+ timeout)
    const kindResults = await Promise.all(
      kinds.map(async (k) => {
        const q = buildOverpassQueryByKind(qBbox, k)
        const elements = await runOverpass(q)
        return elements.map(element => ({ element, kind: k }))
      })
    )
    let allElements: Array<{ element: OverpassElement; kind: ItemKind }> = kindResults.flat()

    let usedFallback = false
    if (allElements.length === 0) {
      usedFallback = true
      const nomResults = await nominatimSearchByName(query, qBbox)
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

    // 4) Build result rows (uses cached reverse-geocoder — fast)
    const results: ScraperResultRow[] = []
    for (const { element, kind: elKind } of allElements) {
      const elat = element.lat ?? element.center?.lat
      const elng = element.lon ?? element.center?.lon
      if (elat == null || elng == null) continue

      const tags = element.tags || {}
      const name = elementName(tags, `${elKind}_${element.id}`)
      const onLand = isOnBaliLand(elat, elng, 1)
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
      geocoded: { lat, lng, display_name: geo.display_name, is_in_bali: isBali, address: geo.address },
      used_fallback: usedFallback,
      source: usedFallback ? 'nominatim' : 'overpass',
      results,
      meta: {
        mode: 'keyword',
        location_label: resolved.label,
        bbox: qBbox,
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

    for (let i = 0; i < brandsToScrape.length; i += BATCH_SIZE) {
      const batch = brandsToScrape.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (brand) => {
          const buildQuery = (tag: string) => buildOverpassQueryByTag(bbox, tag)
          let elements = await runOverpass(buildQuery(brand.osm_tag))
          if (elements.length === 0 && brand.osm_tag_fallback) {
            elements = await runOverpass(buildQuery(brand.osm_tag_fallback))
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
          const onLand = isOnBaliLand(elat, elng, 1)
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
      throw new Error('Overpass API returned no data for any of the selected brands. Try again in a minute, select fewer brands, or narrow the location filter.')
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
      },
    }
  }

  throw new Error(`Unknown mode: ${(req as any).mode}`)
}
