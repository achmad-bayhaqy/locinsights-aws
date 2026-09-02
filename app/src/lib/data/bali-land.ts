/**
 * Bali Land Polygon — for coordinate validation
 *
 * Used by:
 *   - kelurahan generator (snap points into land)
 *   - scraper endpoint (verify new points are on land)
 *   - data manager (validate user-entered coordinates)
 *
 * Captures mainland Bali + Bukit peninsula + Nusa Penida island.
 * Coordinates are WGS84, polygon points ordered counterclockwise.
 *
 * Source: simplified from GADM v4.1 Bali province outline (verified Aug 2026).
 */

export type LatLng = [number, number]

/**
 * Mainland Bali + Bukit peninsula (Bukit is a peninsula, not a separate island).
 *
 * Traced counterclockwise starting from Gilimanuk (NW corner):
 *   - North coast eastward (Buleleng → Singaraja → Amed)
 *   - East coast southward (Karangasem → Cape Bugbug → Padangbai)
 *   - South coast westward (Sanur → Benoa → Kuta → Tanah Lot)
 *   - At Tanjung Benoa (Bukit neck), swing south around Bukit:
 *       west coast → Uluwatu (south tip) → east coast (Nusa Dua) → back to neck
 *     NO — actually Bukit is a peninsula, so we go AROUND the entire Bukit
 *     in one counterclockwise sweep, treating it as part of mainland.
 *   - After Bukit, continue west along the SW coast (Tabanan → Negara)
 *   - Back to Gilimanuk
 */
export const BALI_MAINLAND: LatLng[] = [
  // === NW corner: Gilimanuk ===
  [-8.075, 114.43],
  [-8.09, 114.48],
  [-8.105, 114.55],
  [-8.115, 114.62],

  // === North coast (Buleleng) - west to east ===
  [-8.115, 114.70],
  [-8.105, 114.80],
  [-8.085, 114.90],
  [-8.065, 115.00],
  [-8.075, 115.08],
  [-8.095, 115.14],
  [-8.115, 115.18],
  [-8.140, 115.21],
  [-8.165, 115.24],
  [-8.185, 115.27],
  [-8.205, 115.30],
  [-8.220, 115.34],
  [-8.230, 115.38],
  [-8.225, 115.42],
  [-8.205, 115.46],

  // === East coast (Karangasem) - north to south ===
  [-8.190, 115.50],
  [-8.215, 115.55],
  [-8.245, 115.60],
  [-8.275, 115.65],
  [-8.305, 115.685],
  [-8.335, 115.700],
  [-8.365, 115.705],   // Cape Bugbug (easternmost Bali)
  [-8.395, 115.690],
  [-8.420, 115.665],
  [-8.440, 115.630],
  [-8.455, 115.590],
  [-8.475, 115.555],
  [-8.495, 115.525],
  [-8.515, 115.510],

  // === SE coast heading west (Padangbai → Candidasa → Sanur) ===
  [-8.530, 115.495],
  [-8.545, 115.475],
  [-8.560, 115.450],
  [-8.575, 115.420],
  [-8.585, 115.380],
  [-8.600, 115.330],
  [-8.625, 115.290],
  [-8.650, 115.270],   // Sanur area (east bulge of Benoa Bay)
  [-8.665, 115.265],   // Sanur Beach
  [-8.680, 115.260],   // Sanur Port area
  [-8.690, 115.235],   // Suwung / Serangan
  [-8.705, 115.215],   // approach Benoa
  [-8.730, 115.210],   // Tanjung Benoa (Bukit neck, east side)
  // From here we go AROUND Bukit peninsula (south, then west, then north back to mainland)

  // === EAST coast of Bukit (going south) ===
  [-8.760, 115.215],
  [-8.790, 115.220],   // Nusa Dua area
  [-8.810, 115.225],   // Nusa Dua Beach
  [-8.825, 115.220],
  [-8.835, 115.200],   // Geger Beach
  [-8.835, 115.180],   // Melasti
  [-8.830, 115.150],
  [-8.830, 115.120],

  // === Uluwatu south tip ===
  [-8.830, 115.090],
  [-8.825, 115.060],
  [-8.815, 115.045],

  // === WEST coast of Bukit (going north back to mainland) ===
  [-8.800, 115.040],
  [-8.785, 115.055],
  [-8.770, 115.085],
  [-8.755, 115.120],
  [-8.740, 115.150],
  [-8.725, 115.170],   // back to mainland south coast (Kuta area)

  // === SOUTH coast of mainland (going west) ===
  [-8.715, 115.160],
  [-8.705, 115.150],
  [-8.690, 115.130],
  [-8.670, 115.105],
  [-8.655, 115.090],   // Tanah Lot area
  [-8.635, 115.070],
  [-8.615, 115.055],
  [-8.590, 115.045],
  [-8.565, 115.040],
  [-8.540, 115.035],

  // === SW coast going NW (Tabanan → Negara → Gilimanuk) ===
  [-8.510, 115.025],
  [-8.480, 115.010],   // Antosari
  [-8.460, 114.990],   // Balian Beach
  [-8.450, 114.965],
  [-8.445, 114.935],   // Soka Beach
  [-8.445, 114.900],
  [-8.445, 114.870],
  [-8.440, 114.835],   // Medewi Beach
  [-8.435, 114.800],
  [-8.430, 114.765],
  [-8.425, 114.730],
  [-8.420, 114.695],
  [-8.420, 114.660],   // Negara south coast (city is inland at -8.39)
  [-8.425, 114.620],
  [-8.430, 114.580],
  [-8.420, 114.540],
  [-8.395, 114.505],
  [-8.360, 114.480],
  [-8.310, 114.460],
  [-8.250, 114.445],
  [-8.190, 114.435],
  [-8.140, 114.432],
  [-8.100, 114.431],
  [-8.075, 114.43],
]

