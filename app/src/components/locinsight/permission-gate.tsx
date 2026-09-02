'use client'

/**
 * LocInsights — Permission Gate
 *
 * Wraps a page's content with a `hasPermission(perms, menu, 'read')` check.
 * If the user lacks read access for the given menu, renders an "Access denied"
 * message instead of the children.
 *
 * Superadmin bypasses all checks (returns true for any menu/action — see
 * src/lib/permissions.ts and src/lib/auth-server.ts).
 */

import { useSession } from 'next-auth/react'
import { ShieldX } from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import type { Permissions, MenuId, ActionId } from '@/lib/permissions'
import { useLanguage } from '@/lib/i18n/language-provider'

interface PermissionGateProps {
  menu: MenuId | string
  action?: ActionId
  /** Optional role whitelist (e.g. ['superadmin', 'tenant_admin']) */
  roles?: string[]
  children: React.ReactNode
}

export function PermissionGate({
  menu,
  action = 'read',
  roles,
  children,
}: PermissionGateProps) {
  const { data: session, status } = useSession()
  const { t } = useLanguage()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-[12px] text-[var(--brand-ink)]/50">{t('common.loading')}</div>
      </div>
    )
  }

  const role = session?.user?.role
  const perms = session?.user?.permissions as Permissions | undefined

  // Role whitelist check
  if (roles && role && !roles.includes(role)) {
    return <AccessDenied menu={menu} action={action} />
  }

  // Superadmin bypass
  if (role === 'superadmin') {
    return <>{children}</>
  }

  // Permission check
  if (!hasPermission(perms, menu, action)) {
    return <AccessDenied menu={menu} action={action} />
  }

  return <>{children}</>
}

function AccessDenied({ menu, action }: { menu: string; action: string }) {
  const { t } = useLanguage()
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-[var(--brand-red)]/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-7 h-7 text-[var(--brand-red)]" />
        </div>
        <h2 className="font-display text-[20px] font-bold text-[var(--brand-ink)] mb-2">
          Access denied
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 leading-relaxed">
          You don&apos;t have permission to <strong>{action}</strong> on{' '}
          <strong>{menu}</strong>. Contact your tenant administrator if you
          believe this is an error.
        </p>
      </div>
    </div>
  )
}
