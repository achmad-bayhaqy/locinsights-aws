/**
 * /api/docs/categories — list distinct doc categories
 *
 * GET (public):
 *   Returns the set of distinct `category` values across all visible docs
 *   (system docs + caller's tenant docs), sorted alphabetically.
 *
 *   Response: { success: true, data: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getCurrentTenantId } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const tenantId = getCurrentTenantId(session)

    const visibleTenants: string[] = []
    if (tenantId) visibleTenants.push(tenantId)

    const rows = await prisma.doc.findMany({
      where: {
        OR: [{ tenant_id: null }, ...(tenantId ? [{ tenant_id: tenantId }] : [])],
        is_published: true,
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })

    const data = rows.map(r => r.category).filter(Boolean)
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[api/docs/categories GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
