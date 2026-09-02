'use client'

/**
 * /reports — Export PDF/CSV/JSON
 */

import { Reports } from '@/components/locinsight/reports'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function ReportsPage() {
  return (
    <PermissionGate menu="reports">
      <Reports />
    </PermissionGate>
  )
}
