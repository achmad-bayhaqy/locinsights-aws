import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('competitors', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const competitor = await db.competitorStore.findFirst({
      where: { id, ...tenantFilter(auth.session) },
    })
    if (!competitor) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: competitor })
  } catch (e) {
    return handleError(e)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('competitors', 'update')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const body = await req.json()
    delete body.id
    delete body.tenant_id
    const result = await db.competitorStore.updateMany({
      where: { id, ...tenantFilter(auth.session) },
      data: body,
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }
    const competitor = await db.competitorStore.findUnique({ where: { id } })
    return NextResponse.json({ success: true, data: competitor })
  } catch (e) {
    return handleError(e)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('competitors', 'delete')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const { id } = await params
    const result = await db.competitorStore.deleteMany({
      where: { id, ...tenantFilter(auth.session) },
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Not found or access denied' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleError(e)
  }
}
