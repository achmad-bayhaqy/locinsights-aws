---
title: Technical Architecture
category: Technical Documentation
order: 5
last_updated: 2026-08-12
owner: Engineering Team
---

# Technical Architecture

> **Tujuan**: Dokumentasi teknis lengkap untuk developer dan IT team.
>
> **Purpose**: Complete technical documentation for developers and IT team.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | 16.1+ |
| **UI Framework** | React | 19+ |
| **Styling** | Tailwind CSS | 4+ |
| **UI Components** | shadcn/ui + Radix UI | latest |
| **Map** | Leaflet + react-leaflet | 1.9 / 4+ |
| **Charts** | Recharts | 2+ |
| **Backend** | Next.js API Routes (Node.js) | 16+ |
| **Database** | PostgreSQL (Supabase) | 15+ |
| **ORM** | Prisma | 6+ |
| **ML** | Pure TypeScript GBR | custom |
| **AI Chat** | z-ai-web-dev-sdk | 0.0.18 |
| **PWA** | Service Worker + Web Manifest | - |
| **APK** | Bubblewrap (TWA) | 5.0 |
| **Deploy** | Vercel | - |

## Repository Structure

```
LocInsights/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main SPA entry
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles + Tailwind
│   │   └── api/                # API routes
│   │       └── locinsight/
│   │           ├── overview/   # Main data load
│   │           ├── analyze/    # Deep analysis
│   │           ├── scrape/     # OSM scraper
│   │           ├── ml/         # ML inference
│   │           └── ...         # 20+ endpoints
│   ├── components/
│   │   ├── locinsight/         # Feature components
│   │   │   ├── dashboard.tsx
│   │   │   ├── map-explorer.tsx
│   │   │   ├── documentation.tsx  # ← NEW
│   │   │   └── ...
│   │   └── ui/                 # shadcn/ui primitives
│   └── lib/
│       ├── data/               # Static data (Bali admin, brands, etc.)
│       ├── scoring/            # Scoring engine
│       ├── ml/                 # ML (GBR) implementation
│       ├── i18n/               # EN/ID translations
│       └── api-helpers.ts      # API utilities
├── prisma/
│   ├── schema.prisma           # DB schema
│   └── ml-models/              # Serialized ML models
├── public/                     # Static assets (logos, APK, manifest)
├── docs/                       # Markdown documentation ← NEW
│   ├── DATA_SOURCES.md
│   ├── DATA_DICTIONARY.md
│   ├── CALCULATIONS.md
│   ├── USER_GUIDE.md
│   ├── TECHNICAL.md            # ← this file
│   └── API_REFERENCE.md
├── scripts/                    # Build/utility scripts
├── package.json
└── ...
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Browser / APK / PWA)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Next.js Hosting)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js App (React 19 SSR)                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Dashboard │ │   Map    │ │Analysis  │ │  Docs    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              API Routes (/api/locinsight/*)              │   │
│  │  overview · analyze · opportunities · ml · scrape · ... │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL + PostGIS)                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │kelurahan│ │ stores │ │ malls  │ │competi-│ │  pois  │       │
│  │        │ │        │ │        │ │tors    │ │        │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │ brands │ │ab_tests│ │ml_models│ │field_  │                  │
│  │        │ │        │ │        │ │surveys │                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL APIs                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  OpenStreet │  │  Z.AI LLM   │  │  Vercel     │             │
│  │  Map Overpass│ │  (AI Chat)  │  │  Cron       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Flow (User opens Dashboard)

1. User navigates to https://locinsights.bayhaqy.my.id
2. Next.js serves SSR HTML (LoadingScreen)
3. Client fetches `/api/locinsight/overview`
4. API queries Supabase via Prisma (`kelurahan`, `stores`, `malls`, `brands`)
5. API enriches with scoring engine (composite_score, recommendation)
6. Returns JSON to client
7. React renders Dashboard

### Write Flow (User scrapes competitors)

1. User opens Data Scraper, selects "All Bali"
2. Client calls `POST /api/locinsight/scrape` with location filter
3. API builds Overpass QL query
4. API fetches from `https://overpass-api.de/api/interpreter`
5. API classifies each result via `brand-classifier.ts`
6. Returns scraped rows to client (NOT saved yet)
7. User reviews, multi-selects, clicks "Save"
8. Client calls `POST /api/locinsight/scrape-save` with selected rows
9. API inserts into `staging_competitors` table
10. Data Manager → approve → move to `competitor_stores` table

