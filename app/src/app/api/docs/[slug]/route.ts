/**
 * /api/docs/[slug] — Single doc: GET, PUT, DELETE
 *
 * GET (public for system docs; tenant docs require auth + tenant match):
 *   Returns the full doc including content.
 *   - System doc (tenant_id IS NULL): public, anyone can read
 *   - Tenant doc (tenant_id = X): only authenticated users in that tenant can read
 *   Response: { success: true, data: Doc }
 *
 * PUT (admin roles only, with constraints):
 *   Body: { title?, category?, content?, owner?, order?, is_published? }
 *   - System docs (tenant_id=NULL): ONLY superadmin can edit
 *   - Tenant docs: superadmin OR admin/tenant_admin within the same tenant
 *   - last_updated is set to today
 *   Response: { success: true, data: Doc }
 *
 * DELETE (admin roles only, with constraints):
 *   - System docs (tenant_id=NULL): ONLY superadmin can delete
 *   - Tenant docs: superadmin OR admin/tenant_admin within the same tenant
 *   Response: { success: true }
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
// GET — single doc
// =====================================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const doc = await prisma.doc.findUnique({ where: { slug } })
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }

    // System doc → public
    if (doc.tenant_id === null) {
      if (!doc.is_published) {
        // Unpublished system docs require auth + admin
        const session = await getServerSession(authOptions)
        if (!session?.user || !isAdminRole(session.user.role as string)) {
          return NextResponse.json(
            { success: false, error: 'Doc not found' },
            { status: 404 }
          )
        }
      }
      return NextResponse.json({ success: true, data: doc })
    }

    // Tenant doc → require auth + tenant match
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userTenantId = getCurrentTenantId(session)
    const role = session.user.role as string
    // Superadmin in platform-wide mode can read any tenant doc;
    // otherwise must match tenant_id
    if (role !== 'superadmin' && userTenantId !== doc.tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }
    if (role === 'superadmin' && userTenantId !== null && userTenantId !== doc.tenant_id) {
      // Superadmin scoped to a different tenant
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }
    if (!doc.is_published && !isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (e: any) {
    console.error('[api/docs/[slug] GET] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// PUT — update doc
// =====================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    const role = session.user.role as string
    if (!isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: 'Admin privileges required to edit docs' },
        { status: 403 }
      )
    }

    const doc = await prisma.doc.findUnique({ where: { slug } })
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }

    // Permission constraints
    if (doc.tenant_id === null) {
      // System doc — only superadmin can edit
      if (role !== 'superadmin') {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can edit system documentation' },
          { status: 403 }
        )
      }
    } else {
      // Tenant doc — superadmin OR admin within same tenant
      const userTenantId = getCurrentTenantId(session)
      if (role !== 'superadmin' && userTenantId !== doc.tenant_id) {
        return NextResponse.json(
          { success: false, error: 'You can only edit docs within your own tenant' },
          { status: 403 }
        )
      }
      if (role === 'superadmin' && userTenantId !== null && userTenantId !== doc.tenant_id) {
        return NextResponse.json(
          { success: false, error: 'Doc not found in current tenant scope' },
          { status: 404 }
        )
      }
    }

    const body = await req.json()
    const { title, category, content, owner, order, is_published } = body || {}

    // Build update payload — only set fields that are present
    const update: any = { last_updated: new Date() }
    if (typeof title === 'string' && title.trim()) update.title = title.trim()
    if (typeof category === 'string' && category.trim()) update.category = category.trim()
    if (typeof content === 'string') update.content = content
    if (typeof owner === 'string' && owner.trim()) update.owner = owner.trim()
    if (typeof order === 'number' && Number.isFinite(order)) update.order = order
    if (typeof is_published === 'boolean') update.is_published = is_published

    const updated = await prisma.doc.update({
      where: { slug },
      data: update,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    console.error('[api/docs/[slug] PUT] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE — delete doc
// =====================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    const role = session.user.role as string
    if (!isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: 'Admin privileges required to delete docs' },
        { status: 403 }
      )
    }

    const doc = await prisma.doc.findUnique({ where: { slug } })
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Doc not found' },
        { status: 404 }
      )
    }

    if (doc.tenant_id === null) {
      // System doc — only superadmin can delete
      if (role !== 'superadmin') {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can delete system documentation' },
          { status: 403 }
        )
      }
    } else {
      // Tenant doc — superadmin OR admin within same tenant
      const userTenantId = getCurrentTenantId(session)
      if (role !== 'superadmin' && userTenantId !== doc.tenant_id) {
        return NextResponse.json(
          { success: false, error: 'You can only delete docs within your own tenant' },
          { status: 403 }
        )
      }
      if (role === 'superadmin' && userTenantId !== null && userTenantId !== doc.tenant_id) {
        return NextResponse.json(
          { success: false, error: 'Doc not found in current tenant scope' },
          { status: 404 }
        )
      }
    }

    await prisma.doc.delete({ where: { slug } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/docs/[slug] DELETE] Error:', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
