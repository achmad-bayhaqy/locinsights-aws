'use client'

/**
 * LocInsights — App Context (shared client-side state for the (app) route group)
 *
 * Responsibilities:
 *   1. Loads /api/locinsight/overview ONCE on mount and shares the result
 *      with every route page (Dashboard, Map, Opportunities, Analysis, …).
 *      This avoids each page fetching the (large) overview payload separately
 *      and keeps the previous SPA-style behaviour where data is shared.
 *   2. Holds the shared `selectedKelurahanId` so Map Explorer, Opportunities,
 *      Deep Analysis, etc. all read/write the same selection.
 *   3. Exposes a `navigate(viewId)` helper that translates the legacy view-id
 *      strings (e.g. 'opportunities', 'analysis') used by the existing
 *      component callbacks (onNavigate, onSelectKelurahan + setActiveView)
 *      into next/navigation router.push() calls to the new App-Router URLs.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { OverviewData } from '@/components/locinsight/types'

// =====================================================
// View-id → URL mapping (legacy onNavigate IDs → App-Router paths)
// =====================================================
export const VIEW_PATHS: Record<string, string> = {
  dashboard:      '/dashboard',
  map:            '/map',
  opportunities:  '/opportunities',
  analysis:       '/analysis',
  brands:         '/brands',
  malls:          '/malls',
  competitors:    '/competitors',
  ab:             '/ab',
  ml:             '/ml',
  mall_tenants:   '/mall-tenants',
  reports:        '/reports',
  data:           '/data',
  scraper:        '/scraper',
  methodology:    '/methodology',
  docs:           '/docs',
  about:          '/about',
  settings:       '/settings',
  users:          '/users',
}

// =====================================================
// Context shape
// =====================================================
interface AppContextValue {
  // Shared overview data
  overview: OverviewData | null
  loading:  boolean
  error:    string | null
  reload:   () => void

  // Shared kelurahan selection (used by Map / Opportunities / Analysis / Brands / Malls)
  selectedKelurahanId: string | null
  setSelectedKelurahanId: (id: string | null) => void

  // Navigation helper — accepts legacy view-id ("opportunities") or path ("/opportunities")
  navigate: (viewIdOrPath: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// =====================================================
// Provider
// =====================================================
export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [overview, setOverview]       = useState<OverviewData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedKelurahanId, setSelectedKelurahanId] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const reload = useCallback(() => {
    setLoading(true)
    setReloadNonce(n => n + 1)
  }, [])

  // Fetch overview once (or when reload is triggered).
  // NOTE: we do NOT call setLoading(true) synchronously here — that would
  // trigger the react-hooks/set-state-in-effect lint rule. The initial state
  // is already `true`, and `reload()` sets it to true before bumping the nonce.
  useEffect(() => {
    let cancelled = false
    fetch('/api/locinsight/overview')
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j.success) {
          setOverview(j.data as OverviewData)
          // Default selection = top opportunity (matches old page.tsx behaviour)
          if (j.data.top_opportunities?.[0]) {
            setSelectedKelurahanId(j.data.top_opportunities[0].kelurahan_id)
          }
          setError(null)
        } else {
          setError(j.error || 'Failed to load overview')
        }
      })
      .catch(e => {
        if (!cancelled) setError(e?.message || 'Network error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadNonce])

  // Navigation helper — translate legacy view-id to App-Router path
  const navigate = useCallback((viewIdOrPath: string) => {
    if (!viewIdOrPath) return
    // Already a path?
    if (viewIdOrPath.startsWith('/')) {
      router.push(viewIdOrPath)
      return
    }
    const path = VIEW_PATHS[viewIdOrPath]
    if (path) {
      router.push(path)
    } else {
      // Unknown — fall back to treating it as a path
      router.push('/' + viewIdOrPath)
    }
  }, [router])

  const value = useMemo<AppContextValue>(() => ({
    overview,
    loading,
    error,
    reload,
    selectedKelurahanId,
    setSelectedKelurahanId,
    navigate,
  }), [overview, loading, error, reload, selectedKelurahanId, navigate])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// =====================================================
// Hook
// =====================================================
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp() must be used inside <AppProvider>')
  }
  return ctx
}

// =====================================================
// Convenience: get current page name from pathname
// (used by header breadcrumb)
// =====================================================
export const PATH_LABELS: Record<string, string> = {
  '/dashboard':     'nav.dashboard',
  '/map':           'nav.map',
  '/opportunities': 'nav.opportunities',
  '/analysis':      'nav.analysis',
  '/brands':        'nav.brands',
  '/malls':         'nav.malls',
  '/competitors':   'nav.competitors',
  '/ab':            'nav.ab',
  '/ml':            'nav.ml',
  '/mall-tenants':  'nav.mall_tenants',
  '/reports':       'nav.reports',
  '/data':          'nav.data',
  '/scraper':       'nav.scraper',
  '/methodology':   'nav.methodology',
  '/docs':          'nav.docs',
  '/about':         'nav.about',
  '/settings':      'nav.settings',
  '/users':         'nav.users',
}
