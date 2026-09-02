'use client'

/**
 * /competitors — Competitor Intel
 */

import { CompetitorIntel } from '@/components/locinsight/competitor-intel'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function CompetitorsPage() {
  const { navigate } = useApp()

  return (
    <PermissionGate menu="competitors">
      <CompetitorIntel onScrapeMore={() => navigate('/scraper')} />
    </PermissionGate>
  )
}
