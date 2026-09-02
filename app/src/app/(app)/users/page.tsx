'use client'

/**
 * /users — User, role & permission management (task F0E)
 *
 * Visible to superadmin + tenant_admin + admin only (enforced by PermissionGate).
 * Renders <UserManagement /> which itself renders 3 (or 4 with audit) tabs:
 *   1. Tenants   (superadmin only)
 *   2. Users
 *   3. Roles
 *   4. Audit log
 */

import { PermissionGate } from '@/components/locinsight/permission-gate'
import { UserManagement } from '@/components/locinsight/user-management'

export default function UsersPage() {
  return (
    <PermissionGate menu="users" roles={['superadmin', 'tenant_admin', 'admin']}>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-[22px] font-bold text-[var(--brand-ink)]">User Management</h1>
          <p className="text-[13px] text-[var(--brand-ink)]/60">
            Manage tenants, users, roles, and per-menu permissions. Every mutation is captured in the audit log.
          </p>
        </div>
        <UserManagement />
      </div>
    </PermissionGate>
  )
}