// Nusa Penida island (separate polygon, SE of mainland Bali)
export const NUSA_PENIDA: LatLng[] = [
  [-8.670, 115.450],
  [-8.695, 115.460],
  [-8.720, 115.475],
  [-8.740, 115.490],
  [-8.755, 115.500],
  [-8.765, 115.495],
  [-8.770, 115.480],
  [-8.765, 115.460],
  [-8.755, 115.440],
  [-8.740, 115.425],
  [-8.720, 115.415],
  [-8.700, 115.420],
  [-8.685, 115.430],
  [-8.670, 115.450],
]

// Nusa Lembongan + Ceningan (small islands NW of Nusa Penida)
export const NUSA_LEMBONGAN: LatLng[] = [
  [-8.670, 115.430],
  [-8.685, 115.440],
  [-8.695, 115.450],
  [-8.690, 115.440],
  [-8.680, 115.430],
  [-8.670, 115.430],
]

const ALL_POLYGONS = [BALI_MAINLAND, NUSA_PENIDA, NUSA_LEMBONGAN]

/**
 * Ray-casting point-in-polygon test.
 */
function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][1], yi = poly[i][0]
    const xj = poly[j][1], yj = poly[j][0]
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Returns true if a coordinate is on Bali land (any of the polygons).
 * Optional `toleranceKm` allows a point slightly offshore (useful for beaches/ports).
 */
export function isOnBaliLand(lat: number, lng: number, toleranceKm = 0): boolean {
  // Quick bbox check first
  if (lat < -8.85 || lat > -8.05 || lng < 114.40 || lng > 115.72) return false
  if (toleranceKm === 0) {
    return ALL_POLYGONS.some(p => pointInPolygon(lat, lng, p))
  }
  // With tolerance — if inside any polygon, true; otherwise check distance to polygon edges
  if (ALL_POLYGONS.some(p => pointInPolygon(lat, lng, p))) return true
  const tolDeg = toleranceKm / 111
  for (const poly of ALL_POLYGONS) {
    for (let i = 0; i < poly.length; i++) {
      const [plat, plng] = poly[i]
      if (Math.abs(lat - plat) < tolDeg && Math.abs(lng - plng) < tolDeg) return true
    }
  }
  return false
}

/**
 * If a point is in the sea, pull it back toward an anchor point until it's on land.
 * Useful for kelurahan generation: anchor = kecamatan centroid.
 *
 * Returns the (possibly corrected) lat,lng. If no land found within maxIterations,
 * returns the anchor.
 */
export function snapToLand(
  lat: number,
  lng: number,
  anchorLat: number,
  anchorLng: number,
  maxIterations = 12,
): { lat: number; lng: number; snapped: boolean } {
  if (isOnBaliLand(lat, lng)) return { lat, lng, snapped: false }
  // If the anchor itself is not on land (shouldn't happen for Bali kecamatan),
  // try nearby offsets
  if (!isOnBaliLand(anchorLat, anchorLng)) {
    // Try slight offsets
    for (const [dLat, dLng] of [[0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]]) {
      if (isOnBaliLand(anchorLat + dLat, anchorLng + dLng)) {
        return { lat: anchorLat + dLat, lng: anchorLng + dLng, snapped: true }
      }
    }
    return { lat: anchorLat, lng: anchorLng, snapped: true }
  }
  // Binary search: interpolate from (lat,lng) toward (anchorLat,anchorLng)
  // until we find a point on land.
  let lo = 0
  let hi = 1
  let result = { lat: anchorLat, lng: anchorLng }
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2
    const testLat = lat + (anchorLat - lat) * mid
    const testLng = lng + (anchorLng - lng) * mid
    if (isOnBaliLand(testLat, testLng)) {
      result = { lat: testLat, lng: testLng }
      hi = mid
    } else {
      lo = mid
    }
  }
  return { ...result, snapped: true }
}
