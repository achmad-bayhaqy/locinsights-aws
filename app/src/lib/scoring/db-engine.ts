/**
 * DB-backed scoring helpers — loads competitor data from DB and feeds it into
 * the pure scoring engine. Used by opportunities, analyze, and overview APIs.
 */
import { prisma } from '@/lib/db'
import type { CompetitorStoreLite, ScoringConfig } from './engine'
import type { Kelurahan } from '../data/bali-kelurahan'

let competitorCache: CompetitorStoreLite[] | null = null
let competitorCacheTime = 0
const COMPETITOR_CACHE_TTL_MS = 60_000 // 1 min

let storesCache: any[] | null = null
let storesCacheTime = 0
const STORES_CACHE_TTL_MS = 60_000 // 1 min

export async function loadCompetitorStores(): Promise<CompetitorStoreLite[]> {
  const now = Date.now()
  if (competitorCache && (now - competitorCacheTime) < COMPETITOR_CACHE_TTL_MS) {
    return competitorCache
  }
  const rows = await prisma.competitorStore.findMany({
    select: { brand_name: true, brand_category: true, lat: true, lng: true },
  })
  const result: CompetitorStoreLite[] = rows.map(r => ({
    brand_name: r.brand_name,
    brand_category: r.brand_category,
    lat: typeof r.lat === 'object' ? parseFloat(String(r.lat)) : r.lat,
    lng: typeof r.lng === 'object' ? parseFloat(String(r.lng)) : r.lng,
  }))
  competitorCache = result
  competitorCacheTime = now
  return result
}

/**
 * Load all MAA/MAP stores from the DB (Supabase).
 * Used by the overview API to populate the dashboard with real DB data
 * (including scraped OSM stores) instead of the static BALI_STORES array.
 *
 * Returns an array shaped like BALI_STORES so the frontend can consume it
 * without changes.
 */
export async function loadStoresFromDB(): Promise<any[]> {
  const now = Date.now()
  if (storesCache && (now - storesCacheTime) < STORES_CACHE_TTL_MS) {
    return storesCache
  }
  const rows = await prisma.store.findMany({
    select: {
      id: true,
      brand_id: true,
      brand_name: true,
      brand_category: true,
      parent: true,
      name: true,
      lat: true,
      lng: true,
      kec: true,
      kab: true,
      is_in_mall: true,
      mall_id: true,
      mall_name: true,
      address: true,
      opened_year: true,
      confirmed: true,
    },
  })
  // Cast Prisma Decimal/enum fields to plain JS types for the frontend
  const result = rows.map(r => ({
    ...r,
    lat: typeof r.lat === 'object' ? parseFloat(String(r.lat)) : r.lat,
    lng: typeof r.lng === 'object' ? parseFloat(String(r.lng)) : r.lng,
    brand_category: String(r.brand_category),
    parent: String(r.parent),
  }))
  storesCache = result
  storesCacheTime = now
  return result
}

export async function buildScoringConfig(
  base: ScoringConfig = {},
  opts: { useTravelTime?: boolean } = {},
): Promise<ScoringConfig> {
  const competitors = await loadCompetitorStores()
  return {
    ...base,
    competitorStores: competitors,
    useTravelTime: opts.useTravelTime ?? true,
  }
}

export function invalidateCompetitorCache() {
  competitorCache = null
  competitorCacheTime = 0
}

export function invalidateStoresCache() {
  storesCache = null
  storesCacheTime = 0
}

/**
 * Load ALL kelurahan from the DB and reshape them to match the `Kelurahan`
 * interface that the scoring engine expects. Used by the opportunities and
 * overview APIs to score the full 716 villages (instead of the ~220 in the
 * static BALI_KELURAHAN array).
 *
 * Results are cached for 60s to avoid hammering the DB on every page load.
 */
let kelurahanCache: Kelurahan[] | null = null
let kelurahanCacheTime = 0
const KELURAHAN_CACHE_TTL_MS = 60_000

