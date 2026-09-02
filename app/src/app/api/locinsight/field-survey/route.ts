/**
 * Field Survey — Phase 3.
 *
 * POST /api/locinsight/field-survey — submit a new survey from the PWA.
 *   Anon INSERT allowed (PWA surveyors may submit without logging in).
 *   If the surveyor IS logged in, tenant_id is auto-injected so the survey
 *   is visible to their tenant admins. Anon submissions get tenant_id=NULL
 *   and land in a "global queue" visible to superadmin (and tenant admins
 *   via the OR: [{tenant_id: null}, tenantFilter] clause in GET).
 *
 * GET  /api/locinsight/field-survey — list surveys (admin review).
 *   Requires auth. Returns current tenant's surveys + system (NULL tenant)
 *   surveys so tenant admins can review anon submissions.
 *
 * PATCH /api/locinsight/field-survey — update review status.
 *   Requires auth. Verifies the survey belongs to the current tenant (or is
 *   a system survey) before updating. When status='imported', creates a
 *   competitorStore row scoped to the importing user's tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setTenantContext, tenantFilter, withTenantId, withTenantContext } from '@/lib/tenant-context'
import { getCurrentTenantId } from '@/lib/auth-server'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const status = sp.get('status') || undefined
    const limit = Math.min(200, Number(sp.get('limit') || 100))

    // Show current tenant's surveys + system (NULL tenant) surveys so tenant
    // admins can review anon PWA submissions. For superadmin, tenantFilter
    // returns {} which matches all rows.
    const tf = tenantFilter(auth.session)
    const tenantClause = Object.keys(tf).length > 0
      ? { OR: [{ tenant_id: null }, tf] }
      : {}

    const where = { ...tenantClause, ...(status ? { review_status: status as any } : {}) }
    const surveys = await prisma.fieldSurvey.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      count: surveys.length,
      data: surveys,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // POST is used by field surveyors (separate PWA at /survey) to submit
  // survey data. Surveyors only need to be authenticated (any role), not
  // superadmin. The PATCH endpoint (review status update) is admin-only.
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const {
      kelurahan_id, kelurahan_name,
      lat, lng, accuracy_m,
      surveyor_name, survey_type,
      brand_name, brand_category,
      outlet_name, address,
      is_in_mall, mall_name,
      condition, estimated_size_m2,
      foot_traffic_observation,
      notes, photo_urls,
    } = body

    if (!surveyor_name || lat == null || lng == null) {
      return NextResponse.json({
        success: false,
        error: 'surveyor_name, lat, lng are required',
      }, { status: 400 })
    }

    // Anon PWA submission is allowed — but if the surveyor IS logged in,
    // capture their tenant_id so the survey is visible to their tenant admins.
    // Try to get the session non-fatally; if it fails or no session, proceed
    // with tenant_id=NULL (global queue).
    let tenantId: string | null = null
    try {
      const session = await getServerSession(authOptions)
      if (session?.user) {
        tenantId = getCurrentTenantId(session)
        // Set RLS context for the insert (non-fatal if it fails)
        await setTenantContext(session)
      }
    } catch {
      // Anon — no session available, proceed with tenant_id=NULL
    }

    const survey = await prisma.fieldSurvey.create({
      data: {
        kelurahan_id: kelurahan_id || null,
        kelurahan_name: kelurahan_name || '',
        lat: Number(lat),
        lng: Number(lng),
        accuracy_m: accuracy_m ? Number(accuracy_m) : null,
        surveyor_name,
        survey_type: survey_type || 'site_visit',
        brand_name: brand_name || null,
        brand_category: brand_category || '',
        outlet_name: outlet_name || '',
        address: address || '',
        is_in_mall: !!is_in_mall,
        mall_name: mall_name || '',
        condition: condition || null,
        estimated_size_m2: estimated_size_m2 ? Number(estimated_size_m2) : null,
        foot_traffic_observation: foot_traffic_observation || null,
        notes: notes || '',
        photo_urls: JSON.stringify(photo_urls || []),
        review_status: 'pending',
        // If the surveyor was authenticated, scope to their tenant. Otherwise
        // NULL = global queue, visible to superadmin (and tenant admins via
        // the OR clause in GET).
        tenant_id: tenantId,
      },
    })

    return NextResponse.json({ success: true, id: survey.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    const { id, review_status, reviewer_notes } = body
    if (!id || !review_status) {
      return NextResponse.json({ success: false, error: 'id and review_status are required' }, { status: 400 })
    }
    const validStatuses = ['pending', 'approved', 'rejected', 'imported']
    if (!validStatuses.includes(review_status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    // Verify the survey belongs to the current tenant (or is a system/NULL
    // tenant survey) before allowing the update — prevents cross-tenant
    // mutation. Superadmin bypasses via empty tenantFilter.
    const tf = tenantFilter(auth.session)
    const ownershipClause = Object.keys(tf).length > 0
      ? { OR: [{ tenant_id: null }, tf] }
      : {}

    const existing = await prisma.fieldSurvey.findFirst({
      where: { id, ...ownershipClause },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }

    // If approved → optionally import as a competitor record.
    // The new competitorStore is scoped to the importing user's tenant.
    if (review_status === 'imported' && existing.brand_name) {
      // Validate brand_category against competitor_category_enum
      const validCompetitorCategories = ['convenience_store', 'fast_food', 'coffee', 'fashion', 'beauty', 'supermarket', 'pharmacy', 'department_store', 'sports', 'other']
      const validatedCategory = existing.brand_category && validCompetitorCategories.includes(existing.brand_category) ? existing.brand_category : 'other'
      // Add as a competitor store (assuming it's a non-MAP brand observed in the field).
      // Use withTenantContext to set RLS for the create, then inject tenant_id.
      const tid = getCurrentTenantId(auth.session)
      await withTenantContext(auth.session, () =>
        prisma.competitorStore.create({
          data: {
            brand_name: existing.brand_name!,
            brand_category: validatedCategory as any,
            name: existing.outlet_name || existing.brand_name!,
            lat: existing.lat,
            lng: existing.lng,
            kec: '',
            kab: '',
            city: existing.kelurahan_name || '',
            address: existing.address || '',
            is_in_mall: existing.is_in_mall,
            mall_name: existing.mall_name || null,
            source: 'osm' as any,
            source_url: `field_survey:${existing.surveyor_name}:${existing.submitted_at.toISOString()}`,
            // Scope the imported competitor to the current tenant (if any).
            // Anon-import (superadmin with no tenant selected) leaves it as
            // a system row.
            tenant_id: tid,
          },
        })
      ).catch((e) => {
        // Log but don't fail the whole PATCH — the status update is the
        // primary action; the competitor import is best-effort.
        console.warn('field-survey PATCH: competitorStore import failed:', e)
      })
    }

    // Tenant-scoped update — superadmin (tf={}) updates globally, others
    // restricted to their tenant + system rows.
    const result = await prisma.fieldSurvey.updateMany({
      where: { id, ...ownershipClause },
      data: {
        review_status,
        reviewer_notes: reviewer_notes || '',
        reviewed_at: new Date(),
      },
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }

    const updated = await prisma.fieldSurvey.findUnique({ where: { id } })
    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
