/**
 * Competitor brand catalog — predefined list of non-MAP competitor brands in Indonesia.
 * Used by the competitor scraper.
 *
 * Each brand has ONE OSM tag filter that uniquely identifies its outlets.
 * We deliberately avoid broad tags like `"shop"="convenience"` (which returns
 * hundreds of unrelated stores in Bali) and instead use `brand` or `name` filters.
 */

export interface CompetitorBrand {
  name: string
  category: 'convenience_store' | 'fast_food' | 'coffee' | 'fashion' | 'beauty' | 'supermarket' | 'pharmacy' | 'other'
  /** Single OSM tag filter that uniquely identifies this brand's outlets */
  osm_tag: string
  /** Fallback tag (tried if primary returns empty) */
  osm_tag_fallback?: string
}

export const COMPETITOR_BRANDS: CompetitorBrand[] = [
  // === Convenience stores ===
  { name: 'Indomaret', category: 'convenience_store', osm_tag: '"brand"="Indomaret"', osm_tag_fallback: '"name"="Indomaret"' },
  { name: 'Alfamart', category: 'convenience_store', osm_tag: '"brand"="Alfamart"', osm_tag_fallback: '"name"="Alfamart"' },
  { name: 'Circle K', category: 'convenience_store', osm_tag: '"brand"="Circle K"', osm_tag_fallback: '"name"~"Circle K"' },
  { name: 'FamilyMart', category: 'convenience_store', osm_tag: '"brand"="FamilyMart"', osm_tag_fallback: '"name"~"FamilyMart"' },

  // === Fast food ===
  { name: "McDonald's", category: 'fast_food', osm_tag: '"brand"="McDonald\'s"', osm_tag_fallback: '"name"~"McDonald|McDonalds|MCD"' },
  { name: 'KFC', category: 'fast_food', osm_tag: '"brand"="KFC"', osm_tag_fallback: '"name"~"^KFC"' },
  { name: 'J.CO Donuts', category: 'fast_food', osm_tag: '"brand"="J.CO Donuts"', osm_tag_fallback: '"name"~"J\\.?CO"' },
  { name: 'Domino Pizza', category: 'fast_food', osm_tag: '"brand"="Domino\'s Pizza"', osm_tag_fallback: '"name"~"Domino"' },
  { name: 'Burger King', category: 'fast_food', osm_tag: '"brand"="Burger King"', osm_tag_fallback: '"name"~"Burger King"' },
  { name: 'A&W', category: 'fast_food', osm_tag: '"brand"="A&W"', osm_tag_fallback: '"name"~"^A&W"' },

  // === Coffee ===
  { name: 'Janji Jiwa', category: 'coffee', osm_tag: '"brand"="Janji Jiwa"', osm_tag_fallback: '"name"~"Janji Jiwa"' },
  { name: 'Kopi Kenangan', category: 'coffee', osm_tag: '"brand"="Kopi Kenangan"', osm_tag_fallback: '"name"~"Kopi Kenangan"' },
  { name: 'Excelso', category: 'coffee', osm_tag: '"brand"="Excelso"', osm_tag_fallback: '"name"~"Excelso"' },
  { name: 'Tomoro Coffee', category: 'coffee', osm_tag: '"brand"="Tomoro Coffee"', osm_tag_fallback: '"name"~"Tomoro"' },
  { name: 'Fore Coffee', category: 'coffee', osm_tag: '"brand"="Fore"', osm_tag_fallback: '"name"~"Fore Coffee"' },

  // === Fashion / Lifestyle ===
  { name: 'Uniqlo', category: 'fashion', osm_tag: '"brand"="Uniqlo"', osm_tag_fallback: '"name"~"Uniqlo"' },
  { name: 'H&M', category: 'fashion', osm_tag: '"brand"="H&M"', osm_tag_fallback: '"name"~"^H&M"' },
  { name: 'Miniso', category: 'fashion', osm_tag: '"brand"="Miniso"', osm_tag_fallback: '"name"~"Miniso"' },

  // === Beauty ===
  { name: 'Guardian', category: 'beauty', osm_tag: '"brand"="Guardian"', osm_tag_fallback: '"name"~"^Guardian"' },
  { name: 'Watsons', category: 'beauty', osm_tag: '"brand"="Watsons"', osm_tag_fallback: '"name"~"Watsons"' },
  { name: 'Sociolla', category: 'beauty', osm_tag: '"brand"="Sociolla"', osm_tag_fallback: '"name"~"Sociolla"' },

  // === Supermarket ===
  { name: 'Carrefour', category: 'supermarket', osm_tag: '"brand"="Carrefour"', osm_tag_fallback: '"name"~"Carrefour"' },
  { name: 'Hypermart', category: 'supermarket', osm_tag: '"brand"="Hypermart"', osm_tag_fallback: '"name"~"Hypermart"' },
  { name: 'Lotte Mart', category: 'supermarket', osm_tag: '"brand"="Lotte Mart"', osm_tag_fallback: '"name"~"Lotte Mart"' },
  { name: 'Bintang Supermarket', category: 'supermarket', osm_tag: '"name"~"Bintang Supermarket"' },
  { name: 'Pepito', category: 'supermarket', osm_tag: '"brand"="Pepito"', osm_tag_fallback: '"name"~"^Pepito"' },

  // === Pharmacy ===
  { name: 'Kimia Farma', category: 'pharmacy', osm_tag: '"brand"="Kimia Farma"', osm_tag_fallback: '"name"~"Kimia Farma"' },
  { name: 'K24', category: 'pharmacy', osm_tag: '"brand"="K24"', osm_tag_fallback: '"name"~"^K24"' },
]

// Bali bounding box (used to constrain Overpass queries)
export const BALI_BBOX: [number, number, number, number] = [-8.85, 114.43, -8.05, 115.72]
