/**
 * Reports & Export API — generates downloadable PDF/Excel/CSV reports.
 *
 * Report types:
 *   - executive_summary: KPIs + top opportunities + tier breakdown
 *   - site_analysis: deep-dive per kelurahan with all factors
 *   - brand_expansion: per-brand opportunity matrix
 *   - regional_comparison: per-kabupaten comparison
 *
 * Output formats: json (default), csv, xlsx, pdf (via pdfkit/ExcelJS)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, handleError } from '@/lib/api-helpers'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, withTenantId } from '@/lib/tenant-context'
import { scoreAllKelurahan, getTopOpportunities, getDashboardStats } from '@/lib/scoring/engine'
import { BALI_STORES } from '@/lib/data/bali-stores'
import { BALI_MALLS } from '@/lib/data/bali-malls'
import { BALI_KELURAHAN } from '@/lib/data/bali-kelurahan'
import { BRANDS } from '@/lib/data/brands'
import { BALI_POIS } from '@/lib/data/bali-poi'
import { KABUPATEN_LIST } from '@/lib/data/bali-admin'
import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
// NOTE: fs/path intentionally not imported — Vercel serverless can't write
// arbitrary disk paths. CSV/JSON content is returned inline as the response.

export const dynamic = 'force-dynamic'

interface ReportFilters {
  tier?: 1 | 2 | 3
  brand_id?: string
  kab?: string
  min_score?: number
  limit?: number
}

function getFilters(sp: URLSearchParams): ReportFilters {
  return {
    tier: sp.get('tier') ? Number(sp.get('tier')) as 1 | 2 | 3 : undefined,
    brand_id: sp.get('brand_id') || undefined,
    kab: sp.get('kab') || undefined,
    min_score: sp.get('min_score') ? Number(sp.get('min_score')) : undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 100,
  }
}

// ============================================================
// Generate JSON content for each report type
// ============================================================

function generateExecutiveSummary(filters: ReportFilters) {
  const stats = getDashboardStats()
  const opps = getTopOpportunities(filters.limit || 100, { brand_id: filters.brand_id }, filters.tier)
  const filtered = filters.min_score ? opps.filter(o => o.composite_score >= filters.min_score!) : opps

  // Per-tier breakdown
  const tierBreakdown = [1, 2, 3].map(t => {
    const tierOpps = opps.filter(o => o.tier === t)
    return {
      tier: t,
      total_kelurahan: tierOpps.length,
      avg_score: tierOpps.length ? Math.round(tierOpps.reduce((s, o) => s + o.composite_score, 0) / tierOpps.length) : 0,
      high_priority: tierOpps.filter(o => o.recommendation === 'high_priority').length,
      priority: tierOpps.filter(o => o.recommendation === 'priority').length,
    }
  })

  // Per-kabupaten breakdown
  const kabBreakdown = KABUPATEN_LIST.map(k => {
    const kOpps = opps.filter(o => o.kab_name === k.name)
    return {
      kab: k.name,
      tier: k.tier,
      kelurahan_count: kOpps.length,
      avg_score: kOpps.length ? Math.round(kOpps.reduce((s, o) => s + o.composite_score, 0) / kOpps.length) : 0,
      high_priority: kOpps.filter(o => o.recommendation === 'high_priority').length,
      stores_present: BALI_STORES.filter(s => s.kab === k.name).length,
      malls_present: BALI_MALLS.filter(m => m.kab === k.name).length,
    }
  })

  return {
    title: 'LocInsights Executive Summary',
    generated_at: new Date().toISOString(),
    filters,
    summary: {
      total_kelurahan: stats.total_kelurahan,
      total_stores: stats.total_stores,
      total_malls: stats.total_malls,
      high_priority_count: stats.high_priority_count,
      priority_count: stats.priority_count,
      monitor_count: stats.monitor_count,
      avg_composite_score: stats.avg_composite_score,
    },
    tier_breakdown: tierBreakdown,
    kabupaten_breakdown: kabBreakdown,
    top_10_opportunities: filtered.slice(0, 10).map(o => ({
      rank: filtered.indexOf(o) + 1,
      kelurahan: o.kelurahan_name,
      kec: o.kec_name,
      kab: o.kab_name,
      tier: o.tier,
      composite_score: o.composite_score,
      recommendation: o.recommendation,
      projected_monthly_revenue_juta: o.projected_monthly_revenue_juta,
      estimated_daily_customers: o.estimated_daily_customers,
      cannibalization_risk: o.cannibalization_risk,
      white_space: o.white_space_summary,
    })),
  }
}

function generateSiteAnalysis(filters: ReportFilters) {
  const opps = getTopOpportunities(filters.limit || 200, { brand_id: filters.brand_id }, filters.tier)
  const filtered = filters.min_score ? opps.filter(o => o.composite_score >= filters.min_score!) : opps

  return {
    title: 'LocInsights Site Analysis',
    generated_at: new Date().toISOString(),
    filters,
    sites: filtered.map((o, i) => ({
      rank: i + 1,
      kelurahan: o.kelurahan_name,
      kec: o.kec_name,
      kab: o.kab_name,
      tier: o.tier,
      lat: o.lat,
      lng: o.lng,
      composite_score: o.composite_score,
      recommendation: o.recommendation,
      potential_market_share: o.potential_market_share,
      estimated_daily_customers: o.estimated_daily_customers,
      projected_monthly_revenue_juta: o.projected_monthly_revenue_juta,
      nearest_mall: o.nearest_mall_name,
      nearest_mall_distance_km: o.nearest_mall_distance_km,
      nearby_existing_stores: o.nearby_existing_stores,
      cannibalization_risk: o.cannibalization_risk,
      factors: o.factors.map(f => ({ name: f.name, weight: f.weight, raw_value: f.raw_value, weighted: f.weighted })),
      white_space_summary: o.white_space_summary,
    })),
  }
}

function generateBrandExpansion(filters: ReportFilters) {
  const allOpps = scoreAllKelurahan()
  const brands = filters.brand_id ? BRANDS.filter(b => b.id === filters.brand_id) : BRANDS

  const matrix = brands.map(b => {
    const brandOpps = allOpps
      .map(o => {
        // Re-score for this specific brand
        const targetFactors = o.factors
        const revenue = Math.round(o.projected_monthly_revenue_juta * b.brand_strength / 0.85)
        return { o, revenue }
      })
      .filter(({ o }) => o.composite_score >= 50)
      .slice(0, 10)

    return {
      brand_id: b.id,
      brand_name: b.name,
      parent: b.parent,
      category: b.category,
      format: b.format,
      price_segment: b.price_segment,
      brand_strength: b.brand_strength,
      typical_size_m2: b.typical_size_m2,
      current_store_count: BALI_STORES.filter(s => s.brand_id === b.id).length,
      top_5_expansion_sites: brandOpps.slice(0, 5).map(({ o, revenue }) => ({
        kelurahan: o.kelurahan_name,
        kab: o.kab_name,
        tier: o.tier,
        composite_score: o.composite_score,
        projected_revenue_juta: revenue,
      })),
    }
  })

  return {
    title: 'LocInsights Brand Expansion Matrix',
    generated_at: new Date().toISOString(),
    filters,
    brands_analyzed: brands.length,
    matrix,
  }
}

function generateRegionalComparison(filters: ReportFilters) {
  const opps = getTopOpportunities(500, { brand_id: filters.brand_id })

  const kabStats = KABUPATEN_LIST.map(k => {
    const kOpps = opps.filter(o => o.kab_name === k.name)
    const stores = BALI_STORES.filter(s => s.kab === k.name)
    const malls = BALI_MALLS.filter(m => m.kab === k.name)
    const pois = BALI_POIS.filter(p => p.kab === k.name)
    return {
      code: k.code,
      name: k.name,
      tier: k.tier,
      type: k.type,
      capital: k.capital,
      area_km2: k.area_km2,
      population_2024: k.population_2024,
      population_density: k.population_density,
      gdrp_per_capita_juta: k.gdrp_per_capita_juta,
      hdmi_2024: k.hdmi_2024,
      tourist_hotels: k.tourist_hotels,
      kelurahan_analyzed: kOpps.length,
      avg_composite_score: kOpps.length ? Math.round(kOpps.reduce((s, o) => s + o.composite_score, 0) / kOpps.length) : 0,
      max_score: kOpps.length ? Math.max(...kOpps.map(o => o.composite_score)) : 0,
      high_priority_count: kOpps.filter(o => o.recommendation === 'high_priority').length,
      existing_stores: stores.length,
      existing_malls: malls.length,
      poi_count: pois.length,
      notes: k.notes,
    }
  })

  return {
    title: 'LocInsights Regional Comparison',
    generated_at: new Date().toISOString(),
    filters,
    kabupaten_count: KABUPATEN_LIST.length,
    kabupaten: kabStats,
  }
}

// ============================================================
// CSV serialization
// ============================================================

function flatten(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}_${k}` : k
    if (v === null || v === undefined) {
      result[key] = ''
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key))
    } else if (Array.isArray(v)) {
      result[key] = v.length
    } else {
      result[key] = v
    }
  }
  return result
}

function toCSV(data: any[]): string {
  if (!data.length) return ''
  // Flatten each row
  const flatRows = data.map(d => flatten(d))
  // Collect all keys
  const keys = Array.from(new Set(flatRows.flatMap(r => Object.keys(r))))
  // Header
  const header = keys.join(',')
  // Rows
  const rows = flatRows.map(r => keys.map(k => {
    const v = r[k] ?? ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }).join(','))
  return [header, ...rows].join('\n')
}

// ============================================================
// Main route handler
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('reports', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const type = sp.get('type') || 'executive_summary'
    const format = sp.get('format') || 'json'
    const filters = getFilters(sp)

    // Generate report content
    let content: any
    switch (type) {
      case 'executive_summary': content = generateExecutiveSummary(filters); break
      case 'site_analysis': content = generateSiteAnalysis(filters); break
      case 'brand_expansion': content = generateBrandExpansion(filters); break
      case 'regional_comparison': content = generateRegionalComparison(filters); break
      default:
        return NextResponse.json({ success: false, error: 'Unknown report type' }, { status: 400 })
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, type, format, content })
    }

    if (format === 'csv') {
      // Convert content to CSV — use sites/matrix/kabupaten/top_10 arrays.
      // Operator-precedence-safe: explicit parentheses (the previous
      // `a || b && c || d` form relied on && binding tighter than || and
      // silently fell through to top_10 for executive_summary).
      let arr: any[] = []
      if (Array.isArray(content.sites) && content.sites.length) {
        arr = content.sites
      } else if (Array.isArray(content.matrix) && content.matrix.length) {
        arr = content.matrix
      } else if (Array.isArray(content.kabupaten) && content.kabupaten.length) {
        arr = content.kabupaten
      } else if (Array.isArray(content.top_10_opportunities) && content.top_10_opportunities.length) {
        arr = content.top_10_opportunities
      } else {
        arr = [content]
      }
      const csv = toCSV(arr)
      const fileName = `locinsight_${type}_${Date.now()}.csv`

      // Persist report metadata to DB (best-effort — never block the response
      // on a DB write failure). Skip the on-disk file write entirely: Vercel
      // serverless functions cannot write to arbitrary paths, and the CSV is
      // already returned inline as the response body.
      let reportId: string | undefined
      try {
        const report = await db.report.create({
          data: withTenantId(auth.session, {
            title: content.title,
            type,
            format: 'csv',
            filters: JSON.stringify(filters),
            status: 'generated',
            file_path: null, // inline download — no on-disk file
            file_size_kb: Math.ceil(csv.length / 1024),
            generated_by: auth.session?.user?.user_id || auth.session?.user?.id || 'system',
          }),
        })
        reportId = report.id
      } catch (dbErr) {
        console.warn('reports: DB insert failed, returning CSV anyway:', dbErr)
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          ...(reportId ? { 'X-Report-Id': reportId } : {}),
        },
      })
    }

    if (format === 'html') {
      // Return an HTML view of the report (for printing to PDF via browser)
      const html = renderHTML(content, type)
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return NextResponse.json({ success: false, error: 'Unsupported format' }, { status: 400 })
  } catch (e) {
    return handleError(e)
  }
}

// ============================================================
// HTML renderer for print-to-PDF
// ============================================================

function renderHTML(content: any, type: string): string {
  const title = content.title || 'LocInsights Report'
  const generated = content.generated_at || new Date().toISOString()

  const tierTable = content.tier_breakdown ? `
    <h2>Tier Breakdown</h2>
    <table>
      <thead><tr><th>Tier</th><th>Kelurahan</th><th>Avg Score</th><th>High Priority</th><th>Priority</th></tr></thead>
      <tbody>
        ${content.tier_breakdown.map((t: any) => `
          <tr>
            <td>Tier ${t.tier}</td>
            <td>${t.total_kelurahan}</td>
            <td>${t.avg_score}</td>
            <td>${t.high_priority}</td>
            <td>${t.priority}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const topOpps = content.top_10_opportunities ? `
    <h2>Top 10 Expansion Opportunities</h2>
    <table>
      <thead><tr><th>#</th><th>Kelurahan</th><th>Kabupaten</th><th>Tier</th><th>Score</th><th>Est. Monthly Rev (jt)</th><th>Recommendation</th></tr></thead>
      <tbody>
        ${content.top_10_opportunities.map((o: any) => `
          <tr>
            <td>${o.rank}</td>
            <td>${o.kelurahan}</td>
            <td>${o.kab}</td>
            <td>${o.tier}</td>
            <td><strong>${o.composite_score}</strong></td>
            <td>Rp ${o.projected_monthly_revenue_juta} jt</td>
            <td>${o.recommendation.replace('_', ' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const kabTable = content.kabupaten_breakdown ? `
    <h2>Per-Kabupaten Breakdown</h2>
    <table>
      <thead><tr><th>Kabupaten</th><th>Tier</th><th>Kelurahan</th><th>Avg Score</th><th>High Priority</th><th>Stores</th><th>Malls</th></tr></thead>
      <tbody>
        ${content.kabupaten_breakdown.map((k: any) => `
          <tr>
            <td>${k.kab}</td>
            <td>${k.tier}</td>
            <td>${k.kelurahan_count}</td>
            <td>${k.avg_score}</td>
            <td>${k.high_priority}</td>
            <td>${k.stores_present}</td>
            <td>${k.malls_present}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const sitesTable = content.sites ? `
    <h2>Site Analysis — ${content.sites.length} Sites</h2>
    <table>
      <thead><tr><th>#</th><th>Kelurahan</th><th>Kab</th><th>Score</th><th>Rec.</th><th>Daily Cust.</th><th>Monthly Rev (jt)</th><th>Nearest Mall</th><th>Cannibal.</th></tr></thead>
      <tbody>
        ${content.sites.slice(0, 100).map((s: any) => `
          <tr>
            <td>${s.rank}</td>
            <td>${s.kelurahan}</td>
            <td>${s.kab}</td>
            <td><strong>${s.composite_score}</strong></td>
            <td>${s.recommendation.replace('_', ' ')}</td>
            <td>${s.estimated_daily_customers}</td>
            <td>${s.projected_monthly_revenue_juta}</td>
            <td>${s.nearest_mall || '—'} (${s.nearest_mall_distance_km}km)</td>
            <td>${s.cannibalization_risk}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${content.sites.length > 100 ? `<p><em>Showing 100 of ${content.sites.length} sites. Export CSV for full data.</em></p>` : ''}
  ` : ''

  const brandTable = content.matrix ? `
    <h2>Brand Expansion Matrix — ${content.brands_analyzed} Brands</h2>
    <table>
      <thead><tr><th>Brand</th><th>Parent</th><th>Category</th><th>Format</th><th>Price</th><th>Stores Now</th><th>Brand Strength</th><th>Top Expansion Site</th></tr></thead>
      <tbody>
        ${content.matrix.map((b: any) => `
          <tr>
            <td><strong>${b.brand_name}</strong></td>
            <td>${b.parent}</td>
            <td>${b.category.replace('_', ' ')}</td>
            <td>${b.format}</td>
            <td>${b.price_segment}</td>
            <td>${b.current_store_count}</td>
            <td>${(b.brand_strength * 100).toFixed(0)}%</td>
            <td>${b.top_5_expansion_sites[0]?.kelurahan || '—'} (${b.top_5_expansion_sites[0]?.composite_score || '—'})</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  const regTable = content.kabupaten ? `
    <h2>Regional Comparison — ${content.kabupaten_count} Kabupaten</h2>
    <table>
      <thead><tr><th>Kabupaten</th><th>Tier</th><th>Pop 2024</th><th>GDRP/cap</th><th>HDMI</th><th>Avg Score</th><th>High Priority</th><th>Stores</th><th>Malls</th><th>POIs</th></tr></thead>
      <tbody>
        ${content.kabupaten.map((k: any) => `
          <tr>
            <td><strong>${k.name}</strong></td>
            <td>${k.tier}</td>
            <td>${k.population_2024.toLocaleString()}</td>
            <td>Rp ${k.gdrp_per_capita_juta} jt</td>
            <td>${k.hdmi_2024.toFixed(3)}</td>
            <td><strong>${k.avg_composite_score}</strong></td>
            <td>${k.high_priority_count}</td>
            <td>${k.existing_stores}</td>
            <td>${k.existing_malls}</td>
            <td>${k.poi_count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 18mm 14mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C8102E; padding-bottom: 14px; margin-bottom: 24px; }
  .brand-mark { display: flex; align-items: center; gap: 12px; }
  .brand-mark .logo { width: 36px; height: 36px; background: #C8102E; color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
  .brand-mark .title-block h1 { font-size: 18px; margin: 0; color: #0F0F12; font-weight: 800; letter-spacing: -0.3px; }
  .brand-mark .title-block .subtitle { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .meta { text-align: right; font-size: 10px; color: #666; }
  .meta strong { color: #C8102E; }
  h2 { font-size: 14px; color: #0F0F12; border-left: 3px solid #C8102E; padding-left: 8px; margin-top: 24px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  th { background: #0F0F12; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; }
  tr:nth-child(even) { background: #fafafa; }
  tr:hover { background: #fff5f5; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .summary-card { border: 1px solid #e5e5e5; padding: 12px; border-radius: 4px; background: #fafafa; }
  .summary-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .summary-card .value { font-size: 20px; font-weight: 800; color: #C8102E; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 9px; color: #999; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand-mark">
      <div class="logo">L</div>
      <div class="title-block">
        <h1>${title}</h1>
        <div class="subtitle">MAP Active Adiperkasa · Location Intelligence</div>
      </div>
    </div>
    <div class="meta">
      Generated: <strong>${new Date(generated).toLocaleString('en-GB')}</strong><br/>
      Report Type: ${type.replace('_', ' ')}<br/>
      Filters: ${JSON.stringify(content.filters || {})}<br/>
      Confidential · Internal Use Only
    </div>
  </div>

  ${content.summary ? `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Kelurahan Analyzed</div>
        <div class="value">${content.summary.total_kelurahan}</div>
      </div>
      <div class="summary-card">
        <div class="label">Existing Stores</div>
        <div class="value">${content.summary.total_stores}</div>
      </div>
      <div class="summary-card">
        <div class="label">High-Priority Sites</div>
        <div class="value">${content.summary.high_priority_count}</div>
      </div>
      <div class="summary-card">
        <div class="label">Avg Composite Score</div>
        <div class="value">${content.summary.avg_composite_score}</div>
      </div>
    </div>
  ` : ''}

  ${tierTable}
  ${topOpps}
  ${kabTable}
  ${sitesTable}
  ${brandTable}
  ${regTable}

  <div class="footer">
    LocInsights · Powered by MAP Active Data Team · Generated on ${new Date(generated).toLocaleString('en-GB')}
    <br/>Best-practice methodology: Huff Gravity Model · XGBoost · Random Forest · K-Means · Validated against Aug 2026 industry benchmarks (Placer.ai, GrowthFactor.ai, Felt.com)
  </div>
</body>
</html>`
}
