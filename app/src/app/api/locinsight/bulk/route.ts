/**
 * Bulk import/export endpoint for all master data entities.
 *
 * Endpoints:
 *   GET  /api/locinsight/bulk?entity=stores&format=csv|xlsx     → download export
 *   GET  /api/locinsight/bulk/template?entity=stores&format=csv|xlsx → download template
 *   POST /api/locinsight/bulk  { entity, rows }                  → bulk upsert (JSON)
 *   PUT  /api/locinsight/bulk  { entity, rows }                  → bulk update only
 *
 * Tenant isolation:
 *   - Tenant-scoped entities (stores/malls/brands/competitors/pois): require
 *     'data' permission + tenant_id injected on create + tenant_id in update WHERE.
 *     Exports are filtered to the current tenant.
 *   - Reference-data entities (kelurahan/kabupaten/kecamatan): writes require
 *     superadmin; reads (export) require any authenticated user.
 *
 * Best practices (Aug 2026):
 *   - Always validate entity name against whitelist
 *   - Row limit: 5000 per request
 *   - Return detailed error list per row (row number + message)
 *   - Idempotent: upsert by primary key, so re-uploading same file is safe
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  ENTITY_CONFIG,
  bulkUpsert,
  exportRows,
  rowsToCsv,
  rowsToXlsx,
  buildTemplate,
  TENANT_SCOPED_ENTITIES,
  REFERENCE_DATA_ENTITIES,
  type EntityType,
} from '@/lib/bulk-helpers'
import { requireAuth, requirePermission, requireSuperadmin } from '@/lib/auth-server'
import { setTenantContext, tenantFilter } from '@/lib/tenant-context'
import { getCurrentTenantId } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_ENTITIES = new Set<string>(Object.keys(ENTITY_CONFIG))

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const entity = sp.get('entity') as EntityType | null
    const format = (sp.get('format') || 'csv').toLowerCase()
    const isTemplate = sp.get('template') === 'true'

    if (!entity || !VALID_ENTITIES.has(entity)) {
      return NextResponse.json(
        { success: false, error: `Invalid entity. Valid: ${Array.from(VALID_ENTITIES).join(', ')}` },
        { status: 400 },
      )
    }
    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'format must be csv or xlsx' },
        { status: 400 },
      )
    }

    // Auth + tenant context. Reference-data exports only require auth; tenant-
    // scoped exports require 'data' read permission.
    const auth = TENANT_SCOPED_ENTITIES.has(entity as EntityType)
      ? await requirePermission('data', 'read')
      : await requireAuth()
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const tid = getCurrentTenantId(auth.session)

    if (isTemplate) {
      const tpl = buildTemplate(entity)
      const filename = `template_${entity}_${new Date().toISOString().slice(0,10)}.${format}`
      if (format === 'csv') {
        return new NextResponse(tpl.csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      } else {
        return new NextResponse(new Uint8Array(tpl.xlsx), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      }
    }

    // Export all rows (tenant-filtered for tenant-scoped entities)
    const rows = await exportRows(entity, { tenantId: tid })
    const fields = ENTITY_CONFIG[entity].fields
    const filename = `${entity}_${new Date().toISOString().slice(0,10)}.${format}`
    if (format === 'csv') {
      const csv = rowsToCsv(rows, fields)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else {
      const buf = rowsToXlsx(rows, fields)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
  } catch (e: any) {
    console.error('bulk GET error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/** POST /api/locinsight/bulk — JSON body: { entity, rows } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entity = body.entity as EntityType | null
    const rows: Record<string, any>[] = Array.isArray(body.rows) ? body.rows : []

    if (!entity || !VALID_ENTITIES.has(entity)) {
      return NextResponse.json(
        { success: false, error: `Invalid entity. Valid: ${Array.from(VALID_ENTITIES).join(', ')}` },
        { status: 400 },
      )
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'rows is empty' }, { status: 400 })
    }
    if (rows.length > 5000) {
      return NextResponse.json(
        { success: false, error: `Too many rows: ${rows.length}. Max 5000 per request.` },
        { status: 400 },
      )
    }

    // Permission gate: reference data writes require superadmin; tenant-scoped
    // writes require 'data' create permission.
    const auth = REFERENCE_DATA_ENTITIES.has(entity)
      ? await requireSuperadmin()
      : await requirePermission('data', 'create')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const tid = getCurrentTenantId(auth.session)
    const result = await bulkUpsert(entity, rows, { tenantId: tid })

    return NextResponse.json({
      success: true,
      entity,
      total: rows.length,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      error_count: result.errors.length,
    })
  } catch (e: any) {
    console.error('bulk POST error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

/** PUT /api/locinsight/bulk — bulk update only (no create). Body: { entity, rows } */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const entity = body.entity as EntityType | null
    const rows: Record<string, any>[] = Array.isArray(body.rows) ? body.rows : []

    if (!entity || !VALID_ENTITIES.has(entity)) {
      return NextResponse.json(
        { success: false, error: `Invalid entity. Valid: ${Array.from(VALID_ENTITIES).join(', ')}` },
        { status: 400 },
      )
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'rows is empty' }, { status: 400 })
    }

    // Permission gate: same as POST.
    const auth = REFERENCE_DATA_ENTITIES.has(entity)
      ? await requireSuperadmin()
      : await requirePermission('data', 'update')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const tid = getCurrentTenantId(auth.session)
    const isTenantScoped = TENANT_SCOPED_ENTITIES.has(entity)
    const tf = tenantFilter(auth.session)

    const cfg = ENTITY_CONFIG[entity]
    let updated = 0
    let skipped = 0
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const idVal = row[cfg.idField]
        if (!idVal || idVal === '') {
          skipped++
          continue
        }

        // For tenant-scoped entities, verify ownership before updating
        if (isTenantScoped && tid) {
          const existing = await cfg.model.findFirst({
            where: { [cfg.idField]: idVal, ...tf },
          })
          if (!existing) {
            skipped++
            continue
          }
        } else {
          // Reference data — superadmin-only (already enforced above)
          const existing = await cfg.model.findUnique({ where: { [cfg.idField]: idVal } })
          if (!existing) {
            skipped++
            continue
          }
        }
        // Coerce types — only update fields that are present and not the PK
        const coerced: Record<string, any> = {}
        for (const f of cfg.fields) {
          if (f.key === cfg.idField) continue
          const v = row[f.key]
          if (v === undefined || v === null || v === '') continue
          if (f.type === 'number') {
            const n = Number(v)
            coerced[f.key] = isNaN(n) ? 0 : n
          } else if (f.type === 'boolean') {
            coerced[f.key] = ['true','yes','1','y','t'].includes(String(v).toLowerCase())
          } else {
            coerced[f.key] = String(v)
          }
        }
        // Never allow tenant_id to be changed via PUT
        delete coerced.tenant_id

        if (isTenantScoped && tid) {
          // updateMany with tenant_id in WHERE — prevents cross-tenant mutation
          await cfg.model.updateMany({
            where: { [cfg.idField]: idVal, ...tf },
            data: coerced,
          })
        } else {
          await cfg.model.update({ where: { [cfg.idField]: idVal }, data: coerced })
        }
        updated++
      } catch (e: any) {
        errors.push({ row: i + 2, error: e.message })
      }
    }

    return NextResponse.json({
      success: true,
      entity,
      total: rows.length,
      updated,
      skipped,
      errors,
      error_count: errors.length,
    })
  } catch (e: any) {
    console.error('bulk PUT error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
