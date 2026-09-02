'use client'

/**
 * /data — Master data CRUD
 */

import { DataManager } from '@/components/locinsight/data-manager'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function DataPage() {
  return (
    <PermissionGate menu="data">
      <DataManager />
    </PermissionGate>
  )
}
