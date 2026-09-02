'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { OpportunityScore } from './types'

/**
 * ChoroplethLayer — uses real Bali administrative boundaries (GADM v4.1).
 *
 * Best practices followed (Aug 2026):
 *   - Felt.com / Placer.ai: choropleth must use real admin polygons, not point buffers
 *   - ColorBrewer YlOrRd scheme for sequential data (perception-correct, color-blind safe)
 *   - Quantile classification for balanced color distribution
 *   - Labels at polygon centroid (computed via bounding box, not vertex average)
 *   - Hover tooltip with metric value
 *
 * GeoJSON source: GADM v4.1 (https://gadm.org/) — public, free for academic use.
 * Files served from /public/geojson/bali-{kabupaten,kecamatan}.geojson
 */

export interface ChoroplethLayerProps {
  opportunities: OpportunityScore[]
  /** Score aggregation metric */
  metric: 'avg_score' | 'max_score' | 'high_priority_count' | 'store_density'
  /** Region granularity: 'kabupaten' (9 polygons) or 'kecamatan' (~59 polygons) */
  granularity?: 'kabupaten' | 'kecamatan'
  /** Show labels on each region */
  showLabels?: boolean
  /** Filter to a specific tier (1/2/3) — others shown faded */
  activeTier?: 1 | 2 | 3 | 'all'
  /** Called when a region polygon is clicked. Receives the region name (kabupaten or kecamatan) + granularity. */
  onRegionClick?: (regionName: string, granularity: 'kabupaten' | 'kecamatan') => void
}

// ColorBrewer YlOrRd 7-step (perception-correct sequential reds)
const COLOR_SCALE = [
  '#ffffcc', // 0
  '#ffeda0',
  '#fed976',
  '#feb24c',
  '#fd8d3c',
  '#fc4e2a',
  '#e31a1c',
  '#b10026', // max
]

function quantile(value: number, breaks: number[]): number {
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (value >= breaks[i]) return Math.min(i + 1, COLOR_SCALE.length - 1)
  }
  return 0
}

function getColor(index: number): string {
  return COLOR_SCALE[Math.max(0, Math.min(COLOR_SCALE.length - 1, index))]
}

