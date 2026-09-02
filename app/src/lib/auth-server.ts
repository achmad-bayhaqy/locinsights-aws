/**
 * LocInsights — Server-side Auth Helpers
 *
 * Provides discriminated-union auth helpers for API routes.
 * Replaces verbose try/getServerSession patterns.
 *
 * Usage:
 *   const auth = await requireAuth()
 *   if (!auth.ok) return auth.response
 *   // auth.session is now safe to use
 */

import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { hasPermission, type ActionId, type MenuId } from '@/lib/permissions'

// =====================================================
// Auth Result — discriminated union
// =====================================================
export type AuthResult =
  | { ok: true; session: any; response?: undefined }
  | { ok: false; response: NextResponse; session?: undefined }

// =====================================================
// requireAuth — any authenticated user
// =====================================================
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }
  return { ok: true, session }
}

// =====================================================
// requireSuperadmin — platform-level superadmin only
// =====================================================
export async function requireSuperadmin(): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth
  if (auth.session.user.role !== 'superadmin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Superadmin privileges required' },
        { status: 403 }
      ),
    }
  }
  return auth
}

// =====================================================
// requireTenantAdmin — superadmin OR tenant_admin OR admin (within their tenant)
// =====================================================
export async function requireTenantAdmin(): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth
  const role = auth.session.user.role
  if (role !== 'superadmin' && role !== 'tenant_admin' && role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Tenant admin privileges required' },
        { status: 403 }
      ),
    }
  }
  return auth
}

// =====================================================
// requirePermission — check specific menu+action permission
// =====================================================
export async function requirePermission(
  menu: MenuId | string,
  action: ActionId
): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  // Superadmin bypasses per-menu permission checks
  if (auth.session.user.role === 'superadmin') {
    return auth
  }

  const perms = auth.session.user.permissions
  if (!hasPermission(perms, menu, action)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Permission denied: ${action} on ${menu}`,
        },
        { status: 403 }
      ),
    }
  }
  return auth
}

// =====================================================
// getCurrentTenantId — extract active tenant from session
// =====================================================
export function getCurrentTenantId(session: any): string | null {
  if (!session?.user) return null
  // Superadmin with tenant_id set = acting on a specific tenant
  // Superadmin with tenant_id null = platform-wide (sees all)
  if (session.user.role === 'superadmin') {
    return session.user.tenant_id || null
  }
  // Non-superadmin must have tenant_id set
  return session.user.tenant_id || null
}

// =====================================================
// canAccessTenant — check if user can switch into a specific tenant
// =====================================================
export function canAccessTenant(session: any, tenantId: string): boolean {
  if (!session?.user) return false
  if (session.user.role === 'superadmin') return true
  const available: string[] = session.user.available_tenant_ids || []
  return available.includes(tenantId)
}
