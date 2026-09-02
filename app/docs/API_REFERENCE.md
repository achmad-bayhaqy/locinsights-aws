---
title: API Reference
category: Technical Documentation
order: 6
last_updated: 2026-08-12
owner: Engineering Team
---

# API Reference

> **Tujuan**: Dokumentasi setiap API endpoint di LocInsights untuk developer.
>
> **Purpose**: Document every API endpoint for developers.

## Base URL

```
https://locinsights.bayhaqy.my.id/api/locinsight
```

For local development: `http://localhost:3000/api/locinsight`

## Authentication

Currently no auth (internal tool). All endpoints are public.

## Response Format

All responses are JSON with this envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": "Error description"
}
```

---

## Overview Endpoint

### `GET /overview`

Fetches the main data load for the SPA.

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_kelurahan": 172,
      "total_stores": 70,
      "total_malls": 25,
      "total_brands": 40,
      "total_competitors": 523,
      "total_pois": 80
    },
    "top_opportunities": [
      {
        "kelurahan_id": "5101010001",
        "kelurahan_name": "Dangin Tukad Badung",
        "kec_name": "Denpasar Selatan",
        "kab_name": "Kota Denpasar",
        "tier": 1,
        "lat": -8.6750,
        "lng": 115.2120,
        "composite_score": 82.5,
        "recommendation": "high_priority",
        "factors": [
          { "name": "population", "weight": 0.20, "raw_value": 75, "weighted": 15.0 },
          ...
        ],
        "potential_market_share": 0.18,
        "estimated_daily_customers": 450,
        "projected_monthly_revenue_juta": 135.5,
        "nearest_mall_distance_km": 2.3,
        "nearest_mall_name": "Living World Denpasar",
        "nearby_existing_stores": 3,
        "cannibalization_risk": "medium",
        "white_space_summary": "High demand, low competition"
      }
    ],
    "stores": [...],
    "malls": [...],
    "brands": [...],
    "pois": [...],
    "kelurahan": [...]
  }
}
```

---

## Analyze Endpoint

### `GET /analyze?kelurahan_id={id}&brand_id={brand_id}`

Deep analysis for one kelurahan, optionally filtered by brand.

**Query params**:
- `kelurahan_id` (required) — Kelurahan ID
- `brand_id` (optional) — Filter analysis for specific brand

**Response**: Detailed analysis with factor breakdown, market share, revenue projection, cannibalization risk, nearby stores/malls/competitors.

---

## CRUD Endpoints

### `GET /kecamatan` — List all kecamatan
### `GET /kecamatan/[id]` — Get one kecamatan
### `POST /kecamatan` — Create kecamatan
### `PUT /kecamatan/[id]` — Update kecamatan
### `DELETE /kecamatan/[id]` — Delete kecamatan

### `GET /kelurahan` — List all kelurahan
### `GET /kelurahan/[id]` — Get one kelurahan
### `POST /kelurahan` — Create kelurahan
### `PUT /kelurahan/[id]` — Update kelurahan
### `DELETE /kelurahan/[id]` — Delete kelurahan

### `GET /stores` — List all stores
### `GET /stores/[id]` — Get one store
### `POST /stores` — Create store
### `PUT /stores/[id]` — Update store
### `DELETE /stores/[id]` — Delete store

(Same pattern for `/malls`, `/brands`, `/competitors`, `/pois`, `/countries`, `/provinces`, `/kabupaten`, `/mall-tenants`)

---

## Scrape Endpoint

### `POST /scrape`

Scrape store data from OpenStreetMap Overpass API.

**Request body**:
```json
{
  "mode": "brand",            // or "keyword"
  "brand": "indomaret",       // for "brand" mode
  "keyword": "coffee shop",   // for "keyword" mode
  "kabupaten": "5171",        // optional, filter by kabupaten
  "kecamatan": "5171010",     // optional, filter by kecamatan
  "kelurahan": "5171010001"   // optional, filter by kelurahan
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "name": "Indomaret Kuta",
        "brand": "Indomaret",
        "lat": -8.7234,
        "lng": 115.1688,
        "category": "convenience_store",
        "classification": "competitor",
        "address": "Jl. Raya Kuta No. 88"
      }
    ],
    "count": 42,
    "source": "OpenStreetMap Overpass API"
  }
}
```

### `POST /scrape-save`

Save scraped results to staging table for review.

**Request body**:
```json
{
  "rows": [
    { "name": "...", "brand": "...", "lat": ..., "lng": ..., "category": "..." }
  ],
  "table": "staging_competitors"
}
```

---

## ML Endpoints

### `POST /ml`

Predict revenue for a kelurahan.

**Request body**:
```json
{
  "kelurahan_id": "5101010001",
  "brand_id": "starbucks"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "prediction": 135.5,
    "unit": "juta IDR / month",
    "model": "gbr-revenue-bali-v1",
    "features_used": [...],
    "feature_contributions": [...]
  }
}
```

