/**
 * Bulk import/export helpers for all LocInsights master data entities.
 *
 * Each entity has:
 *   - list of fields (key, label, type) — used for both import templates and the spreadsheet UI
 *   - idField: 'id' or 'code' — the primary key
 *   - requiredFields: minimum fields for a valid record
 *
 * Import strategy: upsert by primary key. Existing records updated; new ones created.
 * Export strategy: dump all rows as JSON (caller converts to CSV/XLSX).
 *
 * Best practices (Aug 2026):
 *   - CSV: RFC 4180 — quote fields containing commas, newlines, or quotes
 *   - XLSX: SheetJS (xlsx@0.18.5) — write to binary, return as Uint8Array
 *   - Boolean: export as 'true'/'false' (lowercase); import accepts 'true','yes','1','y'
 *   - Numbers: parsed via Number(); NaN becomes 0 (or null for optional)
 *   - Empty strings: skipped (so default applies)
 */
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { db } from './api-helpers'

export type EntityType =
  | 'stores' | 'malls' | 'brands' | 'competitors'
  | 'kelurahan' | 'pois' | 'kabupaten' | 'kecamatan'

/**
 * Entities that have a tenant_id column (tenant-scoped data).
 * Bulk operations on these entities inject tenant_id on create and filter
 * reads/updates by tenant_id.
 */
export const TENANT_SCOPED_ENTITIES = new Set<EntityType>([
  'stores', 'malls', 'brands', 'competitors', 'pois',
])

/**
 * Entities that are SHARED reference data (no tenant_id column).
 * Bulk write operations on these entities require superadmin.
 */
export const REFERENCE_DATA_ENTITIES = new Set<EntityType>([
  'kelurahan', 'kabupaten', 'kecamatan',
])

export type FieldType = 'text' | 'number' | 'boolean' | 'select'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  step?: string
  required?: boolean
  default?: any
  fullWidth?: boolean
}

