/**
 * /api/admin/tenants — list & create tenants
 *
 *   • GET  — superadmin: ALL tenants (all statuses); others: only own tenant
 *            (returns richer fields than the legacy "switcher" endpoint)
 *   • POST — superadmin only: create a new tenant
 *
 * Query params (GET):
 *   ?stats=true   include user_count + addon_count per tenant
 *   ?status=<status>  filter by status (active/suspended/terminated/provisioning)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

// =====================================================
// GET
// =====================================================
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  try {
    const sp = req.nextUrl.searchParams
    const withStats = sp.get('stats') === 'true'
    const statusFilter = sp.get('status')

    let where: any = {}
    let tenants: any[] = []

    if (isSuperadmin) {
      if (statusFilter) where.status = statusFilter
      tenants = await prisma.tenant.findMany({
        where,
        orderBy: [{ name: 'asc' }],
      })
    } else {
      // Non-superadmin: only their available tenant ids
      const ids = Array.from(
        new Set([
          ...(session.user.tenant_id ? [session.user.tenant_id] : []),
          ...(session.user.available_tenant_ids || []),
        ])
      )
      if (ids.length === 0) {
        return NextResponse.json({ success: true, data: [] })
      }
      where = { id: { in: ids } }
      if (statusFilter) where.status = statusFilter
      tenants = await prisma.tenant.findMany({
        where,
        orderBy: [{ name: 'asc' }],
      })
    }

    let data = tenants
    if (withStats) {
      // Attach user_count + addon_count
      const ids = tenants.map(t => t.id)
      const [userCounts, addonCounts] = await Promise.all([
        prisma.user.groupBy({
          by: ['tenant_id'],
          where: { tenant_id: { in: ids } },
          _count: { _all: true },
        }),
        prisma.tenantAddon.groupBy({
          by: ['tenant_id'],
          where: { tenant_id: { in: ids } },
          _count: { _all: true },
        }),
      ])
      const uMap: Record<string, number> = {}
      for (const u of userCounts) uMap[u.tenant_id as string] = u._count._all
      const aMap: Record<string, number> = {}
      for (const a of addonCounts) aMap[a.tenant_id as string] = a._count._all

      data = tenants.map(t => ({
        ...t,
        user_count: uMap[t.id] || 0,
        addon_count: aMap[t.id] || 0,
      }))
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[api/admin/tenants GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — superadmin only: create tenant
// =====================================================
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  if (session.user.role !== 'superadmin') {
    return NextResponse.json(
      { success: false, error: 'Superadmin privileges required' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const {
      name,
      slug,
      plan,
      status,
      region_scope,
      app_name,
      logo_url,
      primary_color,
      accent_color,
      contact_name,
      contact_email,
      contact_phone,
      notes,
      max_users,
      max_api_calls_per_day,
      trial_ends_at,
      data_residency,
    } = body || {}

    // ---------- validation ----------
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Tenant name is required' },
        { status: 400 }
      )
    }
    if (!slug || typeof slug !== 'string' || slug.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Tenant slug is required' },
        { status: 400 }
      )
    }

    // Slug uniqueness
    const existingSlug = await prisma.tenant.findUnique({ where: { slug: slug.trim() } })
    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: 'Slug already taken' },
        { status: 409 }
      )
    }

    // ---------- build data ----------
    const data: any = {
      name: name.trim(),
      slug: slug.trim(),
      plan: plan || 'trial',
      status: status || 'provisioning',
      region_scope: Array.isArray(region_scope) ? region_scope : [],
      app_name: app_name || 'LocInsights',
      logo_url: logo_url || null,
      primary_color: primary_color || '#7A0A1A',
      accent_color: accent_color || '#C8102E',
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      notes: notes || '',
      max_users: Number(max_users) || 10,
      max_api_calls_per_day: Number(max_api_calls_per_day) || 10000,
      created_by: session.user.username || session.user.user_id,
    }
    if (data.status === 'trial' && trial_ends_at) {
      data.trial_ends_at = new Date(trial_ends_at)
    }
    if (data_residency) data.data_residency = data_residency

    const created = await prisma.tenant.create({ data })

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'tenant.create',
      details: {
        tenant_id: created.id,
        tenant_name: created.name,
        slug: created.slug,
        plan: created.plan,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e: any) {
    console.error('[api/admin/tenants POST] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
