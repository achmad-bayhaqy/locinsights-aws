'use client'

/**
 * /analysis — Per-kelurahan deep analysis
 */

import { Analysis } from '@/components/locinsight/analysis'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function AnalysisPage() {
  const {
    overview,
    selectedKelurahanId,
    setSelectedKelurahanId,
  } = useApp()

  return (
    <PermissionGate menu="analysis">
      {overview && (
        <Analysis
          kelurahanList={overview.kelurahan}
          brands={overview.brands}
          selectedKelurahanId={selectedKelurahanId}
          onSelectKelurahan={setSelectedKelurahanId}
        />
      )}
    </PermissionGate>
  )
}
