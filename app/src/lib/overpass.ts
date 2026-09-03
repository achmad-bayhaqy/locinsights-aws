/**
 * Shared Overpass client — used by the unified scraper engine
 * (keyword/brand modes) and the mall-tenants scraper.
 *
 * Task 10-a fixes baked in:
 *   1. MULTI-ENDPOINT FAILOVER — overpass-api.de rate-limits aggressively
 *      (HTTP 429) and drops out for minutes at a time. We race three mirrors:
 *        - https://overpass-api.de/api/interpreter  (primary)
 *        - https://overpass.kumi.systems/api/interpreter
 *        - https://maps.mail.ru/osm/tools/overpass/api/interpreter
 *      The previous engine raced osm.ch instead of mail.ru — osm.ch only
 *      carries Swiss data, so it was useless for Indonesia/worldwide scrapes.
 *   2. HONEST empty-vs-failed — the old helper returned `[]` both when every
 *      endpoint failed (network/429/timeout) and when the query genuinely
 *      matched 0 elements. Callers could not tell "Overpass is down" from
 *      "this mall has no OSM shops", which produced misleading errors.
 *   3. TIMEOUT — every request gets an AbortController deadline (default
 *      25 s) so a hanging endpoint can never push the route past the 60 s
 *      function/ALB limit and turn the client response into an HTML 504.
 *   4. Connection hygiene — after a mirror wins, the remaining in-flight
 *      requests are aborted (the old code leaked sockets after clearTimeout).
 */

const USER_AGENT = 'LocInsights/1.0 (MAP Active Adiperkasa Data Team)'

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const

export interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface OverpassResult {
  /** Elements returned by the winning endpoint ([] when empty or failed). */
  elements: OverpassElement[]
  /** Endpoint that produced the winning response (null when all failed). */
  endpoint: string | null
  /** true = every endpoint failed (HTTP error, network error, or timeout). */
  failed: boolean
  /** Short per-endpoint failure summary (only when failed=true). */
  errors: string[]
}

/**
 * Human-readable reason a single endpoint attempt failed.
 */
function describeFailure(endpoint: string, e: any, timeoutMs: number): string {
  if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
    return `${hostOf(endpoint)}: timeout after ${Math.round(timeoutMs / 1000)}s`
  }
  const msg = String(e?.message || e || 'unknown error')
  return `${hostOf(endpoint)}: ${msg.slice(0, 120)}`
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return endpoint
  }
}

/**
 * Run one Overpass QL query against all mirrors concurrently.
 * Never throws — callers inspect `.failed` / `.elements`.
 */
export async function runOverpass(
  query: string,
  opts: { timeoutMs?: number } = {},
): Promise<OverpassResult> {
  const timeoutMs = opts.timeoutMs ?? 25_000
  const controllers: AbortController[] = []
  const failures: string[] = []

  const attempts = OVERPASS_ENDPOINTS.map(endpoint => {
    const controller = new AbortController()
    controllers.push(controller)
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      // Node/Bun fetch caches by URL — Overpass mirrors must never be served
      // from a cache (results change as OSM is edited).
      cache: 'no-store',
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { elements?: OverpassElement[] }
        return { endpoint, elements: data.elements || [] }
      })
      .finally(() => clearTimeout(timer))
  })

  try {
    const winner = await Promise.any(attempts)
    // A mirror answered with valid JSON. Abort the remaining in-flight
    // requests so we don't leak sockets while the route finishes.
    for (const c of controllers) {
      try { c.abort() } catch { /* already settled */ }
    }
    return { elements: winner.elements, endpoint: winner.endpoint, failed: false, errors: [] }
  } catch (agg: any) {
    // Promise.any rejects only when ALL endpoints failed.
    const raw: any[] = Array.isArray(agg?.errors) ? agg.errors : [agg]
    for (let i = 0; i < raw.length; i++) {
      failures.push(describeFailure(OVERPASS_ENDPOINTS[i] as string, raw[i], timeoutMs))
    }
    for (const c of controllers) {
      try { c.abort() } catch { /* already settled */ }
    }
    return { elements: [], endpoint: null, failed: true, errors: failures }
  }
}

/** Coordinates of an element (node coords or way/relation center). */
export function elementCoords(el: OverpassElement): { lat: number; lng: number } | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null
  return { lat, lng }
}

/**
 * Dedupe elements by OSM type+id (primary) and rounded coordinates
 * (secondary — catches the same feature returned once as a way and once as
 * a member node, or overlapping node/way statements in one union).
 */
export function dedupeOverpassElements(elements: OverpassElement[]): OverpassElement[] {
  const seen = new Set<string>()
  const out: OverpassElement[] = []
  for (const el of elements) {
    let key: string
    if (el.type && el.id) {
      key = `${el.type}/${el.id}`
    } else {
      const c = elementCoords(el)
      key = c ? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}` : `anon_${out.length}`
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(el)
  }
  return out
}

/** Escape a user-supplied string for safe embedding in a JS RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
