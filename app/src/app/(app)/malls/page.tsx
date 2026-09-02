'use client'

/**
 * /malls — Mall network coverage
 */

import { MallNetwork } from '@/components/locinsight/mall-network'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function MallsPage() {
  const { overview, setSelectedKelurahanId, navigate } = useApp()

  return (
    <PermissionGate menu="malls">
      {overview && (
        <MallNetwork
          malls={overview.malls}
          stores={overview.stores}
          brands={overview.brands}
          onSelectKelurahan={(id) => {
            setSelectedKelurahanId(id)
            navigate('/analysis')
          }}
        />
      )}
    </PermissionGate>
  )
}