### `POST /ml/train`

Train a new GBR model.

**Request body**:
```json
{
  "n_estimators": 80,
  "max_depth": 3,
  "learning_rate": 0.1
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "model_id": "gbr-revenue-bali-v2",
    "metrics": {
      "mse": 245.8,
      "mae": 11.2,
      "r2": 0.87
    },
    "training_samples": 716,
    "feature_importance": [...]
  }
}
```

---

## Reports Endpoint

### `GET /reports?type={type}&format={format}`

Generate a report.

**Query params**:
- `type` — `executive_summary`, `detailed_analysis`, `data_export`
- `format` — `json`, `csv`
- `kelurahan_id` (optional) — For detailed analysis

---

## A/B Test Endpoint

### `POST /ab-test`

Save A/B test configuration.

**Request body**:
```json
{
  "name": "Kuta vs Seminyak Starbucks",
  "kelurahan_a_id": "5101010001",
  "kelurahan_b_id": "5101020002",
  "variant_a_overrides": { "population": 15000 },
  "variant_b_overrides": {}
}
```

---

## Field Survey Endpoint

### `POST /field-survey`

Submit field survey data from PWA.

**Request body**:
```json
{
  "kelurahan_id": "5101010001",
  "brand_id": "starbucks",
  "store_format": "standalone kiosk",
  "foot_traffic_observation": "high, ~200/hr",
  "competitor_presence": "Indomaret 50m, Alfamart 100m",
  "photo_url": "https://...",
  "notes": "Near school, busy 7-9am and 3-5pm",
  "surveyor_name": "Andi",
  "survey_date": "2026-08-12"
}
```

---

## Chat Endpoint

### `POST /chat`

AI chat using Z.AI LLM (or rule-based fallback).

**Request body**:
```json
{
  "messages": [
    { "role": "user", "content": "Which kelurahan has highest composite score?" }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reply": "Based on current data, Dangin Tukad Badung...",
    "source": "zai-llm"  // or "fallback"
  }
}
```

---

## Locations Endpoint

### `GET /locations`

Cascading dropdown data for scraper.

**Response**:
```json
{
  "success": true,
  "data": {
    "provinces": [{ "code": "51", "name": "Bali" }],
    "kabupaten": [{ "code": "5171", "name": "Kota Denpasar", "province_code": "51" }],
    "kecamatan": [{ "code": "5171010", "name": "Denpasar Selatan", "kabupaten_code": "5171" }],
    "kelurahan": [{ "code": "5171010001", "name": "Dangin Tukad Badung", "kec_code": "5171010", "kab_code": "5171" }]
  }
}
```

---

## Documentation Endpoints ← NEW

### `GET /api/docs`

List all documentation files.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "slug": "data-sources",
      "title": "Data Sources",
      "category": "User Documentation",
      "order": 1,
      "last_updated": "2026-08-12",
      "owner": "Data Team"
    },
    ...
  ]
}
```

### `GET /api/docs/[slug]`

Get full content of a single doc.

**Response**:
```json
{
  "success": true,
  "data": {
    "slug": "data-sources",
    "title": "Data Sources",
    "content": "# Data Sources & Provenance\n\n...",
    "html": "<h1>Data Sources & Provenance</h1>...",
    "toc": [
      { "level": 2, "text": "Summary", "anchor": "summary" },
      ...
    ],
    "last_updated": "2026-08-12"
  }
}
```

### `PUT /api/docs/[slug]`

Update a doc (admin only in production).

**Request body**:
```json
{
  "content": "# Updated content..."
}
```

---

## Rate Limits

- **Read endpoints**: No limit (cached at edge)
- **Scrape endpoint**: 1 request per 5 seconds (Overpass API etiquette)
- **ML train**: 1 request per 60 seconds (CPU-intensive)
- **Chat**: 10 requests per minute (Z.AI API limit)

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Server error |

## SDK Example (TypeScript)

```typescript
const API_BASE = '/api/locinsight';

async function getOverview() {
  const res = await fetch(`${API_BASE}/overview`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function scrapeCompetitors(brand: string, kabupaten?: string) {
  const res = await fetch(`${API_BASE}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'brand', brand, kabupaten }),
  });
  return res.json();
}
```

---

## Changelog

- **v4.2 (Aug 2026)**: Added `/api/docs` and `/api/docs/[slug]` endpoints
- **v4.1 (Aug 2026)**: Added `/api/locinsight/field-survey` endpoint
- **v4.0 (Aug 2026)**: Added `/api/locinsight/ab-test` endpoint
- **v3.0 (Jul 2026)**: Added ML train + inference endpoints
- **v2.0 (Jul 2026)**: Unified scraper endpoint (replaced 2 separate scrapers)
- **v1.0 (Jun 2026)**: Initial API with basic CRUD