/** Compute quantile breaks from a list of values */
function computeBreaks(values: number[], steps = 7): number[] {
  if (values.length === 0) return [0, 0, 0, 0, 0, 0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  const breaks: number[] = []
  for (let i = 1; i < steps; i++) {
    const idx = Math.floor((i / steps) * sorted.length)
    breaks.push(sorted[Math.min(idx, sorted.length - 1)])
  }
  return breaks
}

interface RegionStats {
  sum: number
  max: number
  count: number
  hpCount: number
  tier: number
  opportunities: OpportunityScore[]
}

export function ChoroplethLayer({
  opportunities,
  metric,
  granularity = 'kabupaten',
  showLabels = true,
  activeTier = 'all',
  onRegionClick,
}: ChoroplethLayerProps) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)

  // Load GeoJSON once
  useEffect(() => {
    const url = granularity === 'kabupaten'
      ? '/geojson/bali-kabupaten.geojson'
      : '/geojson/bali-kecamatan.geojson'
    fetch(url)
      .then(r => r.json())
      .then(data => setGeoData(data))
      .catch(e => console.error('Failed to load GeoJSON:', e))
  }, [granularity])

  // Aggregate opportunities per region
  const perRegion = useMemo(() => {
    const m = new Map<string, RegionStats>()
    for (const o of opportunities) {
      // For kabupaten granularity, key on kab_name
      // For kecamatan granularity, key on kec_name
      const key = granularity === 'kabupaten' ? o.kab_name : o.kec_name
      const r = m.get(key) || { sum: 0, max: 0, count: 0, hpCount: 0, tier: o.tier, opportunities: [] }
      r.sum += o.composite_score
      r.max = Math.max(r.max, o.composite_score)
      r.count += 1
      if (o.recommendation === 'high_priority') r.hpCount += 1
      r.opportunities.push(o)
      m.set(key, r)
    }
    return m
  }, [opportunities, granularity])

  // Compute quantile breaks for the chosen metric
  const breaks = useMemo(() => {
    const values: number[] = []
    perRegion.forEach(r => {
      let v = 0
      switch (metric) {
        case 'avg_score': v = r.count > 0 ? r.sum / r.count : 0; break
        case 'max_score': v = r.max; break
        case 'high_priority_count': v = r.hpCount; break
        case 'store_density': v = r.count; break
      }
      values.push(v)
    })
    return computeBreaks(values, 7)
  }, [perRegion, metric])

  // Render the GeoJSON layer
  useEffect(() => {
    if (!geoData) return

    // Clear previous layers
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const layerGroup = L.layerGroup()
    layerRef.current = layerGroup
    layerGroup.addTo(map)

    const labelMarkers: L.Marker[] = []

    geoData.features.forEach(feature => {
      const props = feature.properties || {}
      // GADM property names: NAME_1=Bali (province), NAME_2=kabupaten, NAME_3=kecamatan
      const regionName = granularity === 'kabupaten'
        ? props.NAME_2
        : props.NAME_3 || props.NAME_2

      if (!regionName) return

      // Normalize: remove spaces (GADM "KutaSelatan" vs DB "Kuta Selatan")
      const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')
      const normalizedRegion = normalize(regionName)

      // Find matching stats
      let stats: RegionStats | undefined
      for (const [key, value] of perRegion.entries()) {
        if (normalize(key) === normalizedRegion) {
          stats = value
          break
        }
      }
      // Also try prefix match (GADM "KutaSelatan" should match DB "Kuta Selatan")
      if (!stats) {
        for (const [key, value] of perRegion.entries()) {
          const nk = normalize(key)
          if (nk === normalizedRegion || nk.includes(normalizedRegion) || normalizedRegion.includes(nk)) {
            stats = value
            break
          }
        }
      }

      let value = 0
      let displayValue = '—'
      let colorIdx = 0

      if (stats) {
        switch (metric) {
          case 'avg_score':
            value = stats.count > 0 ? stats.sum / stats.count : 0
            displayValue = value.toFixed(1)
            colorIdx = quantile(value, breaks)
            break
          case 'max_score':
            value = stats.max
            displayValue = value.toFixed(0)
            colorIdx = quantile(value, breaks)
            break
          case 'high_priority_count':
            value = stats.hpCount
            displayValue = value.toString()
            colorIdx = quantile(value, breaks)
            break
          case 'store_density':
            value = stats.count
            displayValue = value.toString()
            colorIdx = quantile(value, breaks)
            break
        }
      }

      const isActive = activeTier === 'all' || (stats?.tier === activeTier)
      const fillOpacity = isActive ? (stats ? 0.7 : 0.15) : 0.1
      const weight = isActive ? 1.2 : 0.6

      const geoLayer = L.geoJSON(feature, {
        style: {
          color: '#0F0F12',
          weight,
          opacity: 0.5,
          fillColor: getColor(colorIdx),
          fillOpacity,
        },
        onEachFeature: (_, lyr) => {
          const metricLabel =
            metric === 'avg_score' ? 'Avg Score' :
            metric === 'max_score' ? 'Max Score' :
            metric === 'high_priority_count' ? 'High-Priority Sites' :
            'Kelurahan Count'

          lyr.bindTooltip(
            `<div style="font-size:11px;line-height:1.4;min-width:140px">
              <strong style="font-size:12px">${regionName}</strong>${stats?.tier ? `<br/>Tier ${stats.tier}` : ''}<br/>
              <span style="color:#666">${metricLabel}:</span> <strong style="color:#C8102E">${displayValue}</strong><br/>
              <span style="color:#666">Kelurahan:</span> <strong>${stats?.count || 0}</strong><br/>
              <span style="color:#666">High-priority:</span> <strong>${stats?.hpCount || 0}</strong>
            </div>`,
            { sticky: true, direction: 'top' }
          )

          // Click handler — select the top opportunity in this region
          if (onRegionClick && stats && stats.opportunities.length > 0) {
            lyr.on('click', () => {
              onRegionClick(regionName, granularity)
            })
            // Add cursor pointer style on hover
            lyr.on('mouseover', () => {
              ;(lyr as L.Path).setStyle({ weight: 2.5, color: '#0F0F12', opacity: 0.9 })
              if (map.getContainer) {
                try { map.getContainer().style.cursor = 'pointer' } catch {}
              }
            })
            lyr.on('mouseout', () => {
              ;(lyr as L.Path).setStyle({ weight, color: '#0F0F12', opacity: 0.5 })
              if (map.getContainer) {
                try { map.getContainer().style.cursor = '' } catch {}
              }
            })
          } else {
            lyr.on('mouseover', () => {
              ;(lyr as L.Path).setStyle({ weight: 2.5, color: '#0F0F12', opacity: 0.9 })
            })
            lyr.on('mouseout', () => {
              ;(lyr as L.Path).setStyle({ weight, color: '#0F0F12', opacity: 0.5 })
            })
          }
        },
      })

      geoLayer.addTo(layerGroup)

      // Add label at the polygon's bounding-box center
      if (showLabels && isActive && stats) {
        const bounds = geoLayer.getBounds()
        if (bounds.isValid()) {
          const center = bounds.getCenter()
          const label = L.marker(center, {
            icon: L.divIcon({
              className: 'kab-label',
              html: `<div style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;color:#0F0F12;background:rgba(255,255,255,0.92);padding:1px 6px;border-radius:3px;border:1px solid rgba(0,0,0,0.15);white-space:nowrap;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <div>${regionName}</div>
                <div style="color:${getColor(colorIdx)};font-weight:700">${displayValue}</div>
              </div>`,
              iconSize: [80, 28],
              iconAnchor: [40, 14],
            }),
            interactive: false,
          })
          label.addTo(layerGroup)
          labelMarkers.push(label)
        }
      }
    })

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, geoData, perRegion, metric, showLabels, activeTier, breaks, granularity, onRegionClick])

  return null
}
