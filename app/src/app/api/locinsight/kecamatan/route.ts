import { NextRequest, NextResponse } from 'next/server'
import { db, paginate, handleError } from '@/lib/api-helpers'
import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'

// GET is public (no auth) — kecamatan are shared reference data.
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const sp = req.nextUrl.searchParams
    const term = sp.get('search')
    const kab = sp.get('kab_code')
    const all = sp.get('all') === 'true'

    const where: any = {}
    if (kab) where.kabupaten_code = kab

    if (all) {
      // Single-shot full fetch for choropleth demographic layer.
      const data = await db.kecamatan.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 5000,
      })
      return NextResponse.json({ success: true, data, count: data.length })
    }

    return paginate(db.kecamatan, req, {
      where,
      orderBy: { code: 'asc' },
      search: { fields: ['name'], term },
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
    const k = await db.kecamatan.create({ data: body })
    return NextResponse.json({ success: true, data: k }, { status: 201 })
  } catch (e) { return handleError(e) }
}
