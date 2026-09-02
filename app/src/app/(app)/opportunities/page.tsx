'use client'

/**
 * /opportunities — Top expansion sites
 */

import { Opportunities } from '@/components/locinsight/opportunities'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function OpportunitiesPage() {
  const {
    overview,
    selectedKelurahanId,
    setSelectedKelurahanId,
    navigate,
  } = useApp()

  return (
    <PermissionGate menu="opportunities">
      {overview && (
        <Opportunities
          opportunities={overview.top_opportunities}
          brands={overview.brands}
          selectedKelurahanId={selectedKelurahanId}
          onSelectKelurahan={(id) => {
            setSelectedKelurahanId(id)
            navigate('/analysis')
          }}
        />
      )}
    </PermissionGate>
  )
}