interface EntityConfig {
  idField: 'id' | 'code'
  label: string
  model: any
  fields: FieldDef[]
}

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  stores: {
    idField: 'id',
    label: 'Stores',
    model: db.store,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
      { key: 'brand_id', label: 'Brand ID', type: 'text', required: true },
      { key: 'brand_name', label: 'Brand Name', type: 'text' },
      { key: 'brand_category', label: 'Category', type: 'select', options: ['food_beverage','sports','fashion','department_store','kids','lifestyle','beauty'] },
      { key: 'parent', label: 'Parent', type: 'select', options: ['MAP','MAA'] },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001', required: true },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001', required: true },
      { key: 'kec', label: 'Kecamatan', type: 'text' },
      { key: 'kab', label: 'Kabupaten', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'is_in_mall', label: 'In Mall', type: 'boolean', default: false },
      { key: 'mall_id', label: 'Mall ID', type: 'text' },
      { key: 'mall_name', label: 'Mall Name', type: 'text' },
      { key: 'address', label: 'Address', type: 'text', fullWidth: true },
      { key: 'opened_year', label: 'Opened Year', type: 'number' },
      { key: 'estimated_size_m2', label: 'Size m²', type: 'number' },
      { key: 'confirmed', label: 'Verified', type: 'boolean', default: false },
      { key: 'source', label: 'Source', type: 'text', default: 'manual' },
    ],
  },
  malls: {
    idField: 'id',
    label: 'Malls',
    model: db.mall,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001', required: true },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001', required: true },
      { key: 'kec', label: 'Kecamatan', type: 'text' },
      { key: 'kab', label: 'Kabupaten', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'gla_m2', label: 'GLA m²', type: 'number' },
      { key: 'opened_year', label: 'Opened Year', type: 'number' },
      { key: 'class', label: 'Class', type: 'select', options: ['super_regional','regional','community','specialty'] },
      { key: 'anchor_count', label: 'Anchors', type: 'number', default: 0 },
      { key: 'has_cinema', label: 'Cinema', type: 'boolean', default: false },
      { key: 'has_supermarket', label: 'Supermarket', type: 'boolean', default: false },
      { key: 'has_department_store', label: 'Dept Store', type: 'boolean', default: false },
      { key: 'visitor_estimate_daily', label: 'Daily Visitors', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
      { key: 'source', label: 'Source', type: 'text', default: 'manual' },
    ],
  },
  brands: {
    idField: 'id',
    label: 'Brands',
    model: db.brand,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'parent', label: 'Parent', type: 'select', options: ['MAP','MAA'], required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['food_beverage','sports','fashion','department_store','kids','lifestyle','beauty'], required: true },
      { key: 'origin_country', label: 'Origin Country', type: 'text' },
      { key: 'format', label: 'Format', type: 'text' },
      { key: 'location_preference', label: 'Location Pref', type: 'select', options: ['mall','street','both'] },
      { key: 'typical_size_m2', label: 'Size m²', type: 'number' },
      { key: 'price_segment', label: 'Price', type: 'select', options: ['mass','mid','premium','luxury'] },
      { key: 'brand_strength', label: 'Strength', type: 'number', step: '0.01' },
      { key: 'target_audience', label: 'Target Audience', type: 'text', fullWidth: true },
      { key: 'city', label: 'HQ City', type: 'text' },
      { key: 'country', label: 'HQ Country', type: 'text', default: 'Indonesia' },
      { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
      { key: 'source', label: 'Source', type: 'text', default: 'manual' },
    ],
  },
  competitors: {
    idField: 'id',
    label: 'Competitor Stores',
    model: db.competitorStore,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'brand_name', label: 'Brand Name', type: 'text', required: true },
      { key: 'brand_category', label: 'Category', type: 'select', options: ['convenience_store','fast_food','coffee','fashion','beauty','supermarket','pharmacy','other'], required: true },
      { key: 'name', label: 'Outlet Name', type: 'text', required: true, fullWidth: true },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001', required: true },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001', required: true },
      { key: 'kec', label: 'Kecamatan', type: 'text' },
      { key: 'kab', label: 'Kabupaten', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'address', label: 'Address', type: 'text', fullWidth: true },
      { key: 'is_in_mall', label: 'In Mall', type: 'boolean', default: false },
      { key: 'mall_name', label: 'Mall Name', type: 'text' },
      { key: 'source', label: 'Source', type: 'text', default: 'osm_overpass' },
    ],
  },
  kelurahan: {
    idField: 'id',
    label: 'Kelurahan',
    model: db.kelurahan,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kec_code', label: 'Kecamatan Code', type: 'text' },
      { key: 'kec_name', label: 'Kecamatan Name', type: 'text' },
      { key: 'kab_code', label: 'Kabupaten Code', type: 'text' },
      { key: 'kab_name', label: 'Kabupaten Name', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
      { key: 'population', label: 'Population (people)', type: 'number' },
      { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
      { key: 'density', label: 'Population Density (per km²)', type: 'number' },
      { key: 'urban_index', label: 'Urbanization Index (0-100)', type: 'number' },
      { key: 'income_index', label: 'Income Index (0-100)', type: 'number' },
      { key: 'tourist_index', label: 'Tourist Index (0-100)', type: 'number' },
      { key: 'transport_index', label: 'Transport Index (0-100)', type: 'number' },
      { key: 'poi_density_index', label: 'POI Density Index (0-100)', type: 'number' },
      { key: 'is_coastal', label: 'Is Coastal Area?', type: 'boolean', default: false },
      { key: 'source', label: 'Data Source', type: 'text', default: 'manual' },
    ],
  },
  pois: {
    idField: 'id',
    label: 'POIs',
    model: db.poi,
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true, fullWidth: true },
      { key: 'type', label: 'Type', type: 'select', options: ['tourist_attraction','beach','temple','hotel_cluster','transit_hub','university','hospital','office_cluster','port'] },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001', required: true },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001', required: true },
      { key: 'kec', label: 'Kecamatan', type: 'text' },
      { key: 'kab', label: 'Kabupaten', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'magnitude', label: 'Magnitude', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
      { key: 'source', label: 'Source', type: 'text', default: 'manual' },
    ],
  },
  kabupaten: {
    idField: 'code',
    label: 'Kabupaten',
    model: db.kabupaten,
    fields: [
      { key: 'code', label: 'Code (BPS 4-digit)', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'type', label: 'Type (Kabupaten/Kota)', type: 'select', options: ['Kabupaten','Kota'] },
      { key: 'capital', label: 'Capital City', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'province', label: 'Province', type: 'text', default: 'Bali' },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
      { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
      { key: 'population_2024', label: 'Population 2024 (people)', type: 'number' },
      { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
      { key: 'population_density', label: 'Population Density (per km²)', type: 'number' },
      { key: 'gdrp_per_capita_juta', label: 'GDRP per Capita (Juta Rp / million IDR)', type: 'number', step: '0.1' },
      { key: 'hdmi_2024', label: 'HDI Score 2024 (0-1, Human Development Index)', type: 'number', step: '0.001' },
      { key: 'tourist_hotels', label: 'Tourist Hotels (count)', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text', fullWidth: true },
      { key: 'source', label: 'Data Source', type: 'text', default: 'manual' },
    ],
  },
  kecamatan: {
    idField: 'code',
    label: 'Kecamatan',
    model: db.kecamatan,
    fields: [
      { key: 'code', label: 'Code (BPS 6-digit)', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kabupaten_code', label: 'Kabupaten Code', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'country', label: 'Country', type: 'text', default: 'Indonesia' },
      { key: 'province', label: 'Province', type: 'text', default: 'Bali' },
      { key: 'lat', label: 'Latitude', type: 'number', step: '0.0001' },
      { key: 'lng', label: 'Longitude', type: 'number', step: '0.0001' },
      { key: 'tier', label: 'Tier (1=Metropolitan, 2=Urban, 3=Rural)', type: 'select', options: ['tier_1','tier_2','tier_3'] },
      { key: 'population_2024', label: 'Population 2024 (people)', type: 'number' },
      { key: 'area_km2', label: 'Area (km²)', type: 'number', step: '0.1' },
      { key: 'urban_score', label: 'Urbanization Score (0-100)', type: 'number' },
      { key: 'is_capital', label: 'Is Kabupaten Capital?', type: 'boolean', default: false },
      { key: 'source', label: 'Data Source', type: 'text', default: 'manual' },
    ],
  },
}

/** Convert a row from import (all strings) into the proper typed shape for Prisma. */
function coerceRow(row: Record<string, any>, fields: FieldDef[]): Record<string, any> {
  const out: Record<string, any> = {}
  // Tier enum mapping: accept "1","2","3" and "tier_1","tier_2","tier_3"
  const tierMap: Record<string, string> = { '1': 'tier_1', '2': 'tier_2', '3': 'tier_3' }
  for (const f of fields) {
    let v = row[f.key]
    if (v === undefined || v === null || v === '') {
      if (f.default !== undefined) out[f.key] = f.default
      continue
    }
    if (typeof v === 'string') v = v.trim()
    if (f.type === 'number') {
      const n = Number(v)
      out[f.key] = isNaN(n) ? 0 : n
    } else if (f.type === 'boolean') {
      out[f.key] = ['true','yes','1','y','t'].includes(String(v).toLowerCase())
    } else {
      // Special handling: tier field — map "1" → "tier_1" for enum compatibility
      if (f.key === 'tier' && tierMap[String(v)]) {
        out[f.key] = tierMap[String(v)]
      } else {
        out[f.key] = String(v)
      }
    }
  }
  return out
}

/**
 * Bulk upsert rows for an entity. Returns counts.
 *
 * Tenant isolation:
 *   - For tenant-scoped entities (TENANT_SCOPED_ENTITIES), if options.tenantId is
 *     provided, it's injected into create payloads and used as an additional
 *     WHERE filter on updateMany (so a row belonging to another tenant cannot
 *     be mutated). If an existing row's tenant_id doesn't match, the row is
 *     rejected with an "access denied" error.
 *   - For reference-data entities (REFERENCE_DATA_ENTITIES), tenant_id is
 *     never injected (those tables have no tenant_id column).
 */
export async function bulkUpsert(
  entity: EntityType,
  rows: Record<string, any>[],
  options?: { tenantId?: string | null },
): Promise<{ created: number; updated: number; errors: Array<{ row: number; error: string }> }> {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)

  const tid = options?.tenantId ?? null
  const isTenantScoped = TENANT_SCOPED_ENTITIES.has(entity)

  let created = 0
  let updated = 0
  const errors: Array<{ row: number; error: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]
    try {
      // Validate required
      for (const f of cfg.fields) {
        if (f.required) {
          const v = rawRow[f.key]
          if (v === undefined || v === null || v === '') {
            throw new Error(`Missing required field: ${f.key}`)
          }
        }
      }
      const data = coerceRow(rawRow, cfg.fields)
      const idVal = data[cfg.idField]
      if (!idVal) throw new Error(`Missing primary key: ${cfg.idField}`)

      // Remove relation fields (e.g., 'stores' on Mall)
      delete data.stores
      delete data.brand
      delete data.mall
      delete data.predictions
      delete data.Kecamatan
      // Never allow tenant_id to be set via the row body — always derive from session
      delete data.tenant_id

      // Check existence — count is more efficient than findUnique for paranoid schemas
      const existing = await cfg.model.findUnique({ where: { [cfg.idField]: idVal } })

      // Tenant-scoped defense-in-depth: if the existing row belongs to a
      // different tenant, reject the upsert. (NULL tenant_id = system row,
      // which is editable by any tenant admin — rare but allowed.)
      if (isTenantScoped && tid && existing) {
        const existingTid = (existing as any).tenant_id
        if (existingTid !== null && existingTid !== undefined && existingTid !== tid) {
          throw new Error('Access denied: record belongs to another tenant')
        }
      }

      if (existing) {
        if (isTenantScoped && tid) {
          // updateMany with tenant_id in WHERE — prevents cross-tenant mutation
          const res = await cfg.model.updateMany({
            where: { [cfg.idField]: idVal, tenant_id: tid },
            data,
          })
          if (res.count > 0) updated++
          else throw new Error('Access denied: record belongs to another tenant')
        } else {
          // Reference data — superadmin-only (route enforces)
          await cfg.model.update({ where: { [cfg.idField]: idVal }, data })
          updated++
        }
      } else {
        // Inject tenant_id on create for tenant-scoped entities
        const createData = isTenantScoped && tid ? { ...data, tenant_id: tid } : data
        await cfg.model.create({ data: createData })
        created++
      }
    } catch (e: any) {
      errors.push({ row: i + 2, error: e.message || String(e) }) // +2: header row + 1-indexed
    }
  }

  return { created, updated, errors }
}

/**
 * Export all rows for an entity as JSON. Caller decides CSV vs XLSX.
 *
 * Tenant isolation: for tenant-scoped entities, if options.tenantId is set,
 * rows are filtered to that tenant. For reference-data entities, no filter
 * is applied (shared across all tenants).
 */
export async function exportRows(
  entity: EntityType,
  options?: { tenantId?: string | null },
): Promise<Record<string, any>[]> {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)

  const tid = options?.tenantId ?? null
  const where = TENANT_SCOPED_ENTITIES.has(entity) && tid ? { tenant_id: tid } : {}

  // Exclude relation fields
  const rows = await cfg.model.findMany({
    where,
    orderBy: { [cfg.idField]: 'asc' },
  })
  // Strip relation objects (Prisma returns them only if `include` is set)
  return rows.map((r: any) => {
    const { brand, mall, stores, predictions, Kecamatan, ...rest } = r
    return rest
  })
}

