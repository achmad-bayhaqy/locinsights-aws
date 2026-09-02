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
    const auth = await requirePermission('data', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const type = sp.get('type')
    const kab = sp.get('kab')

    const where: any = { ...tenantFilter(auth.session) }
    if (type) where.type = type
    if (kab) where.kab = kab

    return paginate(db.poi, req, {
      where,
      orderBy: { id: 'asc' },
      search: { fields: ['name', 'kec', 'kab', 'notes'], term },
    })
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('data', 'create')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const body = await req.json()
    delete body.tenant_id
    const p = await db.poi.create({ data: withTenantId(auth.session, body) })
    return NextResponse.json({ success: true, data: p }, { status: 201 })
  } catch (e) { return handleError(e) }
}
