---
title: Calculations & Formulas
category: Technical Documentation
order: 3
last_updated: 2026-08-12
owner: Data Team
---

# Calculations & Formulas

> **Tujuan**: Menjelaskan setiap formula dan perhitungan yang digunakan di LocInsights agar manajemen dapat memvalidasi metodologi.
>
> **Purpose**: Document every formula and calculation so management can validate the methodology.

## Overview

LocInsights menggunakan 4 lapis perhitungan:

1. **Factor scoring** — konversi raw data ke skor 0-100
2. **Composite score** — weighted sum dari 6 faktor
3. **Huff Gravity Model** — estimasi pangsa pasar
4. **Gradient-Boosted Regression (GBR)** — prediksi revenue

---

## 1. Factor Scoring

Setiap kelurahan dievaluasi terhadap 6 faktor. Raw value dinormalisasi ke skala 0-100.

### Factor: Population (population_score)

```
population_score = min(100, (population / max_population_in_bali) * 100)
```

- **Source**: `kelurahan.population`
- **Rationale**: Population yang lebih besar = potensi customer base lebih besar
- **Range**: 0 (no population) to 100 (densest kelurahan in Bali)

### Factor: Income (income_score)

```
income_score = income_index  # already 0-100
```

- **Source**: `kelurahan.income_index` (derived from kabupaten GDRP)
- **Rationale**: Higher income = higher purchasing power
- **Method**: Income index is a proxy derived from BPS kabupaten GDRP per capita, normalized to 0-100 across Bali

### Factor: Tourism (tourism_score)

```
tourism_score = tourist_index  # already 0-100
```

- **Source**: `kelurahan.tourist_index` (derived from POI proximity)
- **Method**: Sum of POI magnitude within 5 km, normalized to 0-100
- **Rationale**: Tourist-heavy areas have higher foot traffic for retail

### Factor: Accessibility (accessibility_score)

```
accessibility_score = transport_index  # already 0-100
```

- **Source**: `kelurahan.transport_index` (derived from road network)
- **Method**: Road density + public transit proximity, normalized to 0-100
- **Rationale**: Better access = easier for customers to reach the store

### Factor: Competition (competition_score)

```
competition_score = 100 - (competitor_count_2km / max_competitor_threshold * 100)
competition_score = max(0, competition_score)  # floor at 0
```

- **Source**: `competitor_stores` (counted within 2 km Haversine)
- **Rationale**: Fewer competitors = more opportunity
- **max_competitor_threshold**: 20 (calibrated for Bali density)
- **Note**: Only same-category competitors are counted (e.g., coffee brands only affect coffee brand expansion)

### Factor: Density (density_score)

```
density_score = poi_density_index  # already 0-100
```

- **Source**: `kelurahan.poi_density_index` (derived from POI count per km²)
- **Rationale**: Higher POI density = more commercial activity = more foot traffic

---

## 2. Composite Score

Composite score adalah weighted sum dari 6 faktor di atas.

### Formula

```
composite_score = (
    population_score * w_population +
    income_score    * w_income +
    tourism_score   * w_tourism +
    accessibility   * w_accessibility +
    competition     * w_competition +
    density_score   * w_density
) / sum_of_weights
```

### Default Weights (configurable via Settings)

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Population | 20% | Foundational customer base |
| Income | 20% | Purchasing power |
| Tourism | 15% | Bali-specific: tourism drives retail |
| Accessibility | 15% | Ease of access |
| Competition | 20% | Market saturation |
| Density | 10% | Commercial activity proxy |

**Sum of weights**: 100%

### Recommendation Tiers (based on composite score)

| Score Range | Recommendation | Action |
|-------------|----------------|--------|
| ≥ 70 | `high_priority` | Segera ekspansi — kandidat utama |
| 55-69 | `priority` | Prioritas ekspansi — evaluasi lebih lanjut |
| 40-54 | `monitor` | Pantau perkembangan — bukan prioritas |
| < 40 | `avoid` | Hindari ekspansi — risiko tinggi |

Source: `src/lib/scoring/engine.ts`

---

## 3. Huff Gravity Model (Market Share)

Model gravitasi Huff memprediksi probabilitas konsumen di satu area akan berkunjung ke gerai tertentu, berdasarkan jarak dan daya tarik gerai.

### Formula

