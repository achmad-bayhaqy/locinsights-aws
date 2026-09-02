'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Target, Search, TrendingUp, AlertTriangle, MapPin, ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { OpportunityScore, Brand } from './types'

interface OpportunitiesProps {
  opportunities: OpportunityScore[]
  brands: Brand[]
  selectedKelurahanId: string | null
  onSelectKelurahan: (id: string) => void
}

export function Opportunities({
  opportunities, brands, selectedKelurahanId, onSelectKelurahan,
}: OpportunitiesProps) {
  const { t } = useLanguage()
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [recFilter, setRecFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'score' | 'revenue' | 'marketshare'>('score')

  // Note: opportunities are computed server-side without brand filter, but we can client-filter
  // for display (production would re-fetch from /api/locinsight/opportunities?brand_id=)
  const filtered = useMemo(() => {
    let result = opportunities
    if (tierFilter !== 'all') result = result.filter(o => o.tier === Number(tierFilter))
    if (recFilter !== 'all') result = result.filter(o => o.recommendation === recFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.kelurahan_name.toLowerCase().includes(q) ||
        o.kec_name.toLowerCase().includes(q) ||
        o.kab_name.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'score') return b.composite_score - a.composite_score
      if (sortBy === 'revenue') return b.projected_monthly_revenue_juta - a.projected_monthly_revenue_juta
      return b.potential_market_share - a.potential_market_share
    })
    return result
  }, [opportunities, tierFilter, recFilter, search, sortBy])

  // Summary stats for filtered set
  const summary = useMemo(() => {
    return {
      total: filtered.length,
      high_priority: filtered.filter(o => o.recommendation === 'high_priority').length,
      avg_score: filtered.length > 0 ? Math.round(filtered.reduce((s, o) => s + o.composite_score, 0) / filtered.length) : 0,
      total_revenue: filtered.reduce((s, o) => s + o.projected_monthly_revenue_juta, 0),
    }
  }, [filtered])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('opportunities.title')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('opportunities.count_subtitle', {
            count: filtered.length,
            sort_label: sortBy === 'score'
              ? t('opportunities.sort_by_score')
              : sortBy === 'revenue'
                ? t('opportunities.sort_by_revenue')
                : t('opportunities.sort_by_marketshare'),
          })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label={t('opportunities.sites_shown')} value={summary.total.toString()} icon={Target} accent="ink" />
        <SummaryCard label={t('dashboard.rec_high_priority')} value={summary.high_priority.toString()} icon={TrendingUp} accent="red" />
        <SummaryCard label={t('opportunities.avg_score')} value={`${summary.avg_score}/100`} icon={Target} accent="ink" />
        <SummaryCard label={t('opportunities.total_monthly_rev')} value={`Rp ${(summary.total_revenue / 1000).toFixed(1)}M`} icon={TrendingUp} accent="red" />
      </div>

      {/* Filters */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand-ink)]/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('opportunities.search_placeholder')}
                  className="pl-8 h-9 text-[12px]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('opportunities.brand_label')}</label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('opportunities.all_brands_generic')}</SelectItem>
                  {brands.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name} · {b.parent}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('opportunities.tier_label')}</label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('opportunities.all_tiers')}</SelectItem>
                  <SelectItem value="1">{t('opportunities.tier_n', { n: 1 })}</SelectItem>
                  <SelectItem value="2">{t('opportunities.tier_n', { n: 2 })}</SelectItem>
                  <SelectItem value="3">{t('opportunities.tier_n', { n: 3 })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('opportunities.sort_by')}</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">{t('opportunities.score')}</SelectItem>
                  <SelectItem value="revenue">{t('opportunities.projected_revenue')}</SelectItem>
                  <SelectItem value="marketshare">{t('opportunities.market_share')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {brandFilter !== 'all' && (
            <div className="mt-3 pt-3 border-t border-[var(--brand-border)] flex items-center gap-2">
              <Badge className="bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[var(--brand-red)]/30">
                {brands.find(b => b.id === brandFilter)?.name || t('opportunities.brand_label')}
              </Badge>
              <span className="text-[11px] text-[var(--brand-ink)]/60">
                {t('opportunities.brand_filter_note')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opportunity cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.slice(0, 60).map(o => (
          <OpportunityCard
            key={o.kelurahan_id}
            opp={o}
            isSelected={o.kelurahan_id === selectedKelurahanId}
            onClick={() => onSelectKelurahan(o.kelurahan_id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--brand-ink)]/50">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-[13px]">{t('opportunities.no_match')}</div>
        </div>
      )}
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

function OpportunityCard({
  opp, isSelected, onClick
}: {
  opp: OpportunityScore
  isSelected: boolean
  onClick: () => void
}) {
  const { t } = useLanguage()
  const recColor: Record<string, string> = {
    high_priority: 'var(--brand-red)',
    priority: '#D45F4A',
    monitor: '#A08070',
    avoid: '#B0B0B0',
  }
  const recKeyMap: Record<string, string> = {
    high_priority: 'dashboard.rec_high_priority',
    priority: 'dashboard.rec_priority',
    monitor: 'dashboard.rec_monitor',
    avoid: 'dashboard.rec_avoid',
  }
  const riskKeyMap: Record<string, string> = {
    low: 'dashboard.risk_low',
    medium: 'dashboard.risk_medium',
    high: 'dashboard.risk_high',
  }
  const recKey = recKeyMap[opp.recommendation] || recKeyMap.monitor
  const riskKey = riskKeyMap[opp.cannibalization_risk] || opp.cannibalization_risk
  return (
    <Card
      className={`card-premium cursor-pointer transition-all ${isSelected ? 'border-[var(--brand-red)] border-2' : 'hover:border-[var(--brand-red)]/30'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white uppercase"
                style={{ background: recColor[opp.recommendation] }}
              >
                {t(recKey)}
              </span>
              <span className="text-[10px] text-[var(--brand-ink)]/50 uppercase tracking-wider">{t('opportunities.tier_n', { n: opp.tier })}</span>
            </div>
            <div className="font-display font-bold text-[15px] text-[var(--brand-ink)] leading-tight">
              {opp.kelurahan_name}
            </div>
            <div className="text-[11px] text-[var(--brand-ink)]/60 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {opp.kec_name}, {opp.kab_name}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[28px] font-bold leading-none num-tabular" style={{ color: recColor[opp.recommendation] }}>
              {opp.composite_score}
            </div>
            <div className="text-[9px] text-[var(--brand-ink)]/50 uppercase tracking-wider">{t('opportunities.score_label')}</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-1.5 bg-[var(--brand-cream)] rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full"
            style={{ width: `${opp.composite_score}%`, background: recColor[opp.recommendation] }}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] mb-3">
          <div className="flex justify-between">
            <span className="text-[var(--brand-ink)]/55">{t('dashboard.mkt_share')}</span>
            <strong className="num-tabular">{(opp.potential_market_share * 100).toFixed(1)}%</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--brand-ink)]/55">{t('dashboard.daily_customers')}</span>
            <strong className="num-tabular">{opp.estimated_daily_customers}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--brand-ink)]/55">{t('dashboard.rev_per_month')}</span>
            <strong className="num-tabular text-[var(--brand-red)]">Rp {opp.projected_monthly_revenue_juta}jt</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--brand-ink)]/55">{t('dashboard.risk')}</span>
            <span className="capitalize text-[10px] font-medium">{t(riskKey)}</span>
          </div>
        </div>

        {/* Nearest mall */}
        <div className="pt-2.5 border-t border-[var(--brand-border)] text-[11px] text-[var(--brand-ink)]/70 leading-snug">
          {opp.nearest_mall_name ? (
            <><strong className="text-[var(--brand-ink)]">{opp.nearest_mall_name}</strong> · {opp.nearest_mall_distance_km}km · {t('opportunities.map_stores_within_2km', { count: opp.nearby_existing_stores })}</>
          ) : (
            <>{t('opportunities.no_mall_nearby')}</>
          )}
        </div>

        {/* Factor breakdown mini bars */}
        <div className="mt-3 pt-2.5 border-t border-[var(--brand-border)] grid grid-cols-6 gap-1.5">
          {opp.factors.map(f => (
            <div key={f.name} title={t('opportunities.factor_tooltip', { name: f.name, value: f.raw_value, weight: (f.weight * 100).toFixed(0) })} className="text-center">
              <div className="h-1.5 bg-[var(--brand-cream)] rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f.raw_value}%`,
                    background: f.raw_value >= 70 ? 'var(--brand-red)' : f.raw_value >= 50 ? '#D45F4A' : '#A08070'
                  }}
                />
              </div>
              <div className="text-[8px] text-[var(--brand-ink)]/50 uppercase tracking-wider truncate">
                {f.name.split(' ')[0].slice(0, 4)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
