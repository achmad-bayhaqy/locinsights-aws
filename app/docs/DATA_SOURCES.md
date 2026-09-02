---
title: Data Sources
category: User Documentation
order: 1
last_updated: 2026-08-12
owner: Data Team
---

# Data Sources & Provenance

> **Tujuan halaman ini**: Memberikan transparansi penuh atas asal-usul setiap data yang digunakan di LocInsights, agar pihak manajemen dapat melakukan validasi menyeluruh terhadap kredibilitas sumber data.
>
> **Purpose**: Full transparency on the origin of every dataset used in LocInsights, so management can validate data credibility end-to-end.

## Ringkasan Sumber Data / Summary

LocInsights menggabungkan data dari **6 kategori sumber**. Setiap dataset memiliki metadata lengkap: URL sumber, format, tanggal refresh, metodologi pengumpulan, lisensi, dan tingkat kredibilitas.

| # | Dataset | Source | Format | Refresh | Credibility |
|---|---------|--------|--------|---------|-------------|
| 1 | Bali Administrative Boundaries | BPS Bali + KEMENDAGRI | Static (TS) | Q4 2024 | ★★★★★ Authoritative |
| 2 | Kelurahan/Desa Demographics | BPS Statistik Kecamatan | Derived | Aug 2026 | ★★★★☆ Official + derived |
| 3 | MAP/MAA Brand Catalog | map.co.id + mapactive.id | Static (TS) | Aug 2026 | ★★★★★ Official |
| 4 | MAP/MAA Store Locations | Public directories + mall cross-check | Static (TS) | Aug 2026 | ★★★★☆ Verified |
| 5 | Bali Mall Catalog | nowbali.co.id, traveloka.com, mall sites | Static (TS) | Feb 2026 | ★★★★☆ Cross-verified |
| 6 | Points of Interest (POI) | Google Maps, OSM, Bali Tourism Board | Static (TS) | Aug 2026 | ★★★★☆ Multi-source |
| 7 | Competitor Stores | OpenStreetMap Overpass API | Live API | Real-time | ★★★★☆ Community-vetted |
| 8 | Bali Land Polygon | GADM v4.1 | Static (TS) | Aug 2026 | ★★★★★ Authoritative |
| 9 | ML Training Data | LocInsights heuristic engine output | Derived | Aug 2026 | ★★★☆☆ Synthetic |
| 10 | Field Survey Data | Surveyor PWA (`/survey`) | User input | Live | ★★★★☆ Primary |

---

## 1. Bali Administrative Boundaries

**Apa**: 9 Kabupaten/Kota, 57 Kecamatan, 716 Kelurahan/Desa di Provinsi Bali.

| Field | Value |
|-------|-------|
| **Primary Source** | BPS Provinsi Bali 2024 publications |
| **Cross-verification** | KEMENDAGRI Permenegri (latest daftar wilayah) |
| **Additional verification** | Wikipedia + OpenStreetMap Overpass + GADM |
| **Format** | TypeScript static data (`src/lib/data/bali-admin.ts`) |
| **Coordinate system** | WGS84 (EPSG:4326), centroid-based |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Annual (BPS publishes new data yearly) |
| **License** | BPS data: Open Government Data Indonesia (open); KEMENDAGRI: public domain |
| **Credibility** | ★★★★★ Authoritative government source |
| **Verification method** | Centroids cross-checked against BPS Atlas Bali 2024 |

**Codes structure**:
- Province: `51` (Bali)
- Kabupaten/Kota: 4-digit (`5101`-`5108` for Kabupaten, `5171` for Kota Denpasar)
- Kecamatan: 7-digit (e.g., `5101010` = Negara, Jembrana)

**Known limitations**:
- Kelurahan/desa boundary polygons are not included (only centroids). For production, integrate full BPS shapefile.

---

## 2. Kelurahan/Desa Demographics

**Apa**: Data demografi tingkat kelurahan/desa: populasi, luas area, indeks pendapatan, indeks wisatawan, indeks transportasi, indeks kepadatan POI.

