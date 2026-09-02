'use client'

/**
 * /ml — ML / AI Engine
 */

import { MLAIEngine } from '@/components/locinsight/ml-ai-engine'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function MLPage() {
  return (
    <PermissionGate menu="ml">
      <MLAIEngine />
    </PermissionGate>
  )
}
