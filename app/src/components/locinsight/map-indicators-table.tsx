'use client'

/**
 * MapIndicatorsTable — combined indicators table at the bottom of Map Explorer.
 *
 * Shows ALL opportunities (kelurahan) with every indicator:
 *   - kelurahan / kecamatan / kabupaten / tier
 *   - composite score + recommendation
 *   - market share / daily customers / monthly revenue
 *   - population / income / tourism / transport / POI density
 *   - nearest mall + distance
 *   - competitors within 2 km / MAP stores within 2 km
 *   - cannibalization risk
 *
 * Features:
 *   • Per-column sort (asc/desc/none — click header cycles)
 *   • Per-column text filter
 *   • Global search box
 *   • Tier + recommendation filter
 *   • Auto-filter to selected kelurahan when a point is picked on the map
 *     (no selection = show ALL data — per user request Aug 2026)
 *   • Export current filtered view as CSV with column picker
 *
 * Mirrors the UX of the Data Manager table view.
 */

import { useMemo, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Search, Download, ArrowUpDown, ArrowUp, ArrowDown, Filter as FilterIcon, Database, X, Check,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import type { OpportunityScore, Store, Mall } from './types'

interface MapIndicatorsTableProps {
  opportunities: OpportunityScore[]
  stores: Store[]
  malls: Mall[]
  competitors: any[]
  /** When set, the table auto-filters to just this kelurahan. When null, shows ALL rows. */
  selectedKelurahanId?: string | null
  /** Optional callback to clear the selection (shows the "Clear selection" button). */
  onClearSelection?: () => void
}

type SortDir = 'asc' | 'desc' | null

interface ColumnDef {
  key: string
  labelKey: string
  type?: 'text' | 'number'
  width?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'kelurahan_name', labelKey: 'map.table.col.kelurahan', type: 'text', width: 'min-w-[160px]' },
  { key: 'kec_name', labelKey: 'map.table.col.kecamatan', type: 'text', width: 'min-w-[140px]' },
  { key: 'kab_name', labelKey: 'map.table.col.kabupaten', type: 'text', width: 'min-w-[120px]' },
  { key: 'tier', labelKey: 'map.table.col.tier', type: 'number', width: 'w-[60px]' },
  { key: 'composite_score', labelKey: 'map.table.col.score', type: 'number', width: 'w-[90px]' },
  { key: 'recommendation', labelKey: 'map.table.col.recommendation', type: 'text', width: 'min-w-[120px]' },
  { key: 'potential_market_share', labelKey: 'map.table.col.market_share', type: 'number', width: 'w-[100px]' },
  { key: 'estimated_daily_customers', labelKey: 'map.table.col.daily_cust', type: 'number', width: 'w-[100px]' },
  { key: 'projected_monthly_revenue_juta', labelKey: 'map.table.col.monthly_rev', type: 'number', width: 'w-[120px]' },
  { key: 'population', labelKey: 'map.table.col.population', type: 'number', width: 'w-[110px]' },
  { key: 'income_index', labelKey: 'map.table.col.income_idx', type: 'number', width: 'w-[100px]' },
  { key: 'tourist_index', labelKey: 'map.table.col.tourism_idx', type: 'number', width: 'w-[100px]' },
  { key: 'transport_index', labelKey: 'map.table.col.transport_idx', type: 'number', width: 'w-[100px]' },
  { key: 'poi_density_index', labelKey: 'map.table.col.poi_density_idx', type: 'number', width: 'w-[100px]' },
  { key: 'nearest_mall_name', labelKey: 'map.table.col.nearest_mall', type: 'text', width: 'min-w-[160px]' },
  { key: 'nearest_mall_distance_km', labelKey: 'map.table.col.mall_distance', type: 'number', width: 'w-[100px]' },
  { key: 'competitors_2km', labelKey: 'map.table.col.competitors_2km', type: 'number', width: 'w-[110px]' },
  { key: 'stores_2km', labelKey: 'map.table.col.stores_2km', type: 'number', width: 'w-[110px]' },
  { key: 'cannibalization_risk', labelKey: 'map.table.col.cannibalization', type: 'text', width: 'min-w-[120px]' },
]

// Haversine distance
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const REC_COLORS: Record<string, string> = {
  high_priority: 'bg-red-50 text-red-700 border-red-200',
  priority: 'bg-orange-50 text-orange-700 border-orange-200',
  monitor: 'bg-amber-50 text-amber-700 border-amber-200',
  avoid: 'bg-gray-50 text-gray-600 border-gray-200',
}

const CANNIBALIZATION_COLORS: Record<string, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
}