| Field | Value |
|-------|-------|
| **Primary Source** | BPS Bali 2024 — Statistik Kecamatan publication |
| **Generation method** | Real kecamatan population distribution (proportional, based on BPS area shares) |
| **Coordinate method** | Deterministic offset around kecamatan centroid (seeded) |
| **Demographic proxies** | Derived from urban_score, parent kabupaten GDRP, and POI proximity |
| **Format** | TypeScript static data (`src/lib/data/bali-kelurahan.ts`) |
| **Coverage** | ~220 representative kelurahan/desa across all kabupaten/kota |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Annual (when BPS publishes new statistics) |
| **License** | BPS data: Open Government Data Indonesia (open) |
| **Credibility** | ★★★★☆ Official + derived |
| **Verification method** | Spot-checked against BPS 2024 area-share percentages for 9 kabupaten |

**Known limitations**:
- Bali has ~709 kelurahan/desa total — LocInsights includes ~220 representative subset for demo. Production should integrate full BPS shapefile.
- Demographic indices (income, tourism, transport, POI density) are **proxies** derived from kecamatan-level urban_score, kabupaten GDRP, and POI proximity — not direct measurements.

---

## 3. MAP/MAA Brand Catalog

**Apa**: Katalog 40+ brand milik PT Mitra Adiperkasa Tbk (MAP) dan PT MAP Aktif Adiperkasa Tbk (MAA/MAP Active).

