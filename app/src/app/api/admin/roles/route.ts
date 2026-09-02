/**
 * /api/admin/roles — list & create roles
 *
 * Visibility:
 *   • System roles (is_system=true, tenant_id=NULL): visible to all admins
 *   • Tenant-scoped roles (is_tenant_scoped=true, tenant_id=<own>): visible to that tenant's admins + superadmin
 *   • Superadmin: can create either system or tenant-scoped roles
 *   • tenant_admin / admin: can ONLY create tenant-scoped roles in their own tenant
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit-log'
import { sanitizePermissions, DEFAULT_PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// =====================================================
// GET — list roles
// =====================================================
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    // WHERE: system roles (tenant_id NULL) OR own tenant roles
    const where: any = isSuperadmin
      ? {} // superadmin sees all
      : {
          OR: [
            { tenant_id: null },
            { tenant_id: session.user.tenant_id },
          ],
        }

    // Get user counts per role
    const roles = await prisma.role.findMany({
      where,
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
    })

    // Count users per role id (role field on User table is a string matching Role.id).
    // Prisma types User.role as user_role_enum, but at runtime it accepts custom
    // role IDs too — cast to any to allow tenant-scoped custom roles.
    const roleIds = roles.map(r => r.id)
    const userCounts = await prisma.user.groupBy({
      by: ['role'],
      where: { role: { in: roleIds } as any },
      _count: { _all: true },
    })
    const countMap: Record<string, number> = {}
    for (const c of userCounts) {
      const count = (c as any)._count?._all ?? (c as any)._count ?? 0
      countMap[c.role as string] = typeof count === 'number' ? count : 0
    }

    const data = roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      is_system: r.is_system,
      tenant_id: r.tenant_id,
      is_tenant_scoped: r.is_tenant_scoped,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_count: countMap[r.id] || 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[api/admin/roles GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — create role
// =====================================================
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    await setTenantContext(session)

    const body = await req.json()
    const { name, description, permissions, is_system, tenant_id: requestedTenantId } = body || {}

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Role name is required (min 2 chars)' },
        { status: 400 }
      )
    }

    // ---------- resolve scope ----------
    let isSystem: boolean
    let tenantId: string | null

    if (isSuperadmin) {
      isSystem = Boolean(is_system)
      tenantId = isSystem ? null : (requestedTenantId || session.user.tenant_id || null)
    } else {
      // tenant_admin/admin: can ONLY create tenant-scoped roles in their own tenant
      isSystem = false
      tenantId = session.user.tenant_id
      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: 'No tenant context for this user' },
          { status: 403 }
        )
      }
      if (requestedTenantId && requestedTenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: 'Cannot create roles in another tenant' },
          { status: 403 }
        )
      }
    }

    // ---------- name uniqueness ----------
    const existing = await prisma.role.findUnique({ where: { name: name.trim() } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Role name already taken' },
        { status: 409 }
      )
    }

    // ---------- generate id ----------
    // Use slugified name + short uuid suffix for tenant-scoped roles
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32) || 'role'
    const id = isSystem
      ? slug
      : `${slug}_${Math.random().toString(36).slice(2, 8)}`

    // ---------- sanitize permissions ----------
    const sanitized = sanitizePermissions(permissions || DEFAULT_PERMISSIONS.viewer)

    const created = await prisma.role.create({
      data: {
        id,
        name: name.trim(),
        description: description?.trim() || '',
        permissions: sanitized as any,
        is_system: isSystem,
        tenant_id: tenantId,
        is_tenant_scoped: !isSystem,
      },
    })

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'role.create',
      details: {
        role_id: created.id,
        role_name: created.name,
        is_system: created.is_system,
        tenant_id: created.tenant_id,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e: any) {
    console.error('[api/admin/roles POST] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
