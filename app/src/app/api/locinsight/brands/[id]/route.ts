import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('brands', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const b = await db.brand.findFirst({
      where: { id, ...tenantFilter(auth.session) },
      include: { stores: true },
    })
    if (!b) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: b })
  } catch (e) { return handleError(e) }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('brands', 'update')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const body = await req.json()
    delete body.id
    delete body.stores
    delete body.tenant_id
    const result = await db.brand.updateMany({
      where: { id, ...tenantFilter(auth.session) },
      data: body,
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }
    const b = await db.brand.findUnique({ where: { id }, include: { stores: true } })
    return NextResponse.json({ success: true, data: b })
  } catch (e) { return handleError(e) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('brands', 'delete')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const result = await db.brand.deleteMany({
      where: { id, ...tenantFilter(auth.session) },
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) { return handleError(e) }
}
