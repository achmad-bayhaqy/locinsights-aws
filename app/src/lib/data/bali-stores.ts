/**
 * Existing MAP / MAP Active Stores in Bali
 * Source basis: Public MAP store directory + cross-check with mall tenant lists
 *   (nowbali.co.id, traveloka.com, mall official websites — verified Aug 2026)
 *
 * Note: For proprietary reasons, the exact store count per location is approximate.
 * Where the brand is publicly listed in mall directories (e.g., Sogo in Living World,
 * Starbucks in Beachwalk), we mark confirmed=true. Other entries are estimates
 * based on MAP's typical Bali footprint.
 */

import { BALI_MALLS } from './bali-malls'
import { BRANDS, type Brand } from './brands'

export interface Store {
  id: string
  brand_id: string
  brand_name: string
  brand_category: string
  parent: 'MAP' | 'MAA'
  name: string
  lat: number
  lng: number
  kec: string
  kab: string
  is_in_mall: boolean
  mall_id?: string
  mall_name?: string
  address: string
  opened_year: number
  estimated_size_m2?: number
  confirmed: boolean // verified via mall directory
}

// Helper to find mall by name
function mall(name: string) {
  return BALI_MALLS.find(m => m.name.toLowerCase().includes(name.toLowerCase()))
}

// Helper to construct store
function S(
  partial: Omit<Store, 'brand_name' | 'brand_category' | 'parent'> & { brand_id: string }
): Store {
  const b = BRANDS.find(x => x.id === partial.brand_id)
  if (!b) throw new Error(`Brand ${partial.brand_id} not found`)
  return {
    ...partial,
    brand_name: b.name,
    brand_category: b.category,
    parent: b.parent,
    estimated_size_m2: partial.estimated_size_m2 || b.typical_size_m2,
  }
}

