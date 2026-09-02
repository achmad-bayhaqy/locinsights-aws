'use client'

/**
 * /map — Interactive Map Explorer
 */

import { MapExplorer } from '@/components/locinsight/map-explorer'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function MapPage() {
  const {
    overview,
    selectedKelurahanId,
    setSelectedKelurahanId,
    navigate,
  } = useApp()

  return (
    <PermissionGate menu="map">
      {overview && (
        <MapExplorer
          opportunities={overview.top_opportunities}
          stores={overview.stores}
          malls={overview.malls}
          pois={overview.pois}
          selectedKelurahanId={selectedKelurahanId}
          onSelectKelurahan={(id) => setSelectedKelurahanId(id || null)}
          onOpenOpportunities={() => navigate('/opportunities')}
          onOpenAnalysis={() => navigate('/analysis')}
        />
      )}
    </PermissionGate>
  )
}