/** Convert rows to CSV string (RFC 4180). */
export function rowsToCsv(rows: Record<string, any>[], fields: FieldDef[]): string {
  const headers = fields.map(f => f.label)
  const data = rows.map(r => {
    const out: Record<string, any> = {}
    for (const f of fields) {
      const v = r[f.key]
      if (v === null || v === undefined) out[f.label] = ''
      else if (f.type === 'boolean') out[f.label] = v ? 'true' : 'false'
      else if (f.type === 'number') out[f.label] = String(v)
      else out[f.label] = String(v)
    }
    return out
  })
  return Papa.unparse({ fields: headers, data: data.map(d => headers.map(h => d[h])) })
}

/** Convert rows to XLSX file (as Node Buffer). */
export function rowsToXlsx(rows: Record<string, any>[], fields: FieldDef[]): Buffer {
  const headers = fields.map(f => f.label)
  const data = rows.map(r => {
    const out: Record<string, any> = {}
    for (const f of fields) {
      const v = r[f.key]
      if (v === null || v === undefined) out[f.label] = ''
      else if (f.type === 'boolean') out[f.label] = v ? 'true' : 'false'
      else out[f.label] = v
    }
    return out
  })
  const ws = XLSX.utils.json_to_sheet(data, { header: headers })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  // Generate as Node Buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buf)
}

