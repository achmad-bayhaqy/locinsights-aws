/**
 * GET /api/admin/me — current session info for client-side permission checks.
 *
 * Returns the user's id, username, role, tenant_id, and full permissions matrix.
 * Used by the client to gate UI elements (sidebar items, export buttons, etc.)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DEFAULT_PERMISSIONS, type RoleId } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  const user = session.user as any
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name || '',
      tenant_id: user.tenant_id || null,
      default_tenant_id: user.default_tenant_id || null,
      available_tenant_ids: user.available_tenant_ids || [],
      // If the session doesn't carry permissions (older login), fall back to defaults
      permissions: user.permissions || DEFAULT_PERMISSIONS[user.role as string] || DEFAULT_PERMISSIONS.viewer,
    },
  })
}
