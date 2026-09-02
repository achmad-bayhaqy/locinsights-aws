import { NextRequest, NextResponse } from 'next/server'
import { db, paginate, handleError } from '@/lib/api-helpers'
import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

// GET is public (no auth) — provinces are shared reference data.
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const countryId = sp.get('country_id')

    const where: any = {}
    if (countryId) where.country_id = countryId

    return paginate(db.province, req, {
      where,
      orderBy: { code: 'asc' },
      search: { fields: ['name', 'country'], term },
    })
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const p = await db.province.create({ data: body })
    return NextResponse.json({ success: true, data: p }, { status: 201 })
  } catch (e) { return handleError(e) }
}