/** Build an empty template (headers + 1 example row) for download. */
export function buildTemplate(entity: EntityType): { csv: string; xlsx: Buffer; fields: FieldDef[] } {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)
  const fields = cfg.fields
  const exampleRow: Record<string, any> = {}
  for (const f of fields) {
    if (f.required) {
      if (f.type === 'number') exampleRow[f.key] = 0
      else if (f.type === 'boolean') exampleRow[f.key] = false
      else exampleRow[f.key] = `EXAMPLE_${f.key.toUpperCase()}`
    } else if (f.default !== undefined) {
      exampleRow[f.key] = f.default
    } else {
      exampleRow[f.key] = ''
    }
  }
  // CSV
  const csv = rowsToCsv([exampleRow], fields)
  // XLSX
  const xlsx = rowsToXlsx([exampleRow], fields)
  return { csv, xlsx, fields }
}

/**
 * Build a template with ONLY the user-selected columns.
 *
 * Used by the "Import Selection Columns" feature: user picks a subset of
 * columns, downloads a template containing only those columns (in the order
 * selected), then uploads a file that must match exactly.
 *
 * Best practices (Aug 2026):
 *   - Always include the primary key (idField) — required for upsert
 *   - Always include required fields — user can't omit them
 *   - Columns are deduplicated (Set semantics) and ordered by user selection
 *   - Example row shows realistic placeholder values
 */
