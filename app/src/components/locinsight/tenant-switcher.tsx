'use client'

/**
 * LocInsights — Tenant Switcher (header dropdown)
 *
 *   • For superadmin: lists ALL active tenants (calls /api/admin/tenants).
 *     Selecting one updates the JWT (client-side `update({ tenant_id })`)
 *     and refreshes server components via `router.refresh()`.
 *   • For non-superadmin: shows their assigned tenant (read-only badge).
 *   • Hidden entirely when the user has only one tenant available
 *     (e.g. tenant-scoped users with no switch privilege).
 */

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TenantOption {
  id: string
  name: string
  slug?: string
  plan?: string
}

export function TenantSwitcher() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const role              = session?.user?.role
  const currentTenantId   = session?.user?.tenant_id ?? null
  const availableTenants  = session?.user?.available_tenant_ids ?? []

  // Determine whether to render the switcher at all.
  //  - superadmin: always render (they can switch into any tenant)
  //  - other roles: render ONLY if they have >1 available tenant
  const shouldRender =
    status === 'authenticated' &&
    (role === 'superadmin' || availableTenants.length > 1)

  // Fetch tenant list (superadmin only — others use their assigned tenant)
  useEffect(() => {
    if (!shouldRender) return
    if (role !== 'superadmin') {
      // Non-superadmin with >1 tenant — fetch only their tenants
      // (still uses the same endpoint which respects available_tenant_ids)
      setLoading(true)
      fetch('/api/admin/tenants')
        .then(r => r.json())
        .then(j => {
          if (j.success && Array.isArray(j.data)) {
            setTenants(j.data as TenantOption[])
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }
    setLoading(true)
    fetch('/api/admin/tenants')
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          setTenants(j.data as TenantOption[])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [shouldRender, role])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!shouldRender) return null

  const currentTenant =
    tenants.find(t => t.id === currentTenantId) ||
    (currentTenantId
      ? { id: currentTenantId, name: 'Current tenant' }
      : { id: '', name: 'Platform (all tenants)' })

  async function handleSelect(tenantId: string | null) {
    if (tenantId === currentTenantId) {
      setOpen(false)
      return
    }
    setSwitching(true)
    try {
      // Validate server-side (defense-in-depth) before updating JWT
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const j = await res.json()
      if (!j.success) {
        console.warn('[tenant-switcher] server rejected switch:', j.error)
        setSwitching(false)
        setOpen(false)
        return
      }
      // Update JWT (calls the jwt callback with trigger='update')
      await update({ tenant_id: tenantId })
      // Refresh server components
      router.refresh()
    } catch (e) {
      console.error('[tenant-switcher] failed:', e)
    } finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/70 hover:text-[var(--brand-ink)] transition-colors text-[12px] max-w-[200px] disabled:opacity-50"
        title={currentTenant.name}
        aria-label="Switch tenant"
        aria-expanded={open}
      >
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        ) : (
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="font-medium truncate max-w-[140px]">
          {currentTenant.name}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-[var(--brand-border)] rounded-md shadow-lg z-50 py-1 max-h-80 overflow-y-auto scroll-styled">
          {/* Platform-wide option (superadmin only) */}
          {role === 'superadmin' && (
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-[var(--brand-cream)] transition-colors text-left',
                currentTenantId === null
                  ? 'text-[var(--brand-red)] font-medium'
                  : 'text-[var(--brand-ink)]/80'
              )}
            >
              <span className="flex flex-col min-w-0">
                <span className="truncate">Platform (all tenants)</span>
                <span className="text-[10px] text-[var(--brand-ink)]/50">Superadmin mode</span>
              </span>
              {currentTenantId === null && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          )}

          {/* Divider between platform-wide and tenant list (superadmin only) */}
          {role === 'superadmin' && tenants.length > 0 && (
            <div className="border-t border-[var(--brand-border)] my-1" />
          )}

          {/* Tenant list */}
          {loading ? (
            <div className="px-3 py-3 text-[11px] text-[var(--brand-ink)]/50 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading tenants…
            </div>
          ) : (
            tenants.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-[var(--brand-cream)] transition-colors text-left',
                  t.id === currentTenantId
                    ? 'text-[var(--brand-red)] font-medium'
                    : 'text-[var(--brand-ink)]/80'
                )}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{t.name}</span>
                  <span className="text-[10px] text-[var(--brand-ink)]/50 truncate">
                    {t.slug || t.id}{t.plan ? ` · ${t.plan}` : ''}
                  </span>
                </span>
                {t.id === currentTenantId && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            ))
          )}

          {tenants.length === 0 && !loading && role !== 'superadmin' && (
            <div className="px-3 py-3 text-[11px] text-[var(--brand-ink)]/50">
              No tenants available.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
