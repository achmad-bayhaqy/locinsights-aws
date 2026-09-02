'use client'

/**
 * OfflineBanner — shows a clear "no connection" message when the user is offline.
 *
 * Per user request (Aug 2026):
 *   "untuk versi APK yang tidak mengarahkan ke browsernya, jika user offline
 *    cukup munculkan status aplikasi tidak bisa diakses karena tidak ada koneksi."
 *
 * Implementation:
 *   • Listens to `online` / `offline` browser events
 *   • Also pings `/api/locinsight/overview` every 30s when online to detect
 *     "false online" (browser thinks it's online but server is unreachable)
 *   • When offline, shows a full-screen overlay with a clear message
 *   • Dismissible — user can still see cached data by clicking "View cached data"
 *   • Auto-hides when connection returns
 *
 * This works for:
 *   • PWA installed on Android (Chrome)
 *   • PWA installed on iOS (Safari)
 *   • APK wrapper (Bubblewrap TWA — same rendering engine)
 *   • Regular browser tab
 */

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'

export function OfflineBanner() {
  const { t } = useLanguage()
  const [isOffline, setIsOffline] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Initial state
    setIsOffline(!navigator.onLine)

    const handleOffline = () => {
      setIsOffline(true)
      setDismissed(false)
    }
    const handleOnline = () => {
      setIsOffline(false)
      setDismissed(false)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Also poll the server every 30s — browser `navigator.onLine` can be wrong
    // (e.g. connected to a router with no internet)
    let pollInterval: NodeJS.Timeout | null = null
    if (typeof window !== 'undefined') {
      pollInterval = setInterval(async () => {
        try {
          // Fetch with no-cache to actually test the network
          const res = await fetch('/api/locinsight/overview', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          })
          if (!res.ok) throw new Error('Server returned non-OK')
          // Server is reachable — make sure we're marked online
          if (isOffline) {
            setIsOffline(false)
            setDismissed(false)
          }
        } catch {
          // Server unreachable — show offline banner even if browser thinks we're online
          if (!isOffline && !dismissed) {
            setIsOffline(true)
          }
        }
      }, 30000)
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [isOffline, dismissed])

  // Don't show banner if online or if user dismissed it
  if (!isOffline || dismissed) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--brand-ink)]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl border border-[var(--brand-red)]/30 overflow-hidden">
        {/* Header band */}
        <div className="bg-[var(--brand-red)] text-white px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <WifiOff className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-[15px] leading-tight">
              {t('offline.title')}
            </div>
            <div className="text-[11px] text-white/80 mt-0.5">
              {t('offline.subtitle')}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/70 hover:text-white p-1 rounded transition-colors"
            aria-label="Dismiss"
            title="Dismiss (view cached data)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-[12.5px] text-[var(--brand-ink)]/80 leading-relaxed">
            {t('offline.message')}
          </p>

          <div className="bg-[var(--brand-cream)] rounded-lg p-3 text-[11px] text-[var(--brand-ink)]/70 leading-relaxed">
            <div className="font-medium text-[var(--brand-ink)] mb-1">{t('offline.what_you_can_do_title')}</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>{t('offline.can_do_1')}</li>
              <li>{t('offline.can_do_2')}</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setDismissed(true)
                // Trigger a reload to try fetching fresh data
                window.location.reload()
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--brand-red)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--brand-red-dark)] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('offline.retry')}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 border border-[var(--brand-border)] text-[var(--brand-ink)]/70 text-[12px] font-medium rounded-md hover:bg-[var(--brand-cream)] transition-colors"
            >
              {t('offline.view_cached')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
