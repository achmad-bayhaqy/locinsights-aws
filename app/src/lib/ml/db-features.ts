/**
 * DB-backed ML feature vector builder — R1b + R3 of the ML improvement plan.
 *
 * WHY THIS EXISTS (ML1 audit finding):
 *   The previous builder (dataset.ts buildFeatureVector) read ONLY the static
 *   BALI_* arrays. The DB has 2,173 kelurahan (incl. Jabodetabek + other
 *   provinces) whose IDs follow the Kemendagri code scheme — completely
 *   different from the static kec_code+osm_id IDs. ML predictions for
 *   DB-only villages therefore returned null. This builder resolves the
 *   kelurahan + brand from the DB first and falls back to the static set.
 *
 * POSTGIS PUSHDOWN (R3):
 *   All spatial features are computed IN POSTGRES with ST_DWithin / KNN
 *   (<->) operators, using the GiST indexes on stores/malls/pois.geom —
 *   instead of O(n×m) Haversine loops in JS.
 *
 * Feature order MUST match FEATURE_NAMES in dataset.ts (17 features).
 */
import { prisma } from '@/lib/db'
import { FEATURE_NAMES } from './dataset'
import { BALI_KELURAHAN } from '@/lib/data/bali-kelurahan'
import { BRANDS } from '@/lib/data/brands'

export interface DbFeatureVector {
  X: number[]
  kelurahan_id: string
  kelurahan_name: string
  kel_source: 'db' | 'static'
  brand_id: string
  brand_name: string
  brand_source: 'db' | 'static'
  lat: number
  lng: number
}

interface KelRow {
  id: string
  name: string
  lat: number
  lng: number
  population: number
  density: number
  urban_index: number
  income_index: number
  tourist_index: number
  transport_index: number
  poi_density_index: number
  is_coastal: boolean
  tier: 1 | 2 | 3
}

interface BrandRow {
  id: string
  name: string
  category: string
  brand_strength: number
  typical_size_m2: number
}

function num(v: any, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'object' && v.constructor?.name === 'Decimal') return parseFloat(String(v))
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Resolve a kelurahan from the DB (Kemendagri IDs incl. Jabodetabek), else static. */
async function resolveKelurahan(kelurahanId: string): Promise<(KelRow & { source: 'db' | 'static' }) | null> {
  try {
    const row: any = await prisma.kelurahan.findUnique({
      where: { id: kelurahanId },
      select: {
        id: true, name: true, lat: true, lng: true, population: true, area_km2: true,
        urban_index: true, income_index: true, tourist_index: true, transport_index: true,
        poi_density_index: true, is_coastal: true, tier: true,
      },
    })
    if (row) {
      const lat = num(row.lat), lng = num(row.lng)
      const population = num(row.population)
      const areaKm2 = num(row.area_km2, 1) || 1
      const tierNum = row.tier ? Number(String(row.tier).replace('tier_', '')) as 1 | 2 | 3 : 2
      return {
        id: row.id,
        name: row.name,
        lat, lng,
        population,
        density: Math.round(population / areaKm2),
        urban_index: num(row.urban_index, 50),
        income_index: num(row.income_index, 50),
        tourist_index: num(row.tourist_index, 30),
        transport_index: num(row.transport_index, 50),
        poi_density_index: num(row.poi_density_index, 30),
        is_coastal: Boolean(row.is_coastal),
        tier: tierNum,
        source: 'db' as const,
      }
    }
  } catch { /* DB unavailable → static fallback */ }

  const kel = BALI_KELURAHAN.find(k => k.id === kelurahanId)
  if (!kel) return null
  return {
    id: kel.id, name: kel.name, lat: kel.lat, lng: kel.lng,
    population: kel.population, density: kel.density,
    urban_index: kel.urban_index, income_index: kel.income_index,
    tourist_index: kel.tourist_index, transport_index: kel.transport_index,
    poi_density_index: kel.poi_density_index,
    is_coastal: kel.is_coastal, tier: kel.tier,
    source: 'static' as const,
  }
}

/** Resolve a brand: DB brands table (incl. scraped brands), else static directory. */
async function resolveBrand(brandId?: string): Promise<(BrandRow & { source: 'db' | 'static' }) | null> {
  const wanted = brandId || 'BR001' // default: Starbucks (F&B anchor)
  try {
    const row = await prisma.brand.findUnique({
      where: { id: wanted },
      select: { id: true, name: true, category: true, brand_strength: true, typical_size_m2: true },
    })
    if (row) {
      return {
        id: row.id, name: row.name, category: String(row.category),
        brand_strength: num(row.brand_strength, 0.5),
        typical_size_m2: num(row.typical_size_m2, 100),
        source: 'db' as const,
      }
    }
  } catch { /* fall through to static */ }
  const b = BRANDS.find(x => x.id === wanted)
  if (!b) return null
  return {
    id: b.id, name: b.name, category: String(b.category),
    brand_strength: b.brand_strength, typical_size_m2: b.typical_size_m2,
    source: 'static' as const,
  }
}

