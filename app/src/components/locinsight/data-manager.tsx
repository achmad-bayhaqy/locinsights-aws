'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Database, Plus, Edit, Trash2, Search, Store as StoreIcon, Building2, Tag, MapPin, Map,
  RefreshCw, Upload, Download, FileSpreadsheet, Save, X, Check, AlertTriangle, FileDown,
  Shield, Globe, Flag, ArrowUp, ArrowDown, ArrowUpDown, Filter as FilterIcon, FileUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-provider'

type EntityType = 'stores' | 'malls' | 'brands' | 'competitors' | 'kelurahan' | 'pois' | 'kabupaten' | 'kecamatan' | 'provinces' | 'countries'

interface EntityMeta {
  id: EntityType
  label: string // i18n key, e.g. 'data.stores'
  icon: any
  searchFields: string[]
}

const ENTITIES: EntityMeta[] = [
  // Geographic hierarchy: Country → Province → Kabupaten/Kota → Kecamatan → Kelurahan
  { id: 'countries',    label: 'data.countries',     icon: Globe,    searchFields: ['name'] },
  { id: 'provinces',    label: 'data.provinces',     icon: Flag,     searchFields: ['name', 'country'] },
  { id: 'kabupaten',    label: 'data.kabupaten_kota', icon: Map,      searchFields: ['name', 'capital'] },
  { id: 'kecamatan',    label: 'data.kecamatan',     icon: Map,      searchFields: ['name'] },
  { id: 'kelurahan',    label: 'data.kelurahan',     icon: MapPin,   searchFields: ['name', 'kec_name', 'kab_name'] },
  // Master data
  { id: 'brands',       label: 'data.brands',        icon: Tag,      searchFields: ['name'] },
  { id: 'malls',        label: 'data.malls',         icon: Building2, searchFields: ['name'] },
  // Operational data
  { id: 'stores',       label: 'data.stores',        icon: StoreIcon, searchFields: ['name', 'brand_name'] },
  { id: 'competitors',  label: 'data.competitors',   icon: Shield,   searchFields: ['name', 'brand_name', 'kab'] },
  { id: 'pois',         label: 'data.pois',          icon: MapPin,   searchFields: ['name'] },
  // Note: POIs include all sub-types (Beaches, Temples, Attractions, Hotels,
  // Universities, Hospitals, Transit Hubs, Ports, Office/Govt Clusters).
  // Use the POI Type filter dropdown or quick-access chips to view specific types.
]

