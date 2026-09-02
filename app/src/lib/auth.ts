/**
 * LocInsights — NextAuth Configuration
 *
 * Auth strategy: Credentials provider (username + password)
 * - Passwords hashed with bcrypt (10 rounds) — see scripts/seed-users.ts
 * - Session: JWT (30 days, refresh every 24h)
 * - Rate-limit: in-memory per-IP (5 attempts / 15 min)
 * - DB lockout: users.failed_login_count + locked_until (defense-in-depth)
 * - Audit log: every login attempt → user_audit_logs
 *
 * SaaS Multi-Tenant:
 * - JWT carries `tenant_id` claim (current active tenant) + `available_tenant_ids` (for switcher)
 * - Session exposes `session.user.tenant_id` + `session.user.permissions` (loaded from role)
 * - Superadmin has tenant_id = NULL (platform-wide); can switch into any tenant
 */

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { DEFAULT_PERMISSIONS, sanitizePermissions, type Permissions } from '@/lib/permissions'

// =====================================================
// Rate limiting (in-memory, per-IP)
// =====================================================
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000  // 15 minutes
const RATE_WINDOW_MS = 15 * 60 * 1000

const ipAttempts = new Map<string, { count: number; lastAttempt: number }>()

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const entry = ipAttempts.get(ip) || { count: 0, lastAttempt: now }
  // Reset if window expired
  if (now - entry.lastAttempt > RATE_WINDOW_MS) {
    entry.count = 0
  }
  entry.count += 1
  entry.lastAttempt = now
  ipAttempts.set(ip, entry)
}

function isIpRateLimited(ip: string): boolean {
  const entry = ipAttempts.get(ip)
  if (!entry) return false
  if (Date.now() - entry.lastAttempt > RATE_WINDOW_MS) {
    ipAttempts.delete(ip)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

function clearIpAttempts(ip: string) {
  ipAttempts.delete(ip)
}

// =====================================================
// Helper: extract client IP from request headers
// =====================================================
function getClientIp(req: any): string {
  const forwarded = req?.headers?.get?.('x-forwarded-for') || req?.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req?.socket?.remoteAddress || 'unknown'
}

// =====================================================
// Helper: log audit
// =====================================================
async function logAudit(
  userId: string | null,
  action: string,
  ip: string,
  details: Record<string, any> = {}
) {
  try {
    await prisma.userAuditLog.create({
      data: {
        user_id: userId || 'unknown',
        actor_id: null,
        action,
        details: details as any,
        ip_address: ip,
      },
    })
  } catch (e) {
    console.error('[auth] Failed to log audit:', e)
  }
}

// =====================================================
// Helper: load & sanitize role permissions
// =====================================================
async function loadRolePermissions(roleId: string): Promise<Permissions> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { permissions: true },
  })
  if (!role) {
    // Fallback to system defaults
    return DEFAULT_PERMISSIONS[roleId] || DEFAULT_PERMISSIONS.viewer
  }
  return sanitizePermissions(role.permissions)
}

