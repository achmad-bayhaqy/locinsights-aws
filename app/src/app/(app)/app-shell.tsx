'use client'

/**
 * LocInsights — App Shell (client wrapper for the (app) route group)
 *
 * Wraps every protected route with:
 *   • AppProvider  — shared overview data + selectedKelurahanId + navigate()
 *   • Sidebar      — collapsible nav rail (uses usePathname for active state)
 *   • Header       — sidebar toggle, breadcrumb, language switcher, tenant switcher, user menu
 *   • <main>       — page content (children)
 *   • Footer       — sticky bottom (mt-auto)
 *   • AIChat       — floating bottom-right chat widget
 *
 * Auth: this component assumes the server-side layout has already verified
 * the session (via getServerSession). We use useSession() purely for the
 * user menu (display name + logout) and the tenant switcher.
 */

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  PanelLeftClose, PanelLeftOpen, LogOut, User as UserIcon, ChevronDown,
} from 'lucide-react'
import { Sidebar } from '@/components/locinsight/sidebar'
import { AIChat } from '@/components/locinsight/ai-chat'
import { LanguageSwitcher } from '@/components/locinsight/language-switcher'
import { TenantSwitcher } from '@/components/locinsight/tenant-switcher'
import { InstallPrompt } from '@/components/locinsight/install-prompt'
import { AppProvider, useApp, PATH_LABELS } from '@/lib/app-context'
import { useLanguage } from '@/lib/i18n/language-provider'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  )
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { loading, error } = useApp()

  // Track last visited URL (client-side) — keeps the `last_visited_url` cookie
  // in sync with client-side navigations (next/link, router.push). The middleware
  // also sets this cookie on server-side page loads; this effect covers the gaps.
  useEffect(() => {
    if (!pathname) return
    // Skip API/internal paths (shouldn't happen in app shell, but be safe)
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) return
    document.cookie = `last_visited_url=${encodeURIComponent(pathname)}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`
  }, [pathname])

  // Breadcrumb label (current page name).
  // NOTE: no manual useMemo — React Compiler auto-memoizes this expression.
  const currentPageLabel = (() => {
    if (!pathname) return ''
    const exact = PATH_LABELS[pathname]
    if (exact) return t(exact)
    for (const path of Object.keys(PATH_LABELS)) {
      if (pathname.startsWith(path + '/')) return t(PATH_LABELS[path])
    }
    return ''
  })()

  if (loading) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-[var(--brand-cream)]">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-[var(--brand-red)] text-[14px] font-medium mb-2">{t('common.error')}</div>
            <div className="text-[12px] text-[var(--brand-ink)]/60">{error}</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[var(--brand-cream)] items-stretch">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col min-h-screen">
        <header className="bg-white border-b border-[var(--brand-border)] px-4 sm:px-6 py-3 sticky top-0 z-30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="p-1.5 rounded-md hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/70 hover:text-[var(--brand-ink)] transition-colors flex-shrink-0"
              title={sidebarCollapsed ? t('header.show_sidebar') : t('header.hide_sidebar')}
              aria-label={sidebarCollapsed ? t('header.show_sidebar') : t('header.hide_sidebar')}
            >
              {sidebarCollapsed
                ? <PanelLeftOpen className="w-4 h-4" />
                : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <div className="text-[12px] text-[var(--brand-ink)]/60 truncate">
              <Link href="/dashboard" className="text-[var(--brand-ink)]/40 hover:text-[var(--brand-red)] transition-colors">
                LocInsights
              </Link>
              <span className="text-[var(--brand-ink)]/40 mx-1">/</span>
              <span className="font-medium text-[var(--brand-ink)]">
                {currentPageLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <InstallPrompt />
            <TenantSwitcher />
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>

        <div className="p-4 sm:p-6 flex-1">
          {children}
        </div>

        <footer className="bg-[var(--brand-ink)] text-white/70 text-[11px] px-6 py-4 mt-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/logo-white.png" alt="LocInsights" className="w-5 h-5 object-contain" />
              <strong className="text-white">LocInsights</strong> — {t('common.location_intelligence')} for {session?.user?.display_name || session?.user?.name || 'your team'}
            </div>
            <div className="text-white/45">
              © {new Date().getFullYear()} · Built by{' '}
              <a
                href="https://bayhaqy.my.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white underline-offset-2 hover:underline"
              >
                Achmad Bayhaqy
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Floating AI Chat — visible on ALL pages */}
      <AIChat />
    </div>
  )
}

