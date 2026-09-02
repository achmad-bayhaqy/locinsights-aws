/**
 * LocInsights — Auth & Routing Middleware
 *
 * Routing rules:
 *   /                → public landing page; if logged in, redirect to /dashboard (or last visited)
 *   /login           → public login page; if logged in, redirect to callbackUrl or /dashboard
 *   /survey          → public PWA survey form
 *   /dashboard, /map, /opportunities, etc. → require auth; redirect to /login?callbackUrl=<path>
 *   /api/admin/*     → require auth (permission checks in handler)
 *   /api/auth/*      → public (NextAuth endpoints, incl. switch-tenant)
 *   /api/docs        → public (docs listing for marketing)
 *   /api/locinsight/field-survey, /countries, /provinces, /kabupaten, /kecamatan, /kelurahan, /locations
 *                     → public (reference data + PWA submission)
 *   static assets    → public
 *
 * Also tracks last visited URL in cookie for redirect-after-login.
 *
 * NOTE: We use a custom middleware function (not next-auth's withAuth wrapper)
 * because withAuth's `authorized` callback only returns boolean — it can't do
 * "redirect logged-in users away from /login" or "redirect logged-in users
 * from / to /dashboard". Using getToken() + NextResponse gives full control.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// =====================================================
// Public page paths — no auth required
// =====================================================
const PUBLIC_PAGES = new Set(['/', '/login', '/survey'])

// =====================================================
// Public API path prefixes — no auth required
// (These are also excluded from the matcher below for efficiency,
//  but we double-check here in case matcher is bypassed.)
// =====================================================
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/docs',
  '/api/locinsight/field-survey',
  '/api/locinsight/countries',
  '/api/locinsight/provinces',
  '/api/locinsight/kabupaten',
  '/api/locinsight/kecamatan',
  '/api/locinsight/kelurahan',
  '/api/locinsight/locations',
]

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')
  )
}

// =====================================================
// Validate internal URL (prevent open-redirect attacks)
// =====================================================
function isSafeInternalUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

// =====================================================
// Middleware
// =====================================================
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  // Decode JWT token (if any). getToken is lightweight — no DB call.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isLoggedIn = !!token

  // -----------------------------------------------------
  // Case 1: Public pages (/, /login, /survey)
  // -----------------------------------------------------
  if (PUBLIC_PAGES.has(pathname)) {
    // Logged-in user visiting / → redirect to last visited or /dashboard
    if (pathname === '/' && isLoggedIn) {
      const lastVisited = req.cookies.get('last_visited_url')?.value
      const target = lastVisited && isSafeInternalUrl(lastVisited) ? lastVisited : '/dashboard'
      return NextResponse.redirect(new URL(target, req.url))
    }

    // Logged-in user visiting /login → redirect to callbackUrl or /dashboard
    if (pathname === '/login' && isLoggedIn) {
      const callbackUrl = searchParams.get('callbackUrl')
      const target =
        callbackUrl && isSafeInternalUrl(callbackUrl) ? callbackUrl : '/dashboard'
      return NextResponse.redirect(new URL(target, req.url))
    }

    // Otherwise, allow access to public page
    return NextResponse.next()
  }

  // -----------------------------------------------------
  // Case 2: Public API paths — allow without auth
  // -----------------------------------------------------
  if (isPublicApiPath(pathname)) {
    return NextResponse.next()
  }

  // -----------------------------------------------------
  // Case 3: Protected routes — require auth
  // -----------------------------------------------------
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + (searchParams.toString() ? '?' + searchParams.toString() : ''))
    return NextResponse.redirect(loginUrl)
  }

  // -----------------------------------------------------
  // Case 4: Authenticated user on protected route
  // — Track last visited URL (for redirect-after-login)
  // -----------------------------------------------------
  const response = NextResponse.next()
  // Only track page visits (not API calls or Next.js internals)
  // NOTE: httpOnly=false so client-side JS can also update this cookie on
  // client-side navigations (next/link, router.push). The cookie value is
  // just a URL path — no sensitive data — and is validated as internal
  // before being used for redirects.
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next')) {
    response.cookies.set('last_visited_url', pathname, {
      httpOnly: false,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      sameSite: 'lax',
    })
  }
  return response
}

// =====================================================
// Matcher — which paths the middleware runs on
//
// Matches everything EXCEPT:
//  - Next.js internals: _next/static, _next/image
//  - Static assets: favicon.ico, logo-*, apple-touch-icon-*, manifest.json,
//                   sw.js, locinsights.apk, robots.txt
//  - .well-known/*
//  - geojson/*
//  - Public API paths (handled in middleware for safety, but excluded
//    from matcher for efficiency)
//
// NOTE: /, /login, /survey ARE matched by middleware (so we can redirect
// logged-in users away from them). The middleware function handles them
// as public pages.
// =====================================================
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logo-.*|apple-touch-icon.*|manifest\\.json|sw\\.js|\\.well-known|locinsights\\.apk|robots\\.txt|geojson|api/auth|api/docs|api/locinsight/field-survey|api/locinsight/countries|api/locinsight/provinces|api/locinsight/kabupaten|api/locinsight/kecamatan|api/locinsight/kelurahan|api/locinsight/locations).*)',
  ],
}
