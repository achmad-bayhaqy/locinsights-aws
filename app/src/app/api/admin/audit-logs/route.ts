/**
 * /api/admin/audit-logs — list user audit logs
 *
 * Visibility:
 *   • superadmin: ALL audit logs (optional ?tenant_id filter)
 *   • tenant_admin / admin: only logs of users within their OWN tenant
 *   • other roles: forbidden
 *
 * Query params:
 *   ?user_id=<id>     filter by subject user id
 *   ?action=<action>  filter by action (e.g. "user.create", "login")
 *   ?tenant_id=<id>   superadmin-only tenant filter
 *   ?page=1&page_size=50  pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  if (!isSuperadmin && role !== 'tenant_admin' && role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(200, Math.max(1, Number(sp.get('page_size') || 50)))
    const skip = (page - 1) * pageSize

    // Build WHERE clause
    const where: any = {}

    // User scoping
    if (isSuperadmin) {
      const tid = sp.get('tenant_id')
      if (tid && tid !== 'all') {
        // Filter audit logs by users in that tenant
        where.user = { tenant_id: tid }
      }
    } else {
      // Non-superadmin: only logs of users in their own tenant
      if (!session.user.tenant_id) {
        return NextResponse.json({ success: true, data: [], total: 0, page, pageSize, totalPages: 0 })
      }
      where.user = { tenant_id: session.user.tenant_id }
    }

    // Optional action filter
    const actionFilter = sp.get('action')
    if (actionFilter) where.action = actionFilter

    // Optional specific user filter
    const userIdFilter = sp.get('user_id')
    if (userIdFilter) where.user_id = userIdFilter

    const [logs, total] = await Promise.all([
      prisma.userAuditLog.findMany({
        where,
        orderBy: [{ created_at: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          user_id: true,
          actor_id: true,
          action: true,
          details: true,
          ip_address: true,
          created_at: true,
          user: {
            select: {
              id: true,
              username: true,
              display_name: true,
              tenant_id: true,
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.userAuditLog.count({ where }),
    ])

    // Resolve actor names (actor_id is just a string; users may have been deleted)
    const actorIds = Array.from(
      new Set(logs.map(l => l.actor_id).filter(Boolean) as string[])
    )
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true, display_name: true },
        })
      : []
    const actorMap: Record<string, { username: string; display_name: string | null }> = {}
    for (const a of actors) {
      actorMap[a.id] = { username: a.username, display_name: a.display_name }
    }

    const data = logs.map(l => ({
      id: l.id,
      user_id: l.user_id,
      actor_id: l.actor_id,
      actor_username: l.actor_id ? actorMap[l.actor_id]?.username : null,
      actor_display_name: l.actor_id ? actorMap[l.actor_id]?.display_name : null,
      action: l.action,
      details: l.details,
      ip_address: l.ip_address,
      created_at: l.created_at,
      user: l.user,
    }))

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    console.error('[api/admin/audit-logs GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
