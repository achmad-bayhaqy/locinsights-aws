/**
 * Data Scraper — UNIFIED endpoint (keyword mode).
 *
 * POST /api/locinsight/scrape
 *   body: {
 *     mode?: 'keyword' | 'brand'   // default: 'keyword'
 *     query: string                // required for keyword mode
 *     kinds?: ('store'|'mall'|'poi')[]  // default: all
 *     radius_km?: number           // default: 5
 *     location?: { kab_code?, kec_code?, kel_code? }
 *   }
 *   returns: { success, run_id, geocoded, total_found, results, meta, review_required }
 *
 * GET /api/locinsight/scrape — list previous scraper runs
 *
 * NOTE: This endpoint NEVER auto-saves. Results are returned for user review.
 * User selects items in the UI, then POSTs to /scrape-save.
 *
 * The brand-sweep mode is also exposed here for unified access — it calls the
 * same shared engine as /scrape-competitors. The dedicated /scrape-competitors
 * endpoint remains for backward compat.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { runScrape } from '@/lib/scraper-engine'
import type { ScrapeRequest, ScrapeMode, ItemKind } from '@/lib/scraper-engine'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // NOTE: the whole handler is wrapped — an uncaught throw here would let
  // Next.js answer with a non-JSON error page (Task 10-a: every scraper error
  // must be JSON with a correct status code).
  try {
    const auth = await requireSuperadmin()
    if (!auth.ok) return auth.response

    const auth2 = await requirePermission('scraper', 'create')
    if (!auth2.ok) return auth2.response
    await setTenantContext(auth2.session)

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    const mode: ScrapeMode = body.mode === 'brand' ? 'brand' : 'keyword'
    const kinds: ItemKind[] | undefined = Array.isArray(body.kinds)
      ? body.kinds.filter((k: string) => k === 'store' || k === 'mall' || k === 'poi')
      : undefined
    const scrapeReq: ScrapeRequest = {
      mode,
      query: body.query,
      brands: body.brands,
      kinds,
      radius_km: typeof body.radius_km === 'number' ? body.radius_km : 5,
      location: body.location || undefined,
    }

    if (mode === 'keyword' && !scrapeReq.query?.trim()) {
      return NextResponse.json({ success: false, error: 'query is required' }, { status: 400 })
    }

    const result = await runScrape(scrapeReq)

    // Log scraper run for audit (tenant-scoped)
    const run = await db.scraperRun.create({
      data: withTenantId(auth2.session, {
        query: mode === 'keyword' ? (scrapeReq.query || '') : `brand sweep: ${(result.meta.brands_scraped || []).join(', ')}`,
        source: result.source as any,
        status: 'success',
        found_count: result.results.length,
        saved_count: 0,
        result_json: JSON.stringify(result.results.slice(0, 500)),
        finished_at: new Date(),
      }),
    }).catch(() => null)

    return NextResponse.json({
      success: true,
      run_id: run?.id,
      geocoded: result.geocoded,
      used_fallback: result.used_fallback,
      source: result.source,
      total_found: result.results.length,
      total_saved: 0,
      results: result.results.slice(0, 500),
      meta: result.meta,
      review_required: true,
    })
  } catch (e) {
    return handleError(e)
  }
}

/**
 * GET /api/locinsight/scrape — list previous scraper runs
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const auth2 = await requirePermission('scraper', 'read')
    if (!auth2.ok) return auth2.response
    await setTenantContext(auth2.session)

    const sp = req.nextUrl.searchParams
    const limit = Math.min(100, Number(sp.get('limit') || 50))
    const runs = await db.scraperRun.findMany({
      where: tenantFilter(auth2.session),
      orderBy: { started_at: 'desc' },
      take: limit,
    })
    return NextResponse.json({ success: true, data: runs })
  } catch (e) {
    return handleError(e)
  }
}