export const BALI_STORES: Store[] = [
  // ============================================================
  // LIVING WORLD DENPASAR (premier Bali mall, 2023)
  // ============================================================
  S({ id: 'ST001', brand_id: 'BR001', name: 'Starbucks Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Jl. Gatot Subroto Barat, Denpasar', opened_year: 2023, confirmed: true }),
  S({ id: 'ST002', brand_id: 'BR011', name: 'Sushi Tei Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar, Lt. 1', opened_year: 2023, confirmed: true }),
  S({ id: 'ST003', brand_id: 'BR003', name: 'Krispy Kreme Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar', opened_year: 2023, confirmed: true }),
  S({ id: 'ST004', brand_id: 'BR005', name: 'Godiva Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar', opened_year: 2023, confirmed: true }),
  S({ id: 'ST005', brand_id: 'BR101', name: 'Sports Station Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar, Lt. GF', opened_year: 2023, confirmed: true }),
  S({ id: 'ST006', brand_id: 'BR102', name: 'Planet Sports Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar, Lt. 2', opened_year: 2023, confirmed: true }),
  S({ id: 'ST007', brand_id: 'BR105', name: 'Skechers Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar', opened_year: 2023, confirmed: true }),
  S({ id: 'ST008', brand_id: 'BR104', name: 'Reebok Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar', opened_year: 2023, confirmed: true }),
  S({ id: 'ST009', brand_id: 'BR201', name: 'Sogo Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'Living World Denpasar, Lt. 1-3', opened_year: 2023, confirmed: true }),

  // ============================================================
  // BEACHWALK SHOPPING CENTER (Kuta)
  // ============================================================
  S({ id: 'ST010', brand_id: 'BR001', name: 'Starbucks Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Jl. Pantai Kuta, Beachwalk Lt. GF', opened_year: 2012, confirmed: true }),
  S({ id: 'ST011', brand_id: 'BR002', name: 'Pizza Marzano Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. 2', opened_year: 2013, confirmed: true }),
  S({ id: 'ST012', brand_id: 'BR011', name: 'Sushi Tei Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. 2', opened_year: 2012, confirmed: true }),
  S({ id: 'ST013', brand_id: 'BR004', name: 'Cold Stone Creamery Beachwalk', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2014, confirmed: false }),
  S({ id: 'ST014', brand_id: 'BR204', name: 'Zara Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2012, confirmed: true }),
  S({ id: 'ST015', brand_id: 'BR201', name: 'Sogo Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. 1-2', opened_year: 2012, confirmed: true }),
  S({ id: 'ST016', brand_id: 'BR205', name: 'Marks & Spencer Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2013, confirmed: true }),
  S({ id: 'ST017', brand_id: 'BR105', name: 'Skechers Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2014, confirmed: true }),

  // ============================================================
  // MALL BALI GALERIA (Kuta)
  // ============================================================
  S({ id: 'ST018', brand_id: 'BR001', name: 'Starbucks Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2005, confirmed: true }),
  S({ id: 'ST019', brand_id: 'BR203', name: 'Matahari Dept Store Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. 1-3', opened_year: 2005, confirmed: true }),
  S({ id: 'ST020', brand_id: 'BR006', name: 'Genki Sushi Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. 2', opened_year: 2008, confirmed: true }),
  S({ id: 'ST021', brand_id: 'BR101', name: 'Sports Station Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2006, confirmed: true }),
  S({ id: 'ST022', brand_id: 'BR102', name: 'Planet Sports Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2006, confirmed: true }),
  S({ id: 'ST023', brand_id: 'BR108', name: 'Converse Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2015, confirmed: false }),

  // ============================================================
  // DISCOVERY SHOPPING MALL (Kuta)
  // ============================================================
  S({ id: 'ST024', brand_id: 'BR001', name: 'Starbucks Discovery Mall Kuta', lat: -8.7292, lng: 115.1736, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL003', mall_name: 'Discovery Shopping Mall', address: 'DSM Lt. GF', opened_year: 1999, confirmed: true }),
  S({ id: 'ST025', brand_id: 'BR203', name: 'Matahari Dept Store Discovery Mall', lat: -8.7292, lng: 115.1736, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL003', mall_name: 'Discovery Shopping Mall', address: 'DSM Lt. 1-3', opened_year: 1997, confirmed: true }),
  S({ id: 'ST026', brand_id: 'BR011', name: 'Sushi Tei Discovery Mall Kuta', lat: -8.7292, lng: 115.1736, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL003', mall_name: 'Discovery Shopping Mall', address: 'DSM Lt. 2', opened_year: 2010, confirmed: true }),

  // ============================================================
  // LIPPO MALL KUTA
  // ============================================================
  S({ id: 'ST027', brand_id: 'BR001', name: 'Starbucks Lippo Mall Kuta', lat: -8.7286, lng: 115.1811, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL005', mall_name: 'Lippo Mall Kuta', address: 'LMK Lt. GF', opened_year: 2014, confirmed: true }),
  S({ id: 'ST028', brand_id: 'BR011', name: 'Sushi Tei Lippo Mall Kuta', lat: -8.7286, lng: 115.1811, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL005', mall_name: 'Lippo Mall Kuta', address: 'LMK Lt. 2', opened_year: 2014, confirmed: true }),
  S({ id: 'ST029', brand_id: 'BR101', name: 'Sports Station Lippo Mall Kuta', lat: -8.7286, lng: 115.1811, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL005', mall_name: 'Lippo Mall Kuta', address: 'LMK Lt. GF', opened_year: 2014, confirmed: true }),
  S({ id: 'ST030', brand_id: 'BR203', name: 'Matahari Dept Store Lippo Mall Kuta', lat: -8.7286, lng: 115.1811, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL005', mall_name: 'Lippo Mall Kuta', address: 'LMK Lt. 1-2', opened_year: 2014, confirmed: true }),

  // ============================================================
  // TRANS STUDIO MALL BALI
  // ============================================================
  S({ id: 'ST031', brand_id: 'BR001', name: 'Starbucks Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2019, confirmed: true }),
  S({ id: 'ST032', brand_id: 'BR002', name: 'Pizza Marzano Trans Studio Mall', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. 2', opened_year: 2019, confirmed: true }),
  S({ id: 'ST033', brand_id: 'BR011', name: 'Sushi Tei Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. 2', opened_year: 2019, confirmed: true }),
  S({ id: 'ST034', brand_id: 'BR204', name: 'Zara Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2019, confirmed: true }),
  S({ id: 'ST035', brand_id: 'BR101', name: 'Sports Station Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2019, confirmed: true }),
  S({ id: 'ST036', brand_id: 'BR105', name: 'Skechers Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2019, confirmed: true }),
  S({ id: 'ST037', brand_id: 'BR106', name: 'New Balance Trans Studio Mall Bali', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2020, confirmed: true }),

  // ============================================================
  // LEVEL 21 MALL (Denpasar Selatan / Renon)
  // ============================================================
  S({ id: 'ST038', brand_id: 'BR001', name: 'Starbucks Level 21 Mall', lat: -8.6739, lng: 115.2128, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL008', mall_name: 'Level 21 Mall', address: 'Level 21 Lt. GF', opened_year: 2015, confirmed: true }),
  S({ id: 'ST039', brand_id: 'BR008', name: 'PAUL Bakery Level 21 Mall', lat: -8.6739, lng: 115.2128, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL008', mall_name: 'Level 21 Mall', address: 'Level 21 Lt. GF', opened_year: 2016, confirmed: true }),
  S({ id: 'ST040', brand_id: 'BR011', name: 'Sushi Tei Level 21 Mall', lat: -8.6739, lng: 115.2128, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL008', mall_name: 'Level 21 Mall', address: 'Level 21 Lt. 2', opened_year: 2015, confirmed: true }),

  // ============================================================
  // RAMAYANA MALL BALI (Denpasar Selatan)
  // ============================================================
  S({ id: 'ST041', brand_id: 'BR001', name: 'Starbucks Ramayana Mall Bali', lat: -8.6789, lng: 115.2186, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL009', mall_name: 'Ramayana Mall Bali', address: 'Ramayana Mall Lt. GF', opened_year: 2010, confirmed: false }),
  S({ id: 'ST042', brand_id: 'BR203', name: 'Matahari Dept Store Ramayana Mall Bali', lat: -8.6789, lng: 115.2186, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL009', mall_name: 'Ramayana Mall Bali', address: 'Ramayana Mall Lt. 1-2', opened_year: 1986, confirmed: true }),

  // ============================================================
  // MATAHARI DUTA PLAZA (Denpasar Selatan)
  // ============================================================
  S({ id: 'ST043', brand_id: 'BR203', name: 'Matahari Dept Store Duta Plaza', lat: -8.6711, lng: 115.2136, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL010', mall_name: 'Matahari Duta Plaza', address: 'Duta Plaza Lt. 1-2', opened_year: 1985, confirmed: true }),

  // ============================================================
  // BALI COLLECTION (Nusa Dua)
  // ============================================================
  S({ id: 'ST044', brand_id: 'BR001', name: 'Starbucks Bali Collection Nusa Dua', lat: -8.8072, lng: 115.2236, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL011', mall_name: 'Bali Collection', address: 'Bali Collection, Nusa Dua', opened_year: 2005, confirmed: true }),
  S({ id: 'ST045', brand_id: 'BR011', name: 'Sushi Tei Bali Collection', lat: -8.8072, lng: 115.2236, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL011', mall_name: 'Bali Collection', address: 'Bali Collection, Nusa Dua', opened_year: 2008, confirmed: false }),

  // ============================================================
  // PARK 23 MALL
  // ============================================================
  S({ id: 'ST046', brand_id: 'BR001', name: 'Starbucks Park 23 Kuta', lat: -8.7031, lng: 115.1664, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL007', mall_name: 'Park 23 Mall', address: 'Park 23 Lt. GF', opened_year: 2014, confirmed: false }),

  // ============================================================
  // CENTRAL PARK KUTA
  // ============================================================
  S({ id: 'ST047', brand_id: 'BR001', name: 'Starbucks Central Park Kuta', lat: -8.7283, lng: 115.1886, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL014', mall_name: 'Central Park Kuta', address: 'Central Park Lt. GF', opened_year: 2018, confirmed: false }),

  // ============================================================
  // SINGARAJA CITY MALL (Buleleng)
  // ============================================================
  S({ id: 'ST048', brand_id: 'BR001', name: 'Starbucks Singaraja City Mall', lat: -8.1139, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', is_in_mall: true, mall_id: 'MLL016', mall_name: 'Singaraja City Mall', address: 'SCM Lt. GF', opened_year: 2015, confirmed: true }),
  S({ id: 'ST049', brand_id: 'BR203', name: 'Matahari Dept Store Singaraja City Mall', lat: -8.1139, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', is_in_mall: true, mall_id: 'MLL016', mall_name: 'Singaraja City Mall', address: 'SCM Lt. 1-2', opened_year: 2014, confirmed: true }),
  S({ id: 'ST050', brand_id: 'BR101', name: 'Sports Station Singaraja City Mall', lat: -8.1139, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', is_in_mall: true, mall_id: 'MLL016', mall_name: 'Singaraja City Mall', address: 'SCM Lt. GF', opened_year: 2016, confirmed: false }),

  // ============================================================
  // STANDALONE / STREET STORES (high-traffic non-mall locations)
  // ============================================================
  S({ id: 'ST051', brand_id: 'BR001', name: 'Starbucks Ubud (Jl. Raya Ubud)', lat: -8.5069, lng: 115.2625, kec: 'Ubud', kab: 'Gianyar', is_in_mall: false, address: 'Jl. Raya Ubud No. 27', opened_year: 2010, confirmed: true }),
  S({ id: 'ST052', brand_id: 'BR001', name: 'Starbucks Sanur (Jl. By Pass Ngurah Rai)', lat: -8.6722, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', is_in_mall: false, address: 'Jl. By Pass Ngurah Rai No. 88, Sanur', opened_year: 2012, confirmed: true }),
  S({ id: 'ST053', brand_id: 'BR001', name: 'Starbucks Canggu (Jl. Pantai Berawa)', lat: -8.6531, lng: 115.1389, kec: 'Kuta Utara', kab: 'Badung', is_in_mall: false, address: 'Jl. Pantai Berawa, Canggu', opened_year: 2018, confirmed: true }),
  S({ id: 'ST054', brand_id: 'BR001', name: 'Starbucks Seminyak (Jl. Kayu Aya)', lat: -8.6869, lng: 115.1611, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Jl. Kayu Aya, Seminyak', opened_year: 2014, confirmed: true }),
  S({ id: 'ST055', brand_id: 'BR001', name: 'Starbucks Renon (Jl. Raya Puputan)', lat: -8.6708, lng: 115.2169, kec: 'Denpasar Selatan', kab: 'Denpasar', is_in_mall: false, address: 'Jl. Raya Puputan, Renon', opened_year: 2011, confirmed: false }),
  S({ id: 'ST056', brand_id: 'BR001', name: 'Starbucks Jimbaran (Jl. By Pass Ngurah Rai)', lat: -8.7897, lng: 115.1711, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: false, address: 'Jl. By Pass Ngurah Rai, Jimbaran', opened_year: 2016, confirmed: false }),
  S({ id: 'ST057', brand_id: 'BR001', name: 'Starbucks Uluwatu (Jl. Uluwatu)', lat: -8.8297, lng: 115.0889, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: false, address: 'Jl. Uluwatu, Pecatu', opened_year: 2019, confirmed: false }),
  S({ id: 'ST058', brand_id: 'BR001', name: 'Starbucks Denpasar Airport (DPS Ngurah Rai)', lat: -8.7481, lng: 115.1672, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Ngurah Rai International Airport, T2', opened_year: 2014, confirmed: true }),
  S({ id: 'ST059', brand_id: 'BR001', name: 'Starbucks Singaraja (Jl. Diponegoro)', lat: -8.1147, lng: 115.0917, kec: 'Singaraja', kab: 'Buleleng', is_in_mall: false, address: 'Jl. Diponegoro No. 15', opened_year: 2017, confirmed: false }),
  S({ id: 'ST060', brand_id: 'BR001', name: 'Starbucks Gianyar (Jl. By Pass Dharma Giri)', lat: -8.5617, lng: 115.3167, kec: 'Gianyar', kab: 'Gianyar', is_in_mall: false, address: 'Jl. By Pass Dharma Giri', opened_year: 2018, confirmed: false }),

  // Multi-brand Sports stores outside malls
  S({ id: 'ST061', brand_id: 'BR101', name: 'Sports Station Seminyak (Jl. Raya Seminyak)', lat: -8.6761, lng: 115.1628, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Jl. Raya Seminyak No. 88', opened_year: 2019, confirmed: false }),
  S({ id: 'ST062', brand_id: 'BR102', name: 'Planet Sports Denpasar (Jl. Teuku Umar)', lat: -8.6708, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: false, address: 'Jl. Teuku Umar No. 100, Denpasar', opened_year: 2015, confirmed: false }),

  // Subway (street QSR expansion)
  S({ id: 'ST063', brand_id: 'BR007', name: 'Subway Seminyak (Jl. Raya Seminyak)', lat: -8.6786, lng: 115.1628, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Jl. Raya Seminyak', opened_year: 2022, confirmed: false }),
  S({ id: 'ST064', brand_id: 'BR007', name: 'Subway Kuta (Jl. Pantai Kuta)', lat: -8.7211, lng: 115.1689, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Jl. Pantai Kuta No. 12', opened_year: 2022, confirmed: false }),
  S({ id: 'ST065', brand_id: 'BR007', name: 'Subway Sanur (Jl. Danau Tamblingan)', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', is_in_mall: false, address: 'Jl. Danau Tamblingan, Sanur', opened_year: 2023, confirmed: false }),

  // Popeyes (newer openings)
  S({ id: 'ST066', brand_id: 'BR010', name: 'Popeyes Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Food Court, Lt. 2', opened_year: 2023, confirmed: false }),
  S({ id: 'ST067', brand_id: 'BR010', name: 'Popeyes Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'LW Denpasar Food Court, Lt. 2', opened_year: 2024, confirmed: false }),

  // Reebok / Skechers standalone
  S({ id: 'ST068', brand_id: 'BR104', name: 'Reebok Kuta Square', lat: -8.7211, lng: 115.1711, kec: 'Kuta', kab: 'Badung', is_in_mall: false, address: 'Kuta Square, Jl. Kartika Plaza', opened_year: 2017, confirmed: false }),
  S({ id: 'ST069', brand_id: 'BR105', name: 'Skechers Sanur (Jl. By Pass Ngurah Rai)', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', is_in_mall: false, address: 'Jl. By Pass Ngurah Rai, Sanur', opened_year: 2019, confirmed: false }),

  // Sushi Tei additional locations
  S({ id: 'ST070', brand_id: 'BR011', name: 'Sushi Tei Canggu (Jl. Pantai Berawa)', lat: -8.6531, lng: 115.1389, kec: 'Kuta Utara', kab: 'Badung', is_in_mall: false, address: 'Jl. Pantai Berawa, Canggu', opened_year: 2020, confirmed: false }),
  S({ id: 'ST071', brand_id: 'BR011', name: 'Sushi Tei Sanur (Jl. Danau Tamblingan)', lat: -8.6747, lng: 115.2611, kec: 'Denpasar Timur', kab: 'Denpasar', is_in_mall: false, address: 'Jl. Danau Tamblingan, Sanur', opened_year: 2018, confirmed: false }),

  // Genki Sushi additional
  S({ id: 'ST072', brand_id: 'BR006', name: 'Genki Sushi Beachwalk', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. 2', opened_year: 2015, confirmed: false }),

  // Krispy Kreme additional
  S({ id: 'ST073', brand_id: 'BR003', name: 'Krispy Kreme Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2010, confirmed: false }),
  S({ id: 'ST074', brand_id: 'BR003', name: 'Krispy Kreme Lippo Mall Kuta', lat: -8.7286, lng: 115.1811, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL005', mall_name: 'Lippo Mall Kuta', address: 'LMK Lt. GF', opened_year: 2015, confirmed: false }),

  // Cold Stone Creamery additional
  S({ id: 'ST075', brand_id: 'BR004', name: 'Cold Stone Creamery Mall Bali Galeria', lat: -8.7053, lng: 115.1847, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL004', mall_name: 'Mall Bali Galeria', address: 'MBG Lt. GF', opened_year: 2012, confirmed: false }),
  S({ id: 'ST076', brand_id: 'BR004', name: 'Cold Stone Creamery Trans Studio Mall', lat: -8.7311, lng: 115.2089, kec: 'Kuta Selatan', kab: 'Badung', is_in_mall: true, mall_id: 'MLL006', mall_name: 'Trans Studio Mall Bali', address: 'TSM Lt. GF', opened_year: 2020, confirmed: false }),

  // PAUL Bakery additional
  S({ id: 'ST077', brand_id: 'BR008', name: 'PAUL Bakery Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2019, confirmed: false }),

  // New Balance / Hoka / Foot Locker mall presence
  S({ id: 'ST078', brand_id: 'BR106', name: 'New Balance Beachwalk Kuta', lat: -8.7197, lng: 115.1697, kec: 'Kuta', kab: 'Badung', is_in_mall: true, mall_id: 'MLL002', mall_name: 'Beachwalk Shopping Center', address: 'Beachwalk Lt. GF', opened_year: 2019, confirmed: false }),
  S({ id: 'ST079', brand_id: 'BR107', name: 'Hoka Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'LW Denpasar Lt. GF', opened_year: 2024, confirmed: false }),
  S({ id: 'ST080', brand_id: 'BR110', name: 'Foot Locker Living World Denpasar', lat: -8.6608, lng: 115.1947, kec: 'Denpasar Barat', kab: 'Denpasar', is_in_mall: true, mall_id: 'MLL001', mall_name: 'Living World Denpasar', address: 'LW Denpasar Lt. GF', opened_year: 2023, confirmed: false }),
]

export interface StoreCountBy {
  kec: string
  kab: string
  count: number
  brands: string[]
}

export function getStoresByKabupaten(kab: string): Store[] {
  return BALI_STORES.filter(s => s.kab === kab)
}

export function getStoresByKecamatan(kec: string): Store[] {
  return BALI_STORES.filter(s => s.kec === kec)
}

export function getStoresByBrand(brandId: string): Store[] {
  return BALI_STORES.filter(s => s.brand_id === brandId)
}

export function getStoresByMall(mallId: string): Store[] {
  return BALI_STORES.filter(s => s.mall_id === mallId)
}

export function getStoreCountsByKecamatan(): StoreCountBy[] {
  const map = new Map<string, StoreCountBy>()
  for (const s of BALI_STORES) {
    const key = `${s.kab}|${s.kec}`
    if (!map.has(key)) {
      map.set(key, { kec: s.kec, kab: s.kab, count: 0, brands: [] })
    }
    const entry = map.get(key)!
    entry.count += 1
    if (!entry.brands.includes(s.brand_name)) entry.brands.push(s.brand_name)
  }
  return Array.from(map.values())
}
