'use client'

/**
 * /brands — MAP & MAA portfolio coverage
 */

import { BrandsCoverage } from '@/components/locinsight/brands-coverage'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function BrandsPage() {
  const { overview, setSelectedKelurahanId, navigate } = useApp()

  return (
    <PermissionGate menu="brands">
      {overview && (
        <BrandsCoverage
          brands={overview.brands}
          stores={overview.stores}
          onSelectKelurahan={(id) => {
            setSelectedKelurahanId(id)
            navigate('/analysis')
          }}
        />
      )}
    </PermissionGate>
  )
}
