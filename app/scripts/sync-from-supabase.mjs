#!/usr/bin/env node
/**
 * sync-from-supabase.mjs — One-way data sync: Supabase (READ-ONLY) -> RDS Postgres
 *
 * Runs as ECS one-off task (locinsights-sync), scheduled daily by
 * EventBridge Scheduler `locinsights-data-sync` (rate(1 day), UTC).
 *
 * Design:
 *  - Source: Supabase PostgREST (publishable key, anon read). Supabase is NEVER written.
 *  - Target: RDS PostgreSQL via Prisma raw SQL (client already in image).
 *  - Idempotent: INSERT ... ON CONFLICT (pk) DO UPDATE — safe to re-run anytime.
 *  - Incremental: watermark per table in sync_state (updated_at >= last watermark).
 *    Tables without updated_at, or with SYNC_FULL=1, do a full refresh (upsert only,
 *    RDS-only rows are NEVER deleted).
 *  - Tenant backfill: new rows in tenant-scoped tables get tenant_id set to the
 *    single platform tenant (same rule as 0009_saas migration).
 *  - Column-safe: columns are the intersection of (RDS updatable) x (Supabase exposed);
 *    generated columns (e.g. geom) are auto-excluded.
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_API_KEY
 *      (or NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
 *      DATABASE_URL. Optional: SYNC_FULL=1, SYNC_TABLES=csv override.
 */

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SB_KEY = process.env.SUPABASE_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

// Tenant-scoped tables that get tenant_id backfill (mirrors 0009_saas migration rule)
const TENANT_SCOPED = new Set([
  'brands', 'stores', 'malls', 'mall_tenants', 'competitor_stores', 'pois',
  'reports', 'scraper_runs',
])

// Sync order: parents before children
const DEFAULT_TABLES = [
  'countries', 'provinces', 'kabupaten', 'kecamatan', 'kelurahan',
  'brands', 'malls', 'mall_tenants', 'stores', 'competitor_stores',
  'pois', 'field_surveys',
]
const _envTables = (process.env.SYNC_TABLES || '').split(',').map(s => s.trim()).filter(Boolean)
const TABLES = _envTables.length ? _envTables : DEFAULT_TABLES   // NB: [] is truthy in JS!

const PAGE = 1000
const BATCH_ROWS = 120          // rows per INSERT (params = rows*cols must stay < 65535)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function log(...a) { console.log(new Date().toISOString(), ...a) }

