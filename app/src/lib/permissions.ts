/**
 * LocInsights — Permission System
 *
 * Defines the menu catalog, role catalog, and default permission matrix.
 * The permission matrix is stored in the `roles.permissions` JSON column
 * and is checked both client-side (UI gating) and server-side (API routes).
 *
 * SaaS Multi-Tenant Architecture:
 *   - System roles (superadmin, admin, data, analyst, viewer) are global, defined here.
 *   - Tenant-scoped custom roles can be created per-tenant via Users Management > Roles tab.
 *   - Each tenant can manage users within their own tenant.
 *   - Only superadmin (platform-level) can manage tenants themselves.
 */

// =====================================================
// MENU CATALOG — 17 menus visible in the sidebar
// =====================================================
export const MENUS = [
  'dashboard',
  'map',
  'opportunities',
  'analysis',
  'brands',
  'malls',
  'competitors',
  'ab',
  'ml',
  'mall_tenants',
  'reports',
  'data',
  'scraper',
  'methodology',
  'docs',
  'about',
  'settings',
  'users',          // Users Management — restricted
] as const

export type MenuId = (typeof MENUS)[number]

// =====================================================
// PERMISSION ACTIONS — per menu, can be granted/denied
// =====================================================
export const ACTIONS = ['read', 'create', 'update', 'delete', 'export'] as const
export type ActionId = (typeof ACTIONS)[number]

export type MenuPermission = Record<ActionId, boolean>
export type Permissions = Record<MenuId, Partial<MenuPermission>>

// =====================================================
// ROLE CATALOG
// =====================================================
export const SYSTEM_ROLES = [
  'superadmin',
  'admin',
  'tenant_admin',
  'data',
  'analyst',
  'viewer',
] as const

export type RoleId = (typeof SYSTEM_ROLES)[number] | string  // string allows tenant-scoped custom roles

// =====================================================
// HELPERS — build default permission matrix
// =====================================================
function fullAccess(): MenuPermission {
  return { read: true, create: true, update: true, delete: true, export: true }
}
function readOnly(): MenuPermission {
  return { read: true, create: false, update: false, delete: false, export: false }
}
function readExport(): MenuPermission {
  return { read: true, create: false, update: false, delete: false, export: true }
}
function none(): MenuPermission {
  return { read: false, create: false, update: false, delete: false, export: false }
}

function allMenus(p: MenuPermission): Permissions {
  return MENUS.reduce((acc, m) => {
    acc[m] = p
    return acc
  }, {} as Permissions)
}

function merge(base: Permissions, overrides: Partial<Permissions>): Permissions {
  return { ...base, ...overrides }
}

// =====================================================
// DEFAULT PERMISSIONS PER ROLE
// =====================================================
export const DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  // superadmin: full CRUD+export on ALL menus including users
  superadmin: allMenus(fullAccess()),

  // admin: full CRUD+export on all EXCEPT users (no user mgmt)
  admin: merge(allMenus(fullAccess()), { users: none() }),

  // tenant_admin: same as admin but scoped to own tenant only (enforced by RLS + tenant_id JWT claim)
  // Can manage users WITHIN their own tenant (read/create/update/delete on users menu)
  tenant_admin: merge(allMenus(fullAccess()), {
    users: { read: true, create: true, update: true, delete: true, export: false },
  }),

  // data: full CRUD only on reports, data, scraper; read-only elsewhere; NO users
  data: merge(allMenus(readOnly()), {
    reports: fullAccess(),
    data: fullAccess(),
    scraper: fullAccess(),
    users: none(),
  }),

  // analyst: read+export on ML/AB/analysis; read-only elsewhere; NO users
  analyst: merge(allMenus(readOnly()), {
    ml: readExport(),
    ab: readExport(),
    analysis: readExport(),
    users: none(),
  }),

  // viewer: read-only everywhere, NO exports, NO users
  viewer: merge(allMenus(readOnly()), {
    users: none(),
    // override all export permissions to false
    dashboard: readOnly(),
    map: readOnly(),
    opportunities: readOnly(),
    brands: readOnly(),
    malls: readOnly(),
    competitors: readOnly(),
    mall_tenants: readOnly(),
    methodology: readOnly(),
    docs: readOnly(),
    about: readOnly(),
    settings: readOnly(),
    reports: readOnly(),
    data: readOnly(),
    scraper: readOnly(),
  }),
}

