'use client'

/**
 * /ab — A/B Simulator
 */

import { ABTestSimulator } from '@/components/locinsight/ab-test-simulator'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function ABPage() {
  return (
    <PermissionGate menu="ab">
      <ABTestSimulator />
    </PermissionGate>
  )
}
