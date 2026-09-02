/**
 * /api/admin/users — list & create users
 *
 * Visibility:
 *   • superadmin: sees ALL users across all tenants (optional ?tenant_id filter)
 *   • tenant_admin / admin: sees only users in their own tenant (tenant_id locked)
 *
 * Query params:
 *   ?tenant_id=<id>   superadmin-only tenant filter
 *   ?role=<role_id>   filter by role id (e.g. "admin", "viewer")
 *   ?active=true|false  filter by is_active flag
 *   ?search=<term>    case-insensitive LIKE on username / display_name / email
 *   ?page=1&page_size=50  pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/auth-server'
import { setTenantContext } from '@/lib/tenant-context'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

// =====================================================
// GET — list users
// =====================================================
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  // Only superadmin + tenant_admin + admin can list users at all
  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Tenant admin privileges required' },
      { status: 403 }
    )
  }

  try {
    await setTenantContext(session)

    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(200, Math.max(1, Number(sp.get('page_size') || 50)))
    const skip = (page - 1) * pageSize

    // Build WHERE clause
    const where: any = {}

    if (isSuperadmin) {
      const tid = sp.get('tenant_id')
      if (tid && tid !== 'all') {
        where.tenant_id = tid
      } else if (tid === 'platform') {
        where.tenant_id = null
      }
    } else {
      // Non-superadmin: locked to own tenant (defense-in-depth)
      where.tenant_id = session.user.tenant_id
      if (!where.tenant_id) {
        return NextResponse.json(
          { success: false, error: 'No tenant context for this user' },
          { status: 403 }
        )
      }
    }

    const roleFilter = sp.get('role')
    if (roleFilter) where.role = roleFilter

    const activeFilter = sp.get('active')
    if (activeFilter === 'true') where.is_active = true
    if (activeFilter === 'false') where.is_active = false

    const search = sp.get('search')?.trim()
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { display_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ created_at: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    console.error('[api/admin/users GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — create user
// =====================================================
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Tenant admin privileges required' },
      { status: 403 }
    )
  }

  try {
    await setTenantContext(session)

    const body = await req.json()
    const {
      username,
      email,
      display_name,
      password,
      role: newRole,
      tenant_id: requestedTenantId,
      is_active,
    } = body || {}

    // ---------- validate required fields ----------
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username is required (min 3 chars)' },
        { status: 400 }
      )
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password is required (min 4 chars)' },
        { status: 400 }
      )
    }
    if (!newRole || typeof newRole !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      )
    }

    // ---------- resolve tenant_id ----------
    // Non-superadmin: forced to own tenant.
    // Superadmin: can specify any tenant_id (or null for a platform superadmin).
    let tenantId: string | null
    if (isSuperadmin) {
      tenantId =
        requestedTenantId === undefined || requestedTenantId === null || requestedTenantId === ''
          ? null
          : String(requestedTenantId)
    } else {
      tenantId = session.user.tenant_id
      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: 'No tenant context for this user' },
          { status: 403 }
        )
      }
      // Non-superadmin cannot create superadmin users
      if (newRole === 'superadmin') {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can create superadmin users' },
          { status: 403 }
        )
      }
      // Non-superadmin cannot override tenant_id to a different tenant
      if (requestedTenantId && requestedTenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: 'Cannot create users outside your own tenant' },
          { status: 403 }
        )
      }
    }

    // ---------- uniqueness checks ----------
    const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Username already taken' },
        { status: 409 }
      )
    }
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: email.trim() } })
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 409 }
        )
      }
    }

    // ---------- tenant max_users enforcement ----------
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { max_users: true, name: true },
      })
      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 }
        )
      }
      const currentCount = await prisma.user.count({ where: { tenant_id: tenantId } })
      if (currentCount >= tenant.max_users) {
        return NextResponse.json(
          {
            success: false,
            error: `Tenant "${tenant.name}" has reached its max_users limit (${tenant.max_users}).`,
          },
          { status: 409 }
        )
      }
    }

    // ---------- hash password & insert ----------
    const passwordHash = bcrypt.hashSync(password, 10)

    const data: any = {
      username: username.trim(),
      email: email?.trim() || null,
      display_name: display_name?.trim() || username.trim(),
      password_hash: passwordHash,
      role: newRole,
      is_active: is_active !== false,
      failed_login_count: 0,
      tenant_id: tenantId,
      default_tenant_id: tenantId,
      created_by: session.user.username || session.user.user_id,
    }

    const created = await prisma.user.create({ data })

    // ---------- audit ----------
    await logAudit({
      userId: created.id,
      actorId: session.user.user_id,
      action: 'user.create',
      details: {
        username: created.username,
        email: created.email,
        role: created.role,
        tenant_id: created.tenant_id,
        is_active: created.is_active,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e: any) {
    console.error('[api/admin/users POST] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
