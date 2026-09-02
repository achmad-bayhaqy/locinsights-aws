/**
 * LocInsights — Protected route group layout (server component)
 *
 * Wraps every page under /dashboard, /map, /opportunities, etc. with:
 *   • Server-side auth check (getServerSession) — redirects to /login if unauthenticated
 *   • Client-side AppShell wrapper (sidebar + header + footer + AI chat + AppProvider)
 *
 * Per-route permission checks happen at each page.tsx via hasPermission().
 */

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppShell } from './app-shell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard')
  }

  return <AppShell>{children}</AppShell>
}