### ML Flow

1. User opens ML/AI Engine, clicks "Train"
2. Client calls `POST /api/locinsight/ml/train`
3. API loads all kelurahan with their features
4. API generates training target: `heuristic_revenue + log_normal_noise`
5. API trains GBR (80 trees, depth 3, lr 0.1)
6. API serializes model to JSON, saves to `prisma/ml-models/`
7. API saves metadata to `ml_models` table
8. Returns training metrics (MSE, MAE, R²)

## Database Schema

Full schema: `prisma/schema.prisma`

Key relationships:

```
countries 1──N provinces 1──N kabupaten 1──N kecamatan 1──N kelurahan
                                                              │
                                                  ┌───────────┤
                                                  │           │
                                              stores       ab_tests
                                                  │
                                              brands
malls 1──N mall_tenants
stores N──1 malls (optional, is_in_mall)

competitor_stores (separate, no FK to brands)
pois (standalone)
ml_models 1──N predictions
training_runs (standalone)
field_surveys N──1 kelurahan
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/locinsight/overview` | GET | Main data load (stats, top opportunities, kelurahan, stores, malls, brands, POIs) |
| `/api/locinsight/analyze` | GET | Deep analysis for one kelurahan |
| `/api/locinsight/opportunities` | GET | Ranked opportunities |
| `/api/locinsight/kecamatan/[id]` | GET, PUT, DELETE | Kecamatan CRUD |
| `/api/locinsight/kelurahan/[id]` | GET, PUT, DELETE | Kelurahan CRUD |
| `/api/locinsight/stores/[id]` | GET, POST, PUT, DELETE | Store CRUD |
| `/api/locinsight/malls/[id]` | GET, POST, PUT, DELETE | Mall CRUD |
| `/api/locinsight/brands/[id]` | GET, POST, PUT, DELETE | Brand CRUD |
| `/api/locinsight/competitors/[id]` | GET, DELETE | Competitor CRUD |
| `/api/locinsight/pois/[id]` | GET, POST, PUT, DELETE | POI CRUD |
| `/api/locinsight/scrape` | POST | Scrape OSM (returns unsaved results) |
| `/api/locinsight/scrape-save` | POST | Save scraped rows to staging |
| `/api/locinsight/bulk` | POST | Bulk import (CSV) |
| `/api/locinsight/ml` | POST | ML inference (predict revenue) |
| `/api/locinsight/ml/train` | POST | Train new GBR model |
| `/api/locinsight/reports` | GET | Generate report |
| `/api/locinsight/ab-test` | POST | Save A/B test |
| `/api/locinsight/field-survey` | POST | Submit field survey |
| `/api/locinsight/chat` | POST | AI chat (Z.AI LLM) |
| `/api/locinsight/locations` | GET | Cascading location dropdown data |
| `/api/docs` | GET | List documentation files ← NEW |
| `/api/docs/[slug]` | GET, PUT | Get/update single doc ← NEW |
| `/api/cron/anti-sleep` | GET | Vercel cron (keep DB warm) |

## Performance & Caching

- **SSR**: Next.js renders initial HTML server-side for fast first paint
- **API caching**: Vercel edge cache for static endpoints (overview)
- **DB connection pooling**: Supabase connection pooler (PgBouncer)
- **Static data**: Bali admin/brands/malls are TypeScript static data (no DB query)
- **Map tiles**: OpenStreetMap tiles (CDN-cached)
- **ML model**: Loaded once into memory, reused across requests

