/**
 * Brand Catalog — PT Mitra Adiperkasa Tbk (MAP) & PT MAP Aktif Adiperkasa Tbk (MAA / MAP Active)
 * Sources:
 *   - map.co.id/brands (verified Aug 2026)
 *   - mapactive.id/brands (verified Aug 2026)
 *   - MBAI annual report (Map Boga Adiperkasa)
 *   - sgbonline.com (Mar 2026): MAA 2,200+ stores, 40+ brands
 *   - sgieurope.com (Jul 2026): MAA acquires Sports Direct Malaysia
 *
 * Brands grouped by MAP parent entity + category.
 */

export type BrandParent = 'MAP' | 'MAA' // MAP = Mitra Adiperkasa (parent), MAA = MAP Active (sports/kids subsidiary)
export type BrandCategory =
  | 'food_beverage'
  | 'sports'
  | 'fashion'
  | 'department_store'
  | 'kids'
  | 'lifestyle'
  | 'beauty'

export interface Brand {
  id: string
  name: string
  parent: BrandParent
  category: BrandCategory
  origin_country: string
  format: string
  // store size preference: 'mall' = prefers mall, 'street' = can stand alone, 'both'
  location_preference: 'mall' | 'street' | 'both'
  typical_size_m2: number
  target_audience: string
  price_segment: 'mass' | 'mid' | 'premium' | 'luxury'
  // brand strength factor (0-1): how strongly it pulls customers
  brand_strength: number
  notes: string
}

