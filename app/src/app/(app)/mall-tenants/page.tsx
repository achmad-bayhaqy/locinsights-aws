'use client'

/**
 * /mall-tenants — Live mall tenant audit
 */

import { MallTenants } from '@/components/locinsight/mall-tenants'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function MallTenantsPage() {
  const { overview } = useApp()

  return (
    <PermissionGate menu="mall_tenants">
      {overview && <MallTenants malls={overview.malls} />}
    </PermissionGate>
  )
}