export function DataManager() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  // Per user request (Aug 2026): viewer role cannot use ANY export/import options.
  // Only superadmin and analyst can export/import. Viewer is read-only.
  const canExport = session?.user?.role === 'superadmin' || session?.user?.role === 'analyst'
  const [activeEntity, setActiveEntity] = useState<EntityType>('stores')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [viewMode, setViewMode] = useState<'table' | 'spreadsheet'>('table')

  // Spreadsheet state
  const [draft, setDraft] = useState<Record<string, any> | null>(null) // changed cells: { rowIndex: { field: value } }
  const [savingBulk, setSavingBulk] = useState(false)

  // Export column-picker state
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv')
  const [selectedExportCols, setSelectedExportCols] = useState<Set<string>>(new Set())

  // Import column-picker state (NEW Aug 2026 — "Import Selection Columns")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFormat, setImportFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [selectedImportCols, setSelectedImportCols] = useState<Set<string>>(new Set())
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importValidating, setImportValidating] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  // POI type filter (when activeEntity === 'pois')
  const [poiTypeFilter, setPoiTypeFilter] = useState<string>('all')

  // Table view sort + per-column filter state (client-side, on ALL data — not just current page)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // Field config (declared early so useMemos below can reference it)
  const fieldConfig = getFieldConfig(activeEntity)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        // Fetch up to 5000 rows so client-side per-column filters apply to
        // the FULL dataset, not just the current page (per user request Aug 2026).
        // For very large tables, the API caps at 5000 anyway.
        page_size: '5000',
      })
      if (search) params.set('search', search)
      // POI type filter (server-side)
      if (activeEntity === 'pois' && poiTypeFilter !== 'all') {
        params.set('type', poiTypeFilter)
      }
      const res = await fetch(`/api/locinsight/${activeEntity}?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setTotal(json.total)
        setTotalPages(json.totalPages)
      } else {
        toast.error(json.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeEntity, search, page, poiTypeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
    setDraft(null)
    setSortCol(null)
    setSortDir(null)
    setColFilters({})
    setPoiTypeFilter('all')
    // Reset import dialog state when entity changes
    setShowImportDialog(false)
    setImportFile(null)
    setSelectedImportCols(new Set())
  }, [activeEntity, search])

  function openCreate() {
    setEditing({})
    setEditMode('create')
    setShowDialog(true)
  }

  function openEdit(row: any) {
    const { brand, mall, stores, Kecamatan, ...rest } = row
    setEditing(rest)
    setEditMode('edit')
    setShowDialog(true)
  }

  async function save() {
    if (!editing) return
    try {
      const isEdit = editMode === 'edit' && (editing.id || editing.code)
      // For entities that use `code` as the primary key
      const codeKeyedEntities: EntityType[] = ['kabupaten', 'kecamatan', 'provinces', 'countries']
      const idField = codeKeyedEntities.includes(activeEntity) ? editing.code : editing.id
      const url = isEdit
        ? `/api/locinsight/${activeEntity}/${encodeURIComponent(idField)}`
        : `/api/locinsight/${activeEntity}`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(isEdit ? t('data.record_updated') : t('data.record_created'))
        setShowDialog(false)
        setEditing(null)
        fetchData()
      } else {
        toast.error(json.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function remove(row: any) {
    const codeKeyedEntities: EntityType[] = ['kabupaten', 'kecamatan', 'provinces', 'countries']
    const idField = codeKeyedEntities.includes(activeEntity) ? row.code : row.id
    if (!confirm(t('data.delete_confirm', { name: row.name || row.code }))) return
    try {
      const res = await fetch(`/api/locinsight/${activeEntity}/${encodeURIComponent(idField)}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(t('data.record_deleted'))
        fetchData()
      } else {
        toast.error(json.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // =========================
  // Spreadsheet mode handlers
  // =========================

  function setCell(rowIndex: number, field: string, value: any) {
    setData(prev => {
      const next = [...prev]
      next[rowIndex] = { ...next[rowIndex], [field]: value }
      return next
    })
    setDraft(prev => ({
      ...prev,
      [rowIndex]: { ...(prev?.[rowIndex] || {}), [field]: value },
    }))
  }

  function discardChanges() {
    setDraft(null)
    fetchData()
    toast.info(t('data.changes_discarded'))
  }

  async function saveBulkChanges() {
    if (!draft || Object.keys(draft).length === 0) {
      toast.info(t('data.no_changes_to_save'))
      return
    }
    setSavingBulk(true)
    try {
      const idField = activeEntity === 'kabupaten' || activeEntity === 'kecamatan' || activeEntity === 'provinces' || activeEntity === 'countries' ? 'code' : 'id'

      // Separate new rows (POST) from existing rows (PUT bulk).
      const newRows: any[] = []
      const rowsToUpdate: any[] = []
      for (const [idx, changes] of Object.entries(draft)) {
        const dataRow = data[Number(idx)]
        if (!dataRow) continue
        const isNew = (dataRow as any).__isNew === true || (changes as any).__isNew === true
        // Strip internal flags before sending
        const { __isNew, ...cleanChanges } = changes as any
        if (isNew) {
          // For new rows: send ALL fields (combined data + changes), not just diffs
          newRows.push({ ...dataRow, ...cleanChanges, __isNew: undefined })
        } else {
          rowsToUpdate.push({
            [idField]: dataRow[idField],
            ...cleanChanges,
          })
        }
      }

      let totalCreated = 0
      let totalUpdated = 0
      let totalErrors = 0
      const errorList: string[] = []

      // 1. Bulk update existing rows
      if (rowsToUpdate.length > 0) {
        const res = await fetch('/api/locinsight/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: activeEntity, rows: rowsToUpdate }),
        })
        const json = await res.json()
        if (json.success) {
          totalUpdated = json.updated || 0
          totalErrors += json.error_count || 0
          if (json.errors) errorList.push(...json.errors)
        } else {
          toast.error(json.error)
          return
        }
      }

      // 2. Insert new rows one-by-one (POST) — bulk POST would need a
      //    different endpoint signature. New rows are typically few.
      for (const row of newRows) {
        // Strip __isNew and any undefined fields
        const { __isNew: _drop, id: _idDrop, ...payload } = row
        // For id-keyed entities, also drop empty id (DB will assign UUID)
        try {
          const res = await fetch(`/api/locinsight/${activeEntity}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (json.success) totalCreated++
          else {
            totalErrors++
            errorList.push(t('data.new_row_error', { error: json.error || 'unknown error' }))
          }
        } catch (e: any) {
          totalErrors++
          errorList.push(t('data.new_row_error', { error: e.message }))
        }
      }

      const parts: string[] = []
      if (totalUpdated) parts.push(t('data.row_updated', { count: totalUpdated }))
      if (totalCreated) parts.push(t('data.row_created', { count: totalCreated }))
      if (totalErrors) parts.push(t('data.row_errors', { count: totalErrors }))
      const msg = parts.length ? t('data.bulk_saved', { summary: parts.join(' · ') }) : t('data.no_changes_needed')
      if (totalErrors > 0) {
        toast.warning(msg)
        console.warn('Bulk save errors:', errorList)
      } else {
        toast.success(msg)
      }
      setDraft(null)
      fetchData()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingBulk(false)
    }
  }

  // (Legacy downloadExport and downloadTemplate functions removed — Aug 2026.
  //  Use openExportDialog() / openImportDialog() instead, which provide
  //  column-picker + format-toggle + filtered-rows-only exports.)

  /** Open the export dialog with all columns pre-selected. */
  function openExportDialog(format: 'csv' | 'xlsx') {
    setExportFormat(format)
    setSelectedExportCols(new Set(fieldConfig.map(f => f.key)))
    setShowExportDialog(true)
  }

  /** Open the import dialog with all columns pre-selected (default: select all). */
  function openImportDialog() {
    setSelectedImportCols(new Set(fieldConfig.map(f => f.key)))
    setImportFile(null)
    setShowImportDialog(true)
  }

  /** Toggle a single column in the export picker. */
  function toggleExportCol(key: string) {
    setSelectedExportCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** Toggle a single column in the import picker. */
  function toggleImportCol(key: string) {
    setSelectedImportCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** Export only the user-selected columns from the current filtered view.
   *  Supports both CSV and XLSX. Columns are deduplicated (Set semantics).
   *  When filters are active, exports ONLY the filtered rows. */
  async function exportSelectedColumns() {
    if (selectedExportCols.size === 0) {
      toast.error(t('data.select_one_column'))
      return
    }
    // Distinct column keys — Set already enforces uniqueness; we also
    // preserve field-config order to keep the export readable.
    const selectedFields = fieldConfig.filter(f => selectedExportCols.has(f.key))
    const rows = processedData
    const filename = `${activeEntity}_filtered_${rows.length}rows_${selectedFields.length}cols_${new Date().toISOString().slice(0,10)}.${exportFormat}`

    try {
      if (exportFormat === 'csv') {
        // Build CSV in-browser — uses only filtered+sorted rows
        const headers = selectedFields.map(f => t(`data.field.${f.labelKey || f.key}`))
        const lines = [headers.join(',')]
        for (const r of rows) {
          const cells = selectedFields.map(f => {
            const v = (r as any)[f.key]
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
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // XLSX — generate client-side using SheetJS loaded via dynamic import
        // (avoids bundling xlsx in the main chunk for users who never export)
        const XLSX = await import('xlsx')
        const headers = selectedFields.map(f => t(`data.field.${f.labelKey || f.key}`))
        const data = rows.map(r => {
          const out: Record<string, any> = {}
          selectedFields.forEach((f, i) => {
            const v = (r as any)[f.key]
            if (v == null) out[headers[i]] = ''
            else if (f.type === 'boolean') out[headers[i]] = v ? 'true' : 'false'
            else if (f.type === 'number') out[headers[i]] = v
            else out[headers[i]] = String(v)
          })
          return out
        })
        const ws = XLSX.utils.json_to_sheet(data, { header: headers })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Data')
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      toast.success(t('data.exported_rows_cols', { rows: rows.length, cols: selectedFields.length }))
      setShowExportDialog(false)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  /** Download a template with only the user-selected columns (for import). */
  async function downloadImportTemplate() {
    if (selectedImportCols.size === 0) {
      toast.error(t('data.select_one_column'))
      return
    }
    try {
      const columnsParam = Array.from(selectedImportCols).join(',')
      const res = await fetch(`/api/locinsight/bulk?entity=${activeEntity}&format=${importFormat}&template=true&columns=${encodeURIComponent(columnsParam)}`)
      if (!res.ok) throw new Error(t('data.template_download_failed'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template_${activeEntity}_${selectedImportCols.size}cols.${importFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('data.template_downloaded', { format: importFormat.toUpperCase() }))
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  /** Upload a file with column validation against selectedImportCols. */
  async function uploadImportFile() {
    if (!importFile) {
      toast.error(t('data.import_no_file'))
      return
    }
    if (selectedImportCols.size === 0) {
      toast.error(t('data.select_one_column'))
      return
    }
    setImportValidating(true)
    try {
      const form = new FormData()
      form.append('entity', activeEntity)
      form.append('file', importFile)
      form.append('columns', Array.from(selectedImportCols).join(','))
      const res = await fetch('/api/locinsight/bulk/upload', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (json.success) {
        const msg = json.error_count > 0
          ? t('data.imported_summary', { file: importFile.name, created: json.created, updated: json.updated, errors: json.error_count })
          : t('data.imported_summary_no_errors', { file: importFile.name, created: json.created, updated: json.updated })
        if (json.error_count > 0) {
          toast.warning(msg)
          console.warn('Import errors:', json.errors)
        } else {
          toast.success(msg)
        }
        // Show warnings (extra columns) as info
        if (json.warnings && json.warnings.length > 0) {
          toast.info(json.warnings.join('; '))
        }
        setShowImportDialog(false)
        setImportFile(null)
        fetchData()
      } else {
        // Column validation failed — show structured error
        if (json.missing && json.missing.length > 0) {
          toast.error(t('data.import_validation_missing', { missing: json.missing.join(', ') }))
        } else if (json.errors && json.errors.length > 0) {
          toast.error(json.errors.join('; '))
        } else {
          toast.error(json.error || 'Import failed')
        }
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setImportValidating(false)
    }
  }

  // === Client-side sort + filter applied to current page data ===
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

  function resetTableFilters() {
    setSortCol(null)
    setSortDir(null)
    setColFilters({})
  }

  const processedData = useMemo(() => {
    let result = data
    // Apply per-column filters
    if (Object.keys(colFilters).length > 0) {
      result = result.filter(row => {
        for (const [k, v] of Object.entries(colFilters)) {
          if (!v) continue
          const cellVal = (row as any)[k]
          if (cellVal == null) return false
          if (typeof cellVal === 'boolean') {
            if (String(cellVal) !== v) return false
          } else if (!String(cellVal).toLowerCase().includes(v.toLowerCase())) {
            return false
          }
        }
        return true
      })
    }
    // Apply sort
    if (sortCol && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1
      result = [...result].sort((a, b) => {
        const va = (a as any)[sortCol]
        const vb = (b as any)[sortCol]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
        return String(va).localeCompare(String(vb)) * dir
      })
    }
    return result
  }, [data, colFilters, sortCol, sortDir])

  // Get unique values for select-based filters on each column
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {}
    for (const f of fieldConfig) {
      const set = new Set<string>()
      for (const r of data) {
        const v = (r as any)[f.key]
        if (v != null && v !== '') {
          set.add(typeof v === 'boolean' ? String(v) : String(v))
        }
      }
      const arr = Array.from(set).sort()
      // Only show select-style filter if <= 30 unique values; otherwise text input
      if (arr.length > 0 && arr.length <= 30) {
        opts[f.key] = arr
      }
    }
    return opts
  }, [data, fieldConfig])

  // (Legacy exportFilteredViewCSV and handleFileUpload removed — Aug 2026.
  //  The new "Export Selection Columns" dialog (CSV/XLSX) and "Import Selection
  //  Columns" dialog (with column validation) replace these functions.)

  // Show ALL columns in table view (was sliced to 6, hiding most fields).
  // Horizontal scroll is enabled via min-width on the table.
  const tableColumns = fieldConfig
  const hasChanges = draft && Object.keys(draft).length > 0

  // === Insert blank row at top of spreadsheet data (for bulk insert) ===
  function insertBlankRow() {
    // Build an empty row matching the entity's field config (id left empty for DB to assign)
    const blank: Record<string, any> = {}
    for (const f of fieldConfig) {
      blank[f.key] = f.type === 'boolean' ? false : (f.type === 'number' ? null : '')
    }
    // For code-keyed entities, leave code empty too
    if (['kabupaten', 'kecamatan', 'provinces', 'countries'].includes(activeEntity)) {
      delete blank.id
    } else {
      blank.id = '' // DB will assign UUID or we leave it for user to fill
    }
    // Mark as a "new" row by tagging with __isNew so we POST (not PUT) on save
    blank.__isNew = true
    setData(prev => [blank, ...prev])
    // Track in draft so it shows as unsaved
    setDraft(prev => ({
      ...prev,
      0: { ...(prev?.[0] || {}), __isNew: true, ...blank },
    }))
    toast.info(t('data.blank_row_inserted'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
            {t('data.title')}
          </h2>
          <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
            {t('data.subtitle_full')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          className="h-8"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
        {/* Entity switcher */}
        <Card className="card-premium h-fit overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[var(--brand-red)]" />
              {t('data.master_data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {ENTITIES.map(e => {
              const Icon = e.icon
              const isActive = activeEntity === e.id
              return (
                <button
                  key={e.id}
                  onClick={() => setActiveEntity(e.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-[12.5px] ${
                    isActive
                      ? 'bg-[var(--brand-red)] text-white'
                      : 'text-[var(--brand-ink)]/70 hover:bg-[var(--brand-cream)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="capitalize">{t(e.label)}</span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Data pane */}
        <Card className="card-premium overflow-hidden min-w-0">
          <CardHeader className="pb-3">
            {/* (Legacy hidden file input removed — replaced by Import Selection Columns dialog) */}
            {/* Row 1: Title + search + New (always visible, never clipped) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                {activeEntity}
                <Badge variant="secondary" className="text-[10px]">{t('data.records', { count: total })}</Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand-ink)]/40" />
                  <Input
                    placeholder={t('data.search_entity', { entity: activeEntity })}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 pl-7 w-[160px] sm:w-[200px] text-[12px]"
                  />
                </div>
                <Button size="sm" onClick={openCreate} className="h-7 text-[11px] bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] flex-shrink-0">
                  <Plus className="w-3 h-3 mr-1" />
                  {t('data.new_short')}
                </Button>
              </div>
            </div>

            {/* Row 2: Import Selection Cols | Export Selection Cols (CSV/XLSX in dialog)
                Per user request Aug 2026: removed CSV (All), XLSX (All), Export View buttons.
                Import Selection Cols on the LEFT, Export Selection Cols on the RIGHT.
                Aug 2026 update: viewer role cannot see any export/import buttons (read-only). */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {canExport ? (
                <>
                  {/* Import Selection Columns — opens dialog with column picker + template download + file upload */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openImportDialog}
                    className="h-7 text-[11px] flex-shrink-0 border-[var(--brand-ink)]/30 text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]"
                    title={t('data.import_selected_tooltip')}
                  >
                    <FileUp className="w-3 h-3 mr-1" /> {t('data.import_selection_cols')}
                  </Button>
                  {/* Export Selection Columns — opens dialog with column picker + format toggle (CSV/XLSX) */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openExportDialog('csv')}
                    className="h-7 text-[11px] border-[var(--brand-red)]/30 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 flex-shrink-0"
                    title={t('data.export_selection_tooltip')}
                  >
                    <FilterIcon className="w-3 h-3 mr-1" /> {t('data.export_selection_cols')}
                  </Button>
                </>
              ) : (
                <Badge variant="outline" className="text-[10px] text-[var(--brand-ink)]/50 border-[var(--brand-border)] bg-[var(--brand-cream)]">
                  <Shield className="w-3 h-3 mr-1 inline" /> {t('data.viewer_read_only', { default: 'Read-only — export/import disabled for viewer role' })}
                </Badge>
              )}
              {viewMode === 'table' && (
                <Badge variant="outline" className="text-[10px] ml-auto text-[var(--brand-ink)]/60 border-[var(--brand-border)] bg-[var(--brand-cream)]">
                  {t('data.filter_all_data_hint', { total })}
                </Badge>
              )}
            </div>

            {/* POI type filter + quick-stats (only shown when entity === 'pois') */}
            {activeEntity === 'pois' && (
              <div className="mt-3 p-3 border border-[var(--brand-border)] rounded-md bg-[var(--brand-cream)]/30">
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 whitespace-nowrap">
                    {t('data.type_filter')}:
                  </Label>
                  <Select value={poiTypeFilter} onValueChange={setPoiTypeFilter}>
                    <SelectTrigger className="h-7 w-[220px] text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')} ({data.length})</SelectItem>
                      <SelectItem value="beach">🏖 Beaches ({data.filter(p => p.type === 'beach').length})</SelectItem>
                      <SelectItem value="temple">🛕 Temples ({data.filter(p => p.type === 'temple').length})</SelectItem>
                      <SelectItem value="tourist_attraction">🎢 Tourist Attractions ({data.filter(p => p.type === 'tourist_attraction').length})</SelectItem>
                      <SelectItem value="hotel_cluster">🏨 Hotel Clusters ({data.filter(p => p.type === 'hotel_cluster').length})</SelectItem>
                      <SelectItem value="university">🎓 Universities ({data.filter(p => p.type === 'university').length})</SelectItem>
                      <SelectItem value="hospital">🏥 Hospitals ({data.filter(p => p.type === 'hospital').length})</SelectItem>
                      <SelectItem value="transit_hub">🚉 Transit Hubs ({data.filter(p => p.type === 'transit_hub').length})</SelectItem>
                      <SelectItem value="port">⚓ Ports ({data.filter(p => p.type === 'port').length})</SelectItem>
                      <SelectItem value="office_cluster">🏢 Office/Govt Clusters ({data.filter(p => p.type === 'office_cluster').length})</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="text-[10px]">
                    {poiTypeFilter === 'all' ? `${data.length} total` : `${data.filter(p => p.type === poiTypeFilter).length} filtered`}
                  </Badge>
                </div>
                {/* Quick-access type chips with counts — Aug 2026 */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { v: 'all', label: 'All', icon: '📋' },
                    { v: 'beach', label: 'Beaches', icon: '🏖' },
                    { v: 'temple', label: 'Temples', icon: '🛕' },
                    { v: 'tourist_attraction', label: 'Attractions', icon: '🎢' },
                    { v: 'hotel_cluster', label: 'Hotels', icon: '🏨' },
                    { v: 'university', label: 'Universities', icon: '🎓' },
                    { v: 'hospital', label: 'Hospitals', icon: '🏥' },
                    { v: 'transit_hub', label: 'Transit', icon: '🚉' },
                    { v: 'port', label: 'Ports', icon: '⚓' },
                    { v: 'office_cluster', label: 'Govt/Office', icon: '🏢' },
                  ].map(opt => {
                    const count = opt.v === 'all'
                      ? data.length
                      : data.filter(p => p.type === opt.v).length
                    const isActive = poiTypeFilter === opt.v
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setPoiTypeFilter(opt.v)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors border ${
                          isActive
                            ? 'bg-[var(--brand-red)] text-white border-[var(--brand-red)]'
                            : 'bg-white text-[var(--brand-ink)]/70 border-[var(--brand-border)] hover:bg-[var(--brand-cream)]'
                        }`}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                        <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-white/20' : 'bg-[var(--brand-cream)]'}`}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* View mode toggle (Table vs Spreadsheet) */}
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <TabsList className="h-7">
                  <TabsTrigger value="table" className="text-[11px] h-5 px-2">
                    <Database className="w-3 h-3 mr-1" /> {t('data.table_view')}
                  </TabsTrigger>
                  <TabsTrigger value="spreadsheet" className="text-[11px] h-5 px-2">
                    <FileSpreadsheet className="w-3 h-3 mr-1" /> {t('data.spreadsheet_bulk_edit')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {viewMode === 'spreadsheet' && (
                <div className="flex items-center gap-2">
                  {/* Insert blank row at top — for bulk insert workflow */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={insertBlankRow}
                    className="h-7 text-[11px] border-[var(--brand-red)]/30 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10"
                    title={t('data.insert_row_tooltip')}
                  >
                    <Plus className="w-3 h-3 mr-1" /> {t('data.insert_row')}
                  </Button>
                  {hasChanges && (
                    <>
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                        {t('data.rows_changed', { count: Object.keys(draft!).length })}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={discardChanges} className="h-7 text-[11px]">
                        <X className="w-3 h-3 mr-1" /> {t('data.discard')}
                      </Button>
                      <Button size="sm" onClick={saveBulkChanges} disabled={savingBulk} className="h-7 text-[11px] bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]">
                        {savingBulk ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                        {t('data.save_changes')}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'table' ? (
              <TableView
                data={processedData}
                totalCount={data.length}
                loading={loading}
                columns={tableColumns}
                allFieldConfig={fieldConfig}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={toggleSort}
                colFilters={colFilters}
                onColFilterChange={(k, v) => setColFilters(prev => ({ ...prev, [k]: v }))}
                filterOptions={filterOptions}
                onResetFilters={resetTableFilters}
                onEdit={openEdit}
                onDelete={remove}
              />
            ) : (
              <SpreadsheetView
                // Aug 2026: Spreadsheet view now ALSO applies colFilters + sort
                // (so the filter works across ALL data — not just first 100 rows).
                // The first 100 filtered rows are shown for inline editing; the
                // rest are accessible via Prev/Next pagination below.
                data={processedData.slice((page - 1) * 100, page * 100)}
                loading={loading}
                fields={fieldConfig}
                draft={draft || {}}
                setCell={setCell}
                onEdit={openEdit}
                onDelete={remove}
              />
            )}

            {/* Pagination — since we fetch up to 5000 rows in table view, pagination
                is rarely needed. We still show it for spreadsheet mode (which paginates
                client-side for inline editing) and for entities that exceed 5000 rows.
                Aug 2026: Spreadsheet view now uses processedData (filter+sort applied)
                so totalPages reflects the FILTERED row count, not the raw count. */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--brand-border)]">
              <div className="text-[11px] text-[var(--brand-ink)]/60">
                {viewMode === 'table' ? (
                  // Table view: show count of filtered vs total
                  data.length !== processedData.length
                    ? t('data.showing_filtered_n', { shown: processedData.length, total })
                    : t('data.showing_all_n', { n: total })
                ) : (
                  <>
                    {/* Spreadsheet view: totalPages computed from FILTERED data (processedData) */}
                    {(() => {
                      const filteredTotalPages = Math.max(1, Math.ceil(processedData.length / 100))
                      const showingFiltered = processedData.length !== data.length
                      return showingFiltered
                        ? t('data.page_info_filtered', { page, totalPages: filteredTotalPages, total: processedData.length, raw: data.length })
                        : t('data.page_info', { page, totalPages: filteredTotalPages, total: processedData.length })
                    })()}
                    {t('data.showing_100_per_page')}
                  </>
                )}
              </div>
              {viewMode === 'spreadsheet' && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-7 text-[11px]">
                    {t('common.previous')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= Math.max(1, Math.ceil(processedData.length / 100)) || loading} onClick={() => setPage(p => p + 1)} className="h-7 text-[11px]">
                    {t('common.next')}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode === 'create' ? t('data.create_entity', { entity: activeEntity.replace(/s$/, '') }) : t('data.edit_entity', { entity: activeEntity.replace(/s$/, '') })}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {fieldConfig.map(f => (
              <div key={f.key} className={f.fullWidth ? 'col-span-2' : ''}>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1 block">
                  {t(`data.field.${f.labelKey || f.key}`)}{f.required && <span className="text-[var(--brand-red)] ml-0.5">*</span>}
                </Label>
                {f.type === 'boolean' ? (
                  <Switch
                    checked={!!editing?.[f.key]}
                    onCheckedChange={(v) => setEditing({ ...editing, [f.key]: v })}
                  />
                ) : f.type === 'select' ? (
                  <Select
                    value={String(editing?.[f.key] ?? '')}
                    onValueChange={(v) => setEditing({ ...editing, [f.key]: v })}
                  >
                    <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder={t('data.select_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      {f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={editing?.[f.key] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                    className="h-9 text-[12px]"
                    step={f.step || '1'}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t('data.cancel')}</Button>
            <Button onClick={save} className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]">
              {editMode === 'create' ? t('data.create') : t('data.save_changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Selection Columns Dialog (renamed from Custom Cols — Aug 2026)
          • Pick columns (distinct — duplicates auto-removed)
          • Choose format: CSV or XLSX
          • Exports ONLY filtered rows (uses processedData) */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('data.export_selection_cols')} — {activeEntity}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-[12px] text-[var(--brand-ink)]/70 leading-relaxed">
              {t('data.export_pick_columns_desc', { count: processedData.length })}
            </div>
            {/* Format toggle: CSV | XLSX */}
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--brand-border)]">
              <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 whitespace-nowrap">
                {t('data.export_pick_format')}:
              </Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
                  className={`h-7 text-[11px] ${exportFormat === 'csv' ? 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]' : ''}`}
                >
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('xlsx')}
                  className={`h-7 text-[11px] ${exportFormat === 'xlsx' ? 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]' : ''}`}
                >
                  XLSX
                </Button>
              </div>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {t('data.cols_selected', { selected: selectedExportCols.size, total: fieldConfig.length })}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setSelectedExportCols(new Set(fieldConfig.map(f => f.key)))}
              >
                {t('data.select_all')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setSelectedExportCols(new Set())}
              >
                {t('data.clear_all')}
              </Button>
              <span className="ml-auto text-[10px] text-[var(--brand-ink)]/50 flex items-center gap-1">
                <Check className="w-3 h-3" /> {t('data.distinct_cols_note')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {fieldConfig.map(f => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 p-2 rounded border border-[var(--brand-border)] hover:bg-[var(--brand-cream)] cursor-pointer text-[11.5px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedExportCols.has(f.key)}
                    onChange={() => toggleExportCol(f.key)}
                    className="accent-[var(--brand-red)]"
                  />
                  <span className="flex-1 truncate">{t(`data.field.${f.labelKey || f.key}`)}</span>
                  {f.required && <span className="text-[var(--brand-red)] text-[9px]">{t('data.req')}</span>}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>{t('data.cancel')}</Button>
            <Button
              onClick={exportSelectedColumns}
              disabled={selectedExportCols.size === 0}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('data.export_cols_rows', { cols: selectedExportCols.size, rows: processedData.length })} · {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Selection Columns Dialog (NEW — Aug 2026)
          • Pick columns (default: select all)
          • Choose template format: CSV or XLSX
          • Download template (with only selected columns)
          • Upload file (validated against selected columns — error notification on mismatch) */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('data.import_selection_cols')} — {activeEntity}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-[12px] text-[var(--brand-ink)]/70 leading-relaxed">
              {t('data.import_selected_tooltip')}
            </div>
            {/* Format toggle: CSV | XLSX */}
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--brand-border)]">
              <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 whitespace-nowrap">
                {t('data.import_pick_format')}:
              </Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={importFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setImportFormat('csv')}
                  className={`h-7 text-[11px] ${importFormat === 'csv' ? 'bg-[var(--brand-ink)] hover:bg-[var(--brand-ink)]/90 text-white' : ''}`}
                >
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant={importFormat === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setImportFormat('xlsx')}
                  className={`h-7 text-[11px] ${importFormat === 'xlsx' ? 'bg-[var(--brand-ink)] hover:bg-[var(--brand-ink)]/90 text-white' : ''}`}
                >
                  XLSX
                </Button>
              </div>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {t('data.cols_selected', { selected: selectedImportCols.size, total: fieldConfig.length })}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setSelectedImportCols(new Set(fieldConfig.map(f => f.key)))}
              >
                {t('data.select_all')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setSelectedImportCols(new Set())}
              >
                {t('data.clear_all')}
              </Button>
              <span className="ml-auto text-[10px] text-[var(--brand-ink)]/50 flex items-center gap-1">
                <Check className="w-3 h-3" /> {t('data.distinct_cols_note')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
              {fieldConfig.map(f => (
                <label
                  key={f.key}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-[11.5px] ${
                    selectedImportCols.has(f.key)
                      ? 'border-[var(--brand-ink)]/40 bg-[var(--brand-cream)]'
                      : 'border-[var(--brand-border)] hover:bg-[var(--brand-cream)]/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedImportCols.has(f.key)}
                    onChange={() => toggleImportCol(f.key)}
                    className="accent-[var(--brand-ink)]"
                  />
                  <span className="flex-1 truncate">{t(`data.field.${f.labelKey || f.key}`)}</span>
                  {f.required && <span className="text-[var(--brand-red)] text-[9px]">{t('data.req')}</span>}
                </label>
              ))}
            </div>
            {/* Hidden file input for upload */}
            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setImportFile(f)
              }}
              className="hidden"
            />
            {/* Selected file display */}
            {importFile && (
              <div className="flex items-center gap-2 p-2 rounded border border-[var(--brand-border)] bg-[var(--brand-cream)]">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--brand-ink)]/60" />
                <span className="text-[11px] text-[var(--brand-ink)]/80 truncate flex-1">{importFile.name}</span>
                <span className="text-[10px] text-[var(--brand-ink)]/50">{(importFile.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => { setImportFile(null); if (importFileInputRef.current) importFileInputRef.current.value = '' }}
                  className="p-0.5 rounded hover:bg-red-100 text-[var(--brand-ink)]/60 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {/* Validation note */}
            <div className="text-[10.5px] text-[var(--brand-ink)]/55 leading-relaxed bg-[var(--brand-cream)] p-2 rounded border border-[var(--brand-border)]">
              <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />
              {t('data.import_validation_error', {
                expected: selectedImportCols.size > 0 ? `${selectedImportCols.size} selected cols + required` : 'all columns',
                found: importFile ? importFile.name : '—',
              })}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="sm:mr-auto">
              {t('data.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={downloadImportTemplate}
              disabled={selectedImportCols.size === 0}
              className="border-[var(--brand-ink)]/30 text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              {t('data.download_template')} ({importFormat.toUpperCase()})
            </Button>
            <Button
              onClick={uploadImportFile}
              disabled={selectedImportCols.size === 0 || !importFile || importValidating}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
            >
              {importValidating ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              {t('data.upload_file')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================
// Table View (with column sort, per-column filter, edit/delete)
// =============================================================
function TableView({
  data, totalCount, loading, columns, allFieldConfig, sortCol, sortDir, onSort,
  colFilters, onColFilterChange, filterOptions, onResetFilters, onEdit, onDelete,
}: {
  data: any[]
  totalCount: number
  loading: boolean
  columns: FieldConfig[]
  allFieldConfig: FieldConfig[]
  sortCol: string | null
  sortDir: 'asc' | 'desc' | null
  onSort: (k: string) => void
  colFilters: Record<string, string>
  onColFilterChange: (k: string, v: string) => void
  filterOptions: Record<string, string[]>
  onResetFilters: () => void
  onEdit: (row: any) => void
  onDelete: (row: any) => void
}) {
  const { t } = useLanguage()
  const hasFilters = Object.values(colFilters).some(v => v) || sortCol
  return (
    <div className="space-y-2">
      {/* Filter status bar */}
      {hasFilters && (
        <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-[var(--brand-cream)] rounded">
          <span className="text-[var(--brand-ink)]/70">
            <FilterIcon className="w-3 h-3 inline mr-1" />
            {t('data.showing_of', { shown: data.length, total: totalCount })}
            {sortCol && <span className="ml-2 text-[var(--brand-ink)]/50">{t('data.sorted_by', { col: sortCol, dir: sortDir || '' })}</span>}
          </span>
          <button onClick={onResetFilters} className="text-[var(--brand-red)] hover:underline">
            {t('data.reset_filters')}
          </button>
        </div>
      )}
      <div className="overflow-auto max-h-[600px] border border-[var(--brand-border)] rounded scroll-styled">
        <table className="text-[11.5px] border-collapse min-w-max">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-[var(--brand-border)]">
              {columns.map(f => {
                const isSorted = sortCol === f.key
                const SortIcon = !isSorted ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th key={f.key} className="text-left px-2 py-2 font-semibold text-[var(--brand-ink)]/70 uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-[var(--brand-border)] last:border-r-0 min-w-[120px]">
                    <button
                      onClick={() => onSort(f.key)}
                      className="flex items-center gap-1 hover:text-[var(--brand-red)]"
                    >
                      {t(`data.field.${f.labelKey || f.key}`)}
                      <SortIcon className={`w-3 h-3 ${isSorted ? 'text-[var(--brand-red)]' : 'text-[var(--brand-ink)]/40'}`} />
                    </button>
                  </th>
                )
              })}
              <th className="text-right px-2 py-2 w-20"></th>
            </tr>
            {/* Per-column filter row */}
            <tr className="border-b border-[var(--brand-border)] bg-[var(--brand-cream)]/30">
              {columns.map(f => {
                const opts = filterOptions[f.key]
                if (opts && opts.length > 0) {
                  return (
                    <th key={f.key} className="px-1 py-1">
                      <select
                        value={colFilters[f.key] || ''}
                        onChange={e => onColFilterChange(f.key, e.target.value)}
                        className="text-[10px] px-1 py-0.5 border border-[var(--brand-border)] rounded w-full bg-white"
                      >
                        <option value="">{t('common.all')}</option>
                        {opts.map(o => <option key={o} value={o}>{o.length > 30 ? o.slice(0, 27) + '…' : o}</option>)}
                      </select>
                    </th>
                  )
                }
                return (
                  <th key={f.key} className="px-1 py-1">
                    <input
                      type="text"
                      value={colFilters[f.key] || ''}
                      onChange={e => onColFilterChange(f.key, e.target.value)}
                      placeholder={t('data.filter_placeholder')}
                      className="text-[10px] px-1 py-0.5 border border-[var(--brand-border)] rounded w-full"
                    />
                  </th>
                )
              })}
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="py-8 text-center text-[var(--brand-ink)]/40">{t('common.loading')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="py-8 text-center text-[var(--brand-ink)]/40">{t('data.no_records_match')}</td></tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="border-b border-[var(--brand-border)]/50 hover:bg-[var(--brand-cream)]/50">
                  {columns.map(f => (
                    <td key={f.key} className="px-2 py-1.5 whitespace-nowrap border-r border-[var(--brand-border)]/30 last:border-r-0 align-top">
                      {formatCell(row[f.key], f.type)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-1 rounded hover:bg-[var(--brand-red)]/10 text-[var(--brand-ink)]/60 hover:text-[var(--brand-red)]"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(row)}
                      className="p-1 rounded hover:bg-red-100 text-[var(--brand-ink)]/60 hover:text-red-600 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================
// Spreadsheet View (inline-editable cells, like Excel)
// =============================================================
function SpreadsheetView({
  data, loading, fields, draft, setCell, onEdit, onDelete,
}: {
  data: any[]
  loading: boolean
  fields: FieldConfig[]
  draft: Record<number, Record<string, any>>
  setCell: (rowIndex: number, field: string, value: any) => void
  onEdit: (row: any) => void
  onDelete: (row: any) => void
}) {
  const { t } = useLanguage()
  // Spreadsheet shows: row#, all fields, edit, delete
  // Limit columns to keep it usable — show all fields
  if (loading) {
    return <div className="py-12 text-center text-[var(--brand-ink)]/40 text-[12px]">{t('common.loading')}</div>
  }
  if (data.length === 0) {
    return <div className="py-12 text-center text-[var(--brand-ink)]/40 text-[12px]">{t('data.no_data')}</div>
  }
  return (
    <div className="overflow-auto max-h-[600px] border border-[var(--brand-border)] rounded scroll-styled">
      <table className="text-[11px] border-collapse min-w-max">
        <thead className="sticky top-0 bg-[var(--brand-cream)] z-10">
          <tr>
            <th className="text-center px-1 py-1.5 border-r border-b border-[var(--brand-border)] font-semibold text-[var(--brand-ink)]/50 uppercase text-[9px] w-8 sticky left-0 bg-[var(--brand-cream)] z-20">#</th>
            {fields.map(f => (
              <th key={f.key} className="text-left px-2 py-1.5 border-r border-b border-[var(--brand-border)] font-semibold text-[var(--brand-ink)]/70 uppercase tracking-wider text-[9px] whitespace-nowrap min-w-[80px]">
                {t(`data.field.${f.labelKey || f.key}`)}
                {f.required && <span className="text-[var(--brand-red)] ml-0.5">*</span>}
              </th>
            ))}
            <th className="text-center px-1 py-1.5 border-b border-[var(--brand-border)] font-semibold text-[var(--brand-ink)]/50 w-16">{t('data.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => {
            const rowChanged = !!draft[ri]
            return (
              <tr key={ri} className={rowChanged ? 'bg-amber-50/40' : 'bg-white'}>
                <td className="text-center px-1 py-0.5 border-r border-b border-[var(--brand-border)] text-[var(--brand-ink)]/40 text-[10px] font-mono sticky left-0 bg-inherit z-10">
                  {ri + 1}
                  {rowChanged && <span className="text-amber-600 ml-0.5">●</span>}
                </td>
                {fields.map(f => {
                  const value = row[f.key]
                  const changed = draft[ri]?.[f.key] !== undefined
                  return (
                    <td
                      key={f.key}
                      className={`border-r border-b border-[var(--brand-border)] p-0 ${changed ? 'bg-amber-100/60' : ''}`}
                    >
                      <CellEditor
                        field={f}
                        value={value}
                        onChange={(v) => setCell(ri, f.key, v)}
                      />
                    </td>
                  )
                })}
                <td className="text-center border-b border-[var(--brand-border)] px-1">
                  <button
                    onClick={() => onEdit(row)}
                    className="p-0.5 rounded hover:bg-[var(--brand-red)]/10 text-[var(--brand-ink)]/60 hover:text-[var(--brand-red)]"
                    title={t('data.open_in_dialog')}
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDelete(row)}
                    className="p-0.5 rounded hover:bg-red-100 text-[var(--brand-ink)]/60 hover:text-red-600 ml-0.5"
                    title={t('data.delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================
// Cell Editor — inline editable cell, type-aware
// =============================================================
function CellEditor({
  field, value, onChange,
}: {
  field: FieldConfig
  value: any
  onChange: (v: any) => void
}) {
  const { t } = useLanguage()
  if (field.type === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`w-full h-7 flex items-center justify-center text-[10px] font-semibold transition-colors ${
          value
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
        }`}
        title={value ? t('data.true_toggle') : t('data.false_toggle')}
      >
        {value ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      </button>
    )
  }
  if (field.type === 'select') {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-1 text-[10.5px] bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[var(--brand-red)]"
      >
        <option value="">—</option>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        step={field.step || '1'}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full h-7 px-1.5 text-[10.5px] text-right bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[var(--brand-red)] font-mono"
      />
    )
  }
  // text
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-7 px-1.5 text-[10.5px] bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[var(--brand-red)]"
    />
  )
}

function formatCell(value: any, type?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'boolean') return value ? '✓' : '—'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string' && value.length > 60) return value.slice(0, 57) + '…'
  return String(value)
}

interface FieldConfig {
  key: string
  label: string
  labelKey?: string // override for i18n key, defaults to `data.field.${key}`
  type?: 'text' | 'number' | 'boolean' | 'select'
  options?: string[]
  step?: string
  required?: boolean
  fullWidth?: boolean
}

function getFieldConfig(entity: EntityType): FieldConfig[] {
  switch (entity) {
    case 'stores':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
        { key: 'brand_id', label: 'Brand ID', type: 'text', required: true },
        { key: 'brand_name', label: 'Brand', type: 'text' },
        { key: 'brand_category', label: 'Category', type: 'select', options: ['food_beverage','sports','fashion','department_store','kids','lifestyle','beauty'] },
        { key: 'parent', label: 'Parent', type: 'select', options: ['MAP','MAA'] },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'kec', label: 'Kecamatan', type: 'text' },
        { key: 'kab', label: 'Kabupaten/Kota', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'is_in_mall', label: 'In Mall?', type: 'boolean' },
        { key: 'mall_id', label: 'Mall ID', type: 'text' },
        { key: 'mall_name', label: 'Mall Name', type: 'text' },
        { key: 'address', label: 'Address', type: 'text', fullWidth: true },
        { key: 'opened_year', label: 'Opened Year', type: 'number' },
        { key: 'estimated_size_m2', label: 'Size (m²)', type: 'number' },
        { key: 'confirmed', label: 'Verified?', type: 'boolean' },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'competitors':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'brand_name', label: 'Brand Name', type: 'text', required: true },
        { key: 'brand_category', label: 'Category', type: 'select', options: ['convenience_store','fast_food','coffee','fashion','beauty','supermarket','pharmacy','department_store','sports','other'] },
        { key: 'name', label: 'Outlet Name', type: 'text', required: true, fullWidth: true },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001', required: true },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001', required: true },
        { key: 'kec', label: 'Kecamatan', type: 'text' },
        { key: 'kab', label: 'Kabupaten/Kota', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'address', label: 'Address', type: 'text', fullWidth: true },
        { key: 'is_in_mall', label: 'In Mall?', type: 'boolean' },
        { key: 'mall_id', label: 'Mall ID', type: 'text' },
        { key: 'mall_name', label: 'Mall Name', type: 'text' },
        { key: 'source', label: 'Source', type: 'text' },
        { key: 'source_url', label: 'Source URL', type: 'text', fullWidth: true },
      ]
    case 'malls':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'kec', label: 'Kecamatan', type: 'text' },
        { key: 'kab', label: 'Kabupaten/Kota', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'gla_m2', label: 'GLA (m²)', type: 'number' },
        { key: 'opened_year', label: 'Opened Year', type: 'number' },
        { key: 'class', label: 'Class', type: 'select', options: ['super_regional','regional','community','specialty'] },
        { key: 'anchor_count', label: 'Anchors', type: 'number' },
        { key: 'has_cinema', label: 'Cinema?', type: 'boolean' },
        { key: 'has_supermarket', label: 'Supermarket?', type: 'boolean' },
        { key: 'has_department_store', label: 'Dept Store?', type: 'boolean' },
        { key: 'visitor_estimate_daily', label: 'Daily Visitors', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'brands':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'parent', label: 'Parent', type: 'select', options: ['MAP','MAA'] },
        { key: 'category', label: 'Category', type: 'select', options: ['food_beverage','sports','fashion','department_store','kids','lifestyle','beauty'] },
        { key: 'origin_country', label: 'Origin Country', type: 'text' },
        { key: 'format', label: 'Format', type: 'text' },
        { key: 'location_preference', label: 'Loc Pref', type: 'select', options: ['mall','street','both'] },
        { key: 'typical_size_m2', label: 'Size (m²)', type: 'number' },
        { key: 'price_segment', label: 'Price', type: 'select', options: ['mass','mid','premium','luxury'] },
        { key: 'brand_strength', label: 'Strength', type: 'number', step: '0.01' },
        { key: 'target_audience', label: 'Target', type: 'text', fullWidth: true },
        { key: 'city', label: 'HQ City', type: 'text' },
        { key: 'country', label: 'HQ Country', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'kelurahan':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'code', label: 'Code', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'kec_code', label: 'Kecamatan Code', type: 'text' },
        { key: 'kec_name', label: 'Kecamatan', type: 'text' },
        { key: 'kab_code', label: 'Kabupaten/Kota Code', type: 'text' },
        { key: 'kab_name', label: 'Kabupaten/Kota', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'population', label: 'Population', type: 'number' },
        { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
        { key: 'density', label: 'Population Density (per km²)', type: 'number' },
        { key: 'urban_index', label: 'Urbanization Index (0-100)', type: 'number' },
        { key: 'income_index', label: 'Income Index (0-100)', type: 'number' },
        { key: 'tourist_index', label: 'Tourist Index (0-100)', type: 'number' },
        { key: 'transport_index', label: 'Transport Index (0-100)', type: 'number' },
        { key: 'poi_density_index', label: 'POI Density Index (0-100)', type: 'number' },
        { key: 'is_coastal', label: 'Is Coastal Area?', type: 'boolean' },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'pois':
      return [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
        { key: 'type', label: 'Type', type: 'select', options: ['tourist_attraction','beach','temple','hotel_cluster','transit_hub','university','hospital','office_cluster','port'] },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'kec', label: 'Kecamatan', type: 'text' },
        { key: 'kab', label: 'Kabupaten/Kota', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'magnitude', label: 'Magnitude', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'kabupaten':
      return [
        { key: 'code', label: 'Code (BPS 4-digit)', labelKey: 'code_bps4', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'type', label: 'Type (Kabupaten/Kota)', labelKey: 'type_kab', type: 'select', options: ['Kabupaten','Kota'] },
        { key: 'capital', label: 'Capital', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'province', label: 'Province', type: 'text' },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
        { key: 'population_2024', label: 'Population', type: 'number' },
        { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
        { key: 'population_density', label: 'Population Density (per km²)', type: 'number' },
        { key: 'gdrp_per_capita_juta', label: 'GDRP per Capita (Juta Rp)', type: 'number', step: '0.1' },
        { key: 'hdmi_2024', label: 'HDI (0-1, Human Development Index)', type: 'number', step: '0.001' },
        { key: 'tourist_hotels', label: 'Tourist Hotels', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'kecamatan':
      return [
        { key: 'code', label: 'Code (BPS 6-digit)', labelKey: 'code_bps6', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'kabupaten_code', label: 'Kabupaten/Kota Code', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'province', label: 'Province', type: 'text' },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
        { key: 'population_2024', label: 'Population', type: 'number' },
        { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
        { key: 'urban_score', label: 'Urbanization Score (0-100)', type: 'number' },
        { key: 'is_capital', label: 'Is Kabupaten Capital?', type: 'boolean' },
        { key: 'source', label: 'Source', type: 'text', fullWidth: true },
      ]
    case 'provinces':
      return [
        { key: 'code', label: 'Code (BPS 2-digit)', labelKey: 'code_bps2', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'country_id', label: 'Country ID', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
        { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
        { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
        { key: 'population', label: 'Population', type: 'number' },
      ]
    case 'countries':
      return [
        { key: 'id', label: 'ID (ISO-2)', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'iso2', label: 'ISO 2 Code', type: 'text' },
        { key: 'iso3', label: 'ISO 3 Code', type: 'text' },
      ]
  }
  return []
}
