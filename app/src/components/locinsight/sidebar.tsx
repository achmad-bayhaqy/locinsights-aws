'use client'

/**
 * LocInsights — Sidebar (left navigation)
 *
 * Refactored for App Router:
 *   • Uses next/link <Link> instead of <button onClick>
 *   • Uses usePathname() for active-state detection
 *   • Reads session.permissions to hide menus the user can't read
 *   • Includes the new "Documentation" (nav.docs) and "User Management" (nav.users) items
 *   • "User Management" is only visible to superadmin + tenant_admin
 *
 * Visual design is identical to the previous version (collapsible rail,
 * Adiperkasa red active state, white-on-ink colour scheme).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Map, Target, Crosshair, Building2, Store, BookOpen,
  FileText, Database, Search, Brain, Shield, GitCompareArrows, Store as StoreIcon,
  Info, PanelLeftOpen, FileQuestion, Users,
  Settings as SettingsIcon, LucideIcon,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import { hasPermission } from '@/lib/permissions'
import type { Permissions, MenuId } from '@/lib/permissions'

// =====================================================
// Nav item model
// =====================================================
export interface NavItem {
  id: MenuId
  href: string
  label: string        // i18n key, e.g. 'nav.dashboard'
  description: string  // i18n key, e.g. 'nav.dashboard.desc'
  icon: LucideIcon
  adminOnly?: boolean        // superadmin + tenant_admin + admin only
  superadminOnly?: boolean   // superadmin only
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    href: '/dashboard',    label: 'nav.dashboard',    description: 'nav.dashboard.desc',    icon: LayoutDashboard },
  { id: 'map',          href: '/map',          label: 'nav.map',          description: 'nav.map.desc',          icon: Map },
  { id: 'opportunities',href: '/opportunities',label: 'nav.opportunities',description: 'nav.opportunities.desc',icon: Target },
  { id: 'analysis',     href: '/analysis',     label: 'nav.analysis',     description: 'nav.analysis.desc',     icon: Crosshair },
  { id: 'brands',       href: '/brands',       label: 'nav.brands',       description: 'nav.brands.desc',       icon: Store },
  { id: 'malls',        href: '/malls',        label: 'nav.malls',        description: 'nav.malls.desc',        icon: Building2 },
  { id: 'competitors',  href: '/competitors',  label: 'nav.competitors',  description: 'nav.competitors.desc',  icon: Shield },
  { id: 'ab',           href: '/ab',           label: 'nav.ab',           description: 'nav.ab.desc',           icon: GitCompareArrows },
  { id: 'ml',           href: '/ml',           label: 'nav.ml',           description: 'nav.ml.desc',           icon: Brain },
  { id: 'mall_tenants', href: '/mall-tenants', label: 'nav.mall_tenants', description: 'nav.mall_tenants.desc', icon: StoreIcon },
  { id: 'reports',      href: '/reports',      label: 'nav.reports',      description: 'nav.reports.desc',      icon: FileText },
  { id: 'data',         href: '/data',         label: 'nav.data',         description: 'nav.data.desc',         icon: Database },
  { id: 'scraper',      href: '/scraper',      label: 'nav.scraper',      description: 'nav.scraper.desc',      icon: Search },
  { id: 'methodology',  href: '/methodology',  label: 'nav.methodology',  description: 'nav.methodology.desc',  icon: BookOpen },
  { id: 'docs',         href: '/docs',         label: 'nav.docs',         description: 'nav.docs.desc',         icon: FileQuestion },
  { id: 'about',        href: '/about',        label: 'nav.about',        description: 'nav.about.desc',        icon: Info },
  { id: 'settings',     href: '/settings',     label: 'nav.settings',     description: 'nav.settings.desc',     icon: SettingsIcon },
  // Users — admin-only (superadmin + tenant_admin + admin)
  { id: 'users',        href: '/users',        label: 'nav.users',        description: 'nav.users.desc',        icon: Users, adminOnly: true },
]

// =====================================================
// Sidebar props (only style/collapse controls now — items are self-contained)
// =====================================================
export interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** Stats are no longer rendered (kept for backwards-compat) */
  stats?: {
    total_kelurahan: number
    total_stores: number
    total_malls: number
  }
  /** Items override (kept for backwards-compat — defaults to NAV_ITEMS) */
  items?: NavItem[]
  /** Active id override (kept for backwards-compat — defaults to usePathname) */
  activeId?: string
  /** onSelect override (kept for backwards-compat — ignored when items are Link-based) */
  onSelect?: (id: string) => void
}

