'use client'

/**
 * /scraper — Auto-scrape OSM data
 */

import { Scraper } from '@/components/locinsight/scraper'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function ScraperPage() {
  return (
    <PermissionGate menu="scraper">
      <Scraper />
    </PermissionGate>
  )
}
