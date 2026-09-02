/**
 * LocInsights — Audit log helper
 *
 * Convenience wrapper around `prisma.userAuditLog.create()` so API routes
 * can log mutations (create / update / delete / reset_password / reset_lockout)
 * in a single line.
 */

import { prisma } from '@/lib/db'

export interface AuditInput {
  /** ID of the user being acted upon (the "subject" of the audit entry) */
  userId: string
  /** ID of the acting user (the admin performing the action). null for system actions. */
  actorId?: string | null
  action: string
  details?: Record<string, any> | null
  ipAddress?: string | null
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.userAuditLog.create({
      data: {
        user_id: input.userId,
        actor_id: input.actorId ?? null,
        action: input.action,
        details: (input.details ?? {}) as any,
        ip_address: input.ipAddress ?? null,
      },
    })
  } catch (e) {
    // Non-fatal: never block a mutation because the audit log write failed.
    console.error('[audit-log] Failed to write audit entry:', e)
  }
}
