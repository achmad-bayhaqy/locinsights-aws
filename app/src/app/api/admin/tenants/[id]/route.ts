/**
 * /api/admin/tenants/[id] — read / update / delete a single tenant
 *
 * Authorization:
 *   • GET  — superadmin: any tenant; others: only own tenant
 *   • PUT / DELETE — superadmin only
 *
 * DELETE cascades through all FK relations (User, Role, TenantAddon, Brand,
 * Store, etc.) via the schema's `onDelete: Cascade`.
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
// GET — get tenant with stats
// =====================================================
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  const role = session.user.role
  const isSuperadmin = role === 'superadmin'

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    // Non-superadmin: only own tenant
    if (!isSuperadmin && tenant.id !== session.user.tenant_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Load stats: users, addons, brands, stores, malls, competitors, pois
    const [
      userCount,
      addonCount,
      brandCount,
      storeCount,
      mallCount,
      competitorCount,
      poiCount,
      addons,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count({ where: { tenant_id: id } }),
      prisma.tenantAddon.count({ where: { tenant_id: id } }),
      prisma.brand.count({ where: { tenant_id: id } }),
      prisma.store.count({ where: { tenant_id: id } }),
      prisma.mall.count({ where: { tenant_id: id } }),
      prisma.competitorStore.count({ where: { tenant_id: id } }),
      prisma.poi.count({ where: { tenant_id: id } }),
      prisma.tenantAddon.findMany({
        where: { tenant_id: id },
        orderBy: [{ created_at: 'desc' }],
      }),
      prisma.user.findMany({
        where: { tenant_id: id },
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
        orderBy: [{ created_at: 'desc' }],
        take: 20,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...tenant,
        stats: {
          users: userCount,
          addons: addonCount,
          brands: brandCount,
          stores: storeCount,
          malls: mallCount,
          competitors: competitorCount,
          pois: poiCount,
        },
        addons,
        recent_users: recentUsers,
      },
    })
  } catch (e: any) {
    console.error('[api/admin/tenants/[id] GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// PUT — superadmin only
// =====================================================
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  if (session.user.role !== 'superadmin') {
    return NextResponse.json(
      { success: false, error: 'Superadmin privileges required' },
      { status: 403 }
    )
  }

  try {
    const existing = await prisma.tenant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

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
      suspended_at,
      terminated_at,
      data_residency,
    } = body || {}

    // ---------- slug uniqueness ----------
    if (slug !== undefined && slug !== existing.slug) {
      const dupe = await prisma.tenant.findUnique({ where: { slug } })
      if (dupe && dupe.id !== existing.id) {
        return NextResponse.json(
          { success: false, error: 'Slug already taken' },
          { status: 409 }
        )
      }
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (slug !== undefined) data.slug = slug
    if (plan !== undefined) data.plan = plan
    if (status !== undefined) {
      data.status = status
      // Lifecycle timestamps: clear/set based on new status
      if (status === 'suspended' && !existing.suspended_at) {
        data.suspended_at = new Date()
      } else if (status !== 'suspended') {
        data.suspended_at = null
      }
      if (status === 'terminated' && !existing.terminated_at) {
        data.terminated_at = new Date()
      } else if (status !== 'terminated') {
        data.terminated_at = null
      }
    }
    // Allow explicit override of suspended_at / terminated_at
    if (suspended_at !== undefined) {
      data.suspended_at = suspended_at === null ? null : new Date(suspended_at)
    }
    if (terminated_at !== undefined) {
      data.terminated_at = terminated_at === null ? null : new Date(terminated_at)
    }
    if (region_scope !== undefined) data.region_scope = Array.isArray(region_scope) ? region_scope : []
    if (app_name !== undefined) data.app_name = app_name
    if (logo_url !== undefined) data.logo_url = logo_url
    if (primary_color !== undefined) data.primary_color = primary_color
    if (accent_color !== undefined) data.accent_color = accent_color
    if (contact_name !== undefined) data.contact_name = contact_name
    if (contact_email !== undefined) data.contact_email = contact_email
    if (contact_phone !== undefined) data.contact_phone = contact_phone
    if (notes !== undefined) data.notes = notes
    if (max_users !== undefined) data.max_users = Number(max_users)
    if (max_api_calls_per_day !== undefined) data.max_api_calls_per_day = Number(max_api_calls_per_day)
    if (trial_ends_at !== undefined) {
      data.trial_ends_at = trial_ends_at === null ? null : new Date(trial_ends_at)
    }
    if (data_residency !== undefined) data.data_residency = data_residency

    const updated = await prisma.tenant.update({ where: { id }, data })

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'tenant.update',
      details: {
        tenant_id: updated.id,
        tenant_name: updated.name,
        changed_fields: Object.keys(data),
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    console.error('[api/admin/tenants/[id] PUT] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — superadmin only (cascade deletes all tenant data via FK)
// =====================================================
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const session = auth.session
  const { id } = await ctx.params

  if (session.user.role !== 'superadmin') {
    return NextResponse.json(
      { success: false, error: 'Superadmin privileges required' },
      { status: 403 }
    )
  }

  try {
    const existing = await prisma.tenant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    await logAudit({
      userId: session.user.user_id || 'unknown',
      actorId: session.user.user_id,
      action: 'tenant.delete',
      details: {
        tenant_id: existing.id,
        tenant_name: existing.name,
        slug: existing.slug,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
    })

    // Cascade is configured in the schema (onDelete: Cascade on all FKs to Tenant)
    await prisma.tenant.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/admin/tenants/[id] DELETE] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Re-export setTenantContext so server-side RLS context is available even on
// GET — we don't actually need to set it for tenant reads (superadmin), but
// the import keeps the file consistent with the rest of the admin routes.
void setTenantContext