| Field | Value |
|-------|-------|
| **Primary Source** | [map.co.id/brands](https://www.map.co.id/brands) (verified Aug 2026) |
| **Secondary Source** | [mapactive.id/brands](https://www.mapactive.id/brands) (verified Aug 2026) |
| **Tertiary Sources** | MBAI annual report (Map Boga Adiperkasa); sgbonline.com (Mar 2026); sgieurope.com (Jul 2026) |
| **Format** | TypeScript static data (`src/lib/data/brands.ts`) |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Quarterly (when MAP publishes new annual/quarterly reports) |
| **License** | Public catalog data (brand names + categories are public information) |
| **Credibility** | ★★★★★ Official corporate source |
| **Verification method** | Cross-checked across 4 sources (MAP website, MAP Active website, annual report, SGB Online) |

**Brand metadata fields**:
- `parent`: `MAP` (Mitra Adiperkasa parent) or `MAA` (MAP Active subsidiary — sports/kids)
- `category`: `food_beverage`, `sports`, `fashion`, `department_store`, `kids`, `lifestyle`, `beauty`
- `origin_country`: Country of brand origin
- `format`: Store format description (e.g., "standalone", "mall anchor", "kiosk")
- `store_size_preference`: `mall` (prefers mall locations), `street` (can stand alone), `both`

---

## 4. MAP/MAA Store Locations

**Apa**: Lokasi gerai MAP/MAA yang sudah beroperasi di Bali.

| Field | Value |
|-------|-------|
| **Primary Source** | Public MAP store directory |
| **Cross-verification** | Mall tenant lists (nowbali.co.id, traveloka.com, mall official websites) |
| **Verification status** | `confirmed: true` if verified via mall directory; `confirmed: false` if estimated |
| **Format** | TypeScript static data (`src/lib/data/bali-stores.ts`) |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Quarterly |
| **License** | Public directory data |
| **Credibility** | ★★★★☆ Verified (mix of confirmed + estimated) |
| **Verification method** | Each store cross-referenced against 2+ sources where possible |

**Known limitations**:
- For proprietary reasons, the exact store count per location is approximate.
- Where the brand is publicly listed in mall directories (e.g., Sogo in Living World, Starbucks in Beachwalk), `confirmed=true`. Other entries are estimates based on MAP's typical Bali footprint.
- Store size (`estimated_size_m2`) is an estimate based on brand format, not a measured value.

---

## 5. Bali Mall Catalog

**Apa**: Katalog mal/pusat perbelanjaan di Bali (operasional + under construction).

| Field | Value |
|-------|-------|
| **Primary Sources** | [nowbali.co.id](https://www.nowbali.co.id) (Jan 2025), [traveloka.com](https://www.traveloka.com) (May 2025) |
| **Secondary Sources** | bali.com, bali.live (Feb 2026) |
| **Format** | TypeScript static data (`src/lib/data/bali-malls.ts`) |
| **Coordinate accuracy** | Approximate (centroid of mall footprint), WGS84 |
| **Last refreshed** | February 2026 |
| **Refresh cadence** | Semi-annual |
| **License** | Public directory data |
| **Credibility** | ★★★★☆ Cross-verified across 4 sources |
| **Verification method** | Each mall cross-referenced across 2+ directory sites |

**Mall metadata fields**:
- `gla_m2`: Gross Leasable Area in square meters (from mall official data or estimates)
- `class`: `super_regional`, `regional`, `community`, `specialty`
- `anchor_count`: Number of anchor tenants
- `has_cinema`, `has_supermarket`, `has_department_store`: Boolean facility flags
- `visitor_estimate_daily`: Daily visitor estimate (from mall management or third-party estimates)

**Includes**: Operational malls + Living World Kuta (under construction, opening T2 2026).

---

## 6. Points of Interest (POI)

**Apa**: Lokasi penting di Bali yang mempengaruhi foot traffic dan attractiveness: wisata, pantai, pura, hotel cluster, transit hub, universitas, rumah sakit, perkantoran, pelabuhan.

| Field | Value |
|-------|-------|
| **Primary Sources** | Google Maps POI data, OpenStreetMap |
| **Secondary Source** | Bali Tourism Board |
| **Format** | TypeScript static data (`src/lib/data/bali-poi.ts`) |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Annual |
| **License** | OSM: ODbL; Google Maps: ToS; Bali Tourism Board: public |
| **Credibility** | ★★★★☆ Multi-source |
| **Verification method** | Cross-checked across Google Maps + OSM + Tourism Board listings |

**POI types**: `tourist_attraction`, `beach`, `temple`, `hotel_cluster`, `transit_hub`, `university`, `hospital`, `office_cluster`, `port`

**Magnitude field**: Annual visitor estimate (or hotel rooms for `hotel_cluster`). Source: Bali Tourism Board statistics + third-party estimates.

---

## 7. Competitor Stores (Live API)

**Apa**: Lokasi gerai kompetitor (non-MAP) di Bali: Indomaret, Alfamart, Circle K, McDonald's, KFC, Starbucks, dll.

| Field | Value |
|-------|-------|
| **Primary Source** | OpenStreetMap Overpass API |
| **API Endpoint** | `https://overpass-api.de/api/interpreter` |
| **Query method** | Brand-based tag filter (e.g., `"brand"="Indomaret"`) |
| **Format** | Live API → PostgreSQL `competitor_stores` table |
| **Last refreshed** | Real-time (on-demand via Data Scraper) |
| **Refresh cadence** | On-demand (user triggers via Scraper UI) |
| **License** | ODbL (OpenStreetMap) |
| **Credibility** | ★★★★☆ Community-vetted |
| **Verification method** | OSM tags are community-verified; brand classification via `src/lib/brand-classifier.ts` |

**Brand classifier logic** (`src/lib/brand-classifier.ts`):
- MAA/MAP portfolio brand → `stores` table with `brand_id` + `parent`
- Tracked competitor brand → `competitor_stores` table
- Unknown brand → `competitor_stores` table with `brand_category='other'`

**Full list of tracked competitor brands**: see `competitor-brands.ts` (20+ brands across 7 categories).

---

## 8. Bali Land Polygon

**Apa**: Polygon daratan Bali (mainland + Bukit peninsula + Nusa Penida) untuk validasi koordinat.

| Field | Value |
|-------|-------|
| **Source** | GADM v4.1 Bali province outline |
| **Format** | TypeScript static data (`src/lib/data/bali-land.ts`) |
| **Coordinate system** | WGS84, polygon points ordered counterclockwise |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | Rarely changes (geographic) |
| **License** | GADM: free for academic use; commercial use requires license |
| **Credibility** | ★★★★★ Authoritative |
| **Verification method** | Visual comparison with satellite imagery |

**Used by**:
- Kelurahan generator (snap points into land)
- Scraper endpoint (verify new points are on land)
- Data manager (validate user-entered coordinates)

---

## 9. ML Training Data

**Apa**: Data training untuk model Gradient-Boosted Regression (GBR) yang memprediksi revenue bulanan.

| Field | Value |
|-------|-------|
| **Source** | LocInsights heuristic engine output (derived) |
| **Generation method** | `target = projected_monthly_revenue_juta + multiplicative log-normal noise` |
| **Format** | JSON model file (`prisma/ml-models/gbr-revenue-bali-v1.json`) |
| **Last refreshed** | August 2026 |
| **Refresh cadence** | On-demand (via ML Engine → Train) |
| **License** | Internal (LocInsights) |
| **Credibility** | ★★★☆☆ Synthetic (derived from heuristic, not real sales) |

**IMPORTANT — Honest ML disclaimer**: This is honest ML — the model learns the heuristic AND noise, so its predictions will diverge from the heuristic in production. As real sales data arrives, the same trainer can be re-run on actual revenue targets. Until then, GBR predictions should be treated as **directional guidance**, not precise forecasts.

---

## 10. Field Survey Data

**Apa**: Data survei lapangan yang dikumpulkan oleh tim surveyor via PWA di `/survey`.

| Field | Value |
|-------|-------|
| **Source** | User input (surveyor PWA) |
| **Format** | PostgreSQL `field_surveys` table (via API) |
| **API Endpoint** | `POST /api/locinsight/field-survey` |
| **Last refreshed** | Real-time (on submit) |
| **Refresh cadence** | Real-time |
| **License** | Internal (LocInsights) |
| **Credibility** | ★★★★☆ Primary data (collected directly) |

**Survey fields**: kelurahan_id, brand_id, store_format, foot_traffic_observation, competitor_presence, photo_url, notes, surveyor_name, survey_date.

---

## Data Lineage Diagram

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                    EXTERNAL DATA SOURCES                          │
   └──────────────────────────────────────────────────────────────────┘
                              │
   ┌─────────────┬────────────┼─────────────┬─────────────┬───────────┐
   ▼             ▼            ▼             ▼             ▼           ▼
 BPS Bali   KEMENDAGRI    Google Maps    OSM API      Mall Sites   GADM v4.1
   │             │            │             │             │           │
   └──────┬──────┘            └──────┬──────┘             │           │
          │                          │                    │           │
          ▼                          ▼                    ▼           ▼
   ┌─────────────┐           ┌─────────────┐       ┌──────────┐ ┌──────────┐
   │ bali-admin  │           │ bali-poi    │       │ bali-    │ │ bali-    │
   │ .ts (static)│           │ .ts (static)│       │ malls.ts │ │ land.ts  │
   └──────┬──────┘           └──────┬──────┘       └────┬─────┘ └──────────┘
          │                         │                   │
          ▼                         │                   │
   ┌─────────────┐                  │                   │
   │ bali-       │◄────────────────┘                   │
   │ kelurahan   │◄────────────────────────────────────┘
   │ .ts (derived│
   └──────┬──────┘
          │
          ▼
   ┌─────────────────────────────────────────────────────┐
   │              SCORING ENGINE (src/lib/scoring)        │
   │  - Composite score (weighted factors)                │
   │  - Huff gravity model (market share)                 │
   │  - Cannibalization risk                              │
   │  - Recommendation tier                               │
   └─────────────┬───────────────────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────────────────────────────────┐
   │              ML ENGINE (src/lib/ml)                  │
   │  - GBR revenue prediction                            │
   │  - Trained on heuristic output + log-normal noise    │
   └─────────────┬───────────────────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────────────────────────────────┐
   │           API LAYER (/api/locinsight/*)              │
   │  - /overview  /analyze  /opportunities  /ml          │
   └─────────────┬───────────────────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────────────────────────────────┐
   │              UI COMPONENTS (React)                   │
   │  Dashboard · Map · Opportunities · Analysis · ML     │
   └─────────────────────────────────────────────────────┘
```

---

## Data Quality Framework

Setiap dataset dievaluasi terhadap 5 dimensi kualitas data:

| Dimension | Method | Score |
|-----------|--------|-------|
| **Accuracy** | Cross-source verification (2+ sources) | ★★★★☆ |
| **Completeness** | Coverage check (e.g., 220/709 kelurahan = 31%) | ★★★☆☆ |
| **Timeliness** | Last-refreshed date tracking | ★★★★☆ |
| **Consistency** | Schema validation + referential integrity | ★★★★★ |
| **Provenance** | Full source URL + license + methodology (this page) | ★★★★★ |

---

## Audit Trail

Untuk audit eksternal, informasi berikut tersedia di setiap dataset:

1. **Source URL** — link langsung ke sumber asli
2. **Format** — bagaimana data disimpan (TS static, DB table, live API)
3. **Last refreshed** — kapan terakhir di-update
4. **Methodology** — bagaimana data dikumpulkan/derived
5. **License** — hak penggunaan data
6. **Verification method** — bagaimana data diverifikasi
7. **Known limitations** — keterbatasan yang diketahui
8. **Credibility rating** — rating 1-5 bintang

Untuk pertanyaan terkait data provenance, hubungi: **Data Team** — https://bayhaqy.my.id