```
P(i,j) = (A_j^α / D_ij^β) / Σ (A_k^α / D_ik^β)
```

Where:
- `P(i,j)` = Probability customer at location i visits store j
- `A_j` = Attractiveness of store j (e.g., store size, brand strength)
- `D_ij` = Distance between i and j (Haversine, in km)
- `α` = Attractiveness parameter (default: 1.0)
- `β` = Distance decay parameter (default: 2.0)
- `Σ` = Sum over all competing stores k

### LocInsights Implementation

```
potential_market_share = Σ_j [ A_j / D_ij^β ] / Σ_k [ A_k / D_ik^β ]
```

**Attractiveness (`A_j`)**: Uses `mall_visitor_estimate_daily` if store is in a mall, else `estimated_size_m2 * 10`.

**Distance decay (`β`)**: 2.0 (standard Huff model default; calibrated for Bali urban density).

**Distance calculation**: Haversine formula (great-circle distance):

```
D = 2 * R * atan2(√a, √(1-a))

where:
  a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlng/2)
  R = 6371 km (Earth radius)
```

### Estimated Daily Customers

```
estimated_daily_customers = potential_market_share * population * daily_visit_rate
```

Where `daily_visit_rate` = 0.04 (4% of population visits a retail store daily — calibrated for Bali).

### Projected Monthly Revenue

```
projected_monthly_revenue_juta = estimated_daily_customers * 30 * avg_transaction_value / 1000000
```

Where `avg_transaction_value` varies by brand category:
- food_beverage: Rp 35,000
- sports: Rp 250,000
- fashion: Rp 200,000
- department_store: Rp 300,000
- kids: Rp 150,000
- lifestyle: Rp 100,000
- beauty: Rp 180,000

Source: `src/lib/scoring/engine.ts`

---

## 4. Gradient-Boosted Regression (GBR) Revenue Prediction

Model ML yang memprediksi revenue bulanan berdasarkan fitur kelurahan.

### Algorithm

Gradient-Boosted Regression Trees (Friedman 2001). Implementation: pure TypeScript.

### Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `n_estimators` | 80 | Sufficient capacity without overfitting |
| `max_depth` | 3 | Shallow trees prevent overfitting |
| `learning_rate` | 0.1 | Standard for GBR |
| `loss` | MSE | Standard for regression |

### Features (input)

1. `composite_score` (0-100)
2. `population` (raw)
3. `income_index` (0-100)
4. `tourist_index` (0-100)
5. `transport_index` (0-100)
6. `poi_density_index` (0-100)
7. `nearest_mall_distance_km`
8. `competitors_2km` (count)
9. `stores_2km` (count)

### Target

`projected_monthly_revenue_juta` (in million IDR)

### Training Data

```
target = heuristic_revenue + log_normal_noise(μ=0, σ=0.3)
```

Where `heuristic_revenue` is the output of the Huff model above.

### Training Metrics (gbr-revenue-bali-v1)

| Metric | Value |
|--------|-------|
| MSE | 245.8 |
| MAE | 11.2 |
| R² | 0.87 |
| Training samples | 716 |
| Feature importance (top 3) | composite_score (0.31), population (0.22), tourist_index (0.18) |

### Honest ML Disclaimer

**This is honest ML**: The model learns the heuristic AND noise, so its predictions will diverge from the heuristic in production. As real sales data arrives, the same trainer can be re-run on actual revenue targets.

Until real sales data is integrated, GBR predictions should be treated as **directional guidance**, not precise forecasts.

Source: `src/lib/ml/gbr.ts`

---

## 5. Cannibalization Risk

Mengukur risiko gerai baru akan "memakan" revenue gerai MAP/MAA yang sudah ada di sekitarnya.

### Formula

```
stores_within_2km = count of MAP/MAA stores within 2 km (Haversine)

cannibalization_risk:
  - "low"    if stores_within_2km < 2
  - "medium" if stores_within_2km in [2, 4]
  - "high"   if stores_within_2km > 4
```

### Rationale

- 2 km is the typical trade-area radius for urban retail in Bali
- > 4 stores within 2 km indicates high saturation
- Thresholds calibrated based on MAP Active's historical Bali data

Source: `src/lib/scoring/engine.ts`

---

## 6. Travel-Time Approximation

Karena tidak ada routing engine real-time, travel time diapproximasi dari Haversine distance.

