# Unified Scraper

> How LocInsights' scraper works — modes, location filter, brand classifier,
> review workflow, and data routing.

## TL;DR

- **One endpoint** (`POST /api/locinsight/scrape`) replaces the previous two
  near-duplicate scrapers. Mode toggle: `keyword` (free-text) or `brand` (sweep
  the predefined catalog of 27 competitor brands).
- **Hierarchical location filter**: All Bali / specific Kabupaten / specific
  Kecamatan / specific Kelurahan. Implemented as cascading dropdowns in the UI.
- **No auto-save**. Scraped results land in a review panel first. The user
  multi-selects rows, sees a classification badge on each, then clicks Save to
  route them to the appropriate master table.
- **Brand classifier** (`src/lib/brand-classifier.ts`) decides where each store
  row goes:
  - MAA/MAP portfolio brand → `stores` table with `brand_id` + `parent`
  - Tracked competitor brand → `competitor_stores` table
  - Unknown brand → `competitor_stores` table with `brand_category='other'`

This eliminates the v1 bug where scraped non-MAA brands (Starbucks, Indomaret,
etc.) ended up in the master `stores` table distinguished only by `parent`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser — Scraper tab (src/components/locinsight/scraper.tsx)       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Step 1: Pick mode + location + (optional) kinds              │  │
│  │  ───────────────────────────────────────────────────────────  │  │
│  │  Mode:      ( ) Keyword search   ( ) Brand sweep (27 brands)  │  │
│  │  Location:  [All Bali ▾] → [Kab ▾] → [Kec ▾] → [Kel ▾]       │  │
│  │  Kinds:     [✓] stores  [✓] malls  [✓] POIs                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │ POST /api/locinsight/scrape         │
│                                ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Step 2: Review scraped results (NOT saved yet)              │  │
│  │  ───────────────────────────────────────────────────────────  │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ ☐ Indomaret — Kuta Beach   Badung  -8.72,115.17  [COMP] │ │  │
│  │  │ ☐ Starbucks Kuta           Badung  -8.72,115.17  [MAA]  │ │  │
│  │  │ ☐ Random Unknown Cafe      Badung  -8.72,115.17  [OTHER]│ │  │
│  │  │ ☐ Discovery Mall           Badung  -8.72,115.17  [MALL] │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │  Save-routing preview:                                        │  │
│  │  • 1 row → stores        (Starbucks — matches MAA catalog)   │  │
│  │  • 2 rows → competitor_stores (Indomaret, Random Unknown)    │  │
│  │  • 1 row → malls         (Discovery Mall)                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │ POST /api/locinsight/scrape-save    │
│                                ▼                                     │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Server — src/app/api/locinsight/scrape-save/route.ts                │
│                                                                      │
│  for each item:                                                      │
│    if item.kind === 'mall'  → prisma.mall.create(...)                │
│    if item.kind === 'poi'   → prisma.poi.create(...)                 │
│    if item.kind === 'store':                                         │
│      cls = classifyScrapedBrand(item.brand_name)                     │
│      if cls.target === 'maa_store':                                  │
│        prisma.store.create({ brand_id: cls.brand_id, parent: ... })  │
│      else:                                                           │
│        prisma.competitorStore.create({ brand_name: cls.brand_name }) │
└──────────────────────────────────────────────────────────────────────┘
```

## Modes

### 1. Keyword mode (`mode: 'keyword'`)

Use case: ad-hoc search like `"Starbucks Kuta"` or `"Pepito supermarket Denpasar"`.

Flow:
1. Send query to Nominatim geocoder → get the centroid `(lat, lng)` + display name.
2. Compute a bbox around the centroid (default radius: 5 km, or use the kelurahan/
   kecamatan/kabupaten bbox if a location filter is selected).
3. Call Overpass with the bbox and the requested `kinds` (store/mall/poi):
   - `store` → `node["shop"]["name"]`
   - `mall` → `node["shop"="mall"]` + `node["amenity"="shopping_mall"]`
   - `poi` → `node["tourism"~"attraction|hotel|museum"]` + `node["leisure"~"park|beach"]`
4. Reverse-geocode each result to its nearest kelurahan (in-memory nearest-neighbor
   on the cached kelurahan table — no DB call per result).

### 2. Brand mode (`mode: 'brand'`)

Use case: sweep Bali for all outlets of a predefined brand catalog.

Flow:
1. For each brand in the catalog (`src/lib/data/competitor-brands.ts`):
   - Build an Overpass query with the brand's specific OSM tag (e.g.,
     `"brand"="Indomaret"`). Avoid broad tags like `"shop"="convenience"` that
     return hundreds of unrelated rows.
   - Race 3 Overpass endpoints; first non-empty response wins.
2. Parallelize: 5 brands in flight at a time (Promise.all in batches of 5).
3. All results land in the same review panel as keyword mode.

The default catalog has 27 brands covering convenience stores, fast food,
coffee, fashion, beauty, supermarkets, and pharmacies. To extend, add an entry
to `src/lib/data/competitor-brands.ts`.

## Location filter

The UI exposes a cascading dropdown:

```
All Bali  ─┐
            ├→ Kabupaten (9 options) ─→ Kecamatan (48) ─→ Kelurahan (172)
            └→ (any of these can be left at "All")
