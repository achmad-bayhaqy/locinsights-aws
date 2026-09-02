/**
 * Bali Mall / Shopping Center Catalog
 * Sources: nowbali.co.id (Jan 2025), traveloka.com (May 2025), bali.com, bali.live (Feb 2026)
 * Verified: Aug 2026
 *
 * Includes operational malls + Living World Kuta (under construction, opening T2 2026).
 * Coordinates approximate (centroid of mall footprint) - WGS84.
 */

export type MallClass = 'super_regional' | 'regional' | 'community' | 'specialty'

export interface Mall {
  id: string
  name: string
  lat: number
  lng: number
  kec: string
  kab: string
  gla_m2: number // Gross Leasable Area
  opened_year: number
  class: MallClass
  anchor_count: number
  has_cinema: boolean
  has_supermarket: boolean
  has_department_store: boolean
  visitor_estimate_daily: number
  notes: string
}

export const BALI_MALLS: Mall[] = [
  {
    id: 'MLL001',
    name: 'Living World Denpasar',
    lat: -8.6608,
    lng: 115.1947,
    kec: 'Denpasar Barat',
    kab: 'Denpasar',
    gla_m2: 120_000,
    opened_year: 2023,
    class: 'super_regional',
    anchor_count: 8,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 28_000,
    notes: "Bali's largest mall by GLA. Opened March 2023. Anchors: Sogo, Hypermart, Cinema XXI, Azko."
  },
  {
    id: 'MLL002',
    name: 'Beachwalk Shopping Center',
    lat: -8.7197,
    lng: 115.1697,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 71_000,
    opened_year: 2012,
    class: 'super_regional',
    anchor_count: 5,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 24_000,
    notes: 'Premium lifestyle mall opposite Kuta Beach. High tourist footfall. Anchors: Sogo, Lippo.'
  },
  {
    id: 'MLL003',
    name: 'Discovery Shopping Mall',
    lat: -8.7292,
    lng: 115.1736,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 48_000,
    opened_year: 1997,
    class: 'regional',
    anchor_count: 4,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 15_000,
    notes: 'Beachfront mall, one of the oldest in Bali. Matahari Dept Store anchor.'
  },
  {
    id: 'MLL004',
    name: 'Mall Bali Galeria',
    lat: -8.7053,
    lng: 115.1847,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 85_000,
    opened_year: 2005,
    class: 'super_regional',
    anchor_count: 6,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 22_000,
    notes: 'Largest round-shaped mall in Bali. Matahari, Carrefour, Cinema XXI. Simpang Siur roundabout.'
  },
  {
    id: 'MLL005',
    name: 'Lippo Mall Kuta',
    lat: -8.7286,
    lng: 115.1811,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 65_000,
    opened_year: 2014,
    class: 'regional',
    anchor_count: 4,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 18_000,
    notes: 'Adjacent to Discovery Mall. Matahari, Hypermart, XXI Cinema. Strong tourist base.'
  },
  {
    id: 'MLL006',
    name: 'Trans Studio Mall Bali',
    lat: -8.7311,
    lng: 115.2089,
    kec: 'Kuta Selatan',
    kab: 'Badung',
    gla_m2: 90_000,
    opened_year: 2019,
    class: 'super_regional',
    anchor_count: 5,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 20_000,
    notes: 'Integrated with Trans Studio Theme Park. Largest indoor theme park in SE Asia.'
  },
  {
    id: 'MLL007',
    name: 'Park 23 Mall',
    lat: -8.7031,
    lng: 115.1664,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 28_000,
    opened_year: 2014,
    class: 'community',
    anchor_count: 3,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 8_500,
    notes: 'Boutique mall near Kuta, focuses on dining and entertainment.'
  },
  {
    id: 'MLL008',
    name: 'Level 21 Mall',
    lat: -8.6739,
    lng: 115.2128,
    kec: 'Denpasar Selatan',
    kab: 'Denpasar',
    gla_m2: 38_000,
    opened_year: 2015,
    class: 'regional',
    anchor_count: 3,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 12_000,
    notes: 'Renon area. Used to be Centro. XXI Cinema, Farmers Market anchor.'
  },
  {
    id: 'MLL009',
    name: 'Ramayana Mall Bali',
    lat: -8.6789,
    lng: 115.2186,
    kec: 'Denpasar Selatan',
    kab: 'Denpasar',
    gla_m2: 32_000,
    opened_year: 1986,
    class: 'regional',
    anchor_count: 3,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 9_500,
    notes: 'One of the oldest malls in Bali. Ramayana Dept Store anchor. Local middle-class market.'
  },
  {
    id: 'MLL010',
    name: 'Matahari Duta Plaza',
    lat: -8.6711,
    lng: 115.2136,
    kec: 'Denpasar Selatan',
    kab: 'Denpasar',
    gla_m2: 26_000,
    opened_year: 1985,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 7_000,
    notes: 'Oldest mall in Bali. Matahari Dept Store + Hero supermarket.'
  },
  {
    id: 'MLL011',
    name: 'Bali Collection',
    lat: -8.8072,
    lng: 115.2236,
    kec: 'Kuta Selatan',
    kab: 'Badung',
    gla_m2: 42_000,
    opened_year: 2002,
    class: 'specialty',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: false,
    has_department_store: false,
    visitor_estimate_daily: 11_000,
    notes: 'Nusa Dua resort complex. High-end tourist market. Open-air luxury shopping.'
  },
  {
    id: 'MLL012',
    name: 'Sunset Star Mall',
    lat: -8.7131,
    lng: 115.1728,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 18_000,
    opened_year: 2017,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 5_500,
    notes: 'Boutique retail strip near Sunset Road, Kuta.'
  },
  {
    id: 'MLL013',
    name: 'Plaza Renon',
    lat: -8.6747,
    lng: 115.2164,
    kec: 'Denpasar Selatan',
    kab: 'Denpasar',
    gla_m2: 22_000,
    opened_year: 2010,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 6_200,
    notes: 'Renon area, mid-tier. Farmers Market + bakery anchors.'
  },
  {
    id: 'MLL014',
    name: 'Central Park Kuta',
    lat: -8.7283,
    lng: 115.1886,
    kec: 'Kuta',
    kab: 'Badung',
    gla_m2: 25_000,
    opened_year: 2018,
    class: 'community',
    anchor_count: 2,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 7_200,
    notes: 'Boutique mall near Kuta downtown. Cinema XXI.'
  },
  {
    id: 'MLL015',
    name: 'Bali Mall',
    lat: -8.6761,
    lng: 115.2153,
    kec: 'Denpasar Selatan',
    kab: 'Denpasar',
    gla_m2: 30_000,
    opened_year: 2024,
    class: 'regional',
    anchor_count: 3,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 9_800,
    notes: 'Newer mall (opened Q4 2024). Renon area.'
  },
  {
    id: 'MLL016',
    name: 'Singaraja City Mall',
    lat: -8.1139,
    lng: 115.0917,
    kec: 'Singaraja',
    kab: 'Buleleng',
    gla_m2: 24_000,
    opened_year: 2014,
    class: 'regional',
    anchor_count: 3,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 7_500,
    notes: 'Premier mall for North Bali. Matahari, Hypermart, XXI.'
  },
  {
    id: 'MLL017',
    name: 'Gatotkaca Mall (G-Mall)',
    lat: -8.1308,
    lng: 115.0911,
    kec: 'Singaraja',
    kab: 'Buleleng',
    gla_m2: 12_000,
    opened_year: 2010,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 3_800,
    notes: 'Local mall in Singaraja, smaller format.'
  },
  {
    id: 'MLL018',
    name: 'Plaza Bintang Gianyar',
    lat: -8.5617,
    lng: 115.3167,
    kec: 'Gianyar',
    kab: 'Gianyar',
    gla_m2: 14_000,
    opened_year: 2013,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 4_200,
    notes: 'Local mall in Gianyar town. Indomaret, local F&B tenants.'
  },
  {
    id: 'MLL019',
    name: 'Pusat Perbelanjaan Tabanan (Ramayana Tabanan)',
    lat: -8.3939,
    lng: 115.0917,
    kec: 'Tabanan',
    kab: 'Tabanan',
    gla_m2: 11_000,
    opened_year: 2009,
    class: 'community',
    anchor_count: 2,
    has_cinema: false,
    has_supermarket: true,
    has_department_store: false,
    visitor_estimate_daily: 3_500,
    notes: 'Local mall in Tabanan town center.'
  },
  {
    id: 'MLL020',
    name: 'Living World Kuta (Under Construction)',
    lat: -8.7408,
    lng: 115.1708,
    kec: 'Kuta Selatan',
    kab: 'Badung',
    gla_m2: 95_000,
    opened_year: 2026,
    class: 'super_regional',
    anchor_count: 5,
    has_cinema: true,
    has_supermarket: true,
    has_department_store: true,
    visitor_estimate_daily: 0,
    notes: 'Under construction (announced Feb 2026). Expected to open Q4 2026. Will be 2nd largest in Bali.'
  },
]

export function getMallsByKabupaten(kab: string): Mall[] {
  return BALI_MALLS.filter(m => m.kab === kab)
}

export function getMallsByKecamatan(kec: string): Mall[] {
  return BALI_MALLS.filter(m => m.kec === kec)
}
