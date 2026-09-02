'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

/**
 * Point-based heatmap layer using leaflet.heat.
 * Each point: [lat, lng, intensity 0..1]
 *
 * Implementation notes:
 * - The leaflet.heat layer is created ONCE per (map mount) and persisted in a ref.
 * - On prop changes we call `setLatLngs()` + `setOptions()` — this avoids the
 *   destroy-and-recreate cycle that previously made the heatmap flicker / disappear
 *   whenever the parent re-rendered (e.g. on hover, flyTo, filter changes).
 * - `max` defaults to ~0.6 so the high-intensity gradient colors are actually
 *   reachable at default zoom (zoom=10 → intensity scaling factor = 1/8 per point).
 */
export interface HeatLayerProps {
  points: Array<[number, number, number]>
  radius?: number
  blur?: number
  maxZoom?: number
  minOpacity?: number
  /** Maximum intensity value used to normalize the gradient (default 0.6) */
  max?: number
  gradient?: Record<number, string>
}

// Module-level default gradient so we don't create a new object on every render.
// Stronger low-end color and brighter red mid-tones for visibility against the
// CARTO light_all basemap.
const DEFAULT_GRADIENT: Record<number, string> = {
  0.0: '#F8C9B8',
  0.2: '#F0A88C',
  0.4: '#E26B4F',
  0.55: '#D63C2A',
  0.7: '#C8102E',
  0.85: '#A30F23',
  1.0: '#7A0A1A',
}

export function HeatLayer({
  points,
  radius = 30,
  blur = 25,
  maxZoom = 11,
  minOpacity = 0.4,
  max = 0.6,
  gradient = DEFAULT_GRADIENT,
}: HeatLayerProps) {
  const map = useMap()
  const layerRef = useRef<any>(null)

  // Create the layer once per map mount.
  useEffect(() => {
    const opts: any = {
      radius,
      blur,
      maxZoom,
      minOpacity,
      max,
      gradient,
    }
    // @ts-ignore — leaflet.heat extends L.Layer but isn't typed
    const layer = (L as any).heatLayer(points, opts)
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      map.removeLayer(layer)
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Update existing layer in-place when points/options change.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    if (!points.length) {
      // Nothing to draw — keep layer alive but empty
      layer.setLatLngs([])
      return
    }
    layer.setLatLngs(points)
    layer.setOptions({ radius, blur, maxZoom, minOpacity, max, gradient })
  }, [points, radius, blur, maxZoom, minOpacity, max, gradient])

  return null
}