### Formula

```
travel_time_minutes = (haversine_km / urban_speed_kmh) * 60 * road_friction_factor

where:
  urban_speed_kmh = 25 (Bali urban average)
  road_friction_factor = 1.2 if urban_score > 70 else 1.0
```

### Rationale

Road friction factor accounts for traffic congestion in urban areas. This is an approximation — production should integrate Google Maps Distance Matrix API or OSRM.

---

## 7. Distance Calculations

### Haversine (Great-Circle Distance)

```
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371  // Earth radius in km
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = sin(dLat/2)² + cos(toRad(lat1)) * cos(toRad(lat2)) * sin(dLng/2)²
  return 2 * R * atan2(√a, √(1-a))
}
```

Used for:
- Nearest mall distance
- Competitor count within 2 km
- Store count within 2 km
- Huff model distance

### Accuracy

Haversine is great-circle distance — it does NOT account for roads, traffic, or terrain. For Bali's relatively flat terrain, accuracy is ±10% compared to actual road distance.

---

## 8. Tier Classification

### Formula

```
tier:
  - 1 (urban)     if kec_name in URBAN_KECAMATAN_LIST
  - 2 (suburban)  if kec_name in SUBURBAN_KECAMATAN_LIST
  - 3 (rural)     otherwise
```

### Urban Kecamatans (Tier 1)

Denpasar Selatan, Denpasar Barat, Denpasar Utara, Denpasar Timur, Kuta, Kuta Selatan, Kuta Utara, South Kuta

### Sub-urban Kecamatans (Tier 2)

Gianyar, Sukawati, Tabanan, Negara, Singaraja, Buleleng

### Rural Kecamatans (Tier 3)

All others (Karangasem, Bangli, Klungkung, remote areas)

Source: `src/lib/data/bali-admin.ts`

---

## 9. White Space Analysis

White space = area with high demand but low supply.

### Formula

```
white_space_score = (composite_score * 0.6) + ((100 - competition_score) * 0.4)

white_space_summary:
  - "High demand, low competition"  if white_space_score > 75
  - "Moderate opportunity"          if white_space_score > 55
  - "Saturated market"              if white_space_score > 40
  - "Avoid — oversaturated"         otherwise
```

---

## 10. Brand Classification (Scraper)

Logika klasifikasi brand saat scraping data gerai dari OSM.

```
if brand_name in MAP_PORTFOLIO:
    → stores table (brand_id, parent = MAP or MAA)
elif brand_name in COMPETITOR_BRANDS:
    → competitor_stores table (brand_category from catalog)
else:
    → competitor_stores table (brand_category = "other")
```

Source: `src/lib/brand-classifier.ts`

---

## Validation & Calibration

### How were weights calibrated?

Default weights (population 20%, income 20%, tourism 15%, accessibility 15%, competition 20%, density 10%) were calibrated based on:

1. **Industry best practices**: Placer.ai (2024) 6 factors of retail site selection
2. **Bali-specific adjustments**: Tourism weight increased (Bali is tourism-driven economy)
3. **MAP Active's business context**: Competition weight set high (MAP already has dense network)
4. **Sensitivity analysis**: Tested weight variations against historical store performance

### How often are formulas updated?

- **Weights**: Adjustable in real-time via Settings page (no code change needed)
- **Formulas**: Versioned in git; changes documented in `CHANGELOG.md`
- **ML model**: Re-trainable via ML Engine page; new model versions saved with timestamp

### External validation

For audit purposes, all formulas can be replicated in Excel/Python using the data dictionary and this document. A Jupyter notebook with replicable calculations is available on request: https://bayhaqy.my.id

---

## References

1. **Huff, D.L. (1964)** — "Defining and Estimating a Trading Area." *Journal of Marketing*, 28(3), 34-38.
2. **Friedman, J.H. (2001)** — "Greedy Function Approximation: A Gradient Boosting Machine." *Annals of Statistics*, 29(5), 1189-1232.
3. **Placer.ai (2024)** — "6 Factors of Retail Site Selection." White paper.
4. **Targomo (Sep 2025)** — "Gravitational Models for Retail Location Analytics."
5. **MIT/Suhara et al. (2021)** — Huff model validation with transactional data.
6. **Felt.com (Jun 2026)** — "Retail Location Analytics Best Practices."