```

Selecting a kabupaten narrows the kecamatan dropdown to that kabupaten's
kecamatan, and so on. The selected filter is sent to the API as:

```json
{ "location": { "kab_code": "5104", "kec_code": "5104031", "kel_code": "5104031007" } }
```

The scraper engine resolves this to a bbox (1 DB query, cached for the
duration of the request). When a kelurahan is selected, the bbox is tight
(~1 km²). When only a kabupaten is selected, the bbox covers the whole
kabupaten. When nothing is selected, the bbox is the full Bali bounding box
`[-8.85, 114.43, -8.05, 115.72]`.

### Geographic hierarchy in the database

The DB models the full Indonesian administrative hierarchy:

```
countries (1: Indonesia)
   └── provinces (Bali)
         └── kabupaten (8 kabupaten + 1 kota = 9 records)
               └── kecamatan (48 records)
                     └── kelurahan (172 records in Bali)
```

The `desa` level (rural village) is equivalent to `kelurahan` in Bali's urban
context and is not modeled separately. For other provinces where desa/kelurahan
distinction matters, a future migration can add a `desa` table inheriting from
the same pattern.

## Brand classifier

`src/lib/brand-classifier.ts` is the single source of truth for routing. Its
contract:

```ts
classifyScrapedBrand(brandName: string): ClassificationResult
// ClassificationResult = {
//   target: 'maa_store' | 'competitor' | 'other',
//   brand_id?: string,    // when target='maa_store', the brand_id from our catalog
//   parent?: 'MAP' | 'MAA', // when target='maa_store'
//   brand_name: string,   // normalized
//   brand_category: string,
//   reason: string,       // human-readable explanation
// }
```

### Match algorithm

1. **Exact match** against the MAA/MAP catalog (`src/lib/data/brands.ts`).
2. **Substring match** against the same catalog (e.g., `"Starbucks Kuta"`
   matches `"Starbucks"`).
3. **Exact / substring match** against the competitor catalog
   (`src/lib/data/competitor-brands.ts`).
4. **Fall through to `'other'`** — the brand_name is preserved verbatim and
   the row goes to `competitor_stores` with `brand_category='other'`.

The classifier is called **only on the server** (inside `/scrape-save`), never
on the client — the client just renders the classification preview using the
same logic imported directly for UX.

## Review workflow

```
[Scraper runs] ──→ [Review panel] ──→ [User selects rows] ──→ [Save]
       │                  │                                          │
       │                  │                                          ▼
       │                  │                              ┌───────────────────┐
       │                  │                              │ /scrape-save      │
       │                  │                              │  • classify       │
       │                  │                              │  • dedup (50 m)   │
       │                  │                              │  • route          │
       │                  │                              │  • write to DB    │
       │                  │                              └────────────────────┘
       │                  │
       │                  └── User can edit name/brand before saving
       │
       └── Result count + scrape source logged to `scraper_runs` table (audit trail)
