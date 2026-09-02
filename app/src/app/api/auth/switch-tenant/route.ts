/**
 * POST /api/auth/switch-tenant — validate a tenant switch before JWT update
 *
 * Body: { tenantId: string | null }
 *
 *   • tenantId = null  → superadmin switching to "platform-wide" mode (no tenant)
 *   • tenantId = "<id>" → switch to that specific tenant
 *
 * Validation rules:
 *   • superadmin can switch to ANY active tenant (or null for platform-wide)
 *   • other roles can only switch to a tenant in their available_tenant_ids
 *
 * On success: { success: true }
 *   The client then calls `update({ tenant_id: newTenantId })` to refresh
 *   the JWT, then `router.refresh()` to reload server components.
 *
 * NOTE: This endpoint only VALIDATES — it does not modify the JWT itself.
 * The JWT is updated client-side via next-auth's `update()` method, which
 * triggers the `jwt` callback in src/lib/auth.ts with `trigger='update'`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessTenant } from '@/lib/auth-server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const tenantId: string | null = body?.tenantId ?? body?.tenant_id ?? null

  try {
    // Case 1: tenantId = null → switching to platform-wide mode
    if (tenantId === null || tenantId === '') {
      if (role !== 'superadmin') {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can switch to platform-wide mode' },
          { status: 403 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'Switching to platform-wide mode',
        tenant_id: null,
      })
    }

    // Case 2: tenantId is a string → validate the tenant exists + is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, status: true, plan: true },
    })

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      )
    }

    if (tenant.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Tenant is ${tenant.status} (not active)` },
        { status: 403 }
      )
    }

    // Permission check: user must be able to access this tenant
    if (!canAccessTenant(session, tenantId)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Switching to tenant: ${tenant.name}`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
    })
  } catch (e: any) {
    console.error('[api/auth/switch-tenant] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
