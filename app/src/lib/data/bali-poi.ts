/**
 * Bali Points of Interest (POI)
 * Sources: Google Maps POI data, OpenStreetMap, Bali Tourism Board
 * Verified Aug 2026
 *
 * Used for foot-traffic estimation, tourist attractiveness proxy,
 * and trade-area attractiveness scoring.
 */

export type POIType =
  | 'tourist_attraction'
  | 'beach'
  | 'temple'
  | 'hotel_cluster'
  | 'transit_hub'
  | 'university'
  | 'hospital'
  | 'office_cluster'
  | 'port'

export interface POI {
  id: string
  name: string
  type: POIType
  lat: number
  lng: number
  kec: string
  kab: string
  // Annual visitor estimate (or hotel rooms for hotel_cluster)
  magnitude: number
  notes: string
}

export const BALI_POIS: POI[] = [
  // Tourist attractions
  { id: 'POI001', name: 'Tanah Lot Temple', type: 'temple', lat: -8.6211, lng: 115.0867, kec: 'Kediri', kab: 'Tabanan', magnitude: 3_500_000, notes: 'Iconic sea temple. 3.5M visitors/yr.' },
  { id: 'POI002', name: 'Uluwatu Temple', type: 'temple', lat: -8.8292, lng: 115.0847, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 2_100_000, notes: 'Cliff-top temple with Kecak dance.' },
  { id: 'POI003', name: 'Ulun Danu Beratan', type: 'temple', lat: -8.2753, lng: 115.1669, kec: 'Baturiti', kab: 'Tabanan', magnitude: 1_400_000, notes: 'Lake temple, Bedugul area.' },
  { id: 'POI004', name: 'Besakih Temple', type: 'temple', lat: -8.3769, lng: 115.5008, kec: 'Rendang', kab: 'Karangasem', magnitude: 980_000, notes: "Mother temple of Bali." },
  { id: 'POI005', name: 'Tirta Empul', type: 'temple', lat: -8.4256, lng: 115.3133, kec: 'Tampaksiring', kab: 'Gianyar', magnitude: 1_200_000, notes: 'Holy spring water temple.' },
  { id: 'POI006', name: 'Tirta Gangga', type: 'tourist_attraction', lat: -8.4311, lng: 115.5917, kec: 'Karangasem', kab: 'Karangasem', magnitude: 420_000, notes: 'Royal water palace.' },
  { id: 'POI007', name: 'Goa Gajah', type: 'tourist_attraction', lat: -8.5239, lng: 115.2817, kec: 'Ubud', kab: 'Gianyar', magnitude: 580_000, notes: 'Elephant cave, heritage site.' },
  { id: 'POI008', name: 'Mount Batur / Kintamani', type: 'tourist_attraction', lat: -8.2419, lng: 115.3717, kec: 'Kintamani', kab: 'Bangli', magnitude: 1_100_000, notes: 'Volcano viewpoint, sunrise hikes.' },
  { id: 'POI009', name: 'Jatiluwih Rice Terraces', type: 'tourist_attraction', lat: -8.3611, lng: 115.1311, kec: 'Penebel', kab: 'Tabanan', magnitude: 720_000, notes: 'UNESCO heritage rice terraces.' },
  { id: 'POI010', name: 'Bali Safari & Marine Park', type: 'tourist_attraction', lat: -8.6011, lng: 115.3211, kec: 'Gianyar', kab: 'Gianyar', magnitude: 1_300_000, notes: 'Largest safari park in Bali.' },
  { id: 'POI011', name: 'Waterbom Bali', type: 'tourist_attraction', lat: -8.7211, lng: 115.1697, kec: 'Kuta', kab: 'Badung', magnitude: 1_500_000, notes: "Top-rated waterpark, Kuta." },
  { id: 'POI012', name: 'Tegallalang Rice Terrace', type: 'tourist_attraction', lat: -8.4361, lng: 115.2789, kec: 'Tegallalang', kab: 'Gianyar', magnitude: 1_800_000, notes: 'Most photographed rice terrace in Bali.' },

  // Beaches
  { id: 'POI101', name: 'Kuta Beach', type: 'beach', lat: -8.7197, lng: 115.1686, kec: 'Kuta', kab: 'Badung', magnitude: 6_000_000, notes: 'Most visited beach in Bali.' },
  { id: 'POI102', name: 'Seminyak Beach', type: 'beach', lat: -8.6836, lng: 115.1611, kec: 'Kuta', kab: 'Badung', magnitude: 2_800_000, notes: 'Premium beach, sunset bars.' },
  { id: 'POI103', name: 'Canggu Beach (Berawa/Batu Bolong)', type: 'beach', lat: -8.6531, lng: 115.1389, kec: 'Kuta Utara', kab: 'Badung', magnitude: 3_500_000, notes: 'Surf & digital nomad hub. Fastest growing area.' },
  { id: 'POI104', name: 'Sanur Beach', type: 'beach', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', magnitude: 1_900_000, notes: 'Sunrise beach, family-friendly.' },
  { id: 'POI105', name: 'Nusa Dua Beach', type: 'beach', lat: -8.8072, lng: 115.2236, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 2_200_000, notes: 'Luxury resort beach.' },
  { id: 'POI106', name: 'Jimbaran Beach', type: 'beach', lat: -8.7897, lng: 115.1711, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 1_700_000, notes: 'Seafood BBQ beach dining.' },
  { id: 'POI107', name: 'Lovina Beach', type: 'beach', lat: -8.1511, lng: 115.0311, kec: 'Buleleng', kab: 'Buleleng', magnitude: 480_000, notes: 'Dolphin watching, north Bali.' },
  { id: 'POI108', name: 'Amed Beach', type: 'beach', lat: -8.3389, lng: 115.6711, kec: 'Abang', kab: 'Karangasem', magnitude: 280_000, notes: 'Diving village, east Bali.' },

  // Hotel clusters (magnitude = total rooms in cluster)
  { id: 'POI201', name: 'Nusa Dua Resort Cluster', type: 'hotel_cluster', lat: -8.8072, lng: 115.2236, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 4200, notes: 'Luxury resorts (Mulia, Westin, St. Regis, etc).' },
  { id: 'POI202', name: 'Kuta-Legian-Seminyak Hotel Strip', type: 'hotel_cluster', lat: -8.7011, lng: 115.1664, kec: 'Kuta', kab: 'Badung', magnitude: 12800, notes: 'Largest hotel inventory in Bali.' },
  { id: 'POI203', name: 'Canggu Hotel Cluster', type: 'hotel_cluster', lat: -8.6531, lng: 115.1389, kec: 'Kuta Utara', kab: 'Badung', magnitude: 5600, notes: 'Fastest growing hotel cluster, boutique focus.' },
  { id: 'POI204', name: 'Sanur Hotel Cluster', type: 'hotel_cluster', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', magnitude: 3400, notes: 'Mid-tier resort cluster.' },
  { id: 'POI205', name: 'Ubud Hotel Cluster', type: 'hotel_cluster', lat: -8.5069, lng: 115.2625, kec: 'Ubud', kab: 'Gianyar', magnitude: 6200, notes: 'Boutique + wellness resorts.' },
  { id: 'POI206', name: 'Jimbaran Hotel Cluster', type: 'hotel_cluster', lat: -8.7897, lng: 115.1711, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 2800, notes: 'Beachfront + hillside resorts.' },
  { id: 'POI207', name: 'Uluwatu/Pecatu Hotel Cluster', type: 'hotel_cluster', lat: -8.8297, lng: 115.0889, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 2100, notes: 'Clifftop premium resorts.' },
  { id: 'POI208', name: 'Singaraja-Lovina Hotel Cluster', type: 'hotel_cluster', lat: -8.1311, lng: 115.0711, kec: 'Singaraja', kab: 'Buleleng', magnitude: 1400, notes: 'North Bali hotel inventory.' },

  // Transit hubs
  { id: 'POI301', name: 'Ngurah Rai International Airport (DPS)', type: 'transit_hub', lat: -8.7481, lng: 115.1672, kec: 'Kuta', kab: 'Badung', magnitude: 24_500_000, notes: '24.5M passengers/year (2024). #2 airport in Indonesia.' },
  { id: 'POI302', name: 'Padangbai Harbor', type: 'port', lat: -8.5311, lng: 115.5011, kec: 'Manggis', kab: 'Karangasem', magnitude: 1_800_000, notes: 'Ferry to Lombok & Nusa Penida.' },
  { id: 'POI303', name: 'Gilimanuk Harbor', type: 'port', lat: -8.0825, lng: 114.4380, kec: 'Melaya', kab: 'Jembrana', magnitude: 2_400_000, notes: 'Java-Bali ferry crossing. Westernmost Bali.' },
  { id: 'POI304', name: 'Sanur Port (Nusa Penida speedboat)', type: 'port', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', magnitude: 2_100_000, notes: 'Speedboat to Nusa Penida & Lembongan.' },

  // Universities
  { id: 'POI401', name: 'Udayana University (Campus Bukit Jimbaran)', type: 'university', lat: -8.7961, lng: 115.1789, kec: 'Kuta Selatan', kab: 'Badung', magnitude: 18000, notes: 'Largest university in Bali.' },
  { id: 'POI402', name: 'Universitas Pendidikan Ganesha (Undiksha) Singaraja', type: 'university', lat: -8.1147, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', magnitude: 12000, notes: 'North Bali university.' },
  { id: 'POI403', name: 'Politeknik Negeri Bali', type: 'university', lat: -8.6839, lng: 115.2117, kec: 'Denpasar Selatan', kab: 'Denpasar', magnitude: 8000, notes: 'Kuta-South Denpasar polytechnic.' },
  { id: 'POI404', name: 'Universitas Warmadewa Denpasar', type: 'university', lat: -8.6611, lng: 115.2136, kec: 'Denpasar Selatan', kab: 'Denpasar', magnitude: 11000, notes: 'Major private university.' },

  // Hospitals (large only)
  { id: 'POI501', name: 'RSUP Sanglah Denpasar', type: 'hospital', lat: -8.6708, lng: 115.2169, kec: 'Denpasar Selatan', kab: 'Denpasar', magnitude: 1500, notes: 'Largest hospital in Bali (beds).' },
  { id: 'POI502', name: 'RS Bali Mandara', type: 'hospital', lat: -8.6786, lng: 115.2589, kec: 'Denpasar Timur', kab: 'Denpasar', magnitude: 600, notes: 'Sanur hospital.' },
  { id: 'POI503', name: 'RSUP Buleleng Singaraja', type: 'hospital', lat: -8.1147, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', magnitude: 400, notes: 'North Bali main hospital.' },

  // Office / commercial clusters
  { id: 'POI601', name: 'Sunset Road Business Corridor', type: 'office_cluster', lat: -8.7031, lng: 115.1728, kec: 'Kuta', kab: 'Badung', magnitude: 25000, notes: 'Office workers along Sunset Road.' },
  { id: 'POI602', name: 'Renon Government District', type: 'office_cluster', lat: -8.6708, lng: 115.2169, kec: 'Denpasar Selatan', kab: 'Denpasar', magnitude: 18000, notes: 'Provincial government offices.' },
  { id: 'POI603', name: 'Simpang Siur Roundabout (MBG)', type: 'office_cluster', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', magnitude: 22000, notes: 'Major commercial node at Mall Bali Galeria.' },
]

export function getPOIsByKecamatan(kec: string): POI[] {
  return BALI_POIS.filter(p => p.kec === kec)
}

export function getPOIsByKabupaten(kab: string): POI[] {
  return BALI_POIS.filter(p => p.kab === kab)
}