// =====================================================
// PERMISSION CHECK HELPERS
// =====================================================

/**
 * Check if a user's permission set allows a specific action on a menu.
 * Falls back to false if missing/undefined.
 */
export function hasPermission(
  perms: Permissions | null | undefined,
  menu: MenuId | string,
  action: ActionId
): boolean {
  if (!perms) return false
  const menuPerms = perms[menu as MenuId]
  if (!menuPerms) return false
  return Boolean(menuPerms[action])
}

/**
 * Check if user can see a menu at all (read permission).
 */
export function canSeeMenu(perms: Permissions | null | undefined, menu: MenuId | string): boolean {
  return hasPermission(perms, menu, 'read')
}

/**
 * Check if user has a specific role.
 */
export function hasRole(session: any, ...roles: string[]): boolean {
  const userRole = session?.user?.role
  if (!userRole) return false
  return roles.includes(userRole)
}

/**
 * Check if user is platform-level superadmin.
 */
export function isSuperadmin(session: any): boolean {
  return session?.user?.role === 'superadmin'
}

/**
 * Check if user is a tenant admin (tenant_admin role OR superadmin acting on a tenant).
 */
export function isTenantAdmin(session: any): boolean {
  const role = session?.user?.role
  return role === 'superadmin' || role === 'tenant_admin' || role === 'admin'
}

// =====================================================
// MENU VISIBILITY — which menus appear in the sidebar
// =====================================================
export interface NavItem {
  id: MenuId
  label: string  // i18n key, e.g. 'nav.dashboard'
  description?: string
  adminOnly?: boolean       // hidden for non-admins (legacy flag, prefer permission check)
  tenantAdminOnly?: boolean // hidden for non-tenant-admins
}

export const MENU_LABELS: Record<MenuId, string> = {
  dashboard: 'nav.dashboard',
  map: 'nav.map',
  opportunities: 'nav.opportunities',
  analysis: 'nav.analysis',
  brands: 'nav.brands',
  malls: 'nav.malls',
  competitors: 'nav.competitors',
  ab: 'nav.ab',
  ml: 'nav.ml',
  mall_tenants: 'nav.mall_tenants',
  reports: 'nav.reports',
  data: 'nav.data',
  scraper: 'nav.scraper',
  methodology: 'nav.methodology',
  docs: 'nav.docs',
  about: 'nav.about',
  settings: 'nav.settings',
  users: 'nav.users',
}

// =====================================================
// VALIDATION — ensure permissions matrix is well-formed
// =====================================================
export function validatePermissions(perms: any): perms is Permissions {
  if (!perms || typeof perms !== 'object') return false
  for (const menu of MENUS) {
    const mp = perms[menu]
    if (!mp || typeof mp !== 'object') continue  // missing menus OK (treated as none)
    for (const action of ACTIONS) {
      if (action in mp && typeof mp[action] !== 'boolean') return false
    }
  }
  return true
}

/**
 * Sanitize permissions input from API — ensure only valid menus/actions, all booleans.
 */
export function sanitizePermissions(input: any): Permissions {
  const clean: Permissions = {} as Permissions
  for (const menu of MENUS) {
    const mp: Partial<MenuPermission> = {}
    const inputMp = input?.[menu] || {}
    for (const action of ACTIONS) {
      mp[action] = Boolean(inputMp[action])
    }
    clean[menu] = mp
  }
  return clean
}
