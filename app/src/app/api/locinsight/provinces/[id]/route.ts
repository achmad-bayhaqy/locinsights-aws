import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { requireSuperadmin } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// GET is public (no auth) — provinces are shared reference data.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const p = await db.province.findUnique({ where: { code: id } })
    if (!p) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: p })
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
    delete body.code
    const p = await db.province.update({ where: { code: id }, data: body })
    return NextResponse.json({ success: true, data: p })
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
    await db.province.delete({ where: { code: id } })
    return NextResponse.json({ success: true })
  } catch (e) { return handleError(e) }
}