export function MapIndicatorsTable({
  opportunities,
  stores,
  malls,
  competitors,
  selectedKelurahanId = null,
  onClearSelection,
}: MapIndicatorsTableProps) {
  const { t } = useLanguage()
  const { data: session } = useSession()
  // Aug 2026: viewer role cannot use any export options (read-only).
  const canExport = session?.user?.role === 'superadmin' || session?.user?.role === 'analyst'
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [recFilter, setRecFilter] = useState<string>('all')
  const [sortCol, setSortCol] = useState<string | null>('composite_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // Export column-picker state
  const [showExportPopover, setShowExportPopover] = useState(false)
  const [exportCols, setExportCols] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key))) // default: all

  // Reset text search/filter when selection changes (so the auto-filter is the dominant view)
  useEffect(() => {
    if (selectedKelurahanId) {
      setSearch('')
      setColFilters({})
    }
  }, [selectedKelurahanId])

  // Enrich opportunities with population/density info from factors + nearby counts
  const enriched = useMemo(() => {
    return opportunities.map(o => {
      const factorMap: Record<string, number> = {}
      for (const f of o.factors) {
        factorMap[f.name.toLowerCase()] = f.raw_value
      }
      // Count nearby within 2 km
      let comp2km = 0
      for (const c of competitors) {
        if (c.lat && c.lng && haversineKm(o.lat, o.lng, c.lat, c.lng) <= 2) comp2km++
      }
      let stores2km = 0
      for (const s of stores) {
        if (haversineKm(o.lat, o.lng, s.lat, s.lng) <= 2) stores2km++
      }
      return {
        ...o,
        population: factorMap['population'] ?? null,
        income_index: factorMap['income'] ?? null,
        tourist_index: factorMap['tourism'] ?? null,
        transport_index: factorMap['accessibility'] ?? null,
        poi_density_index: factorMap['density'] ?? null,
        competitors_2km: comp2km,
        stores_2km: stores2km,
      }
    })
  }, [opportunities, competitors, stores])

  // Auto-filter: if a kelurahan is selected on the map, the table filters to just that row.
  // If no selection, the table shows ALL data (per user request).
  const selectedOpp = useMemo(() => {
    if (!selectedKelurahanId) return null
    return enriched.find(o => o.kelurahan_id === selectedKelurahanId) || null
  }, [enriched, selectedKelurahanId])

  // Apply filters
  const filtered = useMemo(() => {
    let r = enriched
    // Auto-filter to selected kelurahan (highest priority — overrides other filters)
    if (selectedKelurahanId) {
      r = r.filter(o => o.kelurahan_id === selectedKelurahanId)
    } else {
      if (tierFilter !== 'all') r = r.filter(o => o.tier === Number(tierFilter))
      if (recFilter !== 'all') r = r.filter(o => o.recommendation === recFilter)
      if (search) {
        const q = search.toLowerCase()
        r = r.filter(o => `${o.kelurahan_name} ${o.kec_name} ${o.kab_name}`.toLowerCase().includes(q))
      }
      if (Object.keys(colFilters).length > 0) {
        r = r.filter(row => {
          for (const [k, v] of Object.entries(colFilters)) {
            if (!v) continue
            const cellVal = (row as any)[k]
            if (cellVal == null) return false
            if (!String(cellVal).toLowerCase().includes(v.toLowerCase())) return false
          }
          return true
        })
      }
    }
    return r
  }, [enriched, selectedKelurahanId, tierFilter, recFilter, search, colFilters])

  // Apply sort
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = (a as any)[sortCol]
      const vb = (b as any)[sortCol]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb)) * dir
    })
  }, [filtered, sortCol, sortDir])

  function toggleSort(colKey: string) {
    if (sortCol !== colKey) {
      setSortCol(colKey)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortCol(null)
      setSortDir(null)
    } else {
      setSortCol(colKey)
      setSortDir('asc')
    }
  }

  function resetFilters() {
    setSearch('')
    setTierFilter('all')
    setRecFilter('all')
    setColFilters({})
    setSortCol('composite_score')
    setSortDir('desc')
  }

  function toggleExportCol(key: string) {
    setExportCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllExportCols() {
    setExportCols(new Set(COLUMNS.map(c => c.key)))
  }

  function clearAllExportCols() {
    setExportCols(new Set())
  }

  function exportCSV(usePicker: boolean = false) {
    const colsToExport = usePicker
      ? COLUMNS.filter(c => exportCols.has(c.key))
      : COLUMNS
    if (colsToExport.length === 0) return
    const headers = colsToExport.map(c => t(c.labelKey))
    const lines = [headers.join(',')]
    for (const r of sorted) {
      const cells = colsToExport.map(c => {
        const v = (r as any)[c.key]
        if (v == null) return ''
        const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v)
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      })
      lines.push(cells.join(','))
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const colTag = usePicker ? `_${colsToExport.length}cols` : ''
    a.download = `locinsight_all_indicators_${sorted.length}rows${colTag}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportPopover(false)
  }

  const isFiltered = search !== '' || tierFilter !== 'all' || recFilter !== 'all' || Object.values(colFilters).some(v => v)
  // Disable manual filter UI when a kelurahan is selected (auto-filter takes over)
  const filtersDisabled = !!selectedKelurahanId

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[var(--brand-red)]" />
            {t('map.table.title')}
            <Badge variant="secondary" className="text-[10px]">{sorted.length} / {enriched.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand-ink)]/40" />
              <Input
                placeholder={t('map.table.search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={filtersDisabled}
                className="h-7 pl-7 w-[180px] sm:w-[220px] text-[12px] disabled:opacity-50"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter} disabled={filtersDisabled}>
              <SelectTrigger className="h-7 w-[100px] text-[11px] disabled:opacity-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')} tier</SelectItem>
                <SelectItem value="1">Tier 1</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recFilter} onValueChange={setRecFilter} disabled={filtersDisabled}>
              <SelectTrigger className="h-7 w-[140px] text-[11px] disabled:opacity-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')} rec</SelectItem>
                <SelectItem value="high_priority">{t('map.rec.high_priority')}</SelectItem>
                <SelectItem value="priority">{t('map.rec.priority')}</SelectItem>
                <SelectItem value="monitor">{t('map.rec.monitor')}</SelectItem>
                <SelectItem value="avoid">{t('map.rec.avoid')}</SelectItem>
              </SelectContent>
            </Select>
            {isFiltered && !filtersDisabled && (
              <Button size="sm" variant="outline" onClick={resetFilters} className="h-7 text-[11px]">
                <FilterIcon className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
            {/* Quick export — uses current column selection (defaults to all) */}
            {canExport && (
              <Button
                size="sm"
                onClick={() => exportCSV(true)}
                disabled={sorted.length === 0 || exportCols.size === 0}
                className="h-7 text-[11px] bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
                title={t('map.table.export_with_cols', { n: sorted.length, cols: exportCols.size })}
              >
                <Download className="w-3 h-3 mr-1" />
                {t('map.table.export_filtered', { n: sorted.length })}
              </Button>
            )}
            {/* Column picker button — opens POPOVER anchored to the button
                (not a centered dialog, which appeared awkwardly below the map) */}
            {canExport && (
            <Popover open={showExportPopover} onOpenChange={setShowExportPopover}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] border-[var(--brand-red)]/30 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10"
                  title={t('map.table.export_picker_subtitle')}
                >
                  <FilterIcon className="w-3 h-3 mr-1" />
                  {exportCols.size}/{COLUMNS.length}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-[340px] max-h-[480px] overflow-y-auto p-3 scroll-styled"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-semibold text-[var(--brand-ink)] flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                    {t('map.table.export_picker_title')}
                  </div>
                  <Badge variant="outline" className="text-[9.5px]">
                    {t('map.table.selected_cols_count', { n: exportCols.size })}
                  </Badge>
                </div>
                <p className="text-[10.5px] text-[var(--brand-ink)]/60 mb-2 leading-relaxed">
                  {t('map.table.export_picker_subtitle')}
                </p>
                <div className="flex gap-1.5 mb-2">
                  <Button size="sm" variant="outline" onClick={selectAllExportCols} className="h-6 text-[10px] flex-1">
                    <Check className="w-3 h-3 mr-1" /> {t('map.table.select_all_cols')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearAllExportCols} className="h-6 text-[10px] flex-1">
                    <X className="w-3 h-3 mr-1" /> {t('map.table.clear_all_cols')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1 max-h-[280px] overflow-y-auto scroll-styled pr-0.5">
                  {COLUMNS.map(c => {
                    const checked = exportCols.has(c.key)
                    return (
                      <label
                        key={c.key}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer text-[11px] transition-colors ${
                          checked
                            ? 'border-[var(--brand-red)]/40 bg-[var(--brand-red)]/5 text-[var(--brand-ink)]'
                            : 'border-[var(--brand-border)] text-[var(--brand-ink)]/70 hover:bg-[var(--brand-cream)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExportCol(c.key)}
                          className="w-3.5 h-3.5 accent-[var(--brand-red)]"
                        />
                        <span className="flex-1 truncate">{t(c.labelKey)}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-[var(--brand-border)]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExportPopover(false)}
                    className="h-7 text-[11px] flex-1"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => exportCSV(true)}
                    disabled={exportCols.size === 0 || sorted.length === 0}
                    className="h-7 text-[11px] bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] flex-1"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {t('map.table.export_with_cols', { n: sorted.length, cols: exportCols.size })}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            )}
          </div>
        </div>
        {/* Subtitle: shows whether we're showing all data or filtered to selection */}
        <div className="text-[10.5px] text-[var(--brand-ink)]/55 mt-1">
          {selectedOpp ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9.5px] border-[var(--brand-red)]/40 text-[var(--brand-red)] bg-[var(--brand-red)]/5">
                {t('map.table.filtered_to', { name: selectedOpp.kelurahan_name, kec: selectedOpp.kec_name, kab: selectedOpp.kab_name, n: sorted.length })}
              </Badge>
              {onClearSelection && (
                <button
                  onClick={onClearSelection}
                  className="text-[10px] text-[var(--brand-ink)]/60 hover:text-[var(--brand-red)] underline-offset-2 hover:underline"
                >
                  {t('map.table.clear_selection')}
                </button>
              )}
            </span>
          ) : (
            <>
              {t('map.table.showing_all', { n: enriched.length })}{' '}
              <span className="text-[var(--brand-ink)]/40">{t('map.table.click_anywhere_hint')}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[500px] border border-[var(--brand-border)] rounded scroll-styled">
          <table className="text-[11px] border-collapse min-w-max">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[var(--brand-border)]">
                {COLUMNS.map(c => {
                  const isSorted = sortCol === c.key
                  const SortIcon = !isSorted ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={c.key}
                      className={`text-left px-2 py-2 font-semibold text-[var(--brand-ink)]/70 uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-[var(--brand-border)] last:border-r-0 ${c.width || 'min-w-[100px]'}`}
                    >
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="flex items-center gap-1 hover:text-[var(--brand-red)]"
                      >
                        {t(c.labelKey)}
                        <SortIcon className={`w-3 h-3 ${isSorted ? 'text-[var(--brand-red)]' : 'text-[var(--brand-ink)]/40'}`} />
                      </button>
                    </th>
                  )
                })}
              </tr>
              <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-cream)]/30">
                {COLUMNS.map(c => (
                  <th key={c.key} className="px-1 py-1">
                    <input
                      type="text"
                      value={colFilters[c.key] || ''}
                      onChange={e => setColFilters(prev => ({ ...prev, [c.key]: e.target.value }))}
                      disabled={filtersDisabled}
                      placeholder={t('data.filter_placeholder')}
                      className="text-[10px] px-1 py-0.5 border border-[var(--brand-border)] rounded w-full bg-white disabled:opacity-50"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} className="py-8 text-center text-[var(--brand-ink)]/40">{t('map.table.empty')}</td></tr>
              ) : (
                sorted.map((row, i) => (
                  <tr key={row.kelurahan_id + i} className={`border-b border-[var(--brand-border)]/50 hover:bg-[var(--brand-cream)]/50 ${selectedKelurahanId === row.kelurahan_id ? 'bg-[var(--brand-red)]/5' : ''}`}>
                    {COLUMNS.map(c => {
                      const v = (row as any)[c.key]
                      return (
                        <td
                          key={c.key}
                          className="px-2 py-1.5 whitespace-nowrap border-r border-[var(--brand-border)]/30 last:border-r-0 align-top"
                        >
                          {renderCell(c.key, v)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )

  function renderCell(key: string, value: any): React.ReactNode {
    if (value == null || value === '') return '—'
    if (key === 'recommendation') {
      const cls = REC_COLORS[value] || ''
      const label = t(`map.rec.${value}`)
      return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-medium border ${cls}`}>{label}</span>
    }
    if (key === 'cannibalization_risk') {
      const cls = CANNIBALIZATION_COLORS[value] || ''
      return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-medium border capitalize ${cls}`}>{value}</span>
    }
    if (key === 'composite_score') {
      const color = value >= 70 ? '#dc2626' : value >= 55 ? '#f59e0b' : value >= 40 ? '#a78bfa' : '#9ca3af'
      return <strong style={{ color }} className="num-tabular">{value}</strong>
    }
    if (key === 'potential_market_share') {
      return <span className="num-tabular">{(value * 100).toFixed(1)}%</span>
    }
    if (key === 'projected_monthly_revenue_juta') {
      return <span className="num-tabular text-[var(--brand-red)] font-medium">{value} jt</span>
    }
    if (typeof value === 'number') {
      return <span className="num-tabular">{value.toLocaleString()}</span>
    }
    if (typeof value === 'string' && value.length > 50) {
      return value.slice(0, 47) + '…'
    }
    return String(value)
  }
}