export async function loadKelurahanFromDB(): Promise<Kelurahan[]> {
  const now = Date.now()
  if (kelurahanCache && (now - kelurahanCacheTime) < KELURAHAN_CACHE_TTL_MS) {
    return kelurahanCache
  }
  let rows: any[] = []
  try {
    rows = await prisma.kelurahan.findMany({
      include: {
        kecamatan: { select: { name: true, code: true, kabupaten_code: true } },
      },
    })
  } catch {
    return kelurahanCache || []
  }

  const result: Kelurahan[] = rows.map(row => {
    const lat = typeof row.lat === 'object' ? parseFloat(String(row.lat)) : (row.lat as number)
    const lng = typeof row.lng === 'object' ? parseFloat(String(row.lng)) : (row.lng as number)
    const population = typeof row.population === 'object' ? parseFloat(String(row.population)) : (row.population ?? 0)
    const area_km2 = typeof row.area_km2 === 'object' ? parseFloat(String(row.area_km2)) : (row.area_km2 ?? 1)
    const density = area_km2 > 0 ? Math.round(population / area_km2) : 0
    const tierNum = row.tier ? Number(String(row.tier).replace('tier_', '')) as 1 | 2 | 3 : 2
    return {
      id: row.id,
      code: row.code || row.id,
      name: row.name,
      kec_code: row.kecamatan?.code || row.kec_code || '',
      kec_name: row.kecamatan?.name || row.kec_name || '',
      kab_code: row.kecamatan?.kabupaten_code || row.kab_code || '',
      kab_name: row.kab_name || '',
      tier: tierNum,
      lat,
      lng,
      population,
      area_km2,
      density,
      urban_index: Number(row.urban_index ?? 50),
      income_index: Number(row.income_index ?? 50),
      tourist_index: Number(row.tourist_index ?? 30),
      transport_index: Number(row.transport_index ?? 50),
      poi_density_index: Number(row.poi_density_index ?? 30),
      mall_proximity_index: Number(row.mall_proximity_index ?? 30),
      existing_store_density: Number(row.existing_store_density ?? 0),
      is_coastal: Boolean(row.is_coastal),
    }
  })

  kelurahanCache = result
  kelurahanCacheTime = now
  return result
}

export function invalidateKelurahanCache() {
  kelurahanCache = null
  kelurahanCacheTime = 0
}

/**
 * Fetch a single kelurahan from the DB by its primary key.
 *
 * Why this exists: the analyze API originally used `getKelurahan(id)` from the
 * static bali-kelurahan.ts file, which only contains ~220 representative
 * villages. The real DB has 716 kelurahan/desa. Clicking any DB-only
 * kelurahan on the map returned "kelurahan not found". This function fetches
 * the full record from the DB and reshapes it to match the `Kelurahan`
 * interface that the scoring engine expects.
 *
 * Returns `null` if the kelurahan is not in the DB.
 */
export async function getKelurahanFromDB(id: string): Promise<Kelurahan | null> {
  let row: any = null
  try {
    row = await prisma.kelurahan.findUnique({
      where: { id },
      include: {
        kecamatan: { select: { name: true, code: true, kabupaten_code: true } },
      },
    })
  } catch {
    return null
  }

  if (!row) return null

  const lat = typeof row.lat === 'object' ? parseFloat(String(row.lat)) : (row.lat as number)
  const lng = typeof row.lng === 'object' ? parseFloat(String(row.lng)) : (row.lng as number)
  const population = typeof row.population === 'object' ? parseFloat(String(row.population)) : (row.population ?? 0)
  const area_km2 = typeof row.area_km2 === 'object' ? parseFloat(String(row.area_km2)) : (row.area_km2 ?? 1)
  const density = area_km2 > 0 ? Math.round(population / area_km2) : 0
  const tierNum = row.tier ? Number(String(row.tier).replace('tier_', '')) as 1 | 2 | 3 : 2

  return {
    id: row.id,
    code: row.code || row.id,
    name: row.name,
    kec_code: row.kecamatan?.code || row.kec_code || '',
    kec_name: row.kecamatan?.name || row.kec_name || '',
    kab_code: row.kecamatan?.kabupaten_code || row.kab_code || '',
    kab_name: row.kab_name || '',
    tier: tierNum,
    lat,
    lng,
    population,
    area_km2,
    density,
    urban_index: Number(row.urban_index ?? 50),
    income_index: Number(row.income_index ?? 50),
    tourist_index: Number(row.tourist_index ?? 30),
    transport_index: Number(row.transport_index ?? 50),
    poi_density_index: Number(row.poi_density_index ?? 30),
    mall_proximity_index: Number(row.mall_proximity_index ?? 30),
    existing_store_density: Number(row.existing_store_density ?? 0),
    is_coastal: Boolean(row.is_coastal),
  }
}

