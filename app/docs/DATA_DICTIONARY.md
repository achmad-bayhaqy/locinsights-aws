---
title: Data Dictionary
category: Technical Documentation
order: 2
last_updated: 2026-08-12
owner: Data Team
---

# Data Dictionary

> **Tujuan**: Menjelaskan setiap tabel, kolom, dan tipe data di LocInsights agar pengguna dan manajemen dapat memahami persis apa yang dimaksud setiap field.
>
> **Purpose**: Document every table, column, and data type so users and management can understand exactly what each field means.

## Database Overview

LocInsights menggunakan PostgreSQL (Supabase) dengan PostGIS extension. Schema lengkap ada di `prisma/schema.prisma`.

### Tabel Utama / Main Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `countries` | 1 | Negara (Indonesia) |
| `provinces` | 1 | Provinsi (Bali) |
| `kabupaten` | 9 | 8 Kabupaten + 1 Kota (Denpasar) |
| `kecamatan` | 57 | Kecamatan di Bali |
| `kelurahan` | ~172 | Kelurahan/Desa terkurasi |
| `brands` | 40+ | Katalog brand MAP/MAA |
| `stores` | ~70 | Gerai MAP/MAA di Bali |
| `malls` | ~25 | Mal/pusat perbelanjaan |
| `mall_tenants` | ~150 | Tenant di setiap mal |
| `pois` | ~80 | Points of Interest |
| `competitor_stores` | ~500+ | Gerai kompetitor (live OSM) |
| `ab_tests` | variable | A/B test configurations |
| `ml_models` | 1+ | Trained ML model metadata |
| `predictions` | variable | ML predictions per kelurahan |
| `training_runs` | variable | ML training history |
| `field_surveys` | variable | Survey lapangan |
| `staging_*` | variable | Review queue for scraped data |

---

## Table: `kelurahan`

Tabel utama untuk analisis — setiap row adalah satu kelurahan/desa dengan skor dan rekomendasi.

| Column | Type | Description | Example | Source |
|--------|------|-------------|---------|--------|
| `id` | `text PK` | Unique identifier (kec_code + kelurahan code) | `"5101010001"` | Derived |
| `code` | `text` | Kode wilayah resmi (Kemendagri) | `"5101010"` | BPS/Kemendagri |
| `name` | `text` | Nama kelurahan/desa | `"Dangin Tukad Badung"` | BPS |
| `kec_code` | `text FK` | Kode kecamatan induk | `"5101010"` | bali-admin.ts |
| `kec_name` | `text` | Nama kecamatan | `"Denpasar Selatan"` | bali-admin.ts |
| `kab_code` | `text FK` | Kode kabupaten/kota | `"5171"` | bali-admin.ts |
| `kab_name` | `text` | Nama kabupaten/kota | `"Kota Denpasar"` | bali-admin.ts |
| `tier` | `int (1-3)` | Tingkat urbanisasi: 1=urban, 2=sub-urban, 3=rural | `1` | Derived from BPS |
| `lat` | `float` | Latitude (WGS84) | `-8.6750` | Centroid + offset |
| `lng` | `float` | Longitude (WGS84) | `115.2120` | Centroid + offset |
| `population` | `int` | Estimasi populasi | `12500` | BPS (derived) |
| `area_km2` | `float` | Luas area dalam km² | `4.5` | BPS (derived) |
| `density` | `float` | Kepadatan penduduk per km² (computed) | `2777.8` | population / area_km2 |
| `urban_score` | `float (0-100)` | Skor urbanisasi (proxy) | `78.5` | Derived from tier + POI density |
| `income_index` | `float (0-100)` | Indeks pendapatan (proxy dari GDRP kabupaten) | `65.0` | Derived from BPS GDRP |
| `tourist_index` | `float (0-100)` | Indeks wisata (proxy dari POI kedekatan) | `82.0` | Derived from POI proximity |
| `transport_index` | `float (0-100)` | Indeks transportasi (proxy) | `70.0` | Derived from road network |
| `poi_density_index` | `float (0-100)` | Kepadatan POI | `55.0` | Derived from POI count |
| `composite_score` | `float (0-100)` | **Skor komposit** (weighted factors) | `72.5` | Scoring engine output |
| `recommendation` | `enum` | Rekomendasi: `high_priority`, `priority`, `monitor`, `avoid` | `"high_priority"` | Scoring engine output |
| `potential_market_share` | `float (0-1)` | Estimasi pangsa pasar (Huff model) | `0.18` | Huff gravity model |
| `estimated_daily_customers` | `int` | Estimasi pelanggan harian | `450` | Derived from market share |
| `projected_monthly_revenue_juta` | `float` | Estimasi revenue bulanan (juta IDR) | `135.5` | GBR ML prediction |
| `nearest_mall_distance_km` | `float` | Jarak ke mal terdekat (Haversine) | `2.3` | Computed |
| `nearest_mall_name` | `text?` | Nama mal terdekat | `"Living World Denpasar"` | Computed |
| `nearby_existing_stores` | `int` | Jumlah gerai MAP/MAA dalam 2 km | `3` | Computed |
| `cannibalization_risk` | `enum` | Risiko kanibalisasi: `low`, `medium`, `high` | `"medium"` | Computed |
| `white_space_summary` | `text` | Ringkasan peluang white space | `"High demand, low competition"` | Generated |

