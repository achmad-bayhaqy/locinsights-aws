// Shared types for LocInsights client-side components

export type Tier = 1 | 2 | 3

export interface WeightedFactor {
  name: string
  weight: number
  raw_value: number
  weighted: number
}

export type Recommendation = 'high_priority' | 'priority' | 'monitor' | 'avoid'

export interface OpportunityScore {
  kelurahan_id: string
  kelurahan_name: string
  kec_name: string
  kab_name: string
  tier: Tier
  lat: number
  lng: number
  composite_score: number
  recommendation: Recommendation
  factors: WeightedFactor[]
  potential_market_share: number
  estimated_daily_customers: number
  projected_monthly_revenue_juta: number
  nearest_mall_distance_km: number
  nearest_mall_name: string | null
  nearby_existing_stores: number
  cannibalization_risk: 'low' | 'medium' | 'high'
  white_space_summary: string
}

export interface Store {
  id: string
  brand_id: string
  brand_name: string
  brand_category: string
  parent: 'MAP' | 'MAA'
  name: string
  lat: number
  lng: number
  kec: string
  kab: string
  is_in_mall: boolean
  mall_id?: string
  mall_name?: string
  address: string
  opened_year: number
  confirmed: boolean
}

export interface Mall {
  id: string
  name: string
  lat: number
  lng: number
  kec: string
  kab: string
  gla_m2: number
  opened_year: number
  class: string
  visitor_estimate_daily: number
}

export interface POI {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  kec: string
  kab: string
  magnitude: number
  notes: string
  source?: string
}

export interface KelurahanLite {
  id: string
  name: string
  kec_code: string
  kec_name: string
  kab_code: string
  kab_name: string
  tier: Tier
  lat: number
  lng: number
  population: number
  area_km2: number
  density: number
  urban_index: number
  income_index: number
  tourist_index: number
  transport_index: number
  poi_density_index: number
  is_coastal: boolean
}

export interface Brand {
  id: string
  name: string
  parent: 'MAP' | 'MAA'
  category: string
  origin_country: string
  format: string
  location_preference: 'mall' | 'street' | 'both'
  typical_size_m2: number
  target_audience: string
  price_segment: 'mass' | 'mid' | 'premium' | 'luxury'
  brand_strength: number
  notes: string
}

export interface DashboardStats {
  total_kelurahan: number
  total_stores: number
  total_malls: number
  tier_1_stores: number
  tier_2_stores: number
  tier_3_stores: number
  high_priority_count: number
  priority_count: number
  monitor_count: number
  avoid_count: number
  avg_composite_score: number
  top_5_kelurahan: OpportunityScore[]
  stores_by_kabupaten: { kab: string; count: number }[]
  brands_coverage: { brand: string; stores: number; category: string }[]
  malls_without_map_anchor: { name: string; kec: string; kab: string }[]
}

export interface OverviewData {
  stats: DashboardStats
  top_opportunities: OpportunityScore[]
  stores: Store[]
  malls: Mall[]
  kelurahan: KelurahanLite[]
  brands: Brand[]
  pois: POI[]
}

export interface AnalyzeResponse {
  kelurahan: KelurahanLite & {
    mall_proximity_index: number
    existing_store_density: number
  }
  score: OpportunityScore
  nearby_stores: (Store & { distance_km: number })[]
  nearby_malls: (Mall & { distance_km: number })[]
  nearby_pois: (POI & { distance_km: number })[]
}
