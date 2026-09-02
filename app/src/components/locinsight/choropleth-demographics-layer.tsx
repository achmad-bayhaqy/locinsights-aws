'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * ChoroplethDemographicsLayer — true choropleth visualization for demographic
 * metrics (income, population density, urban index, etc.) by admin boundary.
 *
 * Best practices followed (Aug 2026 review):
 *   - Real GADM admin polygons (kabupaten=9 / kecamatan=59)
 *   - ColorBrewer sequential schemes (perception-correct, color-blind safe)
 *   - Quantile classification for balanced color distribution
 *   - Polygon labels at bounding-box centroid with metric value
 *   - Rich hover tooltips with region name, metric value, and supporting stats
 *   - Per-metric color scheme selection (YlGn for income, BuPu for density, etc.)
 *
 * Data flow:
 *   1. Loads GeoJSON polygons for the chosen granularity from /public/geojson/
 *   2. Joins polygons with aggregated demographic data (passed in via `data` prop)
 *   3. Renders filled polygons colored by metric value using quantile breaks
 */

export type DemoMetric =
  | 'income_index'
  | 'urban_index'
  | 'tourist_index'
  | 'transport_index'
  | 'poi_density_index'
  | 'population_density'
  | 'population'

export type DemoGranularity = 'kabupaten' | 'kecamatan' | 'kelurahan'

export interface DemoRegionRow {
  /** Region name (matches GADM NAME_2 for kabupaten, NAME_3 for kecamatan) */
  name: string
  /** Metric value (numeric) */
  value: number | null
  /** Population (for supporting context) */
  population?: number | null
  /** Kelurahan count in this region */
  kelurahan_count?: number
  /** Tier of region (1/2/3) */
  tier?: number | null
  /** Lat (used only for kelurahan-level point rendering) */
  lat?: number | null
  /** Lng (used only for kelurahan-level point rendering) */
  lng?: number | null
}

interface ChoroplethDemographicsLayerProps {
  /** Aggregated demographic rows per region */
  data: DemoRegionRow[]
  /** Metric to visualize */
  metric: DemoMetric
  /** Region granularity: 'kabupaten' (9 polygons) or 'kecamatan' (~59 polygons) */
  granularity: DemoGranularity
  /** Show labels on each region */
  showLabels?: boolean
}

