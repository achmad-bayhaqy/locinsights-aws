'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Building2, Store as StoreIcon, Loader2, RefreshCw, Search, MapPin,
  Shield, Users,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { OverviewData } from './types'

interface Tenant {
  id: string
  mall_id: string | null
  mall_name: string
  brand_name: string
  brand_category: string
  is_map_brand: boolean
  is_competitor: boolean
  category: string
  source: string
}

interface MallTenantAuditProps {
  malls: OverviewData['malls']
}

export function MallTenants({ malls }: MallTenantAuditProps) {
  const { t } = useLanguage()
  const [selectedMallId, setSelectedMallId] = useState<string>('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)

  useEffect(() => {
    if (malls.length > 0 && !selectedMallId) {
      setSelectedMallId(malls[0].id)
    }
  }, [malls])

  useEffect(() => {
    if (selectedMallId) loadTenants()
  }, [selectedMallId])

  async function loadTenants() {
    setLoading(true)
    try {
      const mall = malls.find(m => m.id === selectedMallId)
      const url = `/api/locinsight/mall-tenants?mall_id=${selectedMallId}${mall ? `&mall_name=${encodeURIComponent(mall.name)}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setTenants(json.data)
      else setTenants([])
    } catch {
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  async function scrapeTenants() {
    const mall = malls.find(m => m.id === selectedMallId)
    if (!mall) return
    setScraping(true)
    try {
      const res = await fetch('/api/locinsight/mall-tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mall_id: mall.id,
          mall_name: mall.name,
          lat: mall.lat,
          lng: mall.lng,
          radius_km: 0.8, // 800m — better coverage for Bali malls
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(t('mall_tenants.toast_found', { total: json.total_found, map: json.map_brands_found, competitor: json.competitor_brands_found }))
        await loadTenants()
      } else {
        // Server returned a structured error — surface the full message so the
        // user knows whether to retry, increase radius, or wait for OSM.
        const errMsg = json.error || t('mall_tenants.toast_audit_failed')
        toast.error(errMsg, { duration: 8000 })
      }
    } catch (e: any) {
      toast.error(t('mall_tenants.toast_network_error', { message: e.message }), { duration: 8000 })
    } finally {
      setScraping(false)
    }
  }

  const mall = malls.find(m => m.id === selectedMallId)
  const mapBrands = tenants.filter(t => t.is_map_brand)
  const competitorBrands = tenants.filter(t => t.is_competitor)
  const otherBrands = tenants.filter(t => !t.is_map_brand && !t.is_competitor)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('mall_tenants.title_directory')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('mall_tenants.directory_subtitle')}
        </p>
      </div>

      {/* Mall selector */}
      <Card className="card-premium">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[300px]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 block mb-1">{t('mall_tenants.select_mall')}</label>
            <select
              value={selectedMallId}
              onChange={e => setSelectedMallId(e.target.value)}
              className="w-full text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded"
            >
              {malls.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.kab}</option>
              ))}
            </select>
          </div>
          {mall && (
            <div className="text-[11px] text-[var(--brand-ink)]/60">
              <MapPin className="w-3 h-3 inline mr-1" />
              {mall.lat.toFixed(4)}, {mall.lng.toFixed(4)} · {mall.class.replace(/_/g, ' ')} · {t('malls.gla')} {(mall.gla_m2 / 1000).toFixed(0)}k m²
            </div>
          )}
          <Button variant="outline" size="sm" onClick={loadTenants} disabled={loading || !selectedMallId}>
            <RefreshCw className="w-3 h-3 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={scrapeTenants} disabled={scraping || !selectedMallId}>
            {scraping ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
            {scraping ? t('mall_tenants.scraping') : t('malls.audit_tenants')}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 flex items-center gap-1">
              <Users className="w-3 h-3" /> {t('mall_tenants.total_tenants')}
            </div>
            <div className="font-display text-[28px] font-bold text-[var(--brand-ink)]">{tenants.length}</div>
          </CardContent>
        </Card>
        <Card className="card-premium border-l-4 border-l-[var(--brand-red)]">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 flex items-center gap-1">
              <StoreIcon className="w-3 h-3" /> {t('mall_tenants.map_brands')}
            </div>
            <div className="font-display text-[28px] font-bold text-[var(--brand-red)]">{mapBrands.length}</div>
          </CardContent>
        </Card>
        <Card className="card-premium border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t('mall_tenants.competitors')}
            </div>
            <div className="font-display text-[28px] font-bold text-amber-600">{competitorBrands.length}</div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> {t('mall_tenants.other_tenants')}
            </div>
            <div className="font-display text-[28px] font-bold text-[var(--brand-ink)]">{otherBrands.length}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : tenants.length === 0 ? (
        <Card className="card-premium">
          <CardContent className="py-12 text-center">
            <Building2 className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
            <div className="text-[14px] text-[var(--brand-ink)]/60">{t('mall_tenants.no_data')}</div>
            <div className="text-[11px] text-[var(--brand-ink)]/40 mt-1">{t('mall_tenants.click_audit')}</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* MAP brands */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2 text-[var(--brand-red)]">
                <StoreIcon className="w-4 h-4" /> {t('mall_tenants.map_brands_count', { count: mapBrands.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 max-h-96 overflow-y-auto">
              {mapBrands.length === 0 ? (
                <div className="text-[11px] text-[var(--brand-ink)]/50 py-4 text-center">
                  {t('mall_tenants.no_map_brands')}
                </div>
              ) : (
                mapBrands.map(t => (
                  <div key={t.id} className="py-1.5 border-b border-[var(--brand-border)] last:border-0">
                    <div className="font-medium text-[12px]">{t.brand_name}</div>
                    <div className="text-[10px] text-[var(--brand-ink)]/55">{t.category}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Competitor brands */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2 text-amber-600">
                <Shield className="w-4 h-4" /> {t('mall_tenants.competitors_count', { count: competitorBrands.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 max-h-96 overflow-y-auto">
              {competitorBrands.length === 0 ? (
                <div className="text-[11px] text-[var(--brand-ink)]/50 py-4 text-center">{t('mall_tenants.no_competitors')}</div>
              ) : (
                competitorBrands.map(t => (
                  <div key={t.id} className="py-1.5 border-b border-[var(--brand-border)] last:border-0">
                    <div className="font-medium text-[12px]">{t.brand_name}</div>
                    <div className="text-[10px] text-[var(--brand-ink)]/55">{t.category}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Other tenants */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" /> {t('mall_tenants.other_count', { count: otherBrands.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 max-h-96 overflow-y-auto">
              {otherBrands.length === 0 ? (
                <div className="text-[11px] text-[var(--brand-ink)]/50 py-4 text-center">{t('mall_tenants.no_other')}</div>
              ) : (
                otherBrands.map(t => (
                  <div key={t.id} className="py-1.5 border-b border-[var(--brand-border)] last:border-0">
                    <div className="font-medium text-[12px]">{t.brand_name}</div>
                    <div className="text-[10px] text-[var(--brand-ink)]/55">{t.category}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
