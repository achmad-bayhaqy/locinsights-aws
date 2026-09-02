/**
 * Build a synthetic training dataset for the GBR revenue model.
 *
 * Phase 3a — realistic ML training without real sales data.
 * Targets are derived from the heuristic engine + multiplicative log-normal
 * noise (mean 1, sigma 0.35) to simulate the variability of real sales.
 *
 * When actual POS data becomes available, replace this with a `loadRealDataset()`
 * function that reads sales records from the DB.
 */
import { BALI_KELURAHAN, haversineKm } from '@/lib/data/bali-kelurahan'
import { BALI_STORES } from '@/lib/data/bali-stores'
import { BALI_MALLS } from '@/lib/data/bali-malls'
import { BRANDS } from '@/lib/data/brands'

export const FEATURE_NAMES = [
  'population',
  'density',
  'urban_index',
  'income_index',
  'tourist_index',
  'transport_index',
  'poi_density_index',
  'is_coastal',
  'tier',
  'nearest_mall_distance_km',
  'nearest_mall_gla_k',
  'same_brand_within_2km',
  'other_brand_within_2km',
  'map_stores_within_5km',
  'brand_strength',
  'typical_size_m2',
  'tourist_multiplier',
] as const

export interface DatasetRow {
  X: number[]
  y: number
  kelurahan_id: string
  brand_id?: string
}

function logNormalNoise(mean: number, sigma: number, seed: () => number): number {
  // Box-Muller transform
  const u1 = Math.max(seed(), 1e-9)
  const u2 = seed()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean * Math.exp(sigma * z)
}

/**
 * Build the training dataset. Each (kelurahan × brand) pair is one row.
 * With 172 kelurahan × 5 representative brands = 860 rows.
 */
export function buildTrainingDataset(seed = 42): DatasetRow[] {
  let rngState = seed
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) % 0x80000000
    return rngState / 0x80000000
  }

  // Representative brands (one per category) — keeps training time reasonable
  const REPRESENTATIVE_BRANDS = [
    'BR001', // Starbucks (F&B)
    'BR101', // Sports Station (sports)
    'BR201', // Sogo (department store)
    'BR301', // (may not exist — filter)
    'BR401', // (may not exist — filter)
  ].map(id => BRANDS.find(b => b.id === id)).filter(Boolean) as typeof BRANDS

  // If we ended up with too few brands, fall back to first 5 brands
  if (REPRESENTATIVE_BRANDS.length < 3) {
    REPRESENTATIVE_BRANDS.push(...BRANDS.slice(0, 5).filter(b => !REPRESENTATIVE_BRANDS.includes(b)))
  }

  const rows: DatasetRow[] = []

  for (const kel of BALI_KELURAHAN) {
    // Pre-compute mall proximity per kelurahan
    let nearestMallDist = Infinity
    let nearestMallGla = 0
    for (const m of BALI_MALLS) {
      if (m.visitor_estimate_daily === 0) continue
      const d = haversineKm(kel.lat, kel.lng, m.lat, m.lng)
      if (d < nearestMallDist) {
        nearestMallDist = d
        nearestMallGla = m.gla_m2
      }
    }

    const mapStoresWithin5km = BALI_STORES.filter(s => haversineKm(kel.lat, kel.lng, s.lat, s.lng) <= 5).length

    for (const brand of REPRESENTATIVE_BRANDS) {
      // Count same-brand and other-brand within 2km
      let sameBrand = 0
      let otherBrand = 0
      for (const s of BALI_STORES) {
        const d = haversineKm(kel.lat, kel.lng, s.lat, s.lng)
        if (d <= 2) {
          if (s.brand_id === brand.id) sameBrand += 1
          else otherBrand += 1
        }
      }

      const touristMultiplier = 1 + (kel.tourist_index / 100) * 1.5

      // Synthetic target: derive from plausible revenue formula + noise
      // (similar but NOT identical to the heuristic engine — adds realistic variability)
      const tradeAreaPop = kel.population * 1.4
      const conversionRate = brand.category === 'food_beverage' ? 0.02 : brand.category === 'sports' ? 0.005 : 0.008
      const ticketSize = brand.category === 'food_beverage' ? 60 : brand.category === 'sports' ? 700 : 350
      const marketShare = 0.4 / (1 + Math.max(0, mapStoresWithin5km) * 0.15 + sameBrand * 0.3)
      const baseRevenue = (tradeAreaPop * conversionRate * marketShare * touristMultiplier * ticketSize * 30) / 1000
      const noise = logNormalNoise(1.0, 0.35, rand)
      const target = Math.max(0, Math.round(baseRevenue * noise))

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
        Math.round(nearestMallDist * 10) / 10,
        Math.round(nearestMallGla / 1000),
        sameBrand,
        otherBrand,
        mapStoresWithin5km,
        brand.brand_strength,
        brand.typical_size_m2,
        Math.round(touristMultiplier * 100) / 100,
      ]

      rows.push({ X, y: target, kelurahan_id: kel.id, brand_id: brand.id })
    }
  }

  return rows
}

/**
 * Build feature vector for a single kelurahan+brand for inference.
 */
export function buildFeatureVector(kelurahanId: string, brandId?: string): { X: number[]; brand_name: string } | null {
  const kel = BALI_KELURAHAN.find(k => k.id === kelurahanId)
  if (!kel) return null
  const brand = brandId ? BRANDS.find(b => b.id === brandId) : BRANDS.find(b => b.id === 'BR001') // default Starbucks
  if (!brand) return null

  let nearestMallDist = Infinity
  let nearestMallGla = 0
  for (const m of BALI_MALLS) {
    if (m.visitor_estimate_daily === 0) continue
    const d = haversineKm(kel.lat, kel.lng, m.lat, m.lng)
    if (d < nearestMallDist) {
      nearestMallDist = d
      nearestMallGla = m.gla_m2
    }
  }

  let sameBrand = 0
  let otherBrand = 0
  for (const s of BALI_STORES) {
    const d = haversineKm(kel.lat, kel.lng, s.lat, s.lng)
    if (d <= 2) {
      if (s.brand_id === brand.id) sameBrand += 1
      else otherBrand += 1
    }
  }
  const mapStoresWithin5km = BALI_STORES.filter(s => haversineKm(kel.lat, kel.lng, s.lat, s.lng) <= 5).length
  const touristMultiplier = 1 + (kel.tourist_index / 100) * 1.5

  return {
    X: [
      kel.population,
      kel.density,
      kel.urban_index,
      kel.income_index,
      kel.tourist_index,
      kel.transport_index,
      kel.poi_density_index,
      kel.is_coastal ? 1 : 0,
      kel.tier,
      Math.round(nearestMallDist * 10) / 10,
      Math.round(nearestMallGla / 1000),
      sameBrand,
      otherBrand,
      mapStoresWithin5km,
      brand.brand_strength,
      brand.typical_size_m2,
      Math.round(touristMultiplier * 100) / 100,
    ],
    brand_name: brand.name,
  }
}
