/**
 * /api/admin/users/[id]/reset-lockout — clear failed_login_count + locked_until
 *
 * Useful when a user has been locked out (5 failed attempts) and an admin
 * needs to manually release them.
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

export async function POST(req: NextRequest, ctx: RouteContext) {
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

    if (!isSuperadmin && existing.tenant_id !== session.user.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await prisma.user.update({
      where: { id },
      data: {
        failed_login_count: 0,
        locked_until: null,
      },
    })

    await logAudit({
      userId: existing.id,
      actorId: session.user.user_id,
      action: 'user.reset_lockout',
      details: {
        username: existing.username,
        previous_failed_login_count: existing.failed_login_count,
        previous_locked_until: existing.locked_until,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/admin/users/[id]/reset-lockout] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