// =====================================================
// NextAuth Options
// =====================================================
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'LocInsights',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }
        const ip = getClientIp(req)

        // IP rate-limit check
        if (isIpRateLimited(ip)) {
          await logAudit(null, 'login', ip, {
            reason: 'ip_rate_limited',
            username: credentials.username,
          })
          return null
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user || !user.is_active) {
          recordFailedAttempt(ip)
          await logAudit(user?.id || null, 'login', ip, {
            reason: !user ? 'user_not_found' : 'user_inactive',
            username: credentials.username,
          })
          return null
        }

        // DB lockout check
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          recordFailedAttempt(ip)
          await logAudit(user.id, 'login', ip, {
            reason: 'account_locked',
            locked_until: user.locked_until,
          })
          return null
        }

        // Verify password (bcrypt constant-time)
        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) {
          recordFailedAttempt(ip)
          const newCount = (user.failed_login_count || 0) + 1
          const shouldLock = newCount >= MAX_ATTEMPTS
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failed_login_count: newCount,
              locked_until: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : user.locked_until,
            },
          })
          await logAudit(user.id, 'login', ip, {
            reason: 'invalid_password',
            attempt_count: newCount,
            account_locked: shouldLock,
          })
          return null
        }

        // SUCCESS — clear counters
        clearIpAttempts(ip)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failed_login_count: 0,
            locked_until: null,
            last_login_at: new Date(),
          },
        })

        // Load role permissions
        const permissions = await loadRolePermissions(user.role)

        await logAudit(user.id, 'login', ip, {
          reason: 'success',
          role: user.role,
        })

        // Resolve tenant_id:
        // - superadmin: NULL (platform-wide) — but default_tenant_id is set for switcher
        // - other roles: their assigned tenant_id
        const tenantId = user.role === 'superadmin' ? null : user.tenant_id

        // Build available tenant list for switcher (superadmin can switch into all tenants)
        let availableTenantIds: string[] = []
        if (user.role === 'superadmin') {
          const allTenants = await prisma.tenant.findMany({
            where: { status: 'active' },
            select: { id: true },
          })
          availableTenantIds = allTenants.map(t => t.id)
        } else if (user.tenant_id) {
          availableTenantIds = [user.tenant_id]
        }

        // Return user object — will be stored in JWT
        return {
          id: user.id,
          name: user.username,
          email: user.email || `${user.username}@locinsights.local`,
          role: user.role,
          username: user.username,
          user_id: user.id,
          display_name: user.display_name || user.username,
          tenant_id: tenantId,
          default_tenant_id: user.default_tenant_id,
          available_tenant_ids: availableTenantIds,
          permissions,
        } as any
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,  // 30 days
    updateAge: 24 * 60 * 60,    // refresh every 24h
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // Inject user info into JWT
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in
      if (user) {
        token.user_id = (user as any).user_id
        token.username = (user as any).username
        token.role = (user as any).role
        token.display_name = (user as any).display_name
        token.tenant_id = (user as any).tenant_id
        token.default_tenant_id = (user as any).default_tenant_id
        token.available_tenant_ids = (user as any).available_tenant_ids
        token.permissions = (user as any).permissions
      }

      // Handle session update (e.g. tenant switching via client-side `update()`)
      if (trigger === 'update' && session) {
        if (session.tenant_id !== undefined) {
          token.tenant_id = session.tenant_id
        }
        if (session.permissions) {
          token.permissions = session.permissions
        }
      }

      return token
    },

    // Expose JWT fields to client session
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.user_id
        ;(session.user as any).user_id = token.user_id
        ;(session.user as any).username = token.username
        ;(session.user as any).role = token.role
        ;(session.user as any).display_name = token.display_name
        ;(session.user as any).tenant_id = token.tenant_id
        ;(session.user as any).default_tenant_id = token.default_tenant_id
        ;(session.user as any).available_tenant_ids = token.available_tenant_ids || []
        ;(session.user as any).permissions = token.permissions
      }
      return session
    },
  },

  events: {
    async signOut(message) {
      // Optional: log sign-out
      const token = message as any
      if (token?.token?.user_id) {
        await logAudit(token.token.user_id, 'logout', 'unknown', {})
      }
    },
  },

  // Use strong secret from env
  secret: process.env.NEXTAUTH_SECRET,
}

// =====================================================
// Extend TypeScript types for Session/JWT
// =====================================================
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      user_id?: string
      name: string
      username?: string
      email?: string | null
      role?: string
      display_name?: string
      tenant_id?: string | null
      default_tenant_id?: string | null
      available_tenant_ids?: string[]
      permissions?: Permissions
    }
  }

  interface User {
    user_id?: string
    username?: string
    role?: string
    display_name?: string
    tenant_id?: string | null
    default_tenant_id?: string | null
    available_tenant_ids?: string[]
    permissions?: Permissions
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user_id?: string
    username?: string
    role?: string
    display_name?: string
    tenant_id?: string | null
    default_tenant_id?: string | null
    available_tenant_ids?: string[]
    permissions?: Permissions
  }
}
