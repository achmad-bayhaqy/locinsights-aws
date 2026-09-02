/**
 * /docs — Documentation hub
 *
 * Server component that gates on auth (any authenticated user can read),
 * then renders the <Documentation /> client component which handles the
 * full UI (sidebar, markdown render, edit/create/delete, etc.)
 *
 * All docs are stored in PostgreSQL via Prisma `Doc` model — DB-backed,
 * never filesystem (Vercel serverless FS is read-only).
 */

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { Documentation } from '@/components/locinsight/documentation'

export const dynamic = 'force-dynamic'

export default async function DocsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/docs')
  }

  return (
    <PermissionGate menu="docs">
      <Documentation />
    </PermissionGate>
  )
}
