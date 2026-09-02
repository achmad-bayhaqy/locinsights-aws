'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Crosshair, TrendingUp, Store as StoreIcon, Building2, MapPin, AlertCircle,
  Activity, DollarSign, Users, Target, CheckCircle2, Info, Lightbulb,
  Shield, Clock, Brain, Navigation, HelpCircle, ArrowRight, Zap,
} from 'lucide-react'
import type { OpportunityScore, Brand, KelurahanLite, Store, Mall, POI } from './types'
import { useLanguage } from '@/lib/i18n/language-provider'

interface AnalysisProps {
  kelurahanList: KelurahanLite[]
  brands: Brand[]
  selectedKelurahanId: string | null
  onSelectKelurahan: (id: string) => void
}

export function Analysis({ kelurahanList, brands, selectedKelurahanId, onSelectKelurahan }: AnalysisProps) {
  const { t } = useLanguage()
  const [brandId, setBrandId] = useState<string>('')
  const [data, setData] = useState<null | {
    kelurahan: KelurahanLite & { mall_proximity_index: number; existing_store_density: number }
    score: OpportunityScore & { nearby_competitor_stores?: number; travel_time_min_to_nearest_mall?: number | null }
    nearby_stores: (Store & { distance_km: number })[]
    nearby_competitors?: any[]
    nearby_malls: (Mall & { distance_km: number })[]
    nearby_pois: (POI & { distance_km: number })[]
    isochrones?: { minutes: number; mode: string; points: { lat: number; lng: number }[] }[]
    ml_prediction?: {
      model_name: string
      predicted_revenue_juta: number
      confidence: number
      top_features: { feature: string; contribution: number }[]
    } | null
  }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const kelByTier: Record<number, KelurahanLite[]> = { 1: [], 2: [], 3: [] }
  for (const k of kelurahanList) kelByTier[k.tier].push(k)

  useEffect(() => {
    if (!selectedKelurahanId) return
    setLoading(true)
    setError(null)
    const url = `/api/locinsight/analyze?kelurahan_id=${selectedKelurahanId}${brandId ? `&brand_id=${brandId}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data)
        else setError(j.error || 'Failed to load')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedKelurahanId, brandId])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
            {t('analysis.deep_title')}
          </h2>
          <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
            {t('analysis.deep_subtitle')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHelp(s => !s)}>
          <HelpCircle className="w-4 h-4 mr-1" />
          {showHelp ? t('analysis.hide_guide') : t('analysis.how_to_use')}
        </Button>
      </div>

      {/* How to use guide */}
      {showHelp && (
        <Card className="card-premium bg-[var(--brand-cream)] border-l-4 border-l-[var(--brand-red)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-[var(--brand-red)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-bold text-[var(--brand-ink)] mb-1">{t('analysis.how_to_use_title')}</div>
                <div className="text-[11.5px] text-[var(--brand-ink)]/70 leading-relaxed">
                  {t('analysis.how_to_use_desc')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <GuideStep n={1} title={t('analysis.step1_title')} desc={t('analysis.step1_desc')} />
              <GuideStep n={2} title={t('analysis.step2_title')} desc={t('analysis.step2_desc')} />
              <GuideStep n={3} title={t('analysis.step3_title')} desc={t('analysis.step3_desc')} />
              <GuideStep n={4} title={t('analysis.step4_title')} desc={t('analysis.step4_desc')} />
              <GuideStep n={5} title={t('analysis.step5_title')} desc={t('analysis.step5_desc')} />
              <GuideStep n={6} title={t('analysis.step6_title')} desc={t('analysis.step6_desc')} />
              <GuideStep n={7} title={t('analysis.step7_title')} desc={t('analysis.step7_desc')} />
              <GuideStep n={8} title={t('analysis.step8_title')} desc={t('analysis.step8_desc')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selectors */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                {t('analysis.kelurahan_desa')}
              </label>
              <Select value={selectedKelurahanId || '__none__'} onValueChange={(v) => v !== '__none__' && onSelectKelurahan(v)}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder={t('analysis.search_kelurahan')} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {[1, 2, 3].map(tier => (
                    <SelectGroup key={tier}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-[var(--brand-red)] font-bold">
                        {t('analysis.tier_label', { tier, count: kelByTier[tier].length })}
                      </SelectLabel>
                      {kelByTier[tier].map(k => (
                        <SelectItem key={k.id} value={k.id} className="text-[12px]">
                          {k.name} — {k.kec_name}, {k.kab_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                {t('analysis.target_brand')}
              </label>
              <Select value={brandId || '__none__'} onValueChange={(v) => setBrandId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder={t('analysis.generic_no_brand')} /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="__none__">{t('analysis.generic_no_brand')}</SelectItem>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-bold">{t('analysis.map_brands')}</SelectLabel>
                    {brands.filter(b => b.parent === 'MAP').map(b => (
                      <SelectItem key={b.id} value={b.id} className="text-[12px]">{b.name} ({b.category.replace('_', ' ')})</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-bold">{t('analysis.map_active_brands')}</SelectLabel>
                    {brands.filter(b => b.parent === 'MAA').map(b => (
                      <SelectItem key={b.id} value={b.id} className="text-[12px]">{b.name} ({b.category.replace('_', ' ')})</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedKelurahanId && (
        <Card className="card-premium bg-[var(--brand-cream)]">
          <CardContent className="py-12 text-center">
            <Crosshair className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
            <div className="text-[14px] text-[var(--brand-ink)]/60">
              {t('analysis.empty_prompt')}
            </div>
            <div className="text-[11px] text-[var(--brand-ink)]/40 mt-1">
              {t('analysis.empty_hint')}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <Card className="card-premium border-red-300">
          <CardContent className="p-4 text-[13px] text-red-700">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </CardContent>
        </Card>
      )}

      {data && !loading && <AnalysisView data={data} />}
    </div>
  )
}

function GuideStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 bg-white p-2.5 rounded">
      <div className="w-5 h-5 rounded-full bg-[var(--brand-red)] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {n}
      </div>
      <div>
        <div className="text-[12px] font-bold text-[var(--brand-ink)]">{title}</div>
        <div className="text-[10.5px] text-[var(--brand-ink)]/70 leading-snug">{desc}</div>
      </div>
    </div>
  )
}

function AnalysisView({ data }: { data: any }) {
  const { t } = useLanguage()
  const { kelurahan, score, nearby_stores, nearby_competitors, nearby_malls, nearby_pois, isochrones, ml_prediction } = data

  // Compute recommended action
  const recommendedAction = computeRecommendedAction(score, kelurahan, nearby_stores, nearby_competitors || [], t)

  return (
    <div className="space-y-4">
      {/* Header summary card */}
      <Card className="bg-[var(--brand-ink)] text-white border-0 rounded-xl shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">{t('analysis.tier_label_short', { tier: kelurahan.tier })}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                  background: score.recommendation === 'high_priority' ? 'var(--brand-red)' :
                             score.recommendation === 'priority' ? '#D45F4A' : '#A08070'
                }}>
                  {t('analysis.recommendation.' + score.recommendation)}
                </span>
              </div>
              <h3 className="font-display text-[28px] font-bold leading-tight">{kelurahan.name}</h3>
              <div className="text-[13px] text-white/70 mt-1">
                {kelurahan.kec_name} · {kelurahan.kab_name}
              </div>
              <div className="text-[11px] text-white/50 mt-1">
                {t('analysis.kelurahan_summary', {
                  pop: kelurahan.population.toLocaleString(),
                  area: kelurahan.area_km2,
                  density: kelurahan.density,
                })}
                {kelurahan.is_coastal && t('analysis.coastal_suffix')}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <BigStat label={t('analysis.stat_composite')} value={score.composite_score.toString()} suffix="/100" icon={Target} />
              <BigStat label={t('analysis.market_share')} value={(score.potential_market_share * 100).toFixed(1)} suffix="%" icon={Activity} />
              <BigStat label={t('analysis.stat_daily_cust')} value={score.estimated_daily_customers.toString()} icon={Users} />
              <BigStat label={t('analysis.stat_rev_mo')} value={`${score.projected_monthly_revenue_juta}`} suffix="jt" icon={DollarSign} accent="red" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Action — NEW */}
      <Card className={`card-premium border-l-4 ${recommendedAction.color === 'green' ? 'border-l-green-500' : recommendedAction.color === 'red' ? 'border-l-red-500' : recommendedAction.color === 'amber' ? 'border-l-amber-500' : 'border-l-[var(--brand-red)]'}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${recommendedAction.color === 'green' ? 'bg-green-100' : recommendedAction.color === 'red' ? 'bg-red-100' : recommendedAction.color === 'amber' ? 'bg-amber-100' : 'bg-[var(--brand-red-light)]'}`}>
              <ArrowRight className={`w-4 h-4 ${recommendedAction.color === 'green' ? 'text-green-600' : recommendedAction.color === 'red' ? 'text-red-600' : recommendedAction.color === 'amber' ? 'text-amber-600' : 'text-[var(--brand-red)]'}`} />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold text-[var(--brand-ink)] uppercase tracking-wider mb-1.5">
                {t('analysis.recommended_action_label', { title: recommendedAction.title })}
              </div>
              <div className="text-[12.5px] text-[var(--brand-ink)]/85 leading-relaxed mb-2">
                {recommendedAction.description}
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendedAction.nextSteps.map((step: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{step}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ML Prediction (Phase 3) — NEW */}
      {ml_prediction && (
        <Card className="card-premium border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-bold text-[var(--brand-ink)] uppercase tracking-wider">
                    {t('analysis.ml_revenue_prediction')}
                  </div>
                  <Badge variant="outline" className="text-[9px]">{t('analysis.confidence_pct', { n: (ml_prediction.confidence * 100).toFixed(0) })}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55">{t('analysis.ml_predicted')}</div>
                    <div className="text-[20px] font-bold text-purple-700">{ml_prediction.predicted_revenue_juta} jt</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55">{t('analysis.heuristic')}</div>
                    <div className="text-[20px] font-bold text-[var(--brand-ink)]">{score.projected_monthly_revenue_juta} jt</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55">{t('analysis.delta')}</div>
                    <div className={`text-[20px] font-bold ${ml_prediction.predicted_revenue_juta > score.projected_monthly_revenue_juta ? 'text-green-600' : 'text-amber-600'}`}>
                      {ml_prediction.predicted_revenue_juta > score.projected_monthly_revenue_juta ? '+' : ''}
                      {ml_prediction.predicted_revenue_juta - score.projected_monthly_revenue_juta} jt
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55">{t('analysis.model')}</div>
                    <div className="text-[12px] font-mono text-[var(--brand-ink)]/70">{ml_prediction.model_name}</div>
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">{t('analysis.top_driving_features')}</div>
                <div className="flex flex-wrap gap-1">
                  {ml_prediction.top_features.map((f: any, i: number) => (
                    <span key={i} className="text-[10px] bg-[var(--brand-cream)] px-1.5 py-0.5 rounded">
                      {f.feature}: <strong>{f.contribution > 0 ? '+' : ''}{f.contribution}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Travel-time isochrones (Phase 2) — NEW */}
      {isochrones && isochrones.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[var(--brand-red)]" />
              {t('analysis.isochrones_friction')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {isochrones.map((iso, i) => {
                const area = computePolygonAreaKm2(iso.points)
                return (
                  <div key={i} className="bg-[var(--brand-cream)] p-3 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">{t('analysis.min_by_mode', { min: iso.minutes, mode: iso.mode })}</span>
                    </div>
                    <div className="font-display text-[24px] font-bold text-[var(--brand-ink)] num-tabular">{area.toFixed(1)}<span className="text-[12px] text-[var(--brand-ink)]/60 ml-1">km²</span></div>
                    <div className="text-[10px] text-[var(--brand-ink)]/55 mt-1">{t('analysis.reachable_catchment')}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-[10.5px] text-[var(--brand-ink)]/60 leading-relaxed">
              {t('analysis.isochrones_approx', { tier: kelurahan.tier === 1 ? '1.3×' : kelurahan.tier === 2 ? '1.55×' : '1.8×' })}
              {' '}
              {t('analysis.isochrones_production_note')}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Factor breakdown */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--brand-red)]" />
            {t('analysis.composite_score_breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {score.factors.map((f: any) => (
            <div key={f.name}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--brand-ink)]">{f.name}</span>
                  <span className="text-[10px] text-[var(--brand-ink)]/40 uppercase tracking-wider">
                    {t('analysis.weight_pct', { n: (f.weight * 100).toFixed(0) })}
                  </span>
                </div>
                <div className="flex items-center gap-2 num-tabular">
                  <span className="text-[var(--brand-ink)]/50 text-[11px]">{f.raw_value}/100</span>
                  <span className="text-[var(--brand-red)] font-bold text-[13px]">+{f.weighted.toFixed(1)}</span>
                </div>
              </div>
              <div className="h-2 bg-[var(--brand-cream)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${f.raw_value}%`,
                    background: f.raw_value >= 70 ? 'var(--brand-red)' : f.raw_value >= 50 ? '#D45F4A' : '#A08070'
                  }}
                />
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-[var(--brand-border)] flex items-center justify-between">
            <span className="text-[12px] font-medium text-[var(--brand-ink)]">{t('analysis.composite_score')}</span>
            <span className="font-display text-[24px] font-bold text-[var(--brand-red)] num-tabular">{score.composite_score}</span>
          </div>
        </CardContent>
      </Card>

      {/* White space insight */}
      <Card className="card-premium border-l-4 border-l-[var(--brand-red)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[var(--brand-red)] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[12px] font-bold text-[var(--brand-ink)] uppercase tracking-wider mb-1.5">{t('analysis.insight_recommendation')}</div>
              <div className="text-[12.5px] text-[var(--brand-ink)]/80 leading-relaxed">
                {score.white_space_summary}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demographic + index grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <IndexCard label={t('analysis.urban_index')} value={kelurahan.urban_index} />
        <IndexCard label={t('analysis.income_index')} value={kelurahan.income_index} />
        <IndexCard label={t('analysis.tourist_index')} value={kelurahan.tourist_index} />
        <IndexCard label={t('analysis.transport_index')} value={kelurahan.transport_index} />
        <IndexCard label={t('analysis.poi_density')} value={kelurahan.poi_density_index} />
        <IndexCard label={t('analysis.mall_proximity')} value={kelurahan.mall_proximity_index || Math.max(0, 100 - score.nearest_mall_distance_km * 20)} />
      </div>

      {/* Nearby stores / competitors / malls / POIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <NearbyCard
          title={t('analysis.nearby_map_stores')}
          icon={StoreIcon}
          accent="red"
          count={nearby_stores.length}
        >
          {nearby_stores.slice(0, 10).map((s: any) => (
            <div key={s.id} className="text-[11.5px] py-1.5 border-b border-[var(--brand-border)] last:border-0">
              <div className="flex items-center justify-between">
                <strong className="text-[var(--brand-ink)]">{s.brand_name}</strong>
                <span className="text-[var(--brand-red)] num-tabular text-[10px]">{s.distance_km.toFixed(1)}km</span>
              </div>
              <div className="text-[10px] text-[var(--brand-ink)]/55 truncate">
                {s.name} {s.is_in_mall ? `· ${s.mall_name}` : ''}
              </div>
            </div>
          ))}
          {nearby_stores.length === 0 && (
            <div className="text-[11px] text-[var(--brand-ink)]/50 py-2 text-center">
              {t('analysis.no_map_stores')}
            </div>
          )}
        </NearbyCard>

        <NearbyCard
          title={t('analysis.nearby_competitors')}
          icon={Shield}
          accent="amber"
          count={nearby_competitors?.length || 0}
        >
          {(nearby_competitors || []).slice(0, 10).map((c: any, i: number) => (
            <div key={i} className="text-[11.5px] py-1.5 border-b border-[var(--brand-border)] last:border-0">
              <div className="flex items-center justify-between">
                <strong className="text-[var(--brand-ink)]">{c.brand_name}</strong>
                <span className="text-amber-600 num-tabular text-[10px]">{c.distance_km.toFixed(1)}km</span>
              </div>
              <div className="text-[10px] text-[var(--brand-ink)]/55 truncate">{c.name}</div>
            </div>
          ))}
          {(!nearby_competitors || nearby_competitors.length === 0) && (
            <div className="text-[11px] text-[var(--brand-ink)]/50 py-2 text-center">
              {t('analysis.no_competitors_db')}
            </div>
          )}
        </NearbyCard>

        <NearbyCard
          title={t('analysis.nearby_malls')}
          icon={Building2}
          accent="ink"
          count={nearby_malls.length}
        >
          {nearby_malls.slice(0, 10).map((m: any) => (
            <div key={m.id} className="text-[11.5px] py-1.5 border-b border-[var(--brand-border)] last:border-0">
              <div className="flex items-center justify-between">
                <strong className="text-[var(--brand-ink)]">{m.name}</strong>
                <span className="text-[var(--brand-red)] num-tabular text-[10px]">{m.distance_km.toFixed(1)}km</span>
              </div>
              <div className="text-[10px] text-[var(--brand-ink)]/55">
                {(m.gla_m2 / 1000).toFixed(0)}k m² · {m.class.replace('_', ' ')} · ~{m.visitor_estimate_daily.toLocaleString()}/day
              </div>
            </div>
          ))}
          {nearby_malls.length === 0 && (
            <div className="text-[11px] text-[var(--brand-ink)]/50 py-2 text-center">
              {t('analysis.no_malls_nearby')}
            </div>
          )}
        </NearbyCard>

        <NearbyCard
          title={t('analysis.nearby_pois')}
          icon={MapPin}
          accent="ink"
          count={nearby_pois.length}
        >
          {nearby_pois.slice(0, 10).map((p: any) => (
            <div key={p.id} className="text-[11.5px] py-1.5 border-b border-[var(--brand-border)] last:border-0">
              <div className="flex items-center justify-between">
                <strong className="text-[var(--brand-ink)]">{p.name}</strong>
                <span className="text-[var(--brand-red)] num-tabular text-[10px]">{p.distance_km.toFixed(1)}km</span>
              </div>
              <div className="text-[10px] text-[var(--brand-ink)]/55 capitalize">
                {p.type.replace('_', ' ')} {p.magnitude > 0 ? `· ${p.magnitude.toLocaleString()}` : ''}
              </div>
            </div>
          ))}
          {nearby_pois.length === 0 && (
            <div className="text-[11px] text-[var(--brand-ink)]/50 py-2 text-center">{t('analysis.no_pois_nearby')}</div>
          )}
        </NearbyCard>
      </div>

      {/* Risk assessment */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--brand-red)]" />
            {t('analysis.risk_assessment')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-3 gap-3">
          <RiskItem
            label={t('analysis.cannibalization_risk')}
            value={score.cannibalization_risk}
            desc={t('analysis.cannibalization_desc', { map: score.nearby_existing_stores }) + (score.nearby_competitor_stores ? t('analysis.competitors_suffix', { count: score.nearby_competitor_stores }) : '')}
          />
          <RiskItem
            label={t('analysis.tier_saturation')}
            value={kelurahan.tier === 1 ? 'high' : kelurahan.tier === 2 ? 'medium' : 'low'}
            desc={kelurahan.tier === 1 ? t('analysis.tier1_saturation_desc') : kelurahan.tier === 2 ? t('analysis.tier2_saturation_desc') : t('analysis.tier3_saturation_desc')}
          />
          <RiskItem
            label={t('analysis.mall_dependency')}
            value={score.nearest_mall_distance_km < 1.5 ? 'high' : score.nearest_mall_distance_km < 5 ? 'medium' : 'low'}
            desc={score.nearest_mall_name ? t('analysis.nearest_mall', { name: score.nearest_mall_name }) : t('analysis.no_mall_nearby')}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function computeRecommendedAction(score: any, kelurahan: any, nearbyStores: any[], nearbyCompetitors: any[], t: (key: string, params?: Record<string, string | number>) => string) {
  const composite = score.composite_score
  const cannibalization = score.cannibalization_risk
  const competitorDensity = nearbyCompetitors.length

  if (composite >= 70 && cannibalization !== 'high') {
    return {
      title: t('analysis.action_proceed_title'),
      color: 'green',
      description: t('analysis.action_proceed_desc', { score: composite, risk: cannibalization }),
      nextSteps: [
        t('analysis.action_step_visit'),
        t('analysis.action_step_lease'),
        t('analysis.action_step_huff'),
        t('analysis.action_step_bizcase'),
      ],
    }
  }
  if (composite >= 55 && cannibalization !== 'high') {
    return {
      title: t('analysis.action_priority_title'),
      color: 'red',
      description: t('analysis.action_priority_desc', { score: composite }),
      nextSteps: [
        t('analysis.action_step_foottraffic'),
        t('analysis.action_step_leasecost'),
        t('analysis.action_step_scenario'),
      ],
    }
  }
  if (composite >= 40) {
    return {
      title: t('analysis.action_monitor_title'),
      color: 'amber',
      description: t('analysis.action_monitor_desc', { score: composite }),
      nextSteps: [
        t('analysis.action_step_watchlist'),
        t('analysis.action_step_rescore'),
        t('analysis.action_step_monitor'),
      ],
    }
  }
  return {
    title: t('analysis.action_avoid_title'),
    color: 'red',
    description: t('analysis.action_avoid_desc', { score: composite }),
    nextSteps: [
      t('analysis.action_step_skip'),
      t('analysis.action_step_focus'),
    ],
  }
}

function computePolygonAreaKm2(points: { lat: number; lng: number }[]): number {
  // Shoelace formula on lat/lng → approximate km²
  if (points.length < 3) return 0
  let area = 0
  const R = 6371 // Earth radius km
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180))
  }
  area = Math.abs(area * R * R / 2) * (Math.PI / 180)
  return area
}

function BigStat({ label, value, suffix, icon: Icon, accent }: { label: string; value: string; suffix?: string; icon: any; accent?: 'red' }) {
  return (
    <div className="bg-white/5 rounded-md p-3 border border-white/10">
      <Icon className={`w-4 h-4 mb-1 ${accent === 'red' ? 'text-[var(--brand-red)]' : 'text-white/60'}`} />
      <div className="text-[10px] uppercase tracking-wider text-white/50 font-medium">{label}</div>
      <div className="font-display text-[22px] font-bold leading-tight num-tabular">
        {value}<span className="text-[14px] text-white/60 ml-0.5">{suffix}</span>
      </div>
    </div>
  )
}

function IndexCard({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'var(--brand-red)' : value >= 50 ? '#D45F4A' : '#A08070'
  return (
    <Card className="card-premium">
      <CardContent className="p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 font-medium mb-1">{label}</div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="font-display text-[24px] font-bold num-tabular leading-none" style={{ color }}>{value}</span>
          <span className="text-[11px] text-[var(--brand-ink)]/40">/100</span>
        </div>
        <div className="h-1.5 bg-[var(--brand-cream)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
        </div>
      </CardContent>
    </Card>
  )
}

function NearbyCard({ title, icon: Icon, accent, count, children }: { title: string; icon: any; accent: 'red' | 'ink' | 'amber'; count: number; children: React.ReactNode }) {
  const iconColor = accent === 'red' ? 'text-[var(--brand-red)]' : accent === 'amber' ? 'text-amber-600' : 'text-[var(--brand-ink)]'
  return (
    <Card className="card-premium">
      <CardHeader className="pb-2">
        <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
            {title}
          </span>
          <span className="bg-[var(--brand-cream)] text-[var(--brand-ink)] px-1.5 py-0.5 rounded text-[10px] font-bold num-tabular">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 max-h-72 overflow-y-auto scroll-styled">
        {children}
      </CardContent>
    </Card>
  )
}

function RiskItem({ label, value, desc }: { label: string; value: string; desc: string }) {
  const { t } = useLanguage()
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  }
  return (
    <div className="bg-[var(--brand-cream)] rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 font-medium mb-1">{label}</div>
      <span className={`text-[11px] px-2 py-0.5 rounded font-bold mb-1.5 inline-block ${colors[value] || colors.medium}`}>{t('common.' + value)}</span>
      <div className="text-[11px] text-[var(--brand-ink)]/70">{desc}</div>
    </div>
  )
}
