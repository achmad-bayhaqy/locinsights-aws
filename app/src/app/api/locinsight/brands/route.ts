import { NextRequest, NextResponse } from 'next/server'
import { db, paginate, handleError } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('brands', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const parent = sp.get('parent')
    const category = sp.get('category')

    const where: any = { ...tenantFilter(auth.session) }
    if (parent) where.parent = parent
    if (category) where.category = category

    return paginate(db.brand, req, {
      where,
      orderBy: { id: 'asc' },
      search: { fields: ['name', 'format', 'target_audience', 'origin_country'], term },
    })
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('brands', 'create')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    // Strip tenant_id if present in body — always derive from session
    delete body.tenant_id
    const brand = await db.brand.create({ data: withTenantId(auth.session, body) })
    return NextResponse.json({ success: true, data: brand }, { status: 201 })
  } catch (e) { return handleError(e) }
}