// =====================================================
// User menu — dropdown with display name + logout
// =====================================================
function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!session?.user) return null

  const displayName = session.user.display_name || session.user.name || session.user.username || 'User'
  const role = session.user.role || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/70 hover:text-[var(--brand-ink)] transition-colors text-[12px] max-w-[200px]"
        aria-label="User menu"
        aria-expanded={open}
      >
        <div className="w-6 h-6 rounded-full bg-[var(--brand-red)] text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
          {initials}
        </div>
        <span className="font-medium truncate max-w-[120px] hidden sm:inline">{displayName}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-[var(--brand-border)] rounded-md shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-[var(--brand-border)]">
            <div className="font-medium text-[12px] text-[var(--brand-ink)] truncate">{displayName}</div>
            <div className="text-[10px] text-[var(--brand-ink)]/50 truncate">
              @{session.user.username || session.user.name}
              {role ? ` · ${role}` : ''}
            </div>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--brand-ink)]/80 hover:bg-[var(--brand-cream)] transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" />
            Settings
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--brand-red)] hover:bg-[var(--brand-red)]/5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// =====================================================
// LoadingScreen — minimalist animated globe loader
// =====================================================
function LoadingScreen() {
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen bg-[var(--brand-cream)] items-center justify-center">
      <style>{`
        @keyframes locinsight-globe-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes locinsight-globe-spin-reverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes locinsight-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.04); }
        }
        @keyframes locinsight-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes locinsight-dot {
          0%, 80%, 100% { opacity: 0.2; }
          40%           { opacity: 1; }
        }
        .li-globe-ring     { animation: locinsight-globe-spin 8s linear infinite;        transform-origin: center; }
        .li-globe-ring-r   { animation: locinsight-globe-spin-reverse 6s linear infinite; transform-origin: center; }
        .li-globe-core     { animation: locinsight-pulse 3.2s ease-in-out infinite;      transform-origin: center; }
        .li-fade-up        { animation: locinsight-fade-up 0.6s ease-out 0.15s both; }
        .li-dot            { animation: locinsight-dot 1.4s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-6">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="absolute inset-0 li-globe-ring" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--brand-red)" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.55" />
          </svg>
          <svg viewBox="0 0 100 100" className="absolute inset-0 li-globe-ring-r" aria-hidden="true">
            <ellipse cx="50" cy="50" rx="34" ry="46" fill="none" stroke="var(--brand-ink)" strokeWidth="1" opacity="0.25" />
            <ellipse cx="50" cy="50" rx="18" ry="46" fill="none" stroke="var(--brand-ink)" strokeWidth="1" opacity="0.18" />
            <line x1="6"  y1="50" x2="94" y2="50" stroke="var(--brand-ink)" strokeWidth="0.8" opacity="0.18" />
            <line x1="14" y1="36" x2="86" y2="36" stroke="var(--brand-ink)" strokeWidth="0.6" opacity="0.12" />
            <line x1="14" y1="64" x2="86" y2="64" stroke="var(--brand-ink)" strokeWidth="0.6" opacity="0.12" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="li-globe-core w-16 h-16 rounded-full flex items-center justify-center shadow-lg overflow-hidden bg-white"
              style={{
                boxShadow: '0 8px 24px -8px rgba(200, 16, 46, 0.5), inset 0 -6px 12px rgba(0,0,0,0.25)',
              }}
            >
              <img src="/logo-icon.png" alt="LocInsights" className="w-12 h-12 object-contain" draggable={false} />
            </div>
          </div>
        </div>

        <div className="li-fade-up text-center">
          <div className="font-display text-[18px] font-bold text-[var(--brand-ink)] tracking-tight">
            LocInsights
          </div>
          <div className="text-[12px] text-[var(--brand-ink)]/55 mt-1.5 flex items-center justify-center gap-1">
            <span>{t('loading.message')}</span>
            <span className="li-dot" style={{ animationDelay: '0s'   }}>.</span>
            <span className="li-dot" style={{ animationDelay: '0.2s' }}>.</span>
            <span className="li-dot" style={{ animationDelay: '0.4s' }}>.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
