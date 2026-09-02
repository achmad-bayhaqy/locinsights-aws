/**
 * /api/admin/users/[id] — read / update / delete a single user
 *
 * Authorization:
 *   • superadmin: full access to any user
 *   • tenant_admin / admin: can only touch users in their OWN tenant
 *
 * Special guards:
 *   • DELETE: cannot delete self (id === session.user.user_id)
 *   • DELETE: cannot delete the last superadmin in the platform
 *   • PUT: non-superadmin cannot promote a user to superadmin
 *   • PUT: non-superadmin cannot move a user to a different tenant
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// =====================================================
// GET — single user
// =====================================================
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        role: true,
        is_active: true,
        failed_login_count: true,
        locked_until: true,
        last_login_at: true,
        tenant_id: true,
        default_tenant_id: true,
        created_at: true,
        updated_at: true,
        created_by: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Non-superadmin: ensure target is in their tenant
    if (!isSuperadmin && user.tenant_id !== session.user.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (e: any) {
    console.error('[api/admin/users/[id] GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// PUT — update user
// =====================================================
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Non-superadmin: must be in own tenant
    if (!isSuperadmin && existing.tenant_id !== session.user.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { display_name, email, role: newRole, tenant_id: newTenantId, is_active } = body || {}

    // ---------- role change rules ----------
    if (newRole !== undefined) {
      if (newRole === 'superadmin' && !isSuperadmin) {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can grant superadmin role' },
          { status: 403 }
        )
      }
      // Demoting yourself from superadmin: prevent if you're the last superadmin
      if (
        existing.role === 'superadmin' &&
        newRole !== 'superadmin' &&
        session.user.user_id === existing.id
      ) {
        const superadminCount = await prisma.user.count({
          where: { role: 'superadmin', is_active: true },
        })
        if (superadminCount <= 1) {
          return NextResponse.json(
            { success: false, error: 'Cannot demote the last active superadmin' },
            { status: 409 }
          )
        }
      }
    }

    // ---------- tenant change rules ----------
    if (newTenantId !== undefined) {
      if (!isSuperadmin) {
        if (newTenantId !== existing.tenant_id) {
          return NextResponse.json(
            { success: false, error: 'Only superadmin can move users between tenants' },
            { status: 403 }
          )
        }
      } else {
        // Superadmin: verify target tenant exists (if non-null)
        if (newTenantId !== null && newTenantId !== '') {
          const t = await prisma.tenant.findUnique({
            where: { id: String(newTenantId) },
            select: { id: true },
          })
          if (!t) {
            return NextResponse.json(
              { success: false, error: 'Target tenant not found' },
              { status: 404 }
            )
          }
        }
      }
    }

    // ---------- email uniqueness ----------
    if (email !== undefined && email && email !== existing.email) {
      const dupe = await prisma.user.findUnique({ where: { email: email.trim() } })
      if (dupe && dupe.id !== existing.id) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 409 }
        )
      }
    }

    // ---------- build update payload ----------
    const data: any = {}
    if (display_name !== undefined) data.display_name = display_name?.trim() || existing.username
    if (email !== undefined) data.email = email?.trim() || null
    if (newRole !== undefined) data.role = newRole
    if (is_active !== undefined) data.is_active = Boolean(is_active)
    if (newTenantId !== undefined) {
      data.tenant_id = newTenantId === '' ? null : newTenantId
      // Keep default_tenant_id in sync when tenant is moved
      if (newTenantId !== existing.tenant_id) {
        data.default_tenant_id = newTenantId === '' ? null : newTenantId
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        role: true,
        is_active: true,
        tenant_id: true,
        updated_at: true,
      },
    })

    await logAudit({
      userId: updated.id,
      actorId: session.user.user_id,
      action: 'user.update',
      details: {
        before: {
          display_name: existing.display_name,
          email: existing.email,
          role: existing.role,
          tenant_id: existing.tenant_id,
          is_active: existing.is_active,
        },
        after: {
          display_name: updated.display_name,
          email: updated.email,
          role: updated.role,
          tenant_id: updated.tenant_id,
          is_active: updated.is_active,
        },
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    console.error('[api/admin/users/[id] PUT] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — delete user
// =====================================================
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Non-superadmin: must be in own tenant
    if (!isSuperadmin && existing.tenant_id !== session.user.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Prevent self-delete
    if (existing.id === session.user.user_id) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account' },
        { status: 409 }
      )
    }

    // Prevent deleting the last superadmin
    if (existing.role === 'superadmin') {
      const superadminCount = await prisma.user.count({
        where: { role: 'superadmin', is_active: true },
      })
      if (superadminCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the last active superadmin' },
          { status: 409 }
        )
      }
    }

    // Capture audit before delete (user row will be gone)
    await logAudit({
      userId: existing.id,
      actorId: session.user.user_id,
      action: 'user.delete',
      details: {
        username: existing.username,
        email: existing.email,
        role: existing.role,
        tenant_id: existing.tenant_id,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    // Delete audit logs for this user first (FK is ON DELETE CASCADE, but be explicit)
    await prisma.userAuditLog.deleteMany({ where: { user_id: existing.id } })
    await prisma.user.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/admin/users/[id] DELETE] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
