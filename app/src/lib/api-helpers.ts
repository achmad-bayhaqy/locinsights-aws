/**
 * LocInsights API route handlers — shared helpers
 */
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
// Re-use the cached Prisma client from db.ts — creating a fresh PrismaClient
// per import (as before) caused connection-pool exhaustion on Vercel.
import { db } from './db'
export { db }

/**
 * Filter an incoming request body so it only contains fields that are valid
 * scalar columns of the given Prisma model. This prevents Prisma validation
 * errors (which surface as empty-body 500s in production and cause the
 * client-side error "Failed to execute 'json' on 'Response': Unexpected end
 * of JSON input") when the body includes virtual/joined fields used for
 * display (e.g. `brand`, `mall`, `stores`, `Kecamatan`).
 *
 * Usage:
 *   const body = filterModelFields('Store', await req.json())
 */
const MODEL_FIELD_CACHE = new Map<string, Set<string>>()

export function filterModelFields(modelName: string, body: any): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  let fields = MODEL_FIELD_CACHE.get(modelName)
  if (!fields) {
    const enumName = `${modelName}ScalarFieldEnum` as keyof typeof Prisma
    const enumObj = Prisma[enumName] as Record<string, string> | undefined
    if (enumObj && typeof enumObj === 'object') {
      fields = new Set(Object.keys(enumObj))
    } else {
      fields = new Set()
    }
    MODEL_FIELD_CACHE.set(modelName, fields)
  }
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (fields.has(k)) out[k] = v
  }
  return out
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function paginate<T>(
  model: any,
  req: NextRequest,
  opts: {
    where?: any
    include?: any
    orderBy?: any
    search?: { fields: string[]; term: string | null }
  } = {}
): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  // Allow up to 5000 rows per page when explicitly requested (used by Data
  // Manager table view so client-side filters can apply to the FULL dataset,
  // not just the current page — per user request Aug 2026).
  // Default is 50 (small, fast); max is 5000 (effectively "all").
  const pageSize = Math.min(5000, Math.max(1, Number(sp.get('page_size') || 50)))
  const skip = (page - 1) * pageSize

  let where: any = opts.where || {}
  if (opts.search?.term && opts.search.fields.length > 0) {
    where.OR = opts.search.fields.map((f: string) => ({
      [f]: { contains: opts.search!.term },
    }))
  }

  const [data, total] = await Promise.all([
    model.findMany({ where, include: opts.include, orderBy: opts.orderBy, skip, take: pageSize }),
    model.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

/**
 * Standard error handler for API routes.
 *
 * Always returns a JSON body — never an empty response. This is critical
 * because the client calls `res.json()` and an empty body throws
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 */
export function handleError(e: any) {
  console.error('API error:', e)
  try {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Duplicate entry — a record with this ID already exists' },
          { status: 409 }
        )
      }
      if (e.code === 'P2025') {
        return NextResponse.json(
          { success: false, error: 'Record not found' },
          { status: 404 }
        )
      }
      // Other Prisma known errors (e.g. P2003 foreign key, P2014 required relation)
      return NextResponse.json(
        { success: false, error: `Database error ${e.code}: ${e.message?.slice(0, 200) || 'constraint violation'}` },
        { status: 400 }
      )
    }
    if (e instanceof Prisma.PrismaClientValidationError) {
      // Validation errors are caused by unknown fields or wrong types in `data:`
      return NextResponse.json(
        { success: false, error: `Validation error: ${e.message?.split('\n').slice(-1)[0]?.trim().slice(0, 300) || 'invalid field'}` },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: e?.message || 'Internal server error' },
      { status: 500 }
    )
  } catch (fallbackErr) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
