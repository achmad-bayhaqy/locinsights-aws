'use client'

/**
 * LocInsights — Auth Provider (client-side wrapper for NextAuth SessionProvider)
 *
 * Wraps the app with NextAuth's SessionProvider so useSession() works in client components.
 * Server components access session via getServerSession() directly.
 */

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