// ColorBrewer sequential palettes (7-step, color-blind safe)
const COLOR_SCALES: Record<DemoMetric, string[]> = {
  // YlGn — for income-related (higher = greener = better purchasing power)
  income_index: ['#ffffcc', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#31a354', '#006837'],
  // OrRd — for urbanization (higher = more orange/red = more developed)
  urban_index: ['#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'],
  // PuBuGn — for tourism (higher = more blue/green = more touristic)
  tourist_index: ['#edf8fb', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#005824'],
  // BuPu — for transport (higher = more purple = better connectivity)
  transport_index: ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c', '#762a83', '#4d004b'],
  // YlOrBr — for POI density (higher = more brown = denser amenities)
  poi_density_index: ['#ffffd4', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#8c2d04'],
  // Reds — for population density (higher = more red = denser)
  population_density: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#ef3b2c', '#a50f15', '#67000d'],
  // Blues — for population (higher = more blue = larger)
  population: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
}

const METRIC_LABELS: Record<DemoMetric, string> = {
  income_index: 'Income Index',
  urban_index: 'Urbanization Index',
  tourist_index: 'Tourist Index',
  transport_index: 'Transport Index',
  poi_density_index: 'POI Density Index',
  population_density: 'Population Density (per km²)',
  population: 'Population',
}

const METRIC_FORMAT: Record<DemoMetric, (v: number) => string> = {
  income_index: v => v.toFixed(0),
  urban_index: v => v.toFixed(0),
  tourist_index: v => v.toFixed(0),
  transport_index: v => v.toFixed(0),
  poi_density_index: v => v.toFixed(0),
  population_density: v => v.toLocaleString(),
  population: v => v.toLocaleString(),
}

function quantile(value: number, breaks: number[]): number {
  // Special-case zero: returns 0 (lowest color) rather than max color
  if (value === 0) return 0
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (value > breaks[i]) return Math.min(i + 1, 6)
  }
  return 0
}

function getColor(scale: string[], index: number): string {
  return scale[Math.max(0, Math.min(scale.length - 1, index))]
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

export function ChoroplethDemographicsLayer({
  data,
  metric,
  granularity,
  showLabels = true,
}: ChoroplethDemographicsLayerProps) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)

  // Load GeoJSON once (only for kabupaten/kecamatan — kelurahan uses point markers)
  useEffect(() => {
    if (granularity === 'kelurahan') {
      setGeoData(null)
      return
    }
    const url = granularity === 'kabupaten'
      ? '/geojson/bali-kabupaten.geojson'
      : '/geojson/bali-kecamatan.geojson'
    fetch(url)
      .then(r => r.json())
      .then(setGeoData)
      .catch(e => console.error('Failed to load GeoJSON:', e))
  }, [granularity])

  // Build lookup map: normalized region name → DemoRegionRow
  const lookup = useMemo(() => {
    const m = new Map<string, DemoRegionRow>()
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')
    for (const row of data) {
      m.set(normalize(row.name), row)
    }
    return m
  }, [data])

  // Compute quantile breaks for the chosen metric
  const breaks = useMemo(() => {
    const values = data
      .filter(r => r.value != null && !Number.isNaN(r.value))
      .map(r => r.value as number)
    return computeBreaks(values, 7)
  }, [data, metric])

  const scale = COLOR_SCALES[metric]

  // Render the GeoJSON layer
  useEffect(() => {
    if (!geoData) return

    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const layerGroup = L.layerGroup()
    layerRef.current = layerGroup
    layerGroup.addTo(map)

    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')

    geoData.features.forEach(feature => {
      const props = feature.properties || {}
      const regionName = granularity === 'kabupaten'
        ? props.NAME_2
        : props.NAME_3 || props.NAME_2

      if (!regionName) return

      const normalizedRegion = normalize(regionName)

      // Find matching row
      let row: DemoRegionRow | undefined = lookup.get(normalizedRegion)
      if (!row) {
        // Try fuzzy/prefix match (GADM "KutaSelatan" vs DB "Kuta Selatan")
        for (const [key, value] of lookup.entries()) {
          if (key === normalizedRegion || key.includes(normalizedRegion) || normalizedRegion.includes(key)) {
            row = value
            break
          }
        }
      }

      let colorIdx = 0
      let displayValue = 'No data'
      const hasValue = row?.value != null && !Number.isNaN(row.value)

      if (hasValue && row) {
        colorIdx = quantile(row.value as number, breaks)
        displayValue = METRIC_FORMAT[metric](row.value as number)
      }

      const fillOpacity = hasValue ? 0.7 : 0.1

      const geoLayer = L.geoJSON(feature, {
        style: {
          color: '#0F0F12',
          weight: 1.0,
          opacity: 0.6,
          fillColor: hasValue ? getColor(scale, colorIdx) : '#cccccc',
          fillOpacity,
        },
        onEachFeature: (_, lyr) => {
          const metricLabel = METRIC_LABELS[metric]
          const popText = row?.population != null
            ? row.population.toLocaleString()
            : '—'
          const kelText = row?.kelurahan_count != null
            ? row.kelurahan_count.toString()
            : '—'
          const tierText = row?.tier ? `Tier ${row.tier}` : '—'

          lyr.bindTooltip(
            `<div style="font-size:11px;line-height:1.5;min-width:160px">
              <strong style="font-size:12.5px">${regionName}</strong><br/>
              <span style="color:#666">Tier:</span> <strong>${tierText}</strong><br/>
              <span style="color:#666">${metricLabel}:</span>
              <strong style="color:${hasValue ? getColor(scale, colorIdx) : '#999'};font-size:13px">${displayValue}</strong><br/>
              <span style="color:#666">Population:</span> <strong>${popText}</strong><br/>
              <span style="color:#666">Kelurahan:</span> <strong>${kelText}</strong>
            </div>`,
            { sticky: true, direction: 'top' }
          )

          lyr.on('mouseover', () => {
            ;(lyr as L.Path).setStyle({ weight: 2.5, color: '#0F0F12', opacity: 0.95 })
          })
          lyr.on('mouseout', () => {
            ;(lyr as L.Path).setStyle({ weight: 1.0, color: '#0F0F12', opacity: 0.6 })
          })
        },
      })

      geoLayer.addTo(layerGroup)

      // Add label at the polygon's bounding-box center
      if (showLabels && hasValue && row) {
        const bounds = geoLayer.getBounds()
        if (bounds.isValid()) {
          const center = bounds.getCenter()
          const label = L.marker(center, {
            icon: L.divIcon({
              className: 'demo-label',
              html: `<div style="font-family:Inter,sans-serif;font-size:10px;font-weight:600;color:#0F0F12;background:rgba(255,255,255,0.92);padding:2px 6px;border-radius:3px;border:1px solid rgba(0,0,0,0.15);white-space:nowrap;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.12)">
                <div>${regionName}</div>
                <div style="color:${getColor(scale, colorIdx)};font-weight:700;font-size:11px">${displayValue}</div>
              </div>`,
              iconSize: [90, 32],
              iconAnchor: [45, 16],
            }),
            interactive: false,
          })
          label.addTo(layerGroup)
        }
      }
    })

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, geoData, lookup, metric, showLabels, breaks, scale, granularity])

  // === Kelurahan-level rendering ===
  // Per user request (Aug 2026): "for demographics only show choropleth"
  // At kelurahan level we don't have GADM polygons, so we render each
  // kelurahan as a SMALL FILLED CIRCLE that visually behaves like a
  // choropleth cell (color = metric quantile, no popup-spamming dots).
  // The radius is intentionally small so adjacent cells form a continuous
  // colored field — like a pointillist choropleth — rather than a
  // sparse scatter of dots with rich popups.
  useEffect(() => {
    if (granularity !== 'kelurahan') return

    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const layerGroup = L.layerGroup()
    layerRef.current = layerGroup
    layerGroup.addTo(map)

    const metricLabel = METRIC_LABELS[metric]
    const fmt = METRIC_FORMAT[metric]

    for (const row of data) {
      if (row.lat == null || row.lng == null) continue
      const hasValue = row.value != null && !Number.isNaN(row.value)
      const colorIdx = hasValue ? quantile(row.value as number, breaks) : 0
      const color = hasValue ? getColor(scale, colorIdx) : '#cccccc'
      const displayValue = hasValue ? fmt(row.value as number) : 'No data'

      // Fixed small radius — visual cell, NOT a clickable info dot
      const radius = 6

      const marker = L.circleMarker([row.lat as number, row.lng as number], {
        radius,
        color: '#0F0F12',
        weight: 0.4,
        opacity: 0.5,
        fillColor: color,
        fillOpacity: hasValue ? 0.85 : 0.25,
      })

      const popText = row.population != null ? row.population.toLocaleString() : '—'
      const tierText = row.tier ? `Tier ${row.tier}` : '—'

      // Tooltip only — no popup, since the user wants pure choropleth visualization
      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.5;min-width:160px">
          <strong style="font-size:12.5px">${row.name}</strong><br/>
          <span style="color:#666">Tier:</span> <strong>${tierText}</strong><br/>
          <span style="color:#666">${metricLabel}:</span>
          <strong style="color:${color};font-size:13px">${displayValue}</strong><br/>
          <span style="color:#666">Population:</span> <strong>${popText}</strong>
        </div>`,
        { sticky: true, direction: 'top' }
      )

      marker.addTo(layerGroup)
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, data, metric, breaks, scale, granularity])

  // Loading/empty state overlay — show a small badge at the top-right of the map
  useEffect(() => {
    if (data.length > 0) return // data is loaded — nothing to show
    const container = map.getContainer()
    const badge = document.createElement('div')
    badge.className = 'demo-loading-badge'
    badge.style.cssText = 'position:absolute;top:10px;right:10px;z-index:999;background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px 10px;font-size:11px;color:#666;box-shadow:0 1px 4px rgba(0,0,0,0.1);font-family:Inter,sans-serif'
    const isLoading = (granularity === 'kabupaten' && !geoData) ||
                      (granularity === 'kecamatan' && !geoData) ||
                      (granularity === 'kelurahan' && data.length === 0)
    badge.innerHTML = isLoading
      ? '<span style="display:inline-block;width:10px;height:10px;border:2px solid #C8102E;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px"></span>Loading demographics data…'
      : '⚠ No demographic data available at this granularity. Try another metric or region level.'
    container.appendChild(badge)
    return () => {
      try { container.removeChild(badge) } catch {}
    }
  }, [map, data, geoData, granularity])

  return null
}

export { METRIC_LABELS, METRIC_FORMAT, COLOR_SCALES }
