'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp, MapPin, Store, Building2, Target, AlertCircle,
  ArrowUpRight, ArrowDownRight, Layers, Sparkles
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { DashboardStats, OpportunityScore } from './types'

interface DashboardProps {
  stats: DashboardStats
  topOpportunities: OpportunityScore[]
  onSelectKelurahan: (id: string) => void
  onNavigate: (id: string) => void
}

export function Dashboard({ stats, topOpportunities, onSelectKelurahan, onNavigate }: DashboardProps) {
  const { t } = useLanguage()
  const tier1Pct = stats.total_stores > 0 ? Math.round((stats.tier_1_stores / stats.total_stores) * 100) : 0
  const tier2Pct = stats.total_stores > 0 ? Math.round((stats.tier_2_stores / stats.total_stores) * 100) : 0
  const tier3Pct = stats.total_stores > 0 ? Math.round((stats.tier_3_stores / stats.total_stores) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="bg-[var(--brand-ink)] text-white rounded-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--brand-red)] rounded-full blur-3xl opacity-20 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-[var(--brand-red)] rounded-full blur-3xl opacity-10" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[var(--brand-red)]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-medium">{t('common.location_intelligence')}</span>
          </div>
          <h1 className="font-display text-[36px] leading-[1.1] font-bold mb-3 max-w-2xl">
            {t('dashboard.hero_title')}<br />
            <span className="text-[var(--brand-red)]">{t('dashboard.hero_title_accent')}</span>
          </h1>
          <p className="text-[14px] text-white/70 max-w-3xl leading-relaxed">
            {t('dashboard.hero_description')}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('opportunities')}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white px-4 py-2 rounded-md text-[13px] font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <Target className="w-4 h-4" />
              {t('dashboard.cta_top_opportunities')}
            </button>
            <button
              onClick={() => onNavigate('map')}
              className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-md text-[13px] font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              {t('dashboard.cta_open_map')}
            </button>
            <button
              onClick={() => onNavigate('methodology')}
              className="bg-white/5 hover:bg-white/10 text-white/80 px-4 py-2 rounded-md text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 border border-white/10"
            >
              <Layers className="w-4 h-4" />
              {t('nav.methodology')}
            </button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('dashboard.kpi_total_stores')}
          value={stats.total_stores.toString()}
          subtext={t('dashboard.kpi_tier1_subtext', { count: stats.tier_1_stores })}
          icon={Store}
          accent="red"
        />
        <KpiCard
          label={t('dashboard.kpi_total_malls')}
          value={stats.total_malls.toString()}
          subtext={t('dashboard.kpi_no_map_anchor', { count: stats.malls_without_map_anchor.length })}
          icon={Building2}
          accent="ink"
        />
        <KpiCard
          label={t('dashboard.kpi_kelurahan_analyzed')}
          value={stats.total_kelurahan.toString()}
          subtext={t('dashboard.kpi_kelurahan_subtext')}
          icon={MapPin}
          accent="ink"
        />
        <KpiCard
          label={t('dashboard.kpi_high_priority')}
          value={stats.high_priority_count.toString()}
          subtext={t('dashboard.kpi_priority_subtext', { count: stats.priority_count })}
          icon={Target}
          accent="red"
          highlight
        />
      </div>

      {/* Tier distribution + recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Store className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.store_distribution')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <TierBar label={t('dashboard.tier1_label')} count={stats.tier_1_stores} pct={tier1Pct} color="var(--brand-red)" />
            <TierBar label={t('dashboard.tier2_label')} count={stats.tier_2_stores} pct={tier2Pct} color="#0F0F12" />
            <TierBar label={t('dashboard.tier3_label')} count={stats.tier_3_stores} pct={tier3Pct} color="#A08070" />

            <div className="pt-3 border-t border-[var(--brand-border)] text-[12px] text-[var(--brand-ink)]/70 leading-relaxed">
              {t('dashboard.tier_distribution_summary', { pct: tier1Pct, remaining: 100 - tier1Pct })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Target className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.recommendation_breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <RecommendationRow label={t('dashboard.rec_high_priority')} count={stats.high_priority_count} total={stats.total_kelurahan} color="#C8102E" />
            <RecommendationRow label={t('dashboard.rec_priority')} count={stats.priority_count} total={stats.total_kelurahan} color="#D45F4A" />
            <RecommendationRow label={t('dashboard.rec_monitor')} count={stats.monitor_count} total={stats.total_kelurahan} color="#A08070" />
            <RecommendationRow label={t('dashboard.rec_avoid')} count={stats.avoid_count} total={stats.total_kelurahan} color="#B0B0B0" />

            <div className="pt-3 border-t border-[var(--brand-border)] text-[12px] text-[var(--brand-ink)]/70 leading-relaxed">
              {t('dashboard.avg_score_label')}{' '}
              <strong className="text-[var(--brand-red)]">{stats.avg_composite_score}/100</strong>.
              {t('dashboard.avg_score_note')}
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.malls_no_anchor')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 max-h-72 overflow-y-auto scroll-styled space-y-2">
            {stats.malls_without_map_anchor.length === 0 ? (
              <div className="text-[12px] text-[var(--brand-ink)]/60 py-4 text-center">{t('dashboard.all_malls_have_anchors')}</div>
            ) : (
              stats.malls_without_map_anchor.map(m => (
                <div key={m.name} className="text-[12px] py-2 border-b border-[var(--brand-border)] last:border-0">
                  <div className="font-medium text-[var(--brand-ink)]">{m.name}</div>
                  <div className="text-[11px] text-[var(--brand-ink)]/60">{m.kec}, {m.kab}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top opportunities */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.top_10_opportunities')}
            </CardTitle>
            <button
              onClick={() => onNavigate('opportunities')}
              className="text-[12px] text-[var(--brand-red)] hover:underline font-medium flex items-center gap-1"
            >
              {t('dashboard.view_all')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--brand-border)] text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                  <th className="text-left py-2.5 px-2 font-medium">#</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('dashboard.kelurahan')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('dashboard.area')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('dashboard.tier')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('dashboard.score')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('dashboard.mkt_share')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('dashboard.daily_customers')}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{t('dashboard.rev_per_month')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('dashboard.status')}</th>
                  <th className="text-left py-2.5 px-2 font-medium">{t('dashboard.risk')}</th>
                </tr>
              </thead>
              <tbody>
                {topOpportunities.slice(0, 10).map((o, i) => (
                  <tr
                    key={o.kelurahan_id}
                    onClick={() => onSelectKelurahan(o.kelurahan_id)}
                    className="border-b border-[var(--brand-border)] last:border-0 hover:bg-[var(--brand-cream)] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-2 text-[var(--brand-ink)]/50 num-tabular">{i + 1}</td>
                    <td className="py-2.5 px-2 font-medium text-[var(--brand-ink)]">{o.kelurahan_name}</td>
                    <td className="py-2.5 px-2 text-[var(--brand-ink)]/70">{o.kec_name}, {o.kab_name}</td>
                    <td className="py-2.5 px-2"><TierBadge tier={o.tier} /></td>
                    <td className="py-2.5 px-2 text-right"><strong className="text-[var(--brand-red)] num-tabular">{o.composite_score}</strong></td>
                    <td className="py-2.5 px-2 text-right num-tabular text-[var(--brand-ink)]/70">{(o.potential_market_share * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-2 text-right num-tabular text-[var(--brand-ink)]/70">{o.estimated_daily_customers}</td>
                    <td className="py-2.5 px-2 text-right num-tabular font-medium">Rp {o.projected_monthly_revenue_juta}jt</td>
                    <td className="py-2.5 px-2"><RecBadge recommendation={o.recommendation} /></td>
                    <td className="py-2.5 px-2"><RiskBadge risk={o.cannibalization_risk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stores by kabupaten + brand coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.stores_by_kabupaten')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {stats.stores_by_kabupaten.sort((a, b) => b.count - a.count).map(item => {
              const max = Math.max(...stats.stores_by_kabupaten.map(s => s.count))
              return (
                <div key={item.kab} className="flex items-center gap-3">
                  <div className="w-24 text-[12px] font-medium text-[var(--brand-ink)]">{item.kab}</div>
                  <div className="flex-1 h-6 bg-[var(--brand-cream)] rounded relative overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand-red)] rounded transition-all"
                      style={{ width: `${(item.count / max) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white num-tabular">
                      {item.count}
                    </span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Store className="w-4 h-4 text-[var(--brand-red)]" />
              {t('dashboard.brand_coverage_bali')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto scroll-styled">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--brand-border)] text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                  <th className="text-left py-2 px-1 font-medium">{t('dashboard.brand')}</th>
                  <th className="text-left py-2 px-1 font-medium">{t('dashboard.category')}</th>
                  <th className="text-right py-2 px-1 font-medium">{t('dashboard.total_stores')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.brands_coverage.map(b => (
                  <tr key={b.brand} className="border-b border-[var(--brand-border)] last:border-0">
                    <td className="py-2 px-1 font-medium text-[var(--brand-ink)]">{b.brand}</td>
                    <td className="py-2 px-1 text-[var(--brand-ink)]/60 capitalize">{b.category.replace('_', ' ')}</td>
                    <td className="py-2 px-1 text-right num-tabular font-medium">{b.stores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, subtext, icon: Icon, accent, highlight
}: {
  label: string
  value: string
  subtext: string
  icon: any
  accent: 'red' | 'ink'
  highlight?: boolean
}) {
  return (
    <div className={`card-premium p-5 ${highlight ? 'border-[var(--brand-red)] border-2' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
          accent === 'red' ? 'bg-[var(--brand-red-light)] text-[var(--brand-red)]' : 'bg-[var(--brand-cream)] text-[var(--brand-ink)]'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        {highlight && (
          <ArrowUpRight className="w-4 h-4 text-[var(--brand-red)]" />
        )}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium mb-1">{label}</div>
      <div className="font-display text-[28px] font-bold text-[var(--brand-ink)] num-tabular leading-none">{value}</div>
      <div className="text-[11px] text-[var(--brand-ink)]/60 mt-1.5">{subtext}</div>
    </div>
  )
}

function TierBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1.5">
        <span className="text-[var(--brand-ink)]">{label}</span>
        <span className="font-medium num-tabular">{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-[var(--brand-cream)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function RecommendationRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
      <div className="flex-1">
        <div className="flex items-center justify-between text-[12px] mb-1">
          <span className="text-[var(--brand-ink)]">{label}</span>
          <span className="font-medium num-tabular">{count} ({pct}%)</span>
        </div>
        <div className="h-1.5 bg-[var(--brand-cream)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const styles: Record<number, string> = {
    1: 'bg-[var(--brand-red-light)] text-[var(--brand-red)] border-[var(--brand-red)]/30',
    2: 'bg-[var(--brand-cream)] text-[var(--brand-ink)] border-[var(--brand-border)]',
    3: 'bg-white text-[var(--brand-ink)]/70 border-[var(--brand-border)]',
  }
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[tier]}`}>T{tier}</Badge>
}

function RecBadge({ recommendation }: { recommendation: string }) {
  const { t } = useLanguage()
  const recKeyMap: Record<string, string> = {
    high_priority: 'dashboard.rec_high_priority',
    priority: 'dashboard.rec_priority',
    monitor: 'dashboard.rec_monitor',
    avoid: 'dashboard.rec_avoid',
  }
  const clsMap: Record<string, string> = {
    high_priority: 'bg-[var(--brand-red)] text-white',
    priority: 'bg-[#D45F4A] text-white',
    monitor: 'bg-[#A08070] text-white',
    avoid: 'bg-[#B0B0B0] text-white',
  }
  const key = recKeyMap[recommendation] || recKeyMap.monitor
  const cls = clsMap[recommendation] || clsMap.monitor
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{t(key)}</span>
}

function RiskBadge({ risk }: { risk: string }) {
  const { t } = useLanguage()
  const riskKeyMap: Record<string, string> = {
    low: 'dashboard.risk_low',
    medium: 'dashboard.risk_medium',
    high: 'dashboard.risk_high',
  }
  const clsMap: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  }
  const key = riskKeyMap[risk] || risk
  const cls = clsMap[risk] || ''
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${cls}`}>{t(key)}</span>
}
