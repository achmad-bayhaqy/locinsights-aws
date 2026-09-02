'use client'

import { useState, useEffect } from 'react'
import { MapPin, Camera, Send, Wifi, WifiOff, CheckCircle2, Clock } from 'lucide-react'

interface SurveyForm {
  surveyor_name: string
  survey_type: string
  kelurahan_id: string
  kelurahan_name: string
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  brand_name: string
  brand_category: string
  outlet_name: string
  address: string
  is_in_mall: boolean
  mall_name: string
  condition: string
  estimated_size_m2: number | null
  foot_traffic_observation: string
  notes: string
}

const INITIAL_FORM: SurveyForm = {
  surveyor_name: '',
  survey_type: 'site_visit',
  kelurahan_id: '',
  kelurahan_name: '',
  lat: null,
  lng: null,
  accuracy_m: null,
  brand_name: '',
  brand_category: '',
  outlet_name: '',
  address: '',
  is_in_mall: false,
  mall_name: '',
  condition: '',
  estimated_size_m2: null,
  foot_traffic_observation: '',
  notes: '',
}

export default function SurveyPage() {
  const [form, setForm] = useState<SurveyForm>(INITIAL_FORM)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    refreshPendingCount()
  }, [])

  // Refresh pending count from IndexedDB
  async function refreshPendingCount() {
    try {
      const db = await openDB()
      const tx = db.transaction('pending-surveys', 'readonly')
      const countReq = tx.objectStore('pending-surveys').count()
      countReq.onsuccess = () => setPendingCount(countReq.result)
    } catch {}
  }

  function getLocation() {
    setLocating(true)
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({
          ...f,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }))
        setLocating(false)
      },
      (err) => {
        setError(`Location error: ${err.message}`)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('locinsight-surveys', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('pending-surveys')) {
          db.createObjectStore('pending-surveys', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function submitSurvey() {
    setError(null)
    setSuccess(null)
    if (!form.surveyor_name) {
      setError('Surveyor name is required')
      return
    }
    if (form.lat == null || form.lng == null) {
      setError('Location is required — tap "Get GPS Location"')
      return
    }

    const payload = { ...form, id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }

    if (isOnline) {
      // Try direct submit
      try {
        const res = await fetch('/api/locinsight/field-survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setSuccess('Survey submitted successfully!')
          setSubmittedCount(c => c + 1)
          setForm(INITIAL_FORM)
          return
        }
        // Fall through to offline queue
      } catch {
        // Fall through to offline queue
      }
    }

    // Queue offline
    try {
      const db = await openDB()
      const tx = db.transaction('pending-surveys', 'readwrite')
      await tx.objectStore('pending-surveys').put(payload)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      setPendingCount(c => c + 1)
      setSuccess('Saved offline — will sync when online')
      setForm(INITIAL_FORM)
    } catch (e: any) {
      setError(`Failed to save: ${e.message}`)
    }
  }

  async function syncNow() {
    if (!isOnline) {
      setError('Cannot sync while offline')
      return
    }
    try {
      const db = await openDB()
      const tx = db.transaction('pending-surveys', 'readonly')
      const allReq = tx.objectStore('pending-surveys').getAll()
      allReq.onsuccess = async () => {
        const all = allReq.result as any[]
        let synced = 0
        for (const survey of all) {
          const res = await fetch('/api/locinsight/field-survey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(survey),
          })
          if (res.ok) {
            const delTx = db.transaction('pending-surveys', 'readwrite')
            delTx.objectStore('pending-surveys').delete(survey.id)
            synced++
          }
        }
        setSuccess(`Synced ${synced} survey${synced === 1 ? '' : 's'}`)
        setSubmittedCount(c => c + synced)
        refreshPendingCount()
      }
    } catch (e: any) {
      setError(`Sync failed: ${e.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1a1a1a]">
      <header className="bg-[#7A0A1A] text-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/60">LocInsights</div>
            <div className="text-[16px] font-bold">Field Surveyor</div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-amber-300" />}
            <span className={isOnline ? 'text-white/80' : 'text-amber-300'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-3 border border-[#e5e0d8]">
            <div className="text-[10px] uppercase tracking-wider text-[#1a1a1a]/60 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pending Sync
            </div>
            <div className="text-[24px] font-bold text-amber-600">{pendingCount}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-[#e5e0d8]">
            <div className="text-[10px] uppercase tracking-wider text-[#1a1a1a]/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Submitted
            </div>
            <div className="text-[24px] font-bold text-green-600">{submittedCount}</div>
          </div>
        </div>

        {pendingCount > 0 && isOnline && (
          <button
            onClick={syncNow}
            className="w-full bg-amber-500 text-white py-2 rounded-md text-[13px] font-medium"
          >
            Sync {pendingCount} pending survey{pendingCount === 1 ? '' : 's'} now
          </button>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg p-4 border border-[#e5e0d8] space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Surveyor Name *</label>
            <input
              type="text"
              value={form.surveyor_name}
              onChange={e => setForm(f => ({ ...f, surveyor_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Survey Type</label>
            <select
              value={form.survey_type}
              onChange={e => setForm(f => ({ ...f, survey_type: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
            >
              <option value="site_visit">Site Visit</option>
              <option value="competitor_audit">Competitor Audit</option>
              <option value="mall_audit">Mall Audit</option>
              <option value="market_observations">Market Observations</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Location *</label>
            <button
              type="button"
              onClick={getLocation}
              disabled={locating}
              className="w-full px-3 py-2 bg-[#7A0A1A] text-white rounded-md text-[13px] font-medium flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              {locating ? 'Getting location…' : 'Get GPS Location'}
            </button>
            {form.lat != null && (
              <div className="mt-1 text-[11px] text-[#1a1a1a]/60 font-mono">
                {form.lat.toFixed(5)}, {form.lng?.toFixed(5)} · ±{Math.round(form.accuracy_m ?? 0)}m
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Kelurahan / Area Name</label>
            <input
              type="text"
              value={form.kelurahan_name}
              onChange={e => setForm(f => ({ ...f, kelurahan_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="e.g., Legian, Kuta"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Brand Observed</label>
            <input
              type="text"
              value={form.brand_name}
              onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="e.g., Starbucks, Indomaret"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Outlet Name</label>
            <input
              type="text"
              value={form.outlet_name}
              onChange={e => setForm(f => ({ ...f, outlet_name: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="Specific outlet name"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="Street address"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_in_mall"
              checked={form.is_in_mall}
              onChange={e => setForm(f => ({ ...f, is_in_mall: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="is_in_mall" className="text-[13px]">Located inside a mall</label>
          </div>

          {form.is_in_mall && (
            <div>
              <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Mall Name</label>
              <input
                type="text"
                value={form.mall_name}
                onChange={e => setForm(f => ({ ...f, mall_name: e.target.value }))}
                className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
                placeholder="e.g., Beachwalk Shopping Center"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Store Condition</label>
            <select
              value={form.condition}
              onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
            >
              <option value="">— Select —</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="under_construction">Under Construction</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Foot Traffic</label>
            <select
              value={form.foot_traffic_observation}
              onChange={e => setForm(f => ({ ...f, foot_traffic_observation: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
            >
              <option value="">— Select —</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="very_high">Very High</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Estimated Size (m²)</label>
            <input
              type="number"
              value={form.estimated_size_m2 ?? ''}
              onChange={e => setForm(f => ({ ...f, estimated_size_m2: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              placeholder="e.g., 120"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#1a1a1a]/80 block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-[#e5e0d8] rounded-md text-[13px]"
              rows={3}
              placeholder="Observations, accessibility, nearby competitors, etc."
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-[12px] p-2 rounded-md">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-[12px] p-2 rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {success}
            </div>
          )}

          <button
            onClick={submitSurvey}
            className="w-full bg-[#7A0A1A] text-white py-3 rounded-md text-[14px] font-bold flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isOnline ? 'Submit Survey' : 'Save Offline'}
          </button>
        </div>

        <div className="text-center text-[10px] text-[#1a1a1a]/40 py-4">
          LocInsights Field Surveyor · Phase 3 PWA · v3.0
        </div>
      </main>
    </div>
  )
}
