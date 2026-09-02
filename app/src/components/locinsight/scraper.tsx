'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Search, MapPin, Database, Loader2, CheckCircle2, XCircle, Clock, ExternalLink,
  Save, Filter, AlertTriangle, CheckSquare, Square, Shield, Store as StoreIcon, HelpCircle, Globe2,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { COMPETITOR_BRANDS } from '@/lib/data/competitor-brands'
import { BRANDS } from '@/lib/data/brands'
import { classifyScrapedBrand, type SaveTarget } from '@/lib/brand-classifier'
import { useLanguage } from '@/lib/i18n/language-provider'

// ============================================================================
// Types
// ============================================================================

interface ScraperResult {
  name: string
  type: string
  lat: number
  lng: number
  category: string
  kind: 'store' | 'mall' | 'poi'
  tags: Record<string, string>
  on_land: boolean
  address?: string
  brand_name?: string
  brand_category?: string
  poi_type?: string
  poi_magnitude?: number
  poi_notes?: string
  source: string
}

interface ScraperRun {
  id: string
  query: string
  source: string
  status: string
  found_count: number
  saved_count: number
  startedAt: string
  finishedAt: string | null
}

interface Geocoded {
  lat: number
  lng: number
  display_name: string
  is_in_bali: boolean
  address?: any
}

type Mode = 'keyword' | 'brand'
type KindFilter = 'all' | 'store' | 'mall' | 'poi' | 'on_land' | 'off_land'

interface LocationOption {
  code: string
  name: string
  type?: string
  kab_code?: string
  kabupaten_code?: string
  kec_code?: string
  kab_name?: string
  kec_name?: string
  province_code?: string
  province?: string
  country_id?: string
  country?: string
  lat?: number
  lng?: number
}

interface CountryOption {
  id: string
  name: string
  iso2?: string
  iso3?: string
}

// ============================================================================
// Component
// ============================================================================

