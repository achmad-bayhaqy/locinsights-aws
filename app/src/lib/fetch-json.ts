/**
 * Safe JSON fetch for client components.
 *
 * Task 10-a: every scraper UI call used to do `fetch(...).then(r => r.json())`.
 * Whenever the server answered with an HTML page (expired session 302 →
 * /login, gateway 502/504 error page, etc.) the browser surfaced the cryptic
 * "Unexpected token '<', "<html> ..." is not valid JSON" instead of a useful
 * message. This helper:
 *   - always requests JSON (`Accept: application/json`),
 *   - reads the body as text and JSON.parse()s it defensively,
 *   - turns non-JSON bodies into descriptive Error objects (status, snippet),
 *   - optionally enforces a client-side AbortController timeout.
 *
 * NOTE: the real fix for the expired-session case lives in
 * src/middleware.ts (API routes now get a 401 JSON response instead of a
 * redirect to the HTML login page); this helper is defense-in-depth for
 * gateway/proxy HTML error pages that we do not control.
 */

export async function fetchJson<T = any>(
  input: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  if (timeoutMs && timeoutMs > 0) {
    controller = new AbortController()
    timer = setTimeout(() => controller!.abort(), timeoutMs)
  }

  let res: Response
  try {
    res = await fetch(input, {
      ...init,
      headers,
      signal: init.signal ?? controller?.signal,
    })
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${Math.round((timeoutMs || 0) / 1000)}s — the scraper may still be finishing; try again.`,
      )
    }
    throw e
  } finally {
    if (timer) clearTimeout(timer)
  }

  const text = await res.text()
  let json: T
  try {
    json = JSON.parse(text) as T
  } catch {
    // Non-JSON body — almost always an HTML error page from a proxy/gateway
    // or (pre-fix) a middleware redirect to the HTML login page.
    const contentType = res.headers.get('content-type') || 'unknown content-type'
    const snippet = text.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (res.status === 401) {
      throw new Error('Your session has expired. Please log in again.')
    }
    throw new Error(
      `Server returned a non-JSON response (HTTP ${res.status}, ${contentType})` +
        (snippet ? ` starting with "${snippet}"` : '') +
        '. If this persists, a gateway may have timed out — please retry.',
    )
  }
  return json
}
