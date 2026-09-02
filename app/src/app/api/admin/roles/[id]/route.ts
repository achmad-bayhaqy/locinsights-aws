/**
 * /api/admin/roles/[id] — read / update / delete a single role
 *
 * Rules:
 *   • System roles (is_system=true): permissions can be edited, but role cannot be DELETED.
 *   • Tenant-scoped roles: full edit + delete (only if no users assigned to the role).
 *   • tenant_admin/admin can only edit roles visible to them (system roles + own tenant roles).
 *   • Only superadmin can edit system role permissions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit-log'
import { sanitizePermissions } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Helper: can the current session manage this role?
function canManageRole(session: any, role: any): boolean {
  if (session.user.role === 'superadmin') return true
  // tenant_admin/admin: can manage system roles (read+edit perms if superadmin only) + own tenant roles
  // For non-superadmin, only allow managing their own tenant-scoped roles
  if (role.is_system) return false // system role edits are superadmin-only
  return role.tenant_id === session.user.tenant_id
}

// Helper: can the session VIEW this role?
function canViewRole(session: any, role: any): boolean {
  if (session.user.role === 'superadmin') return true
  if (role.tenant_id === null) return true // system roles visible to all admins
  return role.tenant_id === session.user.tenant_id
}

// =====================================================
// GET
// =====================================================
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const role = session.user.role
  if (role !== 'superadmin' && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const r = await prisma.role.findUnique({ where: { id } })
    if (!r) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 })
    }

    if (!canViewRole(session, r)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Cast to any: Prisma types User.role as user_role_enum, but at runtime
    // it accepts custom tenant-scoped role IDs too.
    const userCount = await prisma.user.count({ where: { role: r.id as any } })

    return NextResponse.json({
      success: true,
      data: {
        ...r,
        user_count: userCount,
      },
    })
  } catch (e: any) {
    console.error('[api/admin/roles/[id] GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// PUT — update role
// =====================================================
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const sessionRole = session.user.role
  if (sessionRole !== 'superadmin' && sessionRole !== 'tenant_admin' && sessionRole !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 })
    }

    if (!canManageRole(session, existing)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, permissions } = body || {}

    const data: any = {}

    if (name !== undefined && typeof name === 'string') {
      const trimmed = name.trim()
      if (trimmed.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Role name must be at least 2 chars' },
          { status: 400 }
        )
      }
      if (trimmed !== existing.name) {
        const dupe = await prisma.role.findUnique({ where: { name: trimmed } })
        if (dupe && dupe.id !== existing.id) {
          return NextResponse.json(
            { success: false, error: 'Role name already taken' },
            { status: 409 }
          )
        }
        data.name = trimmed
      }
    }

    if (description !== undefined) {
      data.description = typeof description === 'string' ? description.trim() : ''
    }

    if (permissions !== undefined && permissions !== null) {
      data.permissions = sanitizePermissions(permissions) as any
    }

    const updated = await prisma.role.update({
      where: { id },
      data,
    })

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'role.update',
      details: {
        role_id: updated.id,
        role_name: updated.name,
        changed_fields: Object.keys(data),
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    console.error('[api/admin/roles/[id] PUT] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — delete role (only if !is_system and no users assigned)
// =====================================================
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const sessionRole = session.user.role
  if (sessionRole !== 'superadmin' && sessionRole !== 'tenant_admin' && sessionRole !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const existing = await prisma.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 })
    }

    // System roles: cannot be deleted
    if (existing.is_system) {
      return NextResponse.json(
        { success: false, error: 'System roles cannot be deleted' },
        { status: 409 }
      )
    }

    if (!canManageRole(session, existing)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Check no users are assigned to this role
    // Cast to any: Prisma types User.role as user_role_enum, but at runtime
    // it accepts custom tenant-scoped role IDs too.
    const userCount = await prisma.user.count({ where: { role: existing.id as any } })
    if (userCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role: ${userCount} user(s) are still assigned. Reassign them first.`,
        },
        { status: 409 }
      )
    }

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'role.delete',
      details: {
        role_id: existing.id,
        role_name: existing.name,
        tenant_id: existing.tenant_id,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    await prisma.role.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/admin/roles/[id] DELETE] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