export function buildTemplateWithColumns(
  entity: EntityType,
  selectedColumnKeys: string[],
): { csv: string; xlsx: Buffer; fields: FieldDef[]; includedKeys: string[] } {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const orderedKeys: string[] = []
  for (const k of selectedColumnKeys) {
    if (!seen.has(k)) {
      seen.add(k)
      orderedKeys.push(k)
    }
  }

  // Always include the primary key + required fields (force-include even if user didn't pick them)
  const mustInclude = new Set<string>([cfg.idField])
  for (const f of cfg.fields) {
    if (f.required) mustInclude.add(f.key)
  }
  for (const k of mustInclude) {
    if (!seen.has(k)) {
      seen.add(k)
      orderedKeys.unshift(k)
    }
  }

  // Build filtered fields list (preserve config order if user didn't reorder)
  const fields = cfg.fields.filter(f => seen.has(f.key))

  const exampleRow: Record<string, any> = {}
  for (const f of fields) {
    if (f.type === 'number') exampleRow[f.key] = f.required ? 0 : ''
    else if (f.type === 'boolean') exampleRow[f.key] = f.default ?? false
    else if (f.required) exampleRow[f.key] = `EXAMPLE_${f.key.toUpperCase()}`
    else if (f.default !== undefined) exampleRow[f.key] = f.default
    else exampleRow[f.key] = ''
  }

  const csv = rowsToCsv([exampleRow], fields)
  const xlsx = rowsToXlsx([exampleRow], fields)
  return { csv, xlsx, fields, includedKeys: orderedKeys }
}

