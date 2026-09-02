'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Store as StoreIcon, Building2, Layers } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { Brand, Store } from './types'

interface BrandsCoverageProps {
  brands: Brand[]
  stores: Store[]
  onSelectKelurahan: (id: string) => void
}

export function BrandsCoverage({ brands, stores }: BrandsCoverageProps) {
  const { t } = useLanguage()
  // Group brands by parent + category
  const grouped = brands.reduce((acc, b) => {
    const key = `${b.parent}|${b.category}`
    if (!acc[key]) acc[key] = { parent: b.parent, category: b.category, brands: [] }
    acc[key].brands.push({
      ...b,
      store_count: stores.filter(s => s.brand_id === b.id).length,
      in_mall_count: stores.filter(s => s.brand_id === b.id && s.is_in_mall).length,
      street_count: stores.filter(s => s.brand_id === b.id && !s.is_in_mall).length,
    })
    return acc
  }, {} as Record<string, { parent: string; category: string; brands: any[] }>)

  const groups = Object.values(grouped).sort((a, b) => {
    if (a.parent !== b.parent) return a.parent === 'MAA' ? 1 : -1
    return a.category.localeCompare(b.category)
  })

  const categoryLabels: Record<string, string> = {
    food_beverage: t('brands.cat_food_beverage'),
    sports: t('brands.cat_sports'),
    fashion: t('brands.cat_fashion'),
    department_store: t('brands.cat_department_store'),
    kids: t('brands.cat_kids'),
    lifestyle: t('brands.cat_lifestyle'),
    beauty: t('brands.cat_beauty'),
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('brands.title_analysis')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('brands.analysis_subtitle', { brands_count: brands.length, stores_count: stores.length })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label={t('brands.total_brands')} value={brands.length.toString()} icon={StoreIcon} accent="ink" />
        <SummaryCard label={t('brands.map_brands')} value={brands.filter(b => b.parent === 'MAP').length.toString()} icon={StoreIcon} accent="red" />
        <SummaryCard label={t('brands.maa_brands')} value={brands.filter(b => b.parent === 'MAA').length.toString()} icon={StoreIcon} accent="ink" />
        <SummaryCard label={t('brands.in_mall_pct')} value={`${Math.round((stores.filter(s => s.is_in_mall).length / stores.length) * 100)}%`} icon={Building2} accent="red" />
      </div>

      {/* Brand groups */}
      {groups.map(group => (
        <Card key={`${group.parent}-${group.category}`} className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${group.parent === 'MAA' ? 'text-[var(--brand-ink)]' : 'text-[var(--brand-red)]'}`} />
                {group.parent === 'MAA' ? 'MAP Active' : 'MAP'} — {categoryLabels[group.category] || group.category}
              </span>
              <Badge variant="outline" className="text-[10px] border-[var(--brand-border)]">
                {t('brands.brands_count', { count: group.brands.length })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.brands.map(b => (
                <div key={b.id} className="border border-[var(--brand-border)] rounded-md p-3 hover:border-[var(--brand-red)]/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-[var(--brand-ink)]">{b.name}</div>
                      <div className="text-[10.5px] text-[var(--brand-ink)]/55">{b.format} · {b.origin_country}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[20px] font-bold text-[var(--brand-red)] num-tabular leading-none">
                        {b.store_count}
                      </div>
                      <div className="text-[9px] text-[var(--brand-ink)]/50 uppercase tracking-wider">{t('brands.stores_unit')}</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--brand-ink)]/70 mb-2 leading-snug">
                    {b.target_audience}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10.5px] mb-2">
                    <div className="bg-[var(--brand-cream)] rounded px-2 py-1">
                      <div className="text-[var(--brand-ink)]/50 uppercase tracking-wider text-[9px]">{t('brands.price')}</div>
                      <div className="font-medium capitalize text-[var(--brand-ink)]">{b.price_segment}</div>
                    </div>
                    <div className="bg-[var(--brand-cream)] rounded px-2 py-1">
                      <div className="text-[var(--brand-ink)]/50 uppercase tracking-wider text-[9px]">{t('brands.channel')}</div>
                      <div className="font-medium capitalize text-[var(--brand-ink)]">{b.location_preference}</div>
                    </div>
                  </div>

                  {b.store_count > 0 ? (
                    <div className="flex items-center gap-2 text-[10.5px]">
                      <span className="text-[var(--brand-red)] font-medium">{b.in_mall_count} {t('malls.mall_unit')}</span>
                      <span className="text-[var(--brand-ink)]/40">·</span>
                      <span className="text-[var(--brand-ink)] font-medium">{b.street_count} {t('malls.street_unit')}</span>
                      <div className="flex-1 h-1.5 bg-[var(--brand-cream)] rounded-full overflow-hidden ml-2">
                        <div className="h-full bg-[var(--brand-red)]" style={{ width: `${b.store_count > 0 ? (b.in_mall_count / b.store_count) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10.5px] text-[var(--brand-red)] font-medium bg-[var(--brand-red-light)] rounded px-2 py-1 inline-block">
                      {t('brands.white_space')}
                    </div>
                  )}

                  {b.notes && (
                    <div className="mt-2 pt-2 border-t border-[var(--brand-border)] text-[10.5px] text-[var(--brand-ink)]/60 italic leading-snug">
                      {b.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
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
