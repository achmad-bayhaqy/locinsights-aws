'use client'

/**
 * MapAnalysisPanel — Instant Site Analysis card shown when a user clicks
 * any opportunity point on the Map Explorer.
 *
 * Shows:
 *   1. Suitability verdict (Highly / Moderately / Less Suitable)
 *   2. Recommended brands (based on category white-space + audience fit)
 *   3. Supporting parameters (6 scoring factors + market estimates)
 *   4. Nearby outlets within 2 km (MAP stores, MAA stores, malls, competitors)
 *
 * Click "Open in Deep Analysis" to navigate to the Analysis tab.
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Crosshair, Store as StoreIcon, Building2, Shield, MapPin, TrendingUp,
  Users, Banknote, Bus, Activity, Sparkles, Footprints,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { OpportunityScore, Store, Mall, Brand } from './types'
import { BRANDS } from '@/lib/data/brands'

interface NearbyOutlet {
  name: string
  kind: 'map_store' | 'maa_store' | 'mall' | 'competitor'
  distance_km: number
  brand?: string
  category?: string
}

interface MapAnalysisPanelProps {
  opportunity: OpportunityScore | undefined
  stores: Store[]
  malls: Mall[]
  competitors: any[]
  brands: Brand[]
  onOpenAnalysis?: () => void
  onOpenOpportunities?: () => void
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Recommend up to 5 brands based on:
 *   - Score tier (high_priority → premium brands; monitor → mass brands)
 *   - Category white-space (fewest existing stores nearby)
 *   - Location preference (mall locations prefer mall-friendly brands)
 */
function recommendBrands(
  opp: OpportunityScore,
  brands: Brand[],
  nearbyStores: Store[],
  nearbyMalls: Mall[],
): Brand[] {
  const NEARBY_RADIUS_KM = 5
  // Count existing stores per category within 5 km
  const categoryCounts: Record<string, number> = {}
  for (const s of nearbyStores) {
    const d = haversineKm(opp.lat, opp.lng, s.lat, s.lng)
    if (d <= NEARBY_RADIUS_KM) {
      const cat = s.brand_category || 'other'
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    }
  }

  // Score each brand
  const scored = brands.map(b => {
    let score = b.brand_strength * 30 // base: brand strength
    // White-space bonus: fewer stores of same category nearby → higher score
    const sameCatCount = categoryCounts[b.category] || 0
    score += Math.max(0, 30 - sameCatCount * 6)
    // Tier match
    if (opp.tier === 1 && b.price_segment === 'premium') score += 15
    if (opp.tier === 1 && b.price_segment === 'luxury') score += 20
    if (opp.tier === 2 && b.price_segment === 'mid') score += 15
    if (opp.tier === 3 && b.price_segment === 'mass') score += 15
    // Location preference match
    const hasNearbyMall = nearbyMalls.some(m => haversineKm(opp.lat, opp.lng, m.lat, m.lng) <= 3)
    if (hasNearbyMall && b.location_preference === 'mall') score += 10
    if (!hasNearbyMall && b.location_preference === 'street') score += 10
    if (b.location_preference === 'both') score += 5
    // Recommendation alignment
    if (opp.recommendation === 'high_priority' && b.parent === 'MAA') score += 5
    return { brand: b, score }
  })

  // Sort by score desc, take top 5, dedupe by category (keep highest per category first, then fill)
  const sorted = scored.sort((a, b) => b.score - a.score)
  const picked: Brand[] = []
  const seenCategories = new Set<string>()
  // First pass: pick best brand per category
  for (const s of sorted) {
    if (!seenCategories.has(s.brand.category)) {
      picked.push(s.brand)
      seenCategories.add(s.brand.category)
    }
    if (picked.length >= 5) break
  }
  // If still fewer than 5, fill with next best brands
  for (const s of sorted) {
    if (picked.length >= 5) break
    if (!picked.includes(s.brand)) picked.push(s.brand)
  }
  return picked
}

