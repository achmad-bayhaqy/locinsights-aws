import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Disable query logging in production — it adds latency and log volume
    // on Vercel serverless. Enable only in dev for debugging.
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

// Alias for code that uses the conventional `prisma` name
export const prisma = db

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