export function Scraper() {
  const { t } = useLanguage()
  // Mode + query state
  const [mode, setMode] = useState<Mode>('keyword')
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<{ store: boolean; mall: boolean; poi: boolean }>({
    store: true, mall: true, poi: true,
  })
  const [radius, setRadius] = useState('5')

  // Brand sweep state
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])

  // Hierarchical location filter — full 5-level cascade:
  //   Country → Province → Kabupaten → Kecamatan → Kelurahan
  const [countryList, setCountryList] = useState<CountryOption[]>([])
  const [provinceList, setProvinceList] = useState<LocationOption[]>([])
  const [kabupatenList, setKabupatenList] = useState<LocationOption[]>([])
  const [kecamatanList, setKecamatanList] = useState<LocationOption[]>([])
  const [kelurahanList, setKelurahanList] = useState<LocationOption[]>([])
  const [selCountry, setSelCountry] = useState<string>('ID') // default to Indonesia
  const [selProvince, setSelProvince] = useState<string>('51') // default to Bali (BPS code 51)
  const [selKab, setSelKab] = useState<string>('')
  const [selKec, setSelKec] = useState<string>('')
  const [selKel, setSelKel] = useState<string>('')

  // Results state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<ScraperResult[]>([])
  const [geo, setGeo] = useState<Geocoded | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [scrapeMeta, setScrapeMeta] = useState<any>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterKind, setFilterKind] = useState<KindFilter>('all')
  const [history, setHistory] = useState<ScraperRun[]>([])

  // Load locations once on mount
  useEffect(() => {
    fetch('/api/locinsight/locations')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setCountryList(j.data.countries || [])
          setProvinceList(j.data.provinces || [])
          setKabupatenList(j.data.kabupaten || [])
          // pre-load all kecamatan + all kelurahan for snappy UX (Bali is small)
          setKecamatanList(j.data.kecamatan || [])
          setKelurahanList(j.data.kelurahan || [])
          // Auto-select Indonesia + Bali if present (sensible default)
          const indo = (j.data.countries || []).find((c: CountryOption) => c.id === 'ID' || c.iso2 === 'ID')
          if (indo) setSelCountry(indo.id)
          const bali = (j.data.provinces || []).find((p: LocationOption) => p.name === 'Bali')
          if (bali) setSelProvince(bali.code)
        }
      })
      .catch(() => {})
    fetchHistory()
  }, [])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/locinsight/scrape?limit=20')
      const json = await res.json()
      if (json.success) setHistory(json.data)
    } catch {}
  }

  // Reset downstream selectors when parent changes
  function onCountryChange(id: string) {
    setSelCountry(id)
    setSelProvince('')
    setSelKab('')
    setSelKec('')
    setSelKel('')
    // Re-fetch provinces for the selected country
    fetch(`/api/locinsight/locations?country_id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setProvinceList(j.data.provinces || [])
          setKabupatenList(j.data.kabupaten || [])
          setKecamatanList(j.data.kecamatan || [])
          setKelurahanList(j.data.kelurahan || [])
        }
      })
      .catch(() => {})
  }
  function onProvinceChange(code: string) {
    setSelProvince(code)
    setSelKab('')
    setSelKec('')
    setSelKel('')
    // Re-fetch kabupaten for the selected province
    fetch(`/api/locinsight/locations?province_code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setKabupatenList(j.data.kabupaten || [])
          setKecamatanList(j.data.kecamatan || [])
          setKelurahanList(j.data.kelurahan || [])
        }
      })
      .catch(() => {})
  }
  function onKabChange(code: string) {
    setSelKab(code)
    setSelKec('')
    setSelKel('')
  }
  function onKecChange(code: string) {
    setSelKec(code)
    setSelKel('')
  }

  // Build the location filter object for the API
  const locationFilter = useMemo(() => {
    if (selKel) return { kel_code: selKel }
    if (selKec) return { kec_code: selKec }
    if (selKab) return { kab_code: selKab }
    if (selProvince) return { province_code: selProvince }
    if (selCountry) return { country_id: selCountry }
    return undefined
  }, [selCountry, selProvince, selKab, selKec, selKel])

  const locationLabel = useMemo(() => {
    if (selKel) {
      const k = kelurahanList.find(x => x.code === selKel)
      return k ? `Kel. ${k.name}` : 'Kelurahan'
    }
    if (selKec) {
      const k = kecamatanList.find(x => x.code === selKec)
      return k ? `Kec. ${k.name}` : 'Kecamatan'
    }
    if (selKab) {
      const k = kabupatenList.find(x => x.code === selKab)
      return k ? `${k.type === 'Kota' ? 'Kota' : 'Kab.'} ${k.name}` : 'Kabupaten'
    }
    if (selProvince) {
      const p = provinceList.find(x => x.code === selProvince)
      return p ? `Prov. ${p.name}` : 'Province'
    }
    if (selCountry) {
      const c = countryList.find(x => x.id === selCountry)
      return c ? c.name : 'Country'
    }
    return t('scraper.location_bali_all')
  }, [selCountry, selProvince, selKab, selKec, selKel, countryList, provinceList, kabupatenList, kecamatanList, kelurahanList, t])

  // Filtered kabupaten/kecamatan/kelurahan based on parent selection
  // NOTE: kecamatan records from /api/locinsight/locations use `kabupaten_code`,
  // while kelurahan records use `kab_code`. We check both for robustness.
  const filteredKabupaten = useMemo(() => {
    if (!selProvince) return kabupatenList
    return kabupatenList.filter(k => k.province_code === selProvince)
  }, [kabupatenList, selProvince])

  const filteredKecamatan = useMemo(() => {
    if (!selKab) return kecamatanList
    return kecamatanList.filter(k => {
      const code = k.kabupaten_code ?? k.kab_code
      return code === selKab
    })
  }, [kecamatanList, selKab])

  const filteredKelurahan = useMemo(() => {
    if (!selKec) return kelurahanList
    return kelurahanList.filter(k => k.kec_code === selKec)
  }, [kelurahanList, selKec])

  // ============================================================================
  // Scrape action
  // ============================================================================

  async function scrape() {
    if (mode === 'keyword' && !query.trim()) {
      toast.error(t('scraper.toast_enter_query'))
      return
    }
    setLoading(true)
    setResults([])
    setGeo(null)
    setRunId(null)
    setScrapeMeta(null)
    setSelected(new Set())
    try {
      const body: any = {
        mode,
        location: locationFilter,
      }
      if (mode === 'keyword') {
        body.query = query
        body.radius_km = Number(radius)
        body.kinds = (['store', 'mall', 'poi'] as const).filter(k => kinds[k])
        if (body.kinds.length === 0) {
          toast.error(t('scraper.toast_select_type'))
          setLoading(false)
          return
        }
      } else {
        body.brands = selectedBrands.length > 0 ? selectedBrands : undefined
      }

      const res = await fetch('/api/locinsight/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        setGeo(json.geocoded)
        setResults(json.results || [])
        setRunId(json.run_id)
        setScrapeMeta(json.meta)
        const defaultSelected = new Set<number>()
        ;(json.results || []).forEach((r: ScraperResult, i: number) => {
          if (r.on_land) defaultSelected.add(i)
        })
        setSelected(defaultSelected)
        const foundN = json.total_found || (json.results || []).length
        toast.success(t('scraper.toast_found', { count: foundN, location: json.meta?.location_label || locationLabel }))
        fetchHistory()
      } else {
        toast.error(json.error || t('scraper.toast_scrape_failed'))
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // Selection helpers
  // ============================================================================

  function toggleSelected(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function selectAllVisible() {
    const indices: number[] = []
    for (let i = 0; i < results.length; i++) {
      if (matchesFilter(results[i])) indices.push(i)
    }
    setSelected(new Set(indices))
  }

  function selectAllOnLand() {
    const indices = new Set<number>()
    results.forEach((r, i) => { if (r.on_land) indices.add(i) })
    setSelected(indices)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function matchesFilter(r: ScraperResult): boolean {
    if (filterKind === 'all') return true
    if (filterKind === 'on_land') return r.on_land
    if (filterKind === 'off_land') return !r.on_land
    return r.kind === filterKind
  }

  const filteredResults = useMemo(() => {
    return results
      .map((r, originalIndex) => ({ r, originalIndex }))
      .filter(({ r }) => matchesFilter(r))
  }, [results, filterKind])

  // ============================================================================
  // Save action
  // ============================================================================

  async function saveSelected() {
    if (selected.size === 0) {
      toast.warning(t('scraper.toast_no_selected'))
      return
    }
    setSaving(true)
    try {
      const items = Array.from(selected).map(i => results[i])
      const res = await fetch('/api/locinsight/scrape-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId || undefined,
          query,
          items,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const s = json.saved
        const parts: string[] = []
        if (s.stores) parts.push(t('scraper.saved_maa_stores', { count: s.stores }))
        if (s.competitors) parts.push(t('scraper.saved_competitors', { count: s.competitors }))
        if (s.malls) parts.push(t('scraper.saved_malls', { count: s.malls }))
        if (s.pois) parts.push(t('scraper.saved_pois', { count: s.pois }))
        const duplicates = json.skipped ? t('scraper.toast_duplicates', { count: json.skipped }) : ''
        const errors = json.error_count ? t('scraper.toast_errors', { count: json.error_count }) : ''
        toast.success(
          t('scraper.toast_saved', { total: s.total, parts: parts.join(', ') || t('scraper.saved_none') }) +
          duplicates + errors
        )
        if (json.error_count > 0) {
          console.warn('Save errors:', json.errors)
        }
        setSelected(new Set())
        fetchHistory()
      } else {
        toast.error(json.error || t('scraper.toast_save_failed'))
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ============================================================================
  // Classification preview (shows user where each item will be saved)
  // ============================================================================

  const classifications = useMemo(() => {
    const map = new Map<string, { target: SaveTarget; brand_name: string; reason: string }>()
    for (const r of results) {
      if (r.kind !== 'store') continue
      const key = r.brand_name || r.name
      if (!map.has(key)) {
        const c = classifyScrapedBrand(r.brand_name || r.name)
        map.set(key, { target: c.target, brand_name: c.brand_name, reason: c.reason })
      }
    }
    return map
  }, [results])

  function getClassification(r: ScraperResult) {
    if (r.kind !== 'store') return null
    return classifications.get(r.brand_name || r.name) || null
  }

  // ============================================================================
  // Counts
  // ============================================================================

  const counts = useMemo(() => {
    let onLand = 0, offLand = 0, stores = 0, malls = 0, pois = 0
    let maaStores = 0, competitors = 0, others = 0
    for (const r of results) {
      if (r.on_land) onLand++; else offLand++
      if (r.kind === 'store') {
        stores++
        const c = getClassification(r)
        if (c?.target === 'maa_store') maaStores++
        else if (c?.target === 'competitor') competitors++
        else others++
      }
      else if (r.kind === 'mall') malls++
      else pois++
    }
    return { onLand, offLand, stores, malls, pois, total: results.length, maaStores, competitors, others }
  }, [results, classifications])

  const exampleQueries = [
    'Starbucks Kuta',
    'Mall Denpasar',
    'Canggu cafe',
    'Ubud restaurant',
    'Nusa Dua hotel',
    'Seminyak boutique',
    'Sanur Beach',
    'Jimbaran seafood',
  ]

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('scraper.title')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('scraper.subtitle_full')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* ============================================================ */}
        {/* LEFT: Search + Results                                       */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                {t('scraper.search_scrape')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-1 p-1 rounded-md bg-[var(--brand-cream)] border border-[var(--brand-border)]">
                <button
                  onClick={() => setMode('keyword')}
                  className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded ${mode === 'keyword' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-[var(--brand-ink)]/60'}`}
                >
                  <Search className="w-3 h-3 inline mr-1.5" />
                  {t('scraper.keyword_search')}
                </button>
                <button
                  onClick={() => setMode('brand')}
                  className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded ${mode === 'brand' ? 'bg-white shadow-sm text-[var(--brand-red)]' : 'text-[var(--brand-ink)]/60'}`}
                >
                  <Shield className="w-3 h-3 inline mr-1.5" />
                  {t('scraper.brand_sweep', { count: COMPETITOR_BRANDS.length })}
                </button>
              </div>

              {/* Hierarchical location filter — Country → Province → Kabupaten → Kecamatan → Kelurahan */}
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  {t('scraper.location_scope')} <span className="text-[var(--brand-red)] font-medium normal-case tracking-normal">{locationLabel}</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {/* Country */}
                  <select
                    value={selCountry}
                    onChange={(e) => onCountryChange(e.target.value)}
                    className="text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded bg-white"
                  >
                    <option value="">{t('scraper.all_countries')}</option>
                    {countryList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {/* Province */}
                  <select
                    value={selProvince}
                    onChange={(e) => onProvinceChange(e.target.value)}
                    disabled={!selCountry}
                    className="text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded bg-white disabled:opacity-50"
                  >
                    <option value="">{t('scraper.all_provinces')}</option>
                    {provinceList.map(p => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                  {/* Kabupaten */}
                  <select
                    value={selKab}
                    onChange={(e) => onKabChange(e.target.value)}
                    disabled={!selProvince}
                    className="text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded bg-white disabled:opacity-50"
                  >
                    <option value="">{t('scraper.all_kabupaten')}</option>
                    {filteredKabupaten.map(k => (
                      <option key={k.code} value={k.code}>
                        {k.type === 'Kota' ? 'Kota ' : 'Kab. '}{k.name}
                      </option>
                    ))}
                  </select>
                  {/* Kecamatan */}
                  <select
                    value={selKec}
                    onChange={(e) => onKecChange(e.target.value)}
                    disabled={!selKab}
                    className="text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded bg-white disabled:opacity-50"
                  >
                    <option value="">{t('scraper.all_kecamatan')}</option>
                    {filteredKecamatan.map(k => (
                      <option key={k.code} value={k.code}>{k.name}</option>
                    ))}
                  </select>
                  {/* Kelurahan */}
                  <select
                    value={selKel}
                    onChange={(e) => setSelKel(e.target.value)}
                    disabled={!selKec}
                    className="text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded bg-white disabled:opacity-50"
                  >
                    <option value="">{t('scraper.all_kelurahan')}</option>
                    {filteredKelurahan.map(k => (
                      <option key={k.code} value={k.code}>{k.name}</option>
                    ))}
                  </select>
                </div>
                <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">
                  {t('scraper.location_hint')}
                </div>
              </div>

              {/* Mode-specific inputs */}
              {mode === 'keyword' ? (
                <>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                      {t('scraper.query_label')}
                    </Label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && scrape()}
                      placeholder={t('scraper.query_placeholder')}
                      className="h-10 text-[13px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('scraper.types')}</Label>
                      <div className="flex gap-2 text-[12px]">
                        {(['store', 'mall', 'poi'] as const).map(k => (
                          <label key={k} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={kinds[k]}
                              onChange={(e) => setKinds(prev => ({ ...prev, [k]: e.target.checked }))}
                              className="rounded"
                            />
                            <span className="capitalize">{k}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('scraper.radius')}</Label>
                      <Input
                        type="number"
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                        min="1"
                        max="20"
                        className="h-9 text-[12px]"
                      />
                    </div>
                  </div>
                  {/* Example queries */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {exampleQueries.map(q => (
                      <button
                        key={q}
                        onClick={() => setQuery(q)}
                        className="text-[10.5px] px-2 py-1 rounded border border-[var(--brand-border)] bg-white hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/70"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                    {t('scraper.brands_to_scrape')} {selectedBrands.length > 0 && <span className="text-[var(--brand-red)]">{t('scraper.brands_selected', { count: selectedBrands.length })}</span>}
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto p-2 border border-[var(--brand-border)] rounded bg-white">
                    {COMPETITOR_BRANDS.map(b => (
                      <label key={b.name} className="flex items-center gap-1.5 text-[11.5px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(b.name)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedBrands(s => [...s, b.name])
                            else setSelectedBrands(s => s.filter(x => x !== b.name))
                          }}
                        />
                        <span>{b.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedBrands([])}>{t('scraper.clear')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedBrands(COMPETITOR_BRANDS.slice(0, 5).map(b => b.name))}>{t('scraper.top_5')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedBrands(COMPETITOR_BRANDS.map(b => b.name))}>{t('common.all')}</Button>
                  </div>
                </div>
              )}

              <Button
                onClick={scrape}
                disabled={loading}
                className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('scraper.scraping')}
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    {mode === 'keyword' ? t('scraper.scrape_now') : t('scraper.sweep_brands', { count: selectedBrands.length || COMPETITOR_BRANDS.length })}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {(geo || results.length > 0 || scrapeMeta) && (
            <Card className="card-premium">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                    {t('scraper.results_review')}
                  </CardTitle>
                  <div className="text-[11px] text-[var(--brand-ink)]/60 flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] h-4">{t('scraper.found_count', { count: counts.total })}</Badge>
                    <Badge variant="outline" className="text-[9px] h-4 text-green-700 border-green-300">{t('scraper.on_land_count', { count: counts.onLand })}</Badge>
                    {counts.offLand > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-amber-700 border-amber-300">{t('scraper.sea_count', { count: counts.offLand })}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scrapeMeta && (
                  <div className="p-2 rounded-md bg-[var(--brand-cream)] border border-[var(--brand-border)] text-[11px] text-[var(--brand-ink)]/70 flex flex-wrap gap-3">
                    <span><strong>{t('scraper.mode_label')}</strong> {scrapeMeta.mode === 'keyword' ? t('scraper.mode_keyword') : t('scraper.mode_brand')}</span>
                    <span><strong>{t('scraper.scope_label')}</strong> {scrapeMeta.location_label}</span>
                    {scrapeMeta.brands_with_data != null && (
                      <span><strong>{t('scraper.brands_with_data')}</strong> {scrapeMeta.brands_with_data} / {(scrapeMeta.brands_scraped || []).length}</span>
                    )}
                  </div>
                )}
                {geo && (
                  <div className="p-3 rounded-md bg-[var(--brand-cream)] border border-[var(--brand-border)] text-[12px]">
                    <div className="font-semibold">{geo.display_name}</div>
                    <div className="text-[11px] text-[var(--brand-ink)]/60 mt-0.5 flex items-center gap-2 flex-wrap">
                      <Badge variant={geo.is_in_bali ? 'default' : 'secondary'} className="text-[9px] h-4">
                        {geo.is_in_bali ? t('scraper.in_bali') : t('scraper.outside_bali')}
                      </Badge>
                      <span className="font-mono">{geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}</span>
                    </div>
                  </div>
                )}

                {/* Save-routing summary */}
                {results.length > 0 && (
                  <div className="p-2 rounded-md border border-[var(--brand-border)] bg-white text-[11px] flex flex-wrap gap-3 items-center">
                    <span className="font-medium text-[var(--brand-ink)]/70">{t('scraper.save_routing')}</span>
                    {counts.maaStores > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-blue-700 border-blue-300 bg-blue-50">
                        <StoreIcon className="w-2.5 h-2.5 mr-1" /> {t('scraper.route_stores', { count: counts.maaStores })}
                      </Badge>
                    )}
                    {counts.competitors > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-purple-700 border-purple-300 bg-purple-50">
                        <Shield className="w-2.5 h-2.5 mr-1" /> {t('scraper.route_competitors', { count: counts.competitors })}
                      </Badge>
                    )}
                    {counts.others > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-gray-700 border-gray-300 bg-gray-50">
                        <HelpCircle className="w-2.5 h-2.5 mr-1" /> {t('scraper.route_other', { count: counts.others })}
                      </Badge>
                    )}
                    {counts.malls > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-amber-700 border-amber-300 bg-amber-50">
                        <Building2 className="w-2.5 h-2.5 mr-1" /> {t('scraper.route_malls', { count: counts.malls })}
                      </Badge>
                    )}
                    {counts.pois > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 text-green-700 border-green-300 bg-green-50">
                        <MapPin className="w-2.5 h-2.5 mr-1" /> {t('scraper.route_pois', { count: counts.pois })}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Selection toolbar */}
                {results.length > 0 && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-[var(--brand-border)] bg-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-[var(--brand-ink)]/60">
                        <strong className="text-[var(--brand-red)]">{selected.size}</strong> {t('scraper.selected_word')}
                      </span>
                      <Button size="sm" variant="ghost" onClick={selectAllOnLand} className="h-6 text-[10px] px-2">
                        <CheckSquare className="w-3 h-3 mr-1" /> {t('scraper.all_on_land')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={selectAllVisible} className="h-6 text-[10px] px-2">
                        <CheckSquare className="w-3 h-3 mr-1" /> {t('scraper.all_visible')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearSelection} className="h-6 text-[10px] px-2">
                        <Square className="w-3 h-3 mr-1" /> {t('scraper.clear')}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={saveSelected}
                      disabled={saving || selected.size === 0}
                      className="h-7 text-[11px] bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
                    >
                      {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                      {t('scraper.save_selected', { count: selected.size })}
                    </Button>
                  </div>
                )}

                {/* Filter pills */}
                {results.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter className="w-3 h-3 text-[var(--brand-ink)]/40" />
                    {(['all','store','mall','poi','on_land','off_land'] as const).map(f => {
                      const labels: Record<string, string> = {
                        all: t('scraper.filter_all', { count: counts.total }),
                        store: t('scraper.filter_stores', { count: counts.stores }),
                        mall: t('scraper.filter_malls', { count: counts.malls }),
                        poi: t('scraper.filter_pois', { count: counts.pois }),
                        on_land: t('scraper.filter_on_land', { count: counts.onLand }),
                        off_land: t('scraper.filter_sea', { count: counts.offLand }),
                      }
                      const isOff = f === 'off_land' && counts.offLand === 0
                      return (
                        <button
                          key={f}
                          onClick={() => setFilterKind(f)}
                          disabled={isOff}
                          className={`text-[10.5px] px-2 py-0.5 rounded border ${
                            filterKind === f
                              ? 'bg-[var(--brand-red)] text-white border-[var(--brand-red)]'
                              : 'bg-white text-[var(--brand-ink)]/70 border-[var(--brand-border)] hover:bg-[var(--brand-cream)]'
                          } ${isOff ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {labels[f]}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Result rows */}
                <div className="max-h-[600px] overflow-y-auto space-y-1.5">
                  {filteredResults.map(({ r, originalIndex }) => {
                    const isSelected = selected.has(originalIndex)
                    const cls = getClassification(r)
                    return (
                      <div
                        key={originalIndex}
                        className={`flex items-start gap-2 p-2 rounded border ${
                          isSelected
                            ? 'border-[var(--brand-red)] bg-[var(--brand-red)]/5'
                            : r.on_land
                              ? 'border-[var(--brand-border)] bg-white'
                              : 'border-amber-200 bg-amber-50/50'
                        }`}
                      >
                        <button
                          onClick={() => toggleSelected(originalIndex)}
                          disabled={!r.on_land}
                          className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                            !r.on_land
                              ? 'border-amber-300 bg-amber-100 cursor-not-allowed'
                              : isSelected
                                ? 'bg-[var(--brand-red)] border-[var(--brand-red)]'
                                : 'border-[var(--brand-border)] bg-white hover:border-[var(--brand-red)]'
                          }`}
                          title={r.on_land ? (isSelected ? t('scraper.tooltip_selected') : t('scraper.tooltip_click_select')) : t('scraper.tooltip_cannot_save')}
                        >
                          {isSelected && r.on_land && <CheckCircle2 className="w-3 h-3 text-white" />}
                          {!r.on_land && <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium truncate">{r.name}</div>
                          <div className="text-[10.5px] text-[var(--brand-ink)]/60">{r.category}</div>
                          <div className="text-[10px] text-[var(--brand-ink)]/40 mt-0.5 font-mono">
                            {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                            {!r.on_land && <span className="text-amber-700 ml-1">{t('scraper.in_sea_cannot_save')}</span>}
                            {r.address && <span className="ml-1">· {r.address.slice(0, 50)}</span>}
                          </div>
                          {/* Classification badge for store items */}
                          {cls && (
                            <div className="text-[9.5px] mt-0.5">
                              {cls.target === 'maa_store' && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  <StoreIcon className="w-2.5 h-2.5" /> {t('scraper.route_stores_badge')}
                                </span>
                              )}
                              {cls.target === 'competitor' && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  <Shield className="w-2.5 h-2.5" /> {t('scraper.route_competitors_badge')}
                                </span>
                              )}
                              {cls.target === 'other' && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">
                                  <HelpCircle className="w-2.5 h-2.5" /> {t('scraper.route_other_badge')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] h-4 capitalize">{r.kind}</Badge>
                      </div>
                    )
                  })}
                  {results.length > 0 && filteredResults.length === 0 && (
                    <div className="text-[12px] text-[var(--brand-ink)]/40 py-6 text-center">{t('scraper.no_results')}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT: History + info                                        */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
                {t('scraper.history')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-[12px] text-[var(--brand-ink)]/40 py-6 text-center">{t('scraper.no_scrapes')}</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.map(h => (
                    <div key={h.id} className="p-2 rounded border border-[var(--brand-border)] bg-white text-[11.5px]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium truncate flex-1">{h.query}</span>
                        <Badge variant={h.status === 'success' ? 'default' : 'secondary'} className="text-[9px] h-4 ml-1">
                          {h.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-[var(--brand-ink)]/50">
                        {new Date(h.startedAt).toLocaleString()} · {t('scraper.history_found', { count: h.found_count })} · {t('scraper.history_saved', { count: h.saved_count })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-premium bg-[var(--brand-cream)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                {t('scraper.how_it_works')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11.5px] text-[var(--brand-ink)]/70 space-y-2">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--brand-red)] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <div><strong>{t('scraper.step_1_label')}</strong> {t('scraper.step_1_body')}</div>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--brand-red)] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                <div><strong>{t('scraper.step_2_label')}</strong> {t('scraper.step_2_body')}</div>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--brand-red)] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                <div><strong>{t('scraper.step_3_label')}</strong> {t('scraper.step_3_body_pre')}<span className="text-amber-700 font-medium">{t('scraper.in_sea_quote')}</span>{t('scraper.step_3_body_post')}</div>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--brand-red)] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                <div><strong>{t('scraper.step_4_label')}</strong> {t('scraper.step_4_body_1')} <code>stores</code> {t('scraper.step_4_body_2')} <code>competitor_stores</code> {t('scraper.step_4_body_3')} <code>malls</code>{t('scraper.step_4_body_4')} <code>pois</code>.</div>
              </div>
              <div className="pt-2 mt-2 border-t border-[var(--brand-border)] text-[10px] text-[var(--brand-ink)]/50">
                {t('scraper.rate_limit_note_pre')} <code>source</code> {t('scraper.rate_limit_note_post')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