// ===== Malls / POIs / Brands loaders (DB = source of truth, not Bali-only) =====

let mallsCache: any[] | null = null
let mallsCacheTime = 0
const MALLS_CACHE_TTL_MS = 60_000

/** Load ALL malls from the DB (shape-compatible with the static BALI_MALLS usage). */
export async function loadMallsFromDB(): Promise<any[]> {
  const now = Date.now()
  if (mallsCache && (now - mallsCacheTime) < MALLS_CACHE_TTL_MS) return mallsCache
  const rows = await prisma.mall.findMany({
    select: {
      id: true, name: true, lat: true, lng: true, kec: true, kab: true, city: true, country: true,
      gla_m2: true, opened_year: true, class: true, anchor_count: true,
      has_cinema: true, has_supermarket: true, has_department_store: true,
      visitor_estimate_daily: true,
    },
  })
  const result = rows.map(r => ({
    ...r,
    lat: typeof r.lat === 'object' ? parseFloat(String(r.lat)) : r.lat,
    lng: typeof r.lng === 'object' ? parseFloat(String(r.lng)) : r.lng,
    class: r.class ? String(r.class) : 'regional',
  }))
  mallsCache = result
  mallsCacheTime = now
  return result
}

export function invalidateMallsCache() {
  mallsCache = null
  mallsCacheTime = 0
}

let poisCache: any[] | null = null
let poisCacheTime = 0
const POIS_CACHE_TTL_MS = 60_000

/** Load ALL POIs from the DB (tourist + civic + crowd-density sources). */
export async function loadPoisFromDB(): Promise<any[]> {
  const now = Date.now()
  if (poisCache && (now - poisCacheTime) < POIS_CACHE_TTL_MS) return poisCache
  const rows = await prisma.poi.findMany({
    select: { id: true, name: true, type: true, lat: true, lng: true, kec: true, kab: true, city: true, country: true, magnitude: true, notes: true },
  })
  const result = rows.map(r => ({
    ...r,
    lat: typeof r.lat === 'object' ? parseFloat(String(r.lat)) : r.lat,
    lng: typeof r.lng === 'object' ? parseFloat(String(r.lng)) : r.lng,
    type: String(r.type),
  }))
  poisCache = result
  poisCacheTime = now
  return result
}

export function invalidatePoisCache() {
  poisCache = null
  poisCacheTime = 0
}

let brandsCache: any[] | null = null
let brandsCacheTime = 0
const BRANDS_CACHE_TTL_MS = 60_000

/** Load the full brand catalog from the DB (incl. brands created by scraping). */
export async function loadBrandsFromDB(): Promise<any[]> {
  const now = Date.now()
  if (brandsCache && (now - brandsCacheTime) < BRANDS_CACHE_TTL_MS) return brandsCache
  const rows = await prisma.brand.findMany({
    select: {
      id: true, name: true, parent: true, category: true, origin_country: true,
      typical_size_m2: true, brand_strength: true, is_active: true,
    },
    where: { is_active: true },
  })
  const result = rows.map(r => ({
    ...r,
    parent: String(r.parent),
    category: String(r.category),
  }))
  brandsCache = result
  brandsCacheTime = now
  return result
}

export function invalidateBrandsCache() {
  brandsCache = null
  brandsCacheTime = 0
}