export function Sidebar({ collapsed = false, onToggleCollapse, items, activeId, onSelect }: SidebarProps) {
  const { t } = useLanguage()
  const pathname = usePathname()
  const { data: session } = useSession()

  const perms: Permissions | null = (session?.user?.permissions as Permissions) ?? null
  const role: string | undefined = session?.user?.role

  const effectiveItems = items ?? NAV_ITEMS

  // Filter items by permission + role
  const visibleItems = effectiveItems.filter(item => {
    // Users management — admin-only (superadmin + tenant_admin + admin)
    if (item.adminOnly && role !== 'superadmin' && role !== 'tenant_admin' && role !== 'admin') {
      return false
    }
    // Superadmin sees everything (bypass per-menu check)
    if (role === 'superadmin') return true
    // Other roles — check read permission
    return hasPermission(perms, item.id, 'read')
  })

  return (
    <aside
      className={cn(
        'bg-[var(--brand-ink)] text-white flex flex-col h-screen sticky top-0 self-start transition-[width] duration-200 ease-in-out z-40 relative',
        collapsed ? 'w-14' : 'w-64'
      )}
      style={{ height: '100vh', position: 'sticky', top: 0, alignSelf: 'flex-start' }}
    >
      {/* Logo / brand */}
      <div className={cn(
        'border-b border-white/10 flex items-center',
        collapsed ? 'px-2 py-4 justify-center' : 'px-5 pt-5 pb-4 gap-2.5'
      )}>
        <img
          src="/logo-white.png"
          alt="LocInsights"
          className="flex-shrink-0 object-contain"
          style={{ width: collapsed ? '32px' : '36px', height: collapsed ? '32px' : '36px' }}
          draggable={false}
        />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[17px] leading-tight">LocInsights</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">{t('common.location_intelligence')}</div>
          </div>
        )}
      </div>

      {/* Collapsed-mode expand button */}
      {collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute top-3 -right-3 w-6 h-6 rounded-full bg-[var(--brand-red)] text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform z-50"
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Nav */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-3 scroll-styled',
        collapsed ? 'px-1.5 space-y-1' : 'px-2.5'
      )}>
        {visibleItems.map(item => {
          const Icon = item.icon
          // Active = exact match OR (item href is /dashboard and pathname is root of (app))
          const isActive = activeId
            ? item.id === activeId
            : (pathname === item.href || pathname?.startsWith(item.href + '/'))
          const labelText = t(item.label)
          const descText = t(item.description)

          // If onSelect is provided (legacy), use button — otherwise use Link
          const inner = (
            <>
              <Icon className={cn('w-4 h-4 flex-shrink-0', collapsed ? 'mx-auto' : 'mt-0.5')} />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium leading-tight">{labelText}</div>
                  <div className={cn(
                    'text-[10.5px] leading-snug mt-0.5',
                    isActive ? 'text-white/80' : 'text-white/40'
                  )}>
                    {descText}
                  </div>
                </div>
              )}
              {collapsed && isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
            </>
          )

          const className = cn(
            'w-full flex items-center rounded-md text-left transition-all duration-150 group relative',
            collapsed ? 'justify-center p-2.5' : 'items-start gap-3 px-3 py-2.5 mb-0.5',
            isActive
              ? 'bg-[var(--brand-red)] text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          )

          if (onSelect) {
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title={collapsed ? labelText : undefined}
                className={className}
              >
                {inner}
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? labelText : undefined}
              className={className}
              aria-current={isActive ? 'page' : undefined}
            >
              {inner}
            </Link>
          )
        })}
      </nav>

      {/* Footer (expanded only) */}
      {!collapsed && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-[9.5px] text-white/40 leading-relaxed">
            {t('common.powered_by')} <span className="text-white/70 font-medium">MAP Active Data Team</span>
          </div>
        </div>
      )}
    </aside>
  )
}