export function MapAnalysisPanel({
  opportunity: opp,
  stores,
  malls,
  competitors,
  brands,
  onOpenAnalysis,
  onOpenOpportunities,
}: MapAnalysisPanelProps) {
  const { t } = useLanguage()

  // Compute nearby outlets within 2 km
  const nearby = useMemo<NearbyOutlet[]>(() => {
    if (!opp) return []
    const out: NearbyOutlet[] = []
    const RADIUS = 2
    for (const s of stores) {
      const d = haversineKm(opp.lat, opp.lng, s.lat, s.lng)
      if (d <= RADIUS) {
        out.push({
          name: s.name,
          kind: s.parent === 'MAP' ? 'map_store' : 'maa_store',
          distance_km: d,
          brand: s.brand_name,
          category: s.brand_category,
        })
      }
    }
    for (const m of malls) {
      const d = haversineKm(opp.lat, opp.lng, m.lat, m.lng)
      if (d <= RADIUS) {
        out.push({
          name: m.name,
          kind: 'mall',
          distance_km: d,
        })
      }
    }
    for (const c of competitors) {
      const d = haversineKm(opp.lat, opp.lng, c.lat, c.lng)
      if (d <= RADIUS) {
        out.push({
          name: c.name,
          kind: 'competitor',
          distance_km: d,
          brand: c.brand_name,
          category: c.brand_category,
        })
      }
    }
    return out.sort((a, b) => a.distance_km - b.distance_km).slice(0, 12)
  }, [opp, stores, malls, competitors])

  // Recommended brands
  const recommended = useMemo(() => {
    if (!opp) return []
    return recommendBrands(opp, brands.length > 0 ? brands : BRANDS, stores, malls)
  }, [opp, brands, stores, malls])

  // Suitability verdict
  const suitability = useMemo<{ level: 'high' | 'medium' | 'low'; label: string; color: string }>(() => {
    if (!opp) return { level: 'medium', label: '', color: '' }
    if (opp.composite_score >= 65 && opp.cannibalization_risk !== 'high') {
      return { level: 'high', label: t('map.analysis.suitability.high'), color: '#16a34a' }
    }
    if (opp.composite_score >= 45) {
      return { level: 'medium', label: t('map.analysis.suitability.medium'), color: '#f59e0b' }
    }
    return { level: 'low', label: t('map.analysis.suitability.low'), color: '#dc2626' }
  }, [opp, t])

  // Compass message
  const compassMessage = useMemo(() => {
    if (!opp) return ''
    switch (opp.recommendation) {
      case 'high_priority': return t('map.analysis.compass.proceed')
      case 'priority': return t('map.analysis.compass.priority')
      case 'monitor': return t('map.analysis.compass.monitor')
      case 'avoid': return t('map.analysis.compass.avoid')
    }
    return ''
  }, [opp, t])

  if (!opp) {
    return (
      <Card className="card-premium bg-[var(--brand-cream)] border-dashed">
        <CardContent className="py-5 text-center">
          <Crosshair className="w-6 h-6 mx-auto text-[var(--brand-ink)]/30 mb-2" />
          <div className="text-[12px] font-medium text-[var(--brand-ink)]/70">
            {t('map.analysis.empty')}
          </div>
          <div className="text-[10.5px] text-[var(--brand-ink)]/45 mt-1 max-w-xs mx-auto">
            {t('map.analysis.empty_hint')}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Nearby counts
  const nearbyCounts = {
    map_store: nearby.filter(n => n.kind === 'map_store').length,
    maa_store: nearby.filter(n => n.kind === 'maa_store').length,
    mall: nearby.filter(n => n.kind === 'mall').length,
    competitor: nearby.filter(n => n.kind === 'competitor').length,
  }

  // Factor lookup helper
  const factorVal = (name: string) =>
    opp.factors.find(f => f.name.toLowerCase().includes(name.toLowerCase()))?.raw_value ?? 0

  return (
    <Card className="card-premium border-[var(--brand-red)]/40 border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-red)] flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5" />
          {t('map.analysis.title')}
          {onOpenOpportunities && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenOpportunities() }}
              className="ml-auto text-[10px] normal-case tracking-normal text-[var(--brand-ink)]/45 hover:text-[var(--brand-red)] font-normal transition-colors"
            >
              {t('map.analysis.open_in_opportunities')}
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Title + suitability verdict */}
        <div>
          <div className="font-display text-[18px] font-bold text-[var(--brand-ink)] leading-tight">
            {opp.kelurahan_name}
          </div>
          <div className="text-[11px] text-[var(--brand-ink)]/60 mb-2">
            {opp.kec_name} · {opp.kab_name} · Tier {opp.tier}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
              style={{ background: suitability.color }}
            >
              <Sparkles className="w-3 h-3" />
              {t('map.analysis.suitability')}: {suitability.label}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {t('map.table.col.score')}: <strong className="text-[var(--brand-red)] ml-1">{opp.composite_score}/100</strong>
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-[var(--brand-ink)]/75 leading-relaxed bg-[var(--brand-cream)] rounded px-2 py-1.5">
            <strong className="text-[var(--brand-ink)]">{compassMessage}</strong>
            {' — '}{opp.white_space_summary}
          </div>
        </div>

        {/* Recommended brands */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 flex items-center gap-1">
            <StoreIcon className="w-3 h-3 text-[var(--brand-red)]" />
            {t('map.analysis.recommended_brands')}
          </div>
          <div className="text-[10px] text-[var(--brand-ink)]/50 mb-2">
            {t('map.analysis.recommended_brands_hint')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommended.map(b => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium border"
                style={{
                  background: b.parent === 'MAP' ? '#fff7ed' : '#eff6ff',
                  borderColor: b.parent === 'MAP' ? '#fdba74' : '#bfdbfe',
                  color: b.parent === 'MAP' ? '#9a3412' : '#1e40af',
                }}
                title={`${b.parent} · ${b.category} · ${b.format} · ${b.price_segment}`}
              >
                {b.name}
                <span className="opacity-60 text-[9px]">· {b.category.replace('_', ' ')}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Supporting parameters — 6 factor mini-bars + market estimates */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--brand-red)]" />
            {t('map.analysis.supporting_parameters')}
          </div>
          <div className="space-y-1.5">
            <FactorBar icon={Users} label="Population" value={factorVal('population')} color="#3182bd" />
            <FactorBar icon={Banknote} label="Income" value={factorVal('income')} color="#31a354" />
            <FactorBar icon={Shield} label="Competition (lower=better)" value={factorVal('competition')} color="#dc2626" invert />
            <FactorBar icon={Sparkles} label="Tourism" value={factorVal('tourism')} color="#41ae76" />
            <FactorBar icon={Bus} label="Accessibility" value={factorVal('accessibility')} color="#8856a7" />
            <FactorBar icon={Activity} label="Density" value={factorVal('density')} color="#ec7014" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[var(--brand-border)] text-[11px]">
            <div>
              <div className="text-[9.5px] uppercase tracking-wider text-[var(--brand-ink)]/50">{t('map.table.col.market_share')}</div>
              <div className="font-semibold num-tabular">{(opp.potential_market_share * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-wider text-[var(--brand-ink)]/50">{t('map.table.col.daily_cust')}</div>
              <div className="font-semibold num-tabular">{opp.estimated_daily_customers}</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-wider text-[var(--brand-ink)]/50">{t('map.table.col.monthly_rev')}</div>
              <div className="font-semibold num-tabular text-[var(--brand-red)]">{opp.projected_monthly_revenue_juta} jt</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[10.5px]">
            <div className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[var(--brand-ink)]/50" />
              <span className="text-[var(--brand-ink)]/60">{t('map.table.col.nearest_mall')}:</span>
              <span className="font-medium truncate">
                {opp.nearest_mall_name ? `${opp.nearest_mall_name.split(' ')[0]} (${opp.nearest_mall_distance_km}km)` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Footprints className="w-3 h-3 text-[var(--brand-ink)]/50" />
              <span className="text-[var(--brand-ink)]/60">{t('map.table.col.cannibalization')}:</span>
              <span className="font-medium capitalize">{opp.cannibalization_risk}</span>
            </div>
          </div>
        </div>

        {/* Nearby outlets within 2 km */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[var(--brand-red)]" />
            {t('map.analysis.nearby_outlets')}
            <span className="ml-auto flex gap-1 normal-case tracking-normal">
              {nearbyCounts.map_store > 0 && <Badge variant="outline" className="text-[9px] h-4 text-blue-700 border-blue-300 bg-blue-50">MAP {nearbyCounts.map_store}</Badge>}
              {nearbyCounts.maa_store > 0 && <Badge variant="outline" className="text-[9px] h-4 text-gray-700 border-gray-300 bg-gray-50">MAA {nearbyCounts.maa_store}</Badge>}
              {nearbyCounts.mall > 0 && <Badge variant="outline" className="text-[9px] h-4 text-amber-700 border-amber-300 bg-amber-50">Mall {nearbyCounts.mall}</Badge>}
              {nearbyCounts.competitor > 0 && <Badge variant="outline" className="text-[9px] h-4 text-red-700 border-red-300 bg-red-50">Comp {nearbyCounts.competitor}</Badge>}
            </span>
          </div>
          {nearby.length === 0 ? (
            <div className="text-[10.5px] text-[var(--brand-ink)]/50 italic px-2 py-1.5 bg-[var(--brand-cream)] rounded">
              {t('map.analysis.nearby.empty')}
            </div>
          ) : (
            <div className="max-h-[160px] overflow-y-auto scroll-styled space-y-1 pr-1">
              {nearby.map((n, i) => {
                const Icon = n.kind === 'map_store' ? StoreIcon
                  : n.kind === 'maa_store' ? StoreIcon
                  : n.kind === 'mall' ? Building2
                  : Shield
                const color = n.kind === 'map_store' ? '#2563eb'
                  : n.kind === 'maa_store' ? '#0F0F12'
                  : n.kind === 'mall' ? '#D97706'
                  : '#dc2626'
                return (
                  <div key={i} className="flex items-center gap-2 text-[10.5px] py-1 px-1.5 rounded hover:bg-[var(--brand-cream)]">
                    <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                    <span className="flex-1 truncate font-medium">{n.name}</span>
                    {n.brand && <span className="text-[var(--brand-ink)]/50 text-[9.5px] truncate">{n.brand}</span>}
                    <span className="text-[var(--brand-ink)]/45 text-[9.5px] num-tabular whitespace-nowrap">
                      {n.distance_km < 1 ? `${Math.round(n.distance_km * 1000)}m` : `${n.distance_km.toFixed(2)}km`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CTA: Open in Deep Analysis */}
        {onOpenAnalysis && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenAnalysis() }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--brand-ink)] text-white text-[11.5px] font-medium hover:bg-[var(--brand-ink)]/90 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {t('map.analysis.open_in_deep_analysis')}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

function FactorBar({
  icon: Icon, label, value, color, invert = false,
}: {
  icon: any
  label: string
  value: number
  color: string
  invert?: boolean
}) {
  // For competition, lower raw value = better → invert the bar so a short bar = good
  const displayValue = invert ? 100 - value : value
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-[var(--brand-ink)]/50 flex-shrink-0" />
      <span className="text-[10.5px] text-[var(--brand-ink)]/70 w-36 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--brand-cream)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(100, displayValue))}%`, background: color }}
        />
      </div>
      <span className="text-[10px] text-[var(--brand-ink)]/60 num-tabular w-8 text-right">{Math.round(value)}</span>
    </div>
  )
}
