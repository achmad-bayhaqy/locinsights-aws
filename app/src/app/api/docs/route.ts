/**
 * /api/docs — Documentation list + create
 *
 * GET (public):
 *   Returns metadata for all docs visible to the current caller.
 *   Visibility rules:
 *     - Unauthenticated caller: system docs only (tenant_id IS NULL, is_published = true)
 *     - Authenticated caller: system docs + docs in their own tenant_id
 *   Query params:
 *     ?category=X   — filter by category (case-insensitive)
 *     ?search=X     — case-insensitive LIKE on title + content
 *   Response shape:
 *     { success: true, data: DocMeta[] }
 *     DocMeta = { id, slug, title, category, order, owner, tenant_id, is_published, last_updated, excerpt }
 *     NOTE: `content` is omitted from list payloads (only `excerpt` first 200 chars) for performance.
 *
 * POST (auth required — admin roles only: superadmin, tenant_admin, admin):
 *   Body: { title, slug, category?, content?, owner?, order?, tenant_id?, is_published? }
 *   - tenant_admin (non-superadmin): tenant_id is FORCED to their session.tenant_id (cannot create system docs)
 *   - superadmin: can create system doc (tenant_id=NULL) or tenant doc (tenant_id=X)
 *   - last_updated is set to today
 *   Response shape:
 *     { success: true, data: Doc }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getCurrentTenantId } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// Admin role check — per user request (Aug 14 2026): only superadmin can manage docs
function isAdminRole(role: string | undefined): boolean {
  return role === 'superadmin'
}

// =====================================================
// GET — list docs (public for system docs)
// =====================================================
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const categoryFilter = sp.get('category')?.trim() || undefined
    const search = sp.get('search')?.trim() || undefined

    // Try to resolve session — public GET for system docs is allowed without auth
    const session = await getServerSession(authOptions)
    const tenantId = getCurrentTenantId(session)

    // Build visibility filter:
    //   - Unauthenticated OR superadmin-with-no-tenant: system docs only (tenant_id IS NULL)
    //   - Authenticated with tenant: system docs + their tenant's docs
    //
    // NOTE: Prisma 6 no longer accepts `{ in: [null, ...] }` for nullable fields.
    // We use `OR: [{ tenant_id: null }, { tenant_id: { in: [...] } }]` instead.
    const where: any = {
      is_published: true,
      OR: [{ tenant_id: null }, ...(tenantId ? [{ tenant_id: tenantId }] : [])],
    }

    if (categoryFilter) {
      where.category = { equals: categoryFilter, mode: 'insensitive' }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    const docs = await prisma.doc.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        order: true,
        owner: true,
        tenant_id: true,
        is_published: true,
        last_updated: true,
        content: true,
      },
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
    })

    // Strip content → keep only excerpt for list view
    const data = docs.map(d => {
      const plain = (d.content || '')
        .replace(/```[\s\S]*?```/g, ' ') // strip fenced code blocks
        .replace(/[#>*_`~\-]/g, ' ')    // strip markdown syntax chars
        .replace(/\s+/g, ' ')
        .trim()
      const excerpt = plain.slice(0, 200) + (plain.length > 200 ? '…' : '')
      // Strip content from the response object
      const { content, ...meta } = d
      return { ...meta, excerpt }
    })

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[api/docs GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// POST — create doc (admin roles only)
// =====================================================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    const role = session.user.role as string | undefined
    if (!isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: 'Admin privileges required to create docs' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      title,
      slug,
      category = 'General',
      content = '',
      owner = 'Data Team',
      order = 100,
      tenant_id: requestedTenantId = null,
      is_published = true,
    } = body || {}

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      )
    }
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { success: false, error: 'slug is required (lowercase, hyphens, alphanumeric only)' },
        { status: 400 }
      )
    }

    // Resolve tenant_id:
    //   - superadmin can choose (system doc = NULL, or tenant doc = X)
    //   - tenant_admin / admin: FORCED to their own session tenant_id
    let resolvedTenantId: string | null = null
    if (role === 'superadmin') {
      resolvedTenantId = requestedTenantId || null
    } else {
      const sessionTenantId = getCurrentTenantId(session)
      if (!sessionTenantId) {
        return NextResponse.json(
          { success: false, error: 'Tenant context required to create tenant docs' },
          { status: 400 }
        )
      }
      resolvedTenantId = sessionTenantId
    }

    // Check for existing slug
    const existing = await prisma.doc.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Doc with slug "${slug}" already exists` },
        { status: 409 }
      )
    }

    // If tenant_id is provided, verify tenant exists
    if (resolvedTenantId) {
      const tenantExists = await prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
        select: { id: true },
      })
      if (!tenantExists) {
        return NextResponse.json(
          { success: false, error: `Tenant "${resolvedTenantId}" not found` },
          { status: 400 }
        )
      }
    }

    const doc = await prisma.doc.create({
      data: {
        slug,
        title,
        category: String(category) || 'General',
        content: String(content),
        owner: String(owner) || 'Data Team',
        order: Number(order) || 100,
        tenant_id: resolvedTenantId,
        is_published: Boolean(is_published),
        last_updated: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (e: any) {
    console.error('[api/docs POST] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
