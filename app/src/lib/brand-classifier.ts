/**
 * Brand Classifier — decides whether a scraped store belongs to:
 *   1. MAA/MAP portfolio  → save to `stores` table with brand_id + parent
 *   2. Known competitor   → save to `competitor_stores` table
 *   3. Other / unknown    → save to `competitor_stores` table with brand_name = actual name
 *
 * This module prevents the "store pollution" issue where scraped non-MAA brands
 * (Starbucks, Zara, Indomaret, etc.) were being written into the master `stores`
 * table with `brand_id='BR_SCRAPER'` and `parent='MAP'`.
 *
 * Sources:
 *   - Brand catalog: src/lib/data/brands.ts (MAP + MAA portfolio)
 *   - Competitor catalog: src/lib/data/competitor-brands.ts
 */

import { prisma } from '@/lib/db'
import { BRANDS } from '@/lib/data/brands'
import { COMPETITOR_BRANDS } from '@/lib/data/competitor-brands'

export type SaveTarget = 'maa_store' | 'competitor' | 'other'

export interface ClassificationResult {
  target: SaveTarget
  /** When target='maa_store', this is the brand_id from our Brand table */
  brand_id?: string
  /** When target='maa_store', this is 'MAP' or 'MAA' */
  parent?: 'MAP' | 'MAA'
  /** Normalized brand name (e.g., "Starbucks" not "starbucks kuta") */
  brand_name: string
  /** Category (e.g., "food_beverage", "convenience_store") */
  brand_category: string
  /** Human-readable reason for the classification (for UI display) */
  reason: string
}

// In-memory cache of MAA/MAP brand names → {id, parent, category}
// Avoids DB round-trip on every classification.
let maaBrandCache: Array<{
  name: string
  name_lower: string
  id: string
  parent: 'MAP' | 'MAA'
  category: string
}> | null = null

function getMaaBrandCache(): typeof maaBrandCache {
  if (maaBrandCache !== null) return maaBrandCache
  maaBrandCache = BRANDS.map(b => ({
    name: b.name,
    name_lower: b.name.toLowerCase(),
    id: b.id,
    parent: b.parent,
    category: b.category,
  }))
  return maaBrandCache
}

/**
 * Classify a scraped store based on its brand_name.
 *
 * @param brandName — brand name extracted from OSM tags (e.g., "Starbucks", "Indomaret")
 * @returns ClassificationResult — where to save it + metadata
 */
export function classifyScrapedBrand(brandName: string): ClassificationResult {
  const name = (brandName || '').trim()
  const nameLower = name.toLowerCase()

  if (!name) {
    return {
      target: 'other',
      brand_name: 'Unknown',
      brand_category: 'other',
      reason: 'No brand name extracted from OSM tags',
    }
  }

  // 1) Check MAA/MAP brand catalog (exact + substring match)
  const maaBrands = getMaaBrandCache()!
  for (const b of maaBrands) {
    if (nameLower === b.name_lower) {
      return {
        target: 'maa_store',
        brand_id: b.id,
        parent: b.parent,
        brand_name: b.name,
        brand_category: b.category,
        reason: `Matches MAA/MAP brand "${b.name}" (id=${b.id}, parent=${b.parent})`,
      }
    }
  }
  // Substring match (e.g., "Starbucks Kuta" matches "Starbucks")
  for (const b of maaBrands) {
    if (nameLower.includes(b.name_lower)) {
      return {
        target: 'maa_store',
        brand_id: b.id,
        parent: b.parent,
        brand_name: b.name,
        brand_category: b.category,
        reason: `Contains MAA/MAP brand "${b.name}" (id=${b.id}, parent=${b.parent})`,
      }
    }
  }

  // 2) Check competitor brand catalog
  for (const c of COMPETITOR_BRANDS) {
    const cLower = c.name.toLowerCase()
    if (nameLower === cLower || nameLower.includes(cLower)) {
      return {
        target: 'competitor',
        brand_name: c.name,
        brand_category: c.category,
        reason: `Matches tracked competitor brand "${c.name}"`,
      }
    }
  }

  // 3) Other / unknown — also goes to competitor_stores with actual brand_name
  return {
    target: 'other',
    brand_name: name,
    brand_category: 'other',
    reason: `Not in MAA/MAP portfolio or tracked competitor list — saved as "other" competitor for intel`,
  }
}

/**
 * Batch-classify many brand names at once.
 * Returns a map of brandName → ClassificationResult.
 */
export function classifyBatch(brandNames: string[]): Map<string, ClassificationResult> {
  const map = new Map<string, ClassificationResult>()
  for (const n of brandNames) {
    if (!map.has(n)) {
      map.set(n, classifyScrapedBrand(n))
    }
  }
  return map
}
