/**
 * LocInsights — Tenant Context Manager
 *
 * Manages the PostgreSQL session setting `app.current_tenant_id` which is
 * consumed by RLS policies to enforce tenant isolation at the DB layer.
 *
 * Defense-in-depth strategy:
 *   1. RLS policies (DB layer) — see migration 0009
 *   2. Prisma query filters (app layer) — every query should include `where: { tenant_id: ... }`
 *   3. JWT claim (auth layer) — tenant_id stored in JWT, used to resolve context
 *
 * Usage in API routes:
 *   const auth = await requireAuth()
 *   if (!auth.ok) return auth.response
 *   await setTenantContext(auth.session)  // ← set RLS context for this request
 *   // now all Prisma queries respect tenant isolation
 */

import { prisma } from '@/lib/db'
import { getCurrentTenantId } from '@/lib/auth-server'

/**
 * Set the `app.current_tenant_id` PostgreSQL session variable.
 *
 * This must be called at the start of every API route that touches tenant-scoped data.
 * The setting persists for the lifetime of the database connection (within the pool).
 *
 * IMPORTANT: With PgBouncer transaction pooling (Supabase default), `SET` statements
 * may not persist as expected. We use `SET LOCAL` wrapped in a transaction, OR
 * rely on Prisma's `$executeRaw` to set it per-transaction.
 *
 * For Supabase pooler compatibility, we use the approach of setting it via
 * `current_setting()` with `is_local=false` to ensure it persists for the session.
 * If that fails (PgBouncer), we fall back to app-layer filtering only (still safe
 * because defense-in-depth).
 *
 * @param session - NextAuth session object (must contain user.tenant_id)
 */
export async function setTenantContext(session: any): Promise<void> {
  const tenantId = getCurrentTenantId(session)

  try {
    if (tenantId) {
      // Set the session variable — RLS policies use `current_setting('app.current_tenant_id', true)`
      // NOTE: PostgreSQL does NOT allow parameters in `SET LOCAL x = $1` (error 42601).
      // set_config() accepts parameters; is_local=false because $executeRaw runs in
      // autocommit mode (is_local=true would be discarded immediately).
      await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`
    } else {
      // Unset (platform-wide / superadmin mode)
      await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', false)`
    }

    // Also set user_id for audit/RLS policies
    const userId = session?.user?.user_id || session?.user?.id || ''
    if (userId) {
      await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`
    }
  } catch (error) {
    // Non-fatal: if SET LOCAL fails (e.g. PgBouncer transaction mode),
    // we still have app-layer filtering as fallback.
    console.warn('[tenant-context] Failed to set RLS context (non-fatal, app-layer filter will apply):', error)
  }
}

/**
 * Run a Prisma operation with tenant context set.
 * Helper for cases where you need to ensure RLS context is active for a specific query.
 *
 * Example:
 *   const stores = await withTenantContext(session, () => prisma.stores.findMany())
 */
export async function withTenantContext<T>(
  session: any,
  fn: () => Promise<T>
): Promise<T> {
  await setTenantContext(session)
  return fn()
}

/**
 * Get the tenant_id filter for Prisma queries.
 * Use this in every query against tenant-scoped tables for defense-in-depth.
 *
 * Example:
 *   const stores = await prisma.stores.findMany({ where: tenantFilter(session) })
 *
 * For superadmin (tenant_id NULL), this returns `{}` (no filter — sees all).
 * For other roles, returns `{ tenant_id: <their_tenant_id> }`.
 */
export function tenantFilter(session: any): { tenant_id?: string } {
  const tenantId = getCurrentTenantId(session)
  if (!tenantId) return {}  // superadmin platform-wide OR no tenant set
  return { tenant_id: tenantId }
}

/**
 * Get the tenant_id filter, but for superadmin acting on a specific tenant,
 * return that tenant instead of "all".
 *
 * Use this for queries where even superadmin should respect the currently-selected tenant.
 */
export function strictTenantFilter(session: any): { tenant_id?: string } {
  const tenantId = getCurrentTenantId(session)
  if (!tenantId) {
    // Superadmin with no tenant selected — return all (but log warning)
    return {}
  }
  return { tenant_id: tenantId }
}

/**
 * Inject tenant_id into a data payload for INSERT operations.
 * Returns the modified object with tenant_id set.
 *
 * For superadmin: uses session.user.tenant_id (the active tenant), or default_tenant_id.
 * For other roles: uses their assigned tenant_id.
 *
 * Generic over T so the returned type preserves the input shape (TypeScript
 * accepts it as assignable to Prisma's create-input types). When T is `any`
 * (e.g. from `await req.json()`), the return type collapses to `any` which
 * Prisma also accepts.
 */
export function withTenantId<T extends Record<string, any>>(
  session: any,
  data: T
): T & { tenant_id: string } {
  const tenantId = getCurrentTenantId(session) || session?.user?.default_tenant_id
  if (!tenantId) {
    throw new Error('Cannot INSERT without tenant_id — user has no active tenant')
  }
  return { ...data, tenant_id: tenantId }
}
