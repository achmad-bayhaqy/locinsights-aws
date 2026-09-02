'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Store as StoreIcon, AlertCircle, CheckCircle2, MapPin } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { Mall, Store, Brand } from './types'

interface MallNetworkProps {
  malls: Mall[]
  stores: Store[]
  brands: Brand[]
  onSelectKelurahan: (id: string) => void
}

export function MallNetwork({ malls, stores, brands }: MallNetworkProps) {
  const { t } = useLanguage()
  // Compute mall occupancy: which brands are in each mall
  const mallsWithTenants = malls.map(m => {
    const tenants = stores.filter(s => s.mall_id === m.id)
    const tenantBrands = Array.from(new Set(tenants.map(t => t.brand_name)))
    const anchorBrands = tenants.filter(t =>
      ['Sports Station', 'Planet Sports', 'Sogo', 'SEIBU', 'Matahari Department Store'].includes(t.brand_name)
    ).map(t => t.brand_name)
    const uniqueAnchors = Array.from(new Set(anchorBrands))
    return {
      ...m,
      tenants,
      tenantBrands,
      anchorBrands: uniqueAnchors,
      hasAnchor: uniqueAnchors.length > 0,
      tenantCount: tenants.length,
    }
  }).sort((a, b) => b.gla_m2 - a.gla_m2)

  // Untapped malls (no MAP/MAA presence)
  const untapped = mallsWithTenants.filter(m => m.tenantCount === 0 && m.visitor_estimate_daily > 0)
  // Malls without anchor but with some stores
  const noAnchor = mallsWithTenants.filter(m => m.tenantCount > 0 && !m.hasAnchor && m.visitor_estimate_daily > 0)
  // Saturated malls (5+ stores)
  const saturated = mallsWithTenants.filter(m => m.tenantCount >= 5)
  // Under construction
  const upcoming = mallsWithTenants.filter(m => m.visitor_estimate_daily === 0)

  // Brand coverage in malls
  const brandMallPresence = brands.map(b => {
    const inMalls = stores.filter(s => s.brand_id === b.id && s.is_in_mall).length
    const totalStores = stores.filter(s => s.brand_id === b.id).length
    return {
      brand: b.name,
      parent: b.parent,
      category: b.category,
      in_mall_count: inMalls,
      street_count: totalStores - inMalls,
      total: totalStores,
      mall_pct: totalStores > 0 ? Math.round((inMalls / totalStores) * 100) : 0,
    }
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('malls.title_analysis')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('malls.network_subtitle', { count: malls.length })}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label={t('malls.total_malls')} value={malls.length.toString()} icon={Building2} accent="ink" />
        <SummaryCard label={t('malls.untapped_malls')} value={untapped.length.toString()} icon={AlertCircle} accent="red" />
        <SummaryCard label={t('malls.no_anchor')} value={noAnchor.length.toString()} icon={AlertCircle} accent="red" />
        <SummaryCard label={t('malls.saturated')} value={saturated.length.toString()} icon={CheckCircle2} accent="ink" />
      </div>

      {/* Untapped malls highlight */}
      {untapped.length > 0 && (
        <Card className="card-premium border-l-4 border-l-[var(--brand-red)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-red)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t('malls.untapped_priority')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {untapped.map(m => (
                <div key={m.id} className="bg-[var(--brand-cream)] rounded-md p-3">
                  <div className="font-bold text-[13px] text-[var(--brand-ink)]">{m.name}</div>
                  <div className="text-[11px] text-[var(--brand-ink)]/60 mt-0.5">{m.kec}, {m.kab}</div>
                  <div className="text-[11px] text-[var(--brand-ink)]/70 mt-2">
                    {t('malls.gla')}: <strong>{(m.gla_m2 / 1000).toFixed(0)}k m²</strong> · {t('malls.visitors_estimate')} <strong>{m.visitor_estimate_daily.toLocaleString()}</strong> {t('malls.visitors_per_day')}
                  </div>
                  <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('malls.class')}: {m.class.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming malls */}
      {upcoming.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--brand-red)]" />
              {t('malls.upcoming_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-[12px] text-[var(--brand-ink)]/70 mb-3">
              {t('malls.upcoming_desc')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.map(m => (
                <div key={m.id} className="bg-[var(--brand-cream)] rounded-md p-3 border-l-2 border-l-[var(--brand-red)]">
                  <div className="font-bold text-[13px] text-[var(--brand-ink)]">{m.name}</div>
                  <div className="text-[11px] text-[var(--brand-ink)]/60 mt-0.5">{m.kec}, {m.kab}</div>
                  <div className="text-[11px] text-[var(--brand-ink)]/70 mt-2">
                    {t('malls.expected_gla')}: <strong>{(m.gla_m2 / 1000).toFixed(0)}k m²</strong> · {t('malls.target_open')}: <strong>{m.opened_year}</strong>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full mall tenant table */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-[var(--brand-red)]" />
            {t('malls.tenant_map')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--brand-border)] text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                  <th className="text-left py-2.5 px-2 font-medium">{t('malls.col_mall')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('malls.col_area')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('malls.col_gla')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('malls.col_visitors')}</th>
                  <th className="text-center py-2.5 px-2 font-medium">{t('malls.col_stores')}</th>
                  <th className="text-center py-2.5 px-2 font-medium">{t('malls.col_anchor')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('malls.col_tenant_brands')}</th>
                </tr>
              </thead>
              <tbody>
                {mallsWithTenants.map(m => (
                  <tr key={m.id} className="border-b border-[var(--brand-border)] last:border-0 hover:bg-[var(--brand-cream)]">
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-[var(--brand-ink)]">{m.name}</div>
                      <div className="text-[10px] text-[var(--brand-ink)]/50">{m.class.replace('_', ' ')} · {t('malls.opened_in', { year: m.opened_year })}</div>
                    </td>
                    <td className="py-2.5 px-2 text-[var(--brand-ink)]/70">
                      <div className="text-[11px]">{m.kec}</div>
                      <div className="text-[10px] text-[var(--brand-ink)]/50">{m.kab}</div>
                    </td>
                    <td className="py-2.5 px-2 text-right num-tabular">{(m.gla_m2 / 1000).toFixed(1)}k</td>
                    <td className="py-2.5 px-2 text-right num-tabular text-[var(--brand-ink)]/70">
                      {m.visitor_estimate_daily > 0 ? m.visitor_estimate_daily.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold num-tabular ${
                        m.tenantCount === 0 ? 'bg-red-100 text-red-700' :
                        m.tenantCount < 3 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{m.tenantCount}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {m.hasAnchor ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                      ) : m.tenantCount > 0 ? (
                        <AlertCircle className="w-4 h-4 text-amber-500 mx-auto" />
                      ) : (
                        <span className="text-[var(--brand-ink)]/30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {m.tenantBrands.slice(0, 5).map(b => (
                          <Badge key={b} variant="outline" className="text-[9px] px-1 py-0 font-medium border-[var(--brand-border)]">
                            {b}
                          </Badge>
                        ))}
                        {m.tenantBrands.length > 5 && (
                          <span className="text-[9px] text-[var(--brand-ink)]/50 px-1">+{m.tenantBrands.length - 5}</span>
                        )}
                        {m.tenantBrands.length === 0 && m.visitor_estimate_daily > 0 && (
                          <span className="text-[10px] text-[var(--brand-red)] font-medium">{t('malls.no_map_presence')}</span>
                        )}
                        {m.tenantBrands.length === 0 && m.visitor_estimate_daily === 0 && (
                          <span className="text-[10px] text-[var(--brand-ink)]/40 italic">{t('malls.upcoming')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Brand mall presence */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--brand-red)]" />
            {t('malls.channel_mix')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-[11px] text-[var(--brand-ink)]/60 mb-3">
            {t('malls.channel_mix_desc')}
          </div>
          <div className="space-y-2.5">
            {brandMallPresence.map(b => (
              <div key={b.brand} className="flex items-center gap-3">
                <div className="w-36 text-[12px] font-medium text-[var(--brand-ink)]">{b.brand}</div>
                <div className="text-[10px] text-[var(--brand-ink)]/50 w-20">{b.parent === 'MAA' ? 'MAP Active' : 'MAP'} · {b.category.replace('_', ' ')}</div>
                <div className="flex-1 h-5 bg-[var(--brand-cream)] rounded relative overflow-hidden flex">
                  <div className="h-full bg-[var(--brand-red)]" style={{ width: `${b.mall_pct}%` }} />
                  <div className="h-full bg-[var(--brand-ink)]" style={{ width: `${100 - b.mall_pct}%` }} />
                </div>
                <div className="w-32 text-[11px] text-[var(--brand-ink)]/70 num-tabular">
                  <span className="text-[var(--brand-red)] font-medium">{b.in_mall_count} {t('malls.mall_unit')}</span>
                  {' / '}
                  <span className="text-[var(--brand-ink)] font-medium">{b.street_count} {t('malls.street_unit')}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--brand-border)] text-[10px] text-[var(--brand-ink)]/60">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--brand-red)] rounded-sm" />{t('malls.in_mall')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--brand-ink)] rounded-sm" />{t('malls.street_standalone')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: 'red' | 'ink' }) {
  return (
    <Card className="card-premium">
      <CardContent className="p-4">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-2 ${
          accent === 'red' ? 'bg-[var(--brand-red-light)] text-[var(--brand-red)]' : 'bg-[var(--brand-cream)] text-[var(--brand-ink)]'
        }`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium">{label}</div>
        <div className="font-display text-[22px] font-bold text-[var(--brand-ink)] num-tabular leading-tight">{value}</div>
      </CardContent>
    </Card>
  )
}
