'use client'

/**
 * /settings — User preferences + AI configuration
 */

import { Settings } from '@/components/locinsight/settings'
import { PermissionGate } from '@/components/locinsight/permission-gate'

export default function SettingsPage() {
  return (
    <PermissionGate menu="settings">
      <Settings />
    </PermissionGate>
  )
}