async function sbFetch(path, { headers = {}, raw = false } = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json', ...headers },
  })
  if (!res.ok && res.status !== 206) {
    const t = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status} ${path}: ${t.slice(0, 300)}`)
  }
  return raw ? res : res.json()
}

/** Discover Supabase columns from real rows (OpenAPI spec requires secret key;
 *  with only the publishable key we sample limit=1 per table). */
async function sbColumns() {
  const out = {}
  for (const t of TABLES) {
    try {
      const rows = await sbFetch(`${t}?select=*&limit=1`)
      if (Array.isArray(rows) && rows.length) out[t] = Object.keys(rows[0])
    } catch { /* table not readable -> will be skipped */ }
  }
  return out
}

async function main() {
  if (!SB_URL || !SB_KEY) { console.error('FATAL: SUPABASE_URL / SUPABASE_API_KEY not set'); process.exit(2) }
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const FULL = process.env.SYNC_FULL === '1'

  try {
    const sb = await sbColumns()
    log(`Supabase OpenAPI: ${Object.keys(sb).length} tables exposed`)

    // ---------- RDS capability snapshot ----------
    const rdsCols = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, udt_name, is_generated
      FROM information_schema.columns WHERE table_schema='public'`)
    const rdsPk = await prisma.$queryRawUnsafe(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public'`)
    const colsByTable = {}
    for (const r of rdsCols) (colsByTable[r.table_name] ||= []).push(r)
    const pkByTable = {}
    for (const r of rdsPk) (pkByTable[r.table_name] ||= []).push(r.column_name)

    // watermark state table (idempotent create)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sync_state (
        table_name text PRIMARY KEY,
        last_watermark timestamptz NOT NULL DEFAULT '1970-01-01',
        last_rows int NOT NULL DEFAULT 0,
        last_run timestamptz NOT NULL DEFAULT now(),
        mode text NOT NULL DEFAULT 'incremental')`)

    // platform tenant id for backfill
    const tenants = await prisma.$queryRawUnsafe(`SELECT id FROM public.tenants ORDER BY created_at LIMIT 1`)
    const TENANT_ID = tenants[0]?.id || 'tnt_map_active_0001'
    log(`Platform tenant for backfill: ${TENANT_ID}`)

    const quote = (id) => `"${id}"`
    const summary = []
    let failed = 0

    for (const table of TABLES) {
      const t0 = Date.now()
      try {
        const pkCols = pkByTable[table] || []
        if (pkCols.length !== 1) { log(`SKIP ${table}: pk=${pkCols.join(',') || 'none'} (need single pk)`); summary.push([table, 'SKIP']); continue }
        if (!sb[table]) { log(`SKIP ${table}: not exposed by Supabase`); summary.push([table, 'SKIP']); continue }
        const pk = pkCols[0]
        const upd = (colsByTable[table] || []).filter(c => c.is_generated === 'NEVER').map(c => c.column_name)
        const cols = upd.filter(c => sb[table].includes(c))
        if (!cols.includes(pk)) { log(`SKIP ${table}: pk not in supabase cols`); summary.push([table, 'SKIP']); continue }
        const hasUpdatedAt = cols.includes('updated_at')
        const hasTenantId = upd.includes('tenant_id')
        const colMeta = new Map((colsByTable[table] || []).map(c => [c.column_name, c]))
        // Explicit PG casts: Prisma raw params arrive as TEXT; PG refuses implicit
        // text -> timestamptz/enum/numeric casts in INSERT ... VALUES context.
        const CASTABLE = new Set(['int2','int4','int8','float4','float8','numeric',
          'bool','uuid','json','jsonb','timestamp','timestamptz','date'])
        const castOf = (c) => {
          const m = colMeta.get(c)
          if (!m) return ''
          if (m.data_type === 'USER-DEFINED') return `::"${m.udt_name}"`
          return CASTABLE.has(m.udt_name) ? `::${m.udt_name}` : ''
        }
        const jsonCols = new Set((colsByTable[table] || []).filter(c => ['json', 'jsonb'].includes(c.data_type)).map(c => c.column_name))

        // ---------- watermark ----------
        let wm = null
        if (!FULL && hasUpdatedAt) {
          const st = await prisma.$queryRawUnsafe(`SELECT last_watermark FROM sync_state WHERE table_name = $1`, table)
          wm = st[0]?.last_watermark
        }
        const overlap = await prisma.$queryRawUnsafe(`SELECT max(updated_at) AS m FROM ${quote(table)}`).catch(() => [{}])
        const since = wm && overlap[0]?.m ? new Date(Math.max(new Date(wm).getTime(), new Date(overlap[0].m).getTime() - 24 * 3600 * 1000)) : null

        // ---------- fetch from Supabase (paged) ----------
        const filters = []
        if (since) filters.push(`updated_at=gte.${since.toISOString()}`)
        const q = `${table}?select=${cols.join(',')}${filters.length ? '&' + filters.join('&') : ''}&order=${pk}.asc`
        let offset = 0, rows = []
        while (true) {
          const page = await sbFetch(`${q}`, { headers: { Range: `${offset}-${offset + PAGE - 1}`, Prefer: 'count=none' } })
          rows = rows.concat(page)
          if (!Array.isArray(page) || page.length < PAGE) break
          offset += PAGE
          await sleep(150)
        }

        // ---------- upsert in batches ----------
        const colList = cols.map(quote).join(',')
        let up = 0
        for (let i = 0; i < rows.length; i += BATCH_ROWS) {
          const chunk = rows.slice(i, i + BATCH_ROWS)
          const vals = []
          const params = []
          chunk.forEach((r, ri) => {
            const ph = cols.map((c, ci) => {
              params.push(jsonCols.has(c) && r[c] != null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c] ?? null)
              return `$${ri * cols.length + ci + 1}${castOf(c)}`
            }).join(',')
            vals.push(`(${ph})`)
          })
          const sets = cols.filter(c => c !== pk).map(c => `${quote(c)} = EXCLUDED.${quote(c)}`).join(',')
          const sql = `INSERT INTO ${quote(table)} (${colList}) VALUES ${vals.join(',')} ON CONFLICT (${quote(pk)}) DO UPDATE SET ${sets}`
          await prisma.$executeRawUnsafe(sql, ...params)
          up += chunk.length
        }

        // ---------- tenant backfill (same rule as 0009_saas) ----------
        let backfilled = 0
        if (hasTenantId && TENANT_SCOPED.has(table) && up > 0) {
          backfilled = await prisma.$executeRawUnsafe(
            `UPDATE ${quote(table)} SET tenant_id = $1 WHERE tenant_id IS NULL`, TENANT_ID)
        }

        // ---------- watermark update ----------
        if (hasUpdatedAt) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO sync_state (table_name, last_watermark, last_rows, last_run, mode)
            VALUES ($1, now(), $2, now(), $3)
            ON CONFLICT (table_name) DO UPDATE SET last_watermark=EXCLUDED.last_watermark,
              last_rows=EXCLUDED.last_rows, last_run=now(), mode=EXCLUDED.mode`,
            table, up, since ? 'incremental' : 'full')
        }
        const rdsCount = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS c FROM ${quote(table)}`)
        log(`OK ${table}: fetched=${up} backfilled_tenant=${backfilled} rds_total=${rdsCount[0]?.c} (${Date.now() - t0}ms)`)
        summary.push([table, `OK ${up}`])
      } catch (e) {
        failed++
        log(`ERROR ${table}: ${e.message?.slice(0, 500)}`)
        summary.push([table, 'ERROR'])
      }
    }

    log('=== SYNC SUMMARY ===')
    for (const [t, s] of summary) log(`  ${t.padEnd(20)} ${s}`)
    log(`=== SYNC ${failed ? `COMPLETED_WITH_ERRORS (${failed})` : 'COMPLETE'} ===`)
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  } catch (e) {
    console.error('FATAL:', e)
    await prisma.$disconnect().catch(() => {})
    process.exit(2)
  }
}

main()
