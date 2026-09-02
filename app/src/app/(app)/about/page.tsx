'use client'

/**
 * /about — Project overview & data sources
 */

import { About } from '@/components/locinsight/about'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function AboutPage() {
  return (
    <PermissionGate menu="about">
      <About />
    </PermissionGate>
  )
}
