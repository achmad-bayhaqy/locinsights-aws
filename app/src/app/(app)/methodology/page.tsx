'use client'

/**
 * /methodology — Scoring framework & math
 */

import { Methodology } from '@/components/locinsight/methodology'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function MethodologyPage() {
  return (
    <PermissionGate menu="methodology">
      <Methodology />
    </PermissionGate>
  )
}
