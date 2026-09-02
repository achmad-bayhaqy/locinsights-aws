/**
 * Shared types for the scraper — used by /scrape (run) and /scrape-save (persist).
 */

export interface ScraperResultRow {
  name: string
  type: string
  lat: number
  lng: number
  category: string
  kind: 'store' | 'mall' | 'poi'
  tags: Record<string, string>
  on_land: boolean
  address?: string
  brand_name?: string
  brand_category?: string
  poi_type?: string
  poi_magnitude?: number
  poi_notes?: string
  source: string
}

export interface GeocodedResult {
  lat: number
  lng: number
  display_name: string
  is_in_bali: boolean
  address?: any
}