export const BRANDS: Brand[] = [
  // =========================================================
  // MAP — Food & Beverage (Map Boga Adiperkasa - MBAI subsidiary)
  // =========================================================
  {
    id: 'BR001',
    name: 'Starbucks',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'USA',
    format: 'Coffee Shop',
    location_preference: 'both',
    typical_size_m2: 120,
    target_audience: 'Urban professionals, students, tourists 18-45',
    price_segment: 'mid',
    brand_strength: 0.95,
    notes: 'Strongest F&B brand in MAP portfolio. 590+ stores in 33 Indonesian cities (as of 2026).'
  },
  {
    id: 'BR002',
    name: 'Pizza Marzano',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'Indonesia/UK',
    format: 'Casual Dining',
    location_preference: 'mall',
    typical_size_m2: 280,
    target_audience: 'Families, groups 25-50',
    price_segment: 'mid',
    brand_strength: 0.78,
    notes: 'Rebranded Pizza Hut Indonesia (since 2023 dispute with Yum! Brands).'
  },
  {
    id: 'BR003',
    name: 'Krispy Kreme',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'USA',
    format: 'Donut Shop',
    location_preference: 'mall',
    typical_size_m2: 80,
    target_audience: 'Families, office workers 20-45',
    price_segment: 'mid',
    brand_strength: 0.72,
    notes: 'Donut + coffee. Strong mall presence.'
  },
  {
    id: 'BR004',
    name: 'Cold Stone Creamery',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'USA',
    format: 'Ice Cream',
    location_preference: 'mall',
    typical_size_m2: 60,
    target_audience: 'Families, teens 15-35',
    price_segment: 'mid',
    brand_strength: 0.65,
    notes: 'Premium ice cream, mostly kiosk format in malls.'
  },
  {
    id: 'BR005',
    name: 'Godiva',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'Belgium',
    format: 'Chocolatier',
    location_preference: 'mall',
    typical_size_m2: 50,
    target_audience: 'Premium gifting, tourists 25-55',
    price_segment: 'premium',
    brand_strength: 0.78,
    notes: 'Premium chocolate. Strong in tourist areas & luxury malls.'
  },
  {
    id: 'BR006',
    name: 'Genki Sushi',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'Japan',
    format: 'Quick Service Sushi',
    location_preference: 'mall',
    typical_size_m2: 220,
    target_audience: 'Young adults, families 20-45',
    price_segment: 'mid',
    brand_strength: 0.74,
    notes: 'Conveyor belt sushi. Tech-driven ordering.'
  },
  {
    id: 'BR007',
    name: 'Subway',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'USA',
    format: 'Quick Service Sandwich',
    location_preference: 'both',
    typical_size_m2: 90,
    target_audience: 'Office workers, students 18-40',
    price_segment: 'mass',
    brand_strength: 0.68,
    notes: 'Launched in Indonesia 2021. Aggressive expansion plan.'
  },
  {
    id: 'BR008',
    name: 'PAUL Bakery',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'France',
    format: 'Bakery + Cafe',
    location_preference: 'mall',
    typical_size_m2: 180,
    target_audience: 'Urban professionals 25-50',
    price_segment: 'premium',
    brand_strength: 0.71,
    notes: 'French bakery-restaurant. Premium positioning.'
  },
  {
    id: 'BR009',
    name: 'Toast Box',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'Singapore',
    format: 'Quick Service Asian',
    location_preference: 'both',
    typical_size_m2: 100,
    target_audience: 'Families, Asian cuisine fans 25-55',
    price_segment: 'mid',
    brand_strength: 0.60,
    notes: 'Singaporean breakfast concept.'
  },
  {
    id: 'BR010',
    name: 'Popeyes',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'USA',
    format: 'Quick Service Chicken',
    location_preference: 'both',
    typical_size_m2: 130,
    target_audience: 'Families, young adults 18-40',
    price_segment: 'mass',
    brand_strength: 0.66,
    notes: 'Fried chicken chain.'
  },
  {
    id: 'BR011',
    name: 'Sushi Tei',
    parent: 'MAP',
    category: 'food_beverage',
    origin_country: 'Indonesia',
    format: 'Casual Japanese Dining',
    location_preference: 'mall',
    typical_size_m2: 240,
    target_audience: 'Families, executives 25-50',
    price_segment: 'mid',
    brand_strength: 0.75,
    notes: 'Popular mid-tier Japanese restaurant chain.'
  },

  // =========================================================
  // MAA — Sports, Leisure, Kids (MAP Active / MAP Aktif)
  // 2,200+ stores, 40+ brands (as of Mar 2026 per sgbonline.com)
  // =========================================================
  {
    id: 'BR101',
    name: 'Sports Station',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'Indonesia',
    format: 'Multi-brand Sports Retailer',
    location_preference: 'mall',
    typical_size_m2: 600,
    target_audience: 'Mass sports consumers 15-45',
    price_segment: 'mid',
    brand_strength: 0.74,
    notes: 'MAA flagship multi-brand sports format. Carries Nike, Adidas, Puma, etc.'
  },
  {
    id: 'BR102',
    name: 'Planet Sports',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'Indonesia',
    format: 'Multi-brand Sports Superstore',
    location_preference: 'mall',
    typical_size_m2: 850,
    target_audience: 'Active lifestyle 15-50',
    price_segment: 'mid',
    brand_strength: 0.72,
    notes: 'Larger format than Sports Station. Departmental layout.'
  },
  {
    id: 'BR103',
    name: 'The Athlete\'s Foot',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Specialty Footwear',
    location_preference: 'mall',
    typical_size_m2: 220,
    target_audience: 'Premium athletic consumers 25-50',
    price_segment: 'premium',
    brand_strength: 0.69,
    notes: 'Premium footwear, FITID technology.'
  },
  {
    id: 'BR104',
    name: 'Reebok',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Mono-brand Sportswear',
    location_preference: 'both',
    typical_size_m2: 200,
    target_audience: 'Fitness enthusiasts 18-40',
    price_segment: 'mid',
    brand_strength: 0.80,
    notes: 'Top 5 Netizen Choice Sports Brand (Indonesia 2024).'
  },
  {
    id: 'BR105',
    name: 'Skechers',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Mono-brand Footwear',
    location_preference: 'both',
    typical_size_m2: 180,
    target_audience: 'Families, walkers 25-60',
    price_segment: 'mid',
    brand_strength: 0.81,
    notes: 'Walking & lifestyle footwear leader in Indonesia.'
  },
  {
    id: 'BR106',
    name: 'New Balance',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Mono-brand Sportswear',
    location_preference: 'mall',
    typical_size_m2: 200,
    target_audience: 'Premium athletic 25-50',
    price_segment: 'premium',
    brand_strength: 0.83,
    notes: 'Strong growth in Indonesia, dad-shoe trend driver.'
  },
  {
    id: 'BR107',
    name: 'Hoka',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Mono-brand Running',
    location_preference: 'mall',
    typical_size_m2: 120,
    target_audience: 'Runners, premium athletic 25-50',
    price_segment: 'premium',
    brand_strength: 0.79,
    notes: 'Fast-growing running shoe brand, ultra-cushioned.'
  },
  {
    id: 'BR108',
    name: 'Converse',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Mono-brand Lifestyle Footwear',
    location_preference: 'mall',
    typical_size_m2: 130,
    target_audience: 'Youth 15-30',
    price_segment: 'mid',
    brand_strength: 0.74,
    notes: 'Iconic lifestyle sneaker brand.'
  },
  {
    id: 'BR109',
    name: 'Onitsuka Tiger',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'Japan',
    format: 'Mono-brand Lifestyle',
    location_preference: 'mall',
    typical_size_m2: 150,
    target_audience: 'Premium lifestyle 25-45',
    price_segment: 'premium',
    brand_strength: 0.76,
    notes: 'Japanese heritage sportswear, premium positioning.'
  },
  {
    id: 'BR110',
    name: 'Foot Locker',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'USA',
    format: 'Multi-brand Sneaker',
    location_preference: 'mall',
    typical_size_m2: 280,
    target_audience: 'Sneakerheads 16-35',
    price_segment: 'mid',
    brand_strength: 0.77,
    notes: 'MAA partnership since Sep 2021. Premium sneaker retail.'
  },
  {
    id: 'BR111',
    name: 'Golf House',
    parent: 'MAA',
    category: 'sports',
    origin_country: 'Indonesia',
    format: 'Specialty Golf',
    location_preference: 'both',
    typical_size_m2: 350,
    target_audience: 'Golfers 30-65, premium income',
    price_segment: 'premium',
    brand_strength: 0.62,
    notes: 'Premium golf equipment & apparel. Bali has multiple golf courses.'
  },

  // =========================================================
  // MAP — Department Store & Fashion (parent MAP entity)
  // =========================================================
  {
    id: 'BR201',
    name: 'Sogo',
    parent: 'MAP',
    category: 'department_store',
    origin_country: 'Japan',
    format: 'Premium Department Store',
    location_preference: 'mall',
    typical_size_m2: 6500,
    target_audience: 'Mid-premium shoppers 25-60',
    price_segment: 'premium',
    brand_strength: 0.78,
    notes: 'Anchor tenant in Living World Denpasar & Beachwalk.'
  },
  {
    id: 'BR202',
    name: 'SEIBU',
    parent: 'MAP',
    category: 'department_store',
    origin_country: 'Japan',
    format: 'Luxury Department Store',
    location_preference: 'mall',
    typical_size_m2: 8000,
    target_audience: 'Luxury shoppers 30-60',
    price_segment: 'luxury',
    brand_strength: 0.76,
    notes: 'Luxury department store. Currently only in Jakarta (Grand Indonesia).'
  },
  {
    id: 'BR203',
    name: 'Matahari Department Store',
    parent: 'MAP',
    category: 'department_store',
    origin_country: 'Indonesia',
    format: 'Mass Department Store',
    location_preference: 'mall',
    typical_size_m2: 4500,
    target_audience: 'Mass market 20-55',
    price_segment: 'mass',
    brand_strength: 0.71,
    notes: 'Anchor in older malls like Discovery, Mall Bali Galeria, Ramayana Mall.'
  },
  {
    id: 'BR204',
    name: 'Zara',
    parent: 'MAP',
    category: 'fashion',
    origin_country: 'Spain',
    format: 'Fast Fashion',
    location_preference: 'mall',
    typical_size_m2: 700,
    target_audience: 'Fashion-conscious 18-40',
    price_segment: 'mid',
    brand_strength: 0.84,
    notes: 'Inditex brand. Strong in premium malls.'
  },
  {
    id: 'BR205',
    name: 'Marks & Spencer',
    parent: 'MAP',
    category: 'fashion',
    origin_country: 'UK',
    format: 'Mid-premium Fashion',
    location_preference: 'mall',
    typical_size_m2: 400,
    target_audience: 'Adults 30-60',
    price_segment: 'mid',
    brand_strength: 0.72,
    notes: 'British heritage fashion + food.'
  },
]

export function getBrandsByParent(parent: BrandParent): Brand[] {
  return BRANDS.filter(b => b.parent === parent)
}

export function getBrandsByCategory(category: BrandCategory): Brand[] {
  return BRANDS.filter(b => b.category === category)
}

export function getBrand(id: string): Brand | undefined {
  return BRANDS.find(b => b.id === id)
}