## Security

- **Database**: Supabase RLS (Row-Level Security) disabled for app-level access (API is the gatekeeper)
- **API**: No auth currently (internal tool). Production should add NextAuth
- **Scraping**: Rate-limited to 1 request per 5 seconds (Overpass API etiquette)
- **Inputs**: Zod schema validation on all API routes
- **CORS**: Open (PWA + APK needs same-origin)
- **Secrets**: Environment variables on Vercel (DATABASE_URL, ZAI_API_KEY)

## PWA & APK

### PWA Configuration
- `public/manifest.json` — Web App Manifest (display: fullscreen)
- `public/sw.js` — Service Worker (offline caching)
- `public/.well-known/assetlinks.json` — Android Digital Asset Links (TWA verification)

### APK Build
- Tool: Google Bubblewrap (Trusted Web Activity)
- Config: `twa-manifest.json`
- Build script: `scripts/build-apk.js`
- Output: `public/locinsights.apk` (2.35 MB, signed)
- Signing: `android.keystore` (RSA 2048, 100-year validity)
- SHA-256 fingerprint: `94:31:B2:1B:3E:60:C3:C4:A8:19:4A:16:3B:9B:DE:51:FD:8C:D6:0F:8C:1F:9F:52:A0:FF:F2:BB:30:A3:68:9C`

See `public/locinsight-android-build-instructions.txt` for full build steps.

## Deployment

- **Hosting**: Vercel (auto-deploy from `main` branch)
- **Build command**: `next build`
- **Install command**: `bun install`
- **Output**: `.next/`
- **Region**: `sin1` (Singapore — closest to Indonesia)
- **Cron**: `0 8 * * *` → `/api/cron/anti-sleep` (keep DB warm)
- **URL**: https://locinsights.bayhaqy.my.id

## Environment Variables

Required on Vercel:

```
DATABASE_URL=postgresql://...@supabase.co:5432/postgres
ZAI_API_KEY=...         # Optional, for full AI chat (falls back to rule-based)
```

Optional:

```
NEXT_PUBLIC_GA_ID=...   # Google Analytics
SENTRY_DSN=...          # Error tracking
```

## Development

```bash
# Install deps
bun install

# Run dev server
bun run dev

# Type check
bun run typecheck

# Build
bun run build

# DB push (apply schema)
bun run db:push

# Seed DB
bun run seed
```

## Monitoring & Observability

- **Vercel Analytics**: Built-in (page views, Web Vitals)
- **Error tracking**: Console logs (production should add Sentry)
- **DB monitoring**: Supabase dashboard (query performance, connections)
- **Uptime**: Vercel auto-restart on crash
- **Cron monitoring**: Vercel cron logs (last run, status)

## Known Limitations

1. **No auth**: Currently no user authentication (internal tool assumption)
2. **ML model synthetic**: Trained on heuristic output, not real sales data
3. **Kelurahan coverage**: ~220 of 709 Bali kelurahan (curated subset)
4. **No real-time traffic**: Travel time is Haversine approximation
5. **No route optimization**: For field surveyors
6. **Single language fallback**: ID translations may fall back to EN for new keys

## Roadmap

- [ ] NextAuth integration (user auth + roles)
- [ ] Real sales data integration (ML model retrain)
- [ ] Full 709 kelurahan coverage (BPS shapefile integration)
- [ ] Google Maps Distance Matrix API (real travel time)
- [ ] Field surveyor route optimization
- [ ] Multi-language (add JP, CN for tourism analysis)
- [ ] Real-time competitor monitoring (weekly OSM diff)

---

## Contact

- **Developer**: Achmad Bayhaqy — https://bayhaqy.my.id
- **Website**: https://bayhaqy.my.id