```

### Dedup rule

Before writing any row, the save endpoint loads the existing rows of the same
kind within a 50 m radius (Haversine). If a duplicate exists, the new row is
skipped (or, for competitors, optionally updated if the existing row has
missing fields). The dedup cache is loaded **once per save request**, not per
row — this prevents the v1 timeout bug where 200 rows × 50 ms = 10 s just for
dedup queries.

### Audit trail

Every scrape is logged to the `scraper_runs` table:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `query` | text | The query string (keyword mode) or comma-separated brand list (brand mode) |
| `source` | enum | `nominatim` / `overpass` |
| `status` | enum | `success` / `failed` |
| `found_count` | int | How many results came back |
| `saved_count` | int | How many the user actually saved |
| `result_json` | jsonb | First 500 results (capped for storage) |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | |

## API reference

### `POST /api/locinsight/scrape`

Request:
```json
{
  "mode": "keyword" | "brand",
  "query": "Starbucks Kuta",                  // required for keyword mode
  "brands": ["Indomaret", "Alfamart"],        // optional for brand mode (defaults to all 27)
  "kinds": ["store", "mall", "poi"],          // keyword mode only; default: all
  "radius_km": 5,                              // keyword mode only; default: 5
  "location": {
    "kab_code": "5104",                       // optional
    "kec_code": "5104031",                    // optional
    "kel_code": "5104031007"                  // optional
  }
}
```

Response:
```json
{
  "success": true,
  "run_id": "uuid",
  "geocoded": { "lat": -8.72, "lng": 115.17, "display_name": "Kuta, Badung, Bali", "is_in_bali": true },
  "used_fallback": false,
  "source": "overpass",
  "total_found": 47,
  "total_saved": 0,                            // always 0 here — save is a separate call
  "results": [ /* ScraperResultRow[] — see below */ ],
  "meta": {
    "mode": "keyword",
    "location_label": "Badung",
    "bbox": [-8.85, 115.10, -8.60, 115.30]
  },
  "review_required": true                      // always true — results need user review
}
```

### `POST /api/locinsight/scrape-save`

Request:
```json
{
  "run_id": "uuid",                            // optional — for audit linkage
  "items": [ /* ScraperResultRow[] — selected by user */ ]
}
```

Response:
```json
{
  "success": true,
  "saved": { "stores": 1, "competitors": 2, "malls": 1, "pois": 0, "total": 4 },
  "skipped": 0,
  "errors": []
}
```

### `GET /api/locinsight/scrape?limit=50`

Returns the most recent scraper runs (audit trail).

## Performance characteristics

| Scenario | Time | Notes |
|---|---|---|
| Keyword search, single kelurahan | ~12 s | Nominatim geocode (1 s) + Overpass (10 s) |
| Keyword search, all Bali | ~18 s | Wider bbox → more OSM elements |
| Brand sweep, 5 brands | ~15 s | 5 in parallel × 10 s Overpass |
| Brand sweep, all 27 brands | ~22 s | 5 batches × ~5 s each |
| Save 200 selected rows | ~3 s | Single DB round-trip for dedup cache + batched inserts |

All scrape times are well within the Vercel 60 s function timeout.

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to fetch` after 60 s | Overpass rate-limited all 3 endpoints | Wait 1 min; retry |
| `Location is in the sea — skipped` | OSM coordinate is in the ocean | The DB-level CHECK constraint caught it; no action needed |
| 0 results for a known brand | Brand's OSM tags differ in your area | Add a `osm_tag_fallback` in `competitor-brands.ts` |
| Save returns `errors[]` with index numbers | Some rows failed individual validation | Check `errors[].error` message — usually ocean coordinates or duplicate within 50 m |