/**
 * Validate that an uploaded file's headers match the expected template columns.
 *
 * Returns a list of validation issues:
 *   - missing: required columns that are not in the file
 *   - extra:   columns in the file that aren't in the expected set (warning only)
 *   - mismatchedLabels: headers that don't match any known column key/label
 *
 * Best practices (Aug 2026):
 *   - Match against both field.key and field.label (case-insensitive)
 *   - Required fields must be present (else error)
 *   - Extra columns are tolerated but flagged (warning)
 *   - Returns clear, actionable error messages for the UI
 */
export function validateImportColumns(
  entity: EntityType,
  fileHeaders: string[],
  expectedColumnKeys: string[],
): { valid: boolean; errors: string[]; warnings: string[]; missing: string[]; extra: string[] } {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)

  // Build label→key and key→key lookup (case-insensitive)
  const labelToKey = new Map<string, string>()
  for (const f of cfg.fields) {
    labelToKey.set(f.label.toLowerCase(), f.key)
    labelToKey.set(f.key.toLowerCase(), f.key)
  }

  // Normalize file headers to lowercase strings
  const fileHeadersLower = fileHeaders.map(h => String(h).trim().toLowerCase())
  const fileKeysFound = new Set<string>()
  const unmatched: string[] = []
  for (const h of fileHeadersLower) {
    const key = labelToKey.get(h)
    if (key) fileKeysFound.add(key)
    else unmatched.push(h)
  }

  // Deduplicate expected columns (Set semantics)
  const expectedKeys = new Set(expectedColumnKeys)
  // Always require the primary key + required fields
  expectedKeys.add(cfg.idField)
  for (const f of cfg.fields) {
    if (f.required) expectedKeys.add(f.key)
  }

  const missing: string[] = []
  for (const k of expectedKeys) {
    if (!fileKeysFound.has(k)) {
      const f = cfg.fields.find(x => x.key === k)
      missing.push(f?.label || k)
    }
  }

  const extra: string[] = unmatched

  const errors: string[] = []
  const warnings: string[] = []
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`)
  }
  if (extra.length > 0) {
    warnings.push(`Unexpected columns (will be ignored): ${extra.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missing,
    extra,
  }
}

/**
 * Filter rows to only the selected columns, after parsing.
 * Used during import to strip unwanted columns before upsert.
 */
export function filterRowsToColumns(
  rows: Record<string, any>[],
  entity: EntityType,
  selectedColumnKeys: string[],
): Record<string, any>[] {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)
  const keysToKeep = new Set(selectedColumnKeys)
  keysToKeep.add(cfg.idField)
  for (const f of cfg.fields) {
    if (f.required) keysToKeep.add(f.key)
  }
  return rows.map(r => {
    const out: Record<string, any> = {}
    for (const k of keysToKeep) {
      if (k in r) out[k] = r[k]
    }
    return out
  })
}

/** Parse CSV string into rows. */
export function parseCsv(text: string): Record<string, any>[] {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
  return result.data as Record<string, any>[]
}

/** Parse XLSX file (as ArrayBuffer/Buffer) into rows. */
export function parseXlsx(buf: ArrayBuffer | Buffer): Record<string, any>[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[]
}

/** Map column labels back to field keys (since templates export with labels as headers). */
export function normalizeRowKeys(rows: Record<string, any>[], entity: EntityType): Record<string, any>[] {
  const cfg = ENTITY_CONFIG[entity]
  if (!cfg) throw new Error(`Unknown entity: ${entity}`)
  // Build label→key lookup (case-insensitive)
  const labelToKey = new Map<string, string>()
  for (const f of cfg.fields) {
    labelToKey.set(f.label.toLowerCase(), f.key)
    labelToKey.set(f.key.toLowerCase(), f.key)
  }
  return rows.map(r => {
    const out: Record<string, any> = {}
    for (const k of Object.keys(r)) {
      const key = labelToKey.get(k.trim().toLowerCase())
      if (key) out[key] = r[k]
    }
    return out
  })
}