/**
 * Spatial features via PostGIS pushdown (GiST-indexed).
 * All in ONE round-trip using a single $queryRaw with CTEs.
 * tenantId empty string = no tenant filter (platform-wide).
 */
async function spatialFeatures(
  lat: number, lng: number, brandId: string, tenantId: string | null,
): Promise<{ nearest_mall_distance_km: number; nearest_mall_gla_k: number; same_brand_within_2km: number; other_brand_within_2km: number; map_stores_within_5km: number }> {
  const point = `ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)::geography`
  const tenantClause = tenantId ? `AND tenant_id = '${tenantId.replace(/'/g, "''")}'` : ''
  const sql = `
    WITH nearest_mall AS (
      SELECT COALESCE(gla_m2, 0) AS gla_m2,
             ST_Distance(geom, ${point}) / 1000.0 AS d_km
      FROM malls
      WHERE COALESCE(gla_m2, 0) > 0
      ORDER BY geom <-> ${point}
      LIMIT 1
    ),
    same_brand AS (
      SELECT count(*)::int AS n FROM stores
      WHERE brand_id = $1 AND ST_DWithin(geom, ${point}, 2000) ${tenantClause}
    ),
    other_brand AS (
      SELECT count(*)::int AS n FROM stores
      WHERE brand_id <> $1 AND ST_DWithin(geom, ${point}, 2000) ${tenantClause}
    ),
    map_stores AS (
      SELECT count(*)::int AS n FROM stores
      WHERE ST_DWithin(geom, ${point}, 5000) ${tenantClause}
    )
    SELECT
      (SELECT COALESCE(d_km, 999) FROM nearest_mall) AS nearest_mall_distance_km,
      (SELECT COALESCE(gla_m2, 0) FROM nearest_mall) AS nearest_mall_gla_m2,
      (SELECT n FROM same_brand) AS same_brand_within_2km,
      (SELECT n FROM other_brand) AS other_brand_within_2km,
      (SELECT n FROM map_stores) AS map_stores_within_5km
  `
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(sql, brandId)
    const r = rows[0]
    return {
      nearest_mall_distance_km: Math.round(num(r.nearest_mall_distance_km, 999) * 10) / 10,
      nearest_mall_gla_k: Math.round(num(r.nearest_mall_gla_m2, 0) / 1000),
      same_brand_within_2km: num(r.same_brand_within_2km),
      other_brand_within_2km: num(r.other_brand_within_2km),
      map_stores_within_5km: num(r.map_stores_within_5km),
    }
  } catch {
    // PostGIS unavailable → conservative neutral defaults
    return { nearest_mall_distance_km: 999, nearest_mall_gla_k: 0, same_brand_within_2km: 0, other_brand_within_2km: 0, map_stores_within_5km: 0 }
  }
}

/**
 * Build the 17-feature inference vector. DB-first resolution, PostGIS spatial
 * pushdown, static fallback. Returns null only if the kelurahan is unknown.
 */
export async function buildFeatureVectorFromDB(
  kelurahanId: string,
  brandId?: string,
  opts: { tenantId?: string | null } = {},
): Promise<DbFeatureVector | null> {
  const kel = await resolveKelurahan(kelurahanId)
  if (!kel) return null
  const brand = await resolveBrand(brandId)
  if (!brand) return null

  const tenantId = opts.tenantId ?? null
  const spatial = await spatialFeatures(kel.lat, kel.lng, brand.id, tenantId)
  const touristMultiplier = 1 + (kel.tourist_index / 100) * 1.5

  const X = [
    kel.population,
    kel.density,
    kel.urban_index,
    kel.income_index,
    kel.tourist_index,
    kel.transport_index,
    kel.poi_density_index,
    kel.is_coastal ? 1 : 0,
    kel.tier,
    spatial.nearest_mall_distance_km,
    spatial.nearest_mall_gla_k,
    spatial.same_brand_within_2km,
    spatial.other_brand_within_2km,
    spatial.map_stores_within_5km,
    brand.brand_strength,
    brand.typical_size_m2,
    Math.round(touristMultiplier * 100) / 100,
  ]

  if (X.length !== FEATURE_NAMES.length) return null

  return {
    X,
    kelurahan_id: kel.id,
    kelurahan_name: kel.name,
    kel_source: kel.source,
    brand_id: brand.id,
    brand_name: brand.name,
    brand_source: brand.source,
    lat: kel.lat,
    lng: kel.lng,
  }
}

export { FEATURE_NAMES }
