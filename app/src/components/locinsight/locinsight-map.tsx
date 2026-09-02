'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  LayerGroup,
  ZoomControl,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import type { OpportunityScore, Store, Mall, POI } from './types'
import { HeatLayer } from './heat-layer'
import { ChoroplethLayer } from './choropleth-layer'
import {
  ChoroplethDemographicsLayer,
  METRIC_LABELS,
  COLOR_SCALES,
  type DemoMetric,
  type DemoGranularity,
  type DemoRegionRow,
} from './choropleth-demographics-layer'

// Fix default icon path issue with Next.js + Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom divIcon for category-coded markers
function brandMarker(category: string, parent: 'MAP' | 'MAA'): L.DivIcon {
  const colors: Record<string, string> = {
    food_beverage: '#C8102E',
    sports: '#0F0F12',
    fashion: '#9B0E24',
    department_store: '#5C5C5C',
    kids: '#D45F4A',
    lifestyle: '#A33A2A',
    beauty: '#B71C3A',
  }
  const color = colors[category] || '#666'
  const letter = parent === 'MAA' ? 'A' : 'M'
  return L.divIcon({
    className: 'li-marker',
    html: `<div class="li-marker-pin" style="background:${color}"><span>${letter}</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  })
}

function mallMarker(): L.DivIcon {
  return L.divIcon({
    className: 'li-marker',
    html: `<div class="li-marker-pin" style="background:#0F0F12;width:28px;height:28px;border:3px solid #C8102E"><span style="color:#fff">M</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24],
  })
}