---

## Table: `stores`

Gerai MAP/MAA yang sudah beroperasi.

| Column | Type | Description | Example | Source |
|--------|------|-------------|---------|--------|
| `id` | `text PK` | Unique ID | `"store_starbucks_beackwalk"` | Generated |
| `brand_id` | `text FK` | Reference to `brands.id` | `"starbucks"` | brands.ts |
| `brand_name` | `text` | Nama brand | `"Starbucks"` | brands.ts |
| `brand_category` | `text` | Kategori brand | `"food_beverage"` | brands.ts |
| `parent` | `enum` | `MAP` atau `MAA` | `"MAA"` | brands.ts |
| `name` | `text` | Nama gerai | `"Starbucks Beachwalk"` | Manual |
| `lat` | `float` | Latitude | `-8.7197` | Manual |
| `lng` | `float` | Longitude | `115.1685` | Manual |
| `kec` | `text` | Kecamatan | `"Kuta"` | Manual |
| `kab` | `text` | Kabupaten | `"Badung"` | Manual |
| `is_in_mall` | `bool` | Apakah di dalam mal | `true` | Manual |
| `mall_id` | `text FK?` | Reference to `malls.id` | `"mall_beachwalk"` | malls.ts |
| `mall_name` | `text?` | Nama mal | `"Beachwalk Shopping Mall"` | malls.ts |
| `address` | `text` | Alamat lengkap | `"Jl. Pantai Kuta No.2"` | Manual |
| `opened_year` | `int` | Tahun buka | `2013` | Manual |
| `estimated_size_m2` | `int?` | Estimasi ukuran (m²) | `180` | Estimated |
| `confirmed` | `bool` | Verified via mall directory | `true` | Cross-check |

---

## Table: `brands`

Katalog brand MAP/MAA.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | `text PK` | Brand slug | `"starbucks"` |
| `name` | `text` | Nama brand | `"Starbucks"` |
| `parent` | `enum` | `MAP` atau `MAA` | `"MAA"` |
| `category` | `enum` | `food_beverage`, `sports`, `fashion`, `department_store`, `kids`, `lifestyle`, `beauty` | `"food_beverage"` |
| `origin_country` | `text` | Negara asal | `"United States"` |
| `format` | `text` | Format gerai | `"Coffee shop, standalone or mall"` |
| `store_size_preference` | `enum` | `mall`, `street`, `both` | `"both"` |

---

## Table: `malls`

Katalog mal di Bali.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | `text PK` | Mall slug | `"mall_beachwalk"` |
| `name` | `text` | Nama mal | `"Beachwalk Shopping Mall"` |
| `lat` | `float` | Latitude | `-8.7197` |
| `lng` | `float` | Longitude | `115.1685` |
| `kec` | `text` | Kecamatan | `"Kuta"` |
| `kab` | `text` | Kabupaten | `"Badung"` |
| `gla_m2` | `int` | Gross Leasable Area (m²) | `26000` |
| `opened_year` | `int` | Tahun buka | `2013` |
| `class` | `enum` | `super_regional`, `regional`, `community`, `specialty` | `"super_regional"` |
| `anchor_count` | `int` | Jumlah anchor tenant | `4` |
| `has_cinema` | `bool` | Punya bioskop | `true` |
| `has_supermarket` | `bool` | Punya supermarket | `true` |
| `has_department_store` | `bool` | Punya department store | `true` |
| `visitor_estimate_daily` | `int` | Estimasi pengunjung harian | `12000` |
| `notes` | `text` | Catatan tambahan | `"Premier luxury mall in Bali"` |

---

## Table: `competitor_stores`

Gerai kompetitor (non-MAP) dari OpenStreetMap.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | `text PK` | Unique ID (OSM node/way ID) | `"osm_12345678"` |
| `brand_name` | `text` | Nama brand | `"Indomaret"` |
| `brand_category` | `enum` | `convenience_store`, `fast_food`, `coffee`, `fashion`, `beauty`, `supermarket`, `pharmacy`, `other` | `"convenience_store"` |
| `name` | `text` | Nama gerai | `"Indomaret Kuta"` |
| `lat` | `float` | Latitude | `-8.7234` |
| `lng` | `float` | Longitude | `115.1688` |
| `kec` | `text` | Kecamatan | `"Kuta"` |
| `kab` | `text` | Kabupaten | `"Badung"` |
| `address` | `text?` | Alamat (jika tersedia di OSM) | `"Jl. Raya Kuta No. 88"` |
| `source` | `text` | Sumber data | `"OpenStreetMap Overpass API"` |
| `scraped_at` | `timestamp` | Waktu scraping | `"2026-08-12T10:30:00Z"` |

