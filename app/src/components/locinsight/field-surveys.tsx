'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ClipboardList, CheckCircle2, XCircle, Download, RefreshCw,
  Smartphone, MapPin, Calendar, ExternalLink,
} from 'lucide-react'

interface Survey {
  id: string
  kelurahan_id: string | null
  kelurahan_name: string
  lat: number
  lng: number
  accuracy_m: number | null
  surveyor_name: string
  survey_type: string
  brand_name: string | null
  brand_category: string | null
  outlet_name: string | null
  address: string | null
  is_in_mall: boolean
  mall_name: string | null
  condition: string | null
  estimated_size_m2: number | null
  foot_traffic_observation: string | null
  notes: string
  photo_urls: string
  review_status: string
  reviewer_notes: string
  submittedAt: string
  reviewedAt: string | null
}

export function FieldSurveys() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const url = `/api/locinsight/field-survey?status=${filter}&limit=200`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setSurveys(json.data)
      else toast.error(json.error || 'Failed to load')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  async function review(id: string, status: 'approved' | 'rejected' | 'imported', notes = '') {
    try {
      const res = await fetch('/api/locinsight/field-survey', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, review_status: status, reviewer_notes: notes }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Survey ${status}`)
        await load()
      } else {
        toast.error(json.error || 'Review failed')
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function exportCsv() {
    try {
      const rows = surveys.map(s => ({
        id: s.id,
        submitted_at: s.submittedAt,
        surveyor: s.surveyor_name,
        type: s.survey_type,
        kelurahan: s.kelurahan_name,
        lat: s.lat,
        lng: s.lng,
        accuracy_m: s.accuracy_m,
        brand: s.brand_name || '',
        outlet: s.outlet_name || '',
        in_mall: s.is_in_mall,
        mall: s.mall_name || '',
        condition: s.condition || '',
        size_m2: s.estimated_size_m2 || '',
        foot_traffic: s.foot_traffic_observation || '',
        notes: s.notes,
        status: s.review_status,
      }))
      const headers = Object.keys(rows[0] || {})
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => `"${String((r as any)[h] || '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `field-surveys-${filter}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    imported: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
            Field Surveys Review
          </h2>
          <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
            Review surveys submitted by field surveyors via the PWA. Approve / reject / import as competitor.
          </p>
        </div>
        <a href="/survey" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Smartphone className="w-4 h-4 mr-1" /> Open PWA
          </Button>
        </a>
      </div>

      {/* Filters */}
      <Card className="card-premium">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'imported'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md uppercase tracking-wider ${filter === s ? 'bg-[var(--brand-red)] text-white' : 'bg-[var(--brand-cream)] text-[var(--brand-ink)]/70'}`}
            >
              {s}
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={load} className="ml-auto">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={surveys.length === 0}>
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : surveys.length === 0 ? (
        <Card className="card-premium">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
            <div className="text-[14px] text-[var(--brand-ink)]/60">No {filter} surveys</div>
            <div className="text-[11px] text-[var(--brand-ink)]/40 mt-1">
              Field surveyors can submit data at <a href="/survey" className="text-[var(--brand-red)] underline">/survey</a> (installable PWA, works offline)
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <Card key={s.id} className="card-premium">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[9px] uppercase ${statusColors[s.review_status] || ''}`}>
                        {s.review_status}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">{s.survey_type.replace(/_/g, ' ')}</Badge>
                      {s.brand_name && <Badge variant="outline" className="text-[9px]">{s.brand_name}</Badge>}
                    </div>
                    <div className="text-[14px] font-bold text-[var(--brand-ink)]">{s.outlet_name || s.kelurahan_name || 'Unnamed survey'}</div>
                    <div className="text-[11px] text-[var(--brand-ink)]/60">
                      by <strong>{s.surveyor_name}</strong> · {new Date(s.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[var(--brand-red)] hover:underline flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> {s.lat.toFixed(5)}, {s.lng.toFixed(5)} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  {s.kelurahan_name && <Detail label="Kelurahan" value={s.kelurahan_name} />}
                  {s.accuracy_m && <Detail label="GPS Accuracy" value={`±${Math.round(s.accuracy_m)}m`} />}
                  {s.address && <Detail label="Address" value={s.address} />}
                  {s.is_in_mall && <Detail label="Mall" value={s.mall_name || '—'} />}
                  {s.condition && <Detail label="Condition" value={s.condition} />}
                  {s.estimated_size_m2 && <Detail label="Size (m²)" value={String(s.estimated_size_m2)} />}
                  {s.foot_traffic_observation && <Detail label="Foot Traffic" value={s.foot_traffic_observation} />}
                  {s.brand_category && <Detail label="Brand Category" value={s.brand_category} />}
                </div>

                {s.notes && (
                  <div className="bg-[var(--brand-cream)] p-2 rounded text-[12px] text-[var(--brand-ink)]/85">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-0.5">Notes</div>
                    {s.notes}
                  </div>
                )}

                {s.review_status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-[var(--brand-border)]">
                    <Button size="sm" onClick={() => review(s.id, 'approved')}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => review(s.id, 'imported')}>
                      <Download className="w-3 h-3 mr-1" /> Import as Competitor
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => review(s.id, 'rejected')}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {s.reviewer_notes && (
                  <div className="text-[11px] text-[var(--brand-ink)]/60 italic">Reviewer: {s.reviewer_notes}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-[var(--brand-ink)]/55">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
