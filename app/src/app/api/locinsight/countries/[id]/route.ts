import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { requireSuperadmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// GET is public (no auth) — countries are shared reference data.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const c = await db.country.findUnique({ where: { id } })
    if (!c) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: c })
  } catch (e) { return handleError(e) }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await req.json()
    delete body.id
    const c = await db.country.update({ where: { id }, data: body })
    return NextResponse.json({ success: true, data: c })
  } catch (e) { return handleError(e) }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const { id } = await params
    await db.country.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) { return handleError(e) }
}