---

## Table: `pois`

Points of Interest di Bali.

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | `text PK` | POI slug | `"poi_kuta_beach"` |
| `name` | `text` | Nama POI | `"Kuta Beach"` |
| `type` | `enum` | `tourist_attraction`, `beach`, `temple`, `hotel_cluster`, `transit_hub`, `university`, `hospital`, `office_cluster`, `port` | `"beach"` |
| `lat` | `float` | Latitude | `-8.7186` |
| `lng` | `float` | Longitude | `115.1686` |
| `kec` | `text` | Kecamatan | `"Kuta"` |
| `kab` | `text` | Kabupaten | `"Badung"` |
| `magnitude` | `int` | Estimasi pengunjung tahunan (atau jumlah kamar untuk hotel_cluster) | `3500000` |
| `notes` | `text` | Catatan | `"Most visited beach in Bali"` |
| `source` | `text?` | Sumber data | `"Bali Tourism Board"` |

---

## Table: `ab_tests`

Konfigurasi A/B test untuk simulasi.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text PK` | Test ID |
| `name` | `text` | Test name |
| `kelurahan_id` | `text FK` | Target kelurahan |
| `variant_a` | `jsonb` | Variant A parameters (assumptions) |
| `variant_b` | `jsonb` | Variant B parameters |
| `result_a` | `jsonb` | Computed result for A |
| `result_b` | `jsonb` | Computed result for B |
| `created_at` | `timestamp` | Creation time |
| `created_by` | `text` | User who created |

---

## Table: `ml_models`

Metadata model ML yang sudah di-train.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text PK` | Model ID (e.g., `gbr-revenue-bali-v1`) |
| `name` | `text` | Human-readable name |
| `algorithm` | `text` | Algorithm (e.g., `gradient_boosting_regression`) |
| `version` | `text` | Semantic version |
| `features` | `text[]` | Feature names |
| `target` | `text` | Target variable |
| `metrics` | `jsonb` | Training metrics (MSE, MAE, R²) |
| `trained_at` | `timestamp` | Training time |
| `model_file` | `text` | Path to serialized model JSON |

---

## Table: `field_surveys`

Data survei lapangan dari surveyor PWA.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text PK` | Survey ID |
| `kelurahan_id` | `text FK` | Target kelurahan |
| `brand_id` | `text FK?` | Brand (if applicable) |
| `store_format` | `text` | Store format observed |
| `foot_traffic_observation` | `text` | Surveyor's observation |
| `competitor_presence` | `text` | Competitors seen nearby |
| `photo_url` | `text?` | Photo URL |
| `notes` | `text` | Additional notes |
| `surveyor_name` | `text` | Surveyor name |
| `survey_date` | `date` | Survey date |
| `created_at` | `timestamp` | Record creation |

---

## Staging Tables (Scraped Data Review)

Data hasil scraping yang belum di-review masuk ke staging tables:

- `staging_stores` — scraped MAP/MAA stores (pending review)
- `staging_competitors` — scraped competitor stores (pending review)
- `staging_malls` — scraped malls (pending review)

Setelah di-review dan disetujui via Data Manager, data dipindahkan ke tabel utama.

---

## Enum Types

### `recommendation`
- `high_priority` — Composite score ≥ 70, segera ekspansi
- `priority` — Composite score 55-69, prioritas ekspansi
- `monitor` — Composite score 40-54, pantau perkembangan
- `avoid` — Composite score < 40, hindari ekspansi

### `cannibalization_risk`
- `low` — < 2 gerai MAP/MAA dalam 2 km
- `medium` — 2-4 gerai MAP/MAA dalam 2 km
- `high` — > 4 gerai MAP/MAA dalam 2 km

### `tier`
- `1` — Urban (Denpasar, Kuta, Seminyak, Sanur)
- `2` — Sub-urban (Gianyar, Tabanan, Negara)
- `3` — Rural (karangasem, Bangli,偏远 areas)

### `brand_category`
- `food_beverage` — F&B outlets (Starbucks, Pizza Hut, etc.)
- `sports` — Sports brands (Nike, Adidas, Sports Direct)
- `fashion` — Fashion brands (Zara, H&M, Uniqlo)
- `department_store` — Department stores (Sogo, Debenhams)
- `kids` — Kids brands (Lego, Toys "R" Us)
- `lifestyle` — Lifestyle (Kinokuniya, Miniso)
- `beauty` — Beauty (Sephora, MAC)

---

## Untuk Pertanyaan Data / For Data Questions

Hubungi **Data Team** — https://bayhaqy.my.id

Untuk permintaan akses data raw (CSV/Excel) untuk audit eksternal, email dengan subject `[DATA AUDIT REQUEST]` dan sertakan:
1. Nama dataset yang diminta
2. Tujuan audit
3. Period of data needed