function poiMarker(type: string): L.DivIcon {
  // Civic POIs: muted gray tones (universities, hospitals, transit, office, etc.)
  const colors: Record<string, string> = {
    transit_hub: '#2A2A2A',
    university: '#5C5C5C',
    hospital: '#B71C3A',
    office_cluster: '#4A4A4A',
    port: '#3D7EA6',
    market: '#7B6F4E',
    school: '#6B7280',
    government: '#374151',
    stadium: '#92400E',
    airport: '#1E40AF',
  }
  const color = colors[type] || '#666'
  return L.divIcon({
    className: 'li-marker',
    html: `<div style="width:12px;height:12px;border-radius:2px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  })
}

function touristPoiMarker(type: string): L.DivIcon {
  // Tourist POIs: warm vibrant colors (beaches, temples, attractions, hotels)
  const colors: Record<string, string> = {
    tourist_attraction: '#D45F4A',
    beach: '#3D7EA6',
    temple: '#8B5A2B',
    hotel_cluster: '#7B6F4E',
  }
  const color = colors[type] || '#0891b2'
  return L.divIcon({
    className: 'li-marker',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  })
}

// Component to fly to a location
function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.2 })
  }, [lat, lng, zoom, map])
  return null
}

// Map DOUBLE-click handler — fires when the user double-clicks anywhere on the
// map background (not on a marker). Per user request (Aug 2026):
//   "I want to double-click any point on the map and instantly analyze the
//    nearest location, even outside the kecamatan points."
//
// 2026 best practice: use `dblclick` (not `click`) for "deep analyze" actions
// so it doesn't conflict with single-click pan/drag, and disable the default
// `doubleClickZoom` so the map doesn't zoom in while the user is analyzing.
//
// Also shows a temporary "you-clicked-here" marker + popup at the clicked
// spot for visual feedback (cleared after 6s).
function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!onClick) return
    // Disable default double-click-zoom so it doesn't fight with the analyze action
    map.doubleClickZoom.disable()
    const handler = (e: L.LeafletMouseEvent) => {
      onClick(e.latlng.lat, e.latlng.lng)
    }
    map.on('dblclick', handler)
    return () => {
      map.off('dblclick', handler)
      // Re-enable default behavior when this handler unmounts
      map.doubleClickZoom.enable()
    }
  }, [map, onClick])
  return null
}

// Component to drop a temporary "you clicked here" marker + popup at the
// clicked location, so the user gets immediate visual feedback that their
// double-click registered — even before the analysis card finishes updating.
function ClickFeedbackMarker({ point }: { point: { lat: number; lng: number; html: string } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!point) return
    // Drop a small red target marker with a popup at the clicked spot
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: '#0F0F12',
      fillColor: '#C8102E',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map)
    marker.bindPopup(point.html, {
      maxWidth: 280,
      className: 'li-click-popup',
      closeButton: true,
    }).openPopup()
    // Auto-remove after 6 seconds
    const t = setTimeout(() => {
      map.removeLayer(marker)
    }, 6000)
    return () => {
      clearTimeout(t)
      map.removeLayer(marker)
    }
  }, [point, map])
  return null
}

// User location marker — blue dot with accuracy circle (Leaflet CircleMarker + pulsing dot)
function UserLocationMarker({ lat, lng, accuracy }: { lat: number; lng: number; accuracy: number }) {
  const map = useMap()
  // Fly to user location when it first arrives
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.2 })
  }, [lat, lng, map])
  return (
    <>
      <CircleMarker
        center={[lat, lng]}
        radius={Math.max(8, Math.min(40, accuracy / 3))}
        pathOptions={{
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          weight: 1,
        }}
      />
      <CircleMarker
        center={[lat, lng]}
        radius={7}
        pathOptions={{
          color: '#fff',
          fillColor: '#2563eb',
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>
          <div style={{ fontSize: 12, minWidth: 180 }}>
            <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>
              📍 Your location
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              Accuracy: ±{Math.round(accuracy)}m
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  )
}

export interface CompetitorPin {
  id: string
  brand_name: string
  brand_category?: string
  name: string
  lat: number
  lng: number
  kec?: string
  kab?: string
  city?: string
  address?: string
  is_in_mall?: boolean
  mall_name?: string | null
  source?: string
}

export interface LocInsightMapProps {
  opportunities: OpportunityScore[]
  stores: Store[]
  malls: Mall[]
  pois: POI[]
  selectedKelurahanId: string | null
  onSelectKelurahan: (id: string) => void
  showStores: boolean
  showMalls: boolean
  /** Civic POIs (universities, hospitals, transit, market, government, etc.) */
  showCivicPOIs: boolean
  /** Tourist POIs (beaches, temples, attractions, hotels) */
  showTouristPOIs: boolean
  showHeat: boolean
  /** 'region' = choropleth (real GADM polygons); 'point' = leaflet.heat intensity; 'cells' = choropleth-colored kelurahan cells */
  heatMode?: 'region' | 'point' | 'cells'
  /** Choropleth granularity — kabupaten (9) or kecamatan (59) */
  heatGranularity?: 'kabupaten' | 'kecamatan'
  /** Choropleth metric (only used when heatMode='region' or 'cells') */
  heatMetric?: 'avg_score' | 'max_score' | 'high_priority_count' | 'store_density'
  tierFilter: 1 | 2 | 3 | 'all'
  recommendationFilter: 'all' | 'high_priority' | 'priority' | 'monitor' | 'avoid'
  /** Competitor layer */
  showCompetitors?: boolean
  competitors?: CompetitorPin[]
  competitorBrandFilter?: string
  /** Demographics choropleth layer */
  showDemographics?: boolean
  demoMetric?: DemoMetric
  demoGranularity?: DemoGranularity
  demoData?: DemoRegionRow[]
  /** Crowd density heatmap (leaflet.heat) */
  showCrowdDensity?: boolean
  /** Called when a choropleth region (kabupaten/kecamatan polygon) is clicked. */
  onRegionClick?: (regionName: string, granularity: 'kabupaten' | 'kecamatan') => void
  /** Called when user double-clicks on empty map area (no marker). Receives lat/lng. */
  onMapClick?: (lat: number, lng: number) => void
  /** Optional: a {lat,lng,html} tuple to render a temporary "you clicked here" marker + popup. */
  clickFeedback?: { lat: number; lng: number; html: string } | null
  height?: string
}

export function LocInsightMap({
  opportunities,
  stores,
  malls,
  pois,
  selectedKelurahanId,
  onSelectKelurahan,
  showStores,
  showMalls,
  showCivicPOIs,
  showTouristPOIs,
  showHeat,
  heatMode = 'region',
  heatGranularity = 'kabupaten',
  heatMetric = 'avg_score',
  tierFilter,
  recommendationFilter,
  showCompetitors = false,
  competitors = [],
  competitorBrandFilter = 'all',
  showDemographics = false,
  demoMetric = 'income_index',
  demoGranularity = 'kabupaten',
  demoData = [],
  showCrowdDensity = false,
  onRegionClick,
  onMapClick,
  clickFeedback = null,
  height = '600px',
}: LocInsightMapProps) {
  const [mapReady, setMapReady] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const selected = opportunities.find(o => o.kelurahan_id === selectedKelurahanId)

  // Bali center: roughly -8.4, 115.2
  const center: [number, number] = [-8.45, 115.2]
  const initialZoom = 10

  const filteredOpps = useMemo(() => {
    return opportunities.filter(o => {
      if (tierFilter !== 'all' && o.tier !== tierFilter) return false
      if (recommendationFilter !== 'all' && o.recommendation !== recommendationFilter) return false
      return true
    })
  }, [opportunities, tierFilter, recommendationFilter])

  const filteredStores = useMemo(() => {
    if (!showStores) return []
    return stores.filter(s => {
      if (tierFilter === 'all') return true
      const kabTier: Record<string, number> = {
        Badung: 1, Denpasar: 1,
        Tabanan: 2, Gianyar: 2, Buleleng: 2,
        Jembrana: 3, Klungkung: 3, Bangli: 3, Karangasem: 3,
      }
      return kabTier[s.kab] === tierFilter
    })
  }, [stores, showStores, tierFilter])

  const heatPoints = useMemo(
    () => filteredOpps.map(o => [o.lat, o.lng, o.composite_score / 100] as [number, number, number]),
    [filteredOpps]
  )

  const filteredCompetitors = useMemo(() => {
    if (!showCompetitors) return []
    if (competitorBrandFilter === 'all') return competitors
    return competitors.filter(c => c.brand_name === competitorBrandFilter)
  }, [competitors, showCompetitors, competitorBrandFilter])

  // Split POIs into tourist vs civic — they are now mutually exclusive layers
  const touristTypes = ['tourist_attraction', 'beach', 'temple', 'hotel_cluster']
  const { touristPOIs, civicPOIs } = useMemo(() => {
    const tour: POI[] = []
    const civ: POI[] = []
    for (const p of pois) {
      if (touristTypes.includes(p.type)) tour.push(p)
      else civ.push(p)
    }
    return { touristPOIs: tour, civicPOIs: civ }
  }, [pois])

  const visibleCivicPOIs = useMemo(() => (showCivicPOIs ? civicPOIs : []), [civicPOIs, showCivicPOIs])
  const visibleTouristPOIs = useMemo(() => (showTouristPOIs ? touristPOIs : []), [touristPOIs, showTouristPOIs])

  // Crowd density heat points: combine tourist POIs + malls + stores + competitors
  const crowdPoints = useMemo(() => {
    if (!showCrowdDensity) return []
    const pts: Array<[number, number, number]> = []
    touristPOIs.forEach(p => pts.push([p.lat, p.lng, 0.4]))
    civicPOIs.forEach(p => pts.push([p.lat, p.lng, 0.2]))
    malls.forEach(m => pts.push([m.lat, m.lng, 0.8]))
    stores.forEach(s => pts.push([s.lat, s.lng, 0.5]))
    competitors.forEach(c => pts.push([c.lat, c.lng, 0.4]))
    return pts
  }, [touristPOIs, civicPOIs, malls, stores, competitors, showCrowdDensity])

  // ===== Request user's GPS location =====
  const requestLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 50,
        })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        const messages: Record<number, string> = {
          1: 'Location permission denied. Please allow location access in your browser settings.',
          2: 'Location unavailable. Check your GPS or network connection.',
          3: 'Location request timed out. Try again.',
        }
        setGeoError(messages[err.code] || `Location error: ${err.message}`)
        // Auto-clear error after 6 seconds
        setTimeout(() => setGeoError(null), 6000)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  return (
    <div style={{ height, width: '100%' }} className="relative rounded-lg overflow-hidden border border-[var(--brand-border)]">
      <MapContainer
        center={center}
        zoom={initialZoom}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomright" />

        {selected && <FlyTo lat={selected.lat} lng={selected.lng} zoom={13} />}

        {/* Map click handler — finds nearest opportunity when user double-clicks anywhere on the map */}
        <MapClickHandler onClick={onMapClick} />

        {/* Click-feedback marker — temporary popup at the double-clicked spot */}
        <ClickFeedbackMarker point={clickFeedback} />

        {/* ===== User's GPS location marker (blue dot) ===== */}
        {userLocation && (
          <UserLocationMarker
            lat={userLocation.lat}
            lng={userLocation.lng}
            accuracy={userLocation.accuracy}
          />
        )}

        {/* ===== Demographics choropleth (income, urban index, etc.) ===== */}
        {showDemographics && demoData.length > 0 && (
          <ChoroplethDemographicsLayer
            data={demoData}
            metric={demoMetric}
            granularity={demoGranularity}
            showLabels
          />
        )}

        {/* ===== Opportunity choropleth or point heatmap ===== */}
        {showHeat && heatMode === 'region' && (
          <ChoroplethLayer
            opportunities={filteredOpps}
            metric={heatMetric}
            granularity={heatGranularity}
            showLabels
            activeTier={tierFilter}
            onRegionClick={onRegionClick}
          />
        )}
        {showHeat && heatMode === 'point' && (
          <HeatLayer
            points={heatPoints}
            radius={32}
            blur={28}
            maxZoom={11}
            minOpacity={0.4}
            max={0.6}
          />
        )}

        {/* Opportunity markers
         *  - heatMode 'cells'  = choropleth-colored kelurahan cells (quantile-based YlOrRd)
         *  - heatMode 'point' or 'region' = recommendation-colored circle markers
         *
         * IMPORTANT (Aug 2026 user feedback): When the Opportunity layer is OFF
         * (showHeat === false), NO markers should appear at all. Previously the
         * LayerGroup rendered unconditionally — dots stayed visible even after
         * unchecking, with popups showing Composite Score, Daily Customers, etc.
         * Now the whole LayerGroup is gated behind showHeat.
         *
         * Additionally, when heatMode === 'region' (true GADM polygon choropleth),
         * we suppress these markers entirely — the ChoroplethLayer above handles
         * visualization with filled polygons, and dots would just clutter the map.
         */}
        {showHeat && heatMode !== 'region' && (
          <LayerGroup>
            {filteredOpps.map(o => {
              const isSelected = o.kelurahan_id === selectedKelurahanId
              // Choropleth-cells mode: use YlOrRd quantile coloring based on composite_score
              if (heatMode === 'cells') {
                // ColorBrewer YlOrRd 7-step (matches choropleth-layer.tsx)
                const CELL_COLORS = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026']
                // Compute quantile breaks from current filteredOpps scores
                const scores: number[] = filteredOpps.map(x => x.composite_score).sort((a, b) => a - b)
                const breaks: number[] = []
                for (let i = 1; i < 7; i++) breaks.push(scores[Math.floor((i / 7) * scores.length)] ?? 0)
                let colorIdx = 0
                for (let i = breaks.length - 1; i >= 0; i--) {
                  if (o.composite_score >= breaks[i]) { colorIdx = Math.min(i + 1, CELL_COLORS.length - 1); break }
                }
                const cellColor = CELL_COLORS[colorIdx]
                return (
                  <CircleMarker
                    key={o.kelurahan_id}
                    center={[o.lat, o.lng]}
                    radius={isSelected ? 14 : 9}
                    pathOptions={{
                      color: isSelected ? '#0F0F12' : '#0F0F12',
                      fillColor: cellColor,
                      fillOpacity: isSelected ? 0.95 : 0.78,
                      weight: isSelected ? 3 : 0.6,
                    }}
                    eventHandlers={{ click: () => onSelectKelurahan(o.kelurahan_id) }}
                  >
                    <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                      <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                        <strong>{o.kelurahan_name}</strong><br />
                        {o.kec_name}, {o.kab_name}<br />
                        Score: <strong style={{ color: cellColor === '#ffffcc' || cellColor === '#ffeda0' ? '#666' : cellColor }}>{o.composite_score}</strong> · {o.recommendation.replace('_', ' ')}
                      </div>
                    </Tooltip>
                    <Popup>
                      <div style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{o.kelurahan_name}</div>
                        <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
                          {o.kec_name} · {o.kab_name} · Tier {o.tier}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>Composite Score</span>
                          <strong style={{ color: '#C8102E' }}>{o.composite_score}/100</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>Est. Daily Customers</span>
                          <strong>{o.estimated_daily_customers}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>Proj. Monthly Rev.</span>
                          <strong>Rp {o.projected_monthly_revenue_juta} jt</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                          <span>Market Share</span>
                          <strong>{(o.potential_market_share * 100).toFixed(1)}%</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#666', borderTop: '1px solid #eee', paddingTop: 8 }}>
                          {o.nearest_mall_name ? `Nearest mall: ${o.nearest_mall_name} (${o.nearest_mall_distance_km}km)` : 'No mall nearby'}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              }
              // Default: recommendation-colored markers (heatMode === 'point')
              const color =
                o.recommendation === 'high_priority' ? '#C8102E' :
                o.recommendation === 'priority' ? '#D45F4A' :
                o.recommendation === 'monitor' ? '#A08070' :
                '#B0B0B0'
              const radius = isSelected ? 14 : 6 + Math.round(o.composite_score / 12)
              return (
                <CircleMarker
                  key={o.kelurahan_id}
                  center={[o.lat, o.lng]}
                  radius={radius}
                  pathOptions={{
                    color: isSelected ? '#0F0F12' : color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.95 : 0.6,
                    weight: isSelected ? 3 : 1,
                  }}
                  eventHandlers={{
                    click: () => onSelectKelurahan(o.kelurahan_id),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                    <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                      <strong>{o.kelurahan_name}</strong><br />
                      {o.kec_name}, {o.kab_name}<br />
                      Score: <strong style={{ color: '#C8102E' }}>{o.composite_score}</strong> · {o.recommendation.replace('_', ' ')}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{o.kelurahan_name}</div>
                      <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
                        {o.kec_name} · {o.kab_name} · Tier {o.tier}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>Composite Score</span>
                        <strong style={{ color: '#C8102E' }}>{o.composite_score}/100</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>Est. Daily Customers</span>
                        <strong>{o.estimated_daily_customers}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>Proj. Monthly Rev.</span>
                        <strong>Rp {o.projected_monthly_revenue_juta} jt</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                        <span>Market Share</span>
                        <strong>{(o.potential_market_share * 100).toFixed(1)}%</strong>
                      </div>
                      <div style={{ fontSize: 11, color: '#666', borderTop: '1px solid #eee', paddingTop: 8 }}>
                        {o.nearest_mall_name ? `Nearest mall: ${o.nearest_mall_name} (${o.nearest_mall_distance_km}km)` : 'No mall nearby'}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </LayerGroup>
        )}

        {/* Mall markers */}
        {showMalls && malls.filter(m => m.visitor_estimate_daily > 0).map(m => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={mallMarker()}>
            <Tooltip direction="top" offset={[0, -25]} opacity={1}>
              <div style={{ fontSize: '11px' }}>
                <strong>{m.name}</strong><br />
                {m.kec}, {m.kab}<br />
                GLA: {(m.gla_m2 / 1000).toFixed(0)}k m² · {m.class.replace('_', ' ')}
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{m.name}</div>
                <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>{m.kec}, {m.kab}</div>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Opened: <strong>{m.opened_year}</strong></div>
                <div style={{ fontSize: 12, marginBottom: 2 }}>GLA: <strong>{(m.gla_m2 / 1000).toFixed(1)}k m²</strong></div>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Class: <strong>{m.class.replace('_', ' ')}</strong></div>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Est. daily visitors: <strong>{m.visitor_estimate_daily.toLocaleString()}</strong></div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Store markers */}
        {filteredStores.map(s => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={brandMarker(s.brand_category, s.parent)}
          >
            <Tooltip direction="top" offset={[0, -22]} opacity={1}>
              <div style={{ fontSize: '11px' }}>
                <strong>{s.brand_name}</strong><br />
                {s.name}<br />
                {s.is_in_mall ? `📍 ${s.mall_name}` : s.address}
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#C8102E' }}>{s.brand_name}</div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                  {s.is_in_mall ? `📍 ${s.mall_name}` : s.address}<br />
                  {s.kec}, {s.kab}
                </div>
                <div style={{ fontSize: 11, display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
                  <span>Category:</span><strong>{s.brand_category.replace('_', ' ')}</strong>
                  <span>Parent:</span><strong>{s.parent === 'MAA' ? 'MAP Active' : 'MAP'}</strong>
                  <span>Opened:</span><strong>{s.opened_year}</strong>
                  <span>In Mall:</span><strong>{s.is_in_mall ? 'Yes' : 'No'}</strong>
                  <span>Verified:</span><strong>{s.confirmed ? 'Yes' : 'Est.'}</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Tourist attraction markers (warm colors, circular) */}
        {visibleTouristPOIs.map(p => (
          <Marker key={`tourist-${p.id}`} position={[p.lat, p.lng]} icon={touristPoiMarker(p.type)}>
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div style={{ fontSize: '11px' }}>
                <strong>{p.name}</strong><br />
                {p.type.replace('_', ' ')} · {p.kab}
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0891b2' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{p.type.replace('_', ' ')} · {p.kec}, {p.kab}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{p.notes}</div>
                <div style={{ fontSize: 11, color: '#666' }}>Magnitude: <strong>{p.magnitude}</strong> · Source: <strong>{p.source}</strong></div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Civic POI markers (muted, square) */}
        {visibleCivicPOIs.map(p => (
          <Marker key={`civic-${p.id}`} position={[p.lat, p.lng]} icon={poiMarker(p.type)}>
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div style={{ fontSize: '11px' }}>
                <strong>{p.name}</strong><br />
                {p.type.replace('_', ' ')} · {p.kab}
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#5C5C5C' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{p.type.replace('_', ' ')} · {p.kec}, {p.kab}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{p.notes}</div>
                <div style={{ fontSize: 11, color: '#666' }}>Magnitude: <strong>{p.magnitude}</strong> · Source: <strong>{p.source}</strong></div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Competitor store markers (red circles) */}
        {showCompetitors && filteredCompetitors.map(c => (
          <CircleMarker
            key={`comp-${c.id}`}
            center={[c.lat, c.lng]}
            radius={4}
            pathOptions={{
              color: '#dc2626',
              fillColor: '#dc2626',
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -5]} opacity={1}>
              <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                <strong>{c.brand_name}</strong><br />
                {c.name}<br />
                {c.kec ? `${c.kec}, ` : ''}{c.kab || ''}
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: '#dc2626' }}>{c.brand_name}</div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6, lineHeight: 1.5 }}>
                  {c.is_in_mall ? `📍 ${c.mall_name || 'In Mall'}<br/>` : ''}
                  {c.address ? `🏠 ${c.address}<br/>` : ''}
                  {c.kec ? `🏘️ Kec. ${c.kec}<br/>` : ''}
                  {c.kab ? `🏛️ Kab. ${c.kab}<br/>` : ''}
                  {c.city ? ` Kota ${c.city}<br/>` : ''}
                </div>
                <div style={{ fontSize: 11, display: 'grid', gridTemplateColumns: '1fr auto', gap: 3, paddingTop: 4, borderTop: '1px solid #eee' }}>
                  <span>Category:</span><strong>{(c.brand_category || 'other').replace('_', ' ')}</strong>
                  <span>Source:</span><strong>{c.source || '—'}</strong>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Crowd density heatmap (leaflet.heat) */}
        {showCrowdDensity && crowdPoints.length > 0 && (
          <HeatLayer
            points={crowdPoints}
            radius={25}
            blur={20}
            maxZoom={12}
            minOpacity={0.3}
            max={0.8}
            gradient={{
              0.0: '#fef3c7',
              0.2: '#fde68a',
              0.4: '#fb923c',
              0.6: '#ef4444',
              0.8: '#b91c1c',
              1.0: '#7f1d1d',
            }}
          />
        )}
      </MapContainer>

      {/* Map legend overlay — dynamic based on active layers */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg border border-[var(--brand-border)] shadow-sm p-3 text-xs space-y-2 z-[1000] max-w-[230px]">
        <div className="font-semibold text-[11px] uppercase tracking-wider text-[var(--brand-ink)]">Legend</div>

        {showHeat && heatMode === 'cells' && (
          <div className="pt-1 border-t border-[var(--brand-border)]">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-[var(--brand-red)] mb-1">
              Opportunity Score (choropleth cells)
            </div>
            <div className="flex items-center gap-0.5">
              {['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'].map((c, i) => (
                <span key={i} className="w-4 h-3 inline-block rounded-sm" style={{ background: c }} title={`Step ${i + 1}`} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-[var(--brand-ink)]/60 mt-0.5">
              <span>Low score</span>
              <span>High score</span>
            </div>
            <div className="text-[9.5px] text-[var(--brand-ink)]/55 mt-1">Each cell = one kelurahan, colored by quantile.</div>
          </div>
        )}
        {showHeat && heatMode !== 'cells' && (
          <>
            <div className="font-semibold text-[10px] uppercase tracking-wider text-[var(--brand-red)] pt-1 border-t border-[var(--brand-border)]">Opportunity</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#C8102E' }}></span>High priority (≥70)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#D45F4A' }}></span>Priority (55–69)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#A08070' }}></span>Monitor (40–54)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#B0B0B0' }}></span>Avoid (&lt;40)</div>
          </>
        )}

        {showDemographics && demoData.length > 0 && (
          <div className="pt-1 border-t border-[var(--brand-border)]">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-[var(--brand-ink)] mb-1">
              {METRIC_LABELS[demoMetric]}
            </div>
            <div className="flex items-center gap-0.5">
              {COLOR_SCALES[demoMetric].map((c, i) => (
                <span key={i} className="w-4 h-3 inline-block" style={{ background: c }} title={`Step ${i + 1}`} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-[var(--brand-ink)]/60 mt-0.5">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        )}

        {showMalls && <div className="flex items-center gap-2 pt-1 border-t border-[var(--brand-border)]"><span className="w-3 h-3 rounded-full" style={{ background: '#0F0F12', border: '2px solid #C8102E' }}></span>Mall</div>}
        {showStores && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#C8102E' }}></span>MAP Store · <span style={{ background: '#0F0F12' }} className="w-3 h-3 rounded-full inline-block"></span>MAA Store</div>}
        {showCompetitors && <div className="flex items-center gap-2 pt-1 border-t border-[var(--brand-border)]"><span className="w-3 h-3 rounded-full" style={{ background: '#dc2626' }}></span>Competitor Store</div>}
        {showTouristPOIs && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: '#0891b2' }}></span>Tourist Attraction</div>}
        {showCivicPOIs && <div className="flex items-center gap-2"><span className="w-3 h-3" style={{ background: '#5C5C5C' }}></span>Civic POI (Hospital, University, Transit, Office)</div>}
        {showCrowdDensity && <div className="flex items-center gap-2 pt-1 border-t border-[var(--brand-border)]"><span className="w-3 h-3 rounded-full" style={{ background: '#fb923c' }}></span>Crowd Density (heat)</div>}
        {userLocation && <div className="flex items-center gap-2 pt-1 border-t border-[var(--brand-border)]"><span className="w-3 h-3 rounded-full" style={{ background: '#2563eb', border: '2px solid #fff', boxShadow: '0 0 0 1px #2563eb' }}></span>Your location</div>}
      </div>

      {/* ===== "Use My Location" button — top-right of map ===== */}
      <button
        onClick={requestLocation}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm border border-[var(--brand-border)] rounded-lg shadow-sm text-[11.5px] font-medium text-[var(--brand-ink)] hover:bg-white hover:border-[var(--brand-red)] hover:text-[var(--brand-red)] transition-colors disabled:opacity-60 disabled:cursor-wait"
        title="Center the map on your current GPS location"
      >
        {locating ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-[var(--brand-red)] border-t-transparent rounded-full animate-spin" />
            <span>Locating…</span>
          </>
        ) : userLocation ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] border-2 border-white shadow-sm" />
            <span>My Location</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
            <span>Use My Location</span>
          </>
        )}
      </button>

      {/* ===== Geolocation error toast ===== */}
      {geoError && (
        <div className="absolute top-16 right-3 z-[1000] max-w-[260px] bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-md shadow-md px-3 py-2 flex items-start gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{geoError}</span>
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1100]">
          <div className="text-sm text-[var(--brand-ink)]">Loading map…</div>
        </div>
      )}

      {/* ===== "Double-click to analyze" hint pill — bottom-center ===== */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand-ink)]/85 backdrop-blur-sm text-white text-[10.5px] font-medium shadow-md whitespace-nowrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>Double-click anywhere to analyze nearest location</span>
        </div>
      </div>
    </div>
  )
}
