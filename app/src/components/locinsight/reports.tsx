'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, FileSpreadsheet, FileJson, Printer, Clock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-provider'

interface ReportHistoryItem {
  id: string
  title: string
  type: string
  format: string
  status: string
  file_path: string | null
  file_size_kb: number | null
  createdAt: string
}

export function Reports() {
  const { t } = useLanguage()
  const { data: session } = useSession()
  // Aug 2026: viewer role cannot generate/download reports (read-only).
  const canExport = session?.user?.role === 'superadmin' || session?.user?.role === 'analyst'
  const [reportType, setReportType] = useState<'executive_summary' | 'site_analysis' | 'brand_expansion' | 'regional_comparison'>('executive_summary')
  const [format, setFormat] = useState<'json' | 'csv' | 'html'>('html')
  const [tier, setTier] = useState<string>('all')
  const [brandId, setBrandId] = useState<string>('all')
  const [minScore, setMinScore] = useState<string>('')
  const [limit, setLimit] = useState<string>('100')
  const [history, setHistory] = useState<ReportHistoryItem[]>([])
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateReport() {
    setLoading(true)
    setPreviewHtml(null)
    try {
      const params = new URLSearchParams({
        type: reportType,
        format,
      })
      if (tier !== 'all') params.set('tier', tier)
      if (brandId !== 'all') params.set('brand_id', brandId)
      if (minScore) params.set('min_score', minScore)
      if (limit) params.set('limit', limit)

      const res = await fetch(`/api/locinsight/reports?${params.toString()}`)
      if (!res.ok) throw new Error(await res.text())

      if (format === 'html') {
        const html = await res.text()
        setPreviewHtml(html)
        toast.success(t('reports.toast_generated'))
      } else if (format === 'csv') {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `locinsight_${reportType}_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(t('reports.toast_csv'))

        // Add to history
        const reportId = res.headers.get('X-Report-Id')
        if (reportId) {
          setHistory(h => [{
            id: reportId,
            title: `locinsight_${reportType}`,
            type: reportType,
            format: 'csv',
            status: 'generated',
            file_path: null,
            file_size_kb: Math.ceil(blob.size / 1024),
            createdAt: new Date().toISOString(),
          }, ...h])
        }
      } else if (format === 'json') {
        const json = await res.json()
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `locinsight_${reportType}_${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(t('reports.toast_json'))
      }
    } catch (e: any) {
      toast.error(e.message || t('reports.toast_failed'))
    } finally {
      setLoading(false)
    }
  }

  function printPreview() {
    if (!previewHtml) return
    const w = window.open('', '_blank')
    if (!w) {
      toast.error(t('reports.toast_popup_blocked'))
      return
    }
    w.document.write(previewHtml)
    w.document.close()
    setTimeout(() => w.print(), 800)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('reports.title')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('reports.subtitle_full')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left: Preview */}
        <Card className="card-premium overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-[var(--brand-red)]" />
              {t('reports.preview')}
            </CardTitle>
            {previewHtml && (
              <Button size="sm" variant="default" onClick={printPreview} className="h-8 text-[12px]">
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                {t('reports.print_pdf')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <iframe
                title={t('reports.preview')}
                srcDoc={previewHtml}
                className="w-full border border-[var(--brand-border)] rounded-md bg-white"
                style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-[var(--brand-ink)]/40" style={{ height: '400px' }}>
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <div className="text-[14px] font-medium">{t('reports.no_report')}</div>
                <div className="text-[12px] mt-1 max-w-xs">
                  {t('reports.no_report_hint')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Config */}
        <div className="space-y-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                {t('reports.configuration')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('reports.report_type')}</Label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive_summary">{t('reports.executive_summary_desc')}</SelectItem>
                    <SelectItem value="site_analysis">{t('reports.site_analysis_desc')}</SelectItem>
                    <SelectItem value="brand_expansion">{t('reports.brand_expansion_desc')}</SelectItem>
                    <SelectItem value="regional_comparison">{t('reports.regional_comparison_desc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('reports.format')}</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">{t('reports.format_html')}</SelectItem>
                    <SelectItem value="csv">{t('reports.format_csv')}</SelectItem>
                    <SelectItem value="json">{t('reports.format_json')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('reports.tier_filter')}</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.all_tiers')}</SelectItem>
                    <SelectItem value="1">{t('reports.tier_1_mature')}</SelectItem>
                    <SelectItem value="2">{t('reports.tier_2_growth')}</SelectItem>
                    <SelectItem value="3">{t('reports.tier_3_untapped')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('reports.min_score')}</Label>
                  <Input
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    placeholder="0"
                    className="h-9 text-[12px]"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">{t('reports.limit')}</Label>
                  <Input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="100"
                    className="h-9 text-[12px]"
                  />
                </div>
              </div>

              <Button
                onClick={generateReport}
                disabled={loading || !canExport}
                className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white"
                title={!canExport ? t('data.viewer_read_only', { default: 'Read-only — export disabled for viewer role' }) : undefined}
              >
                {loading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {t('reports.generating')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {t('reports.generate_report')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
                {t('reports.recent')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-[12px] text-[var(--brand-ink)]/40 py-6 text-center">
                  {t('reports.no_reports')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {history.map(r => (
                    <div key={r.id} className="flex items-start gap-2 p-2 rounded border border-[var(--brand-border)] bg-white">
                      <div className="flex-shrink-0 mt-0.5">
                        {r.format === 'csv' ? <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> :
                         r.format === 'json' ? <FileJson className="w-3.5 h-3.5 text-blue-600" /> :
                         <FileText className="w-3.5 h-3.5 text-[var(--brand-red)]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11.5px] font-medium truncate">{r.title}</div>
                        <div className="text-[10px] text-[var(--brand-ink)]/50">
                          {new Date(r.createdAt).toLocaleString()} · {r.file_size_kb} KB
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-green-600" />
                        {t('reports.done')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
