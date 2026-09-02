---
title: Data Model
category: Technical
order: 20
---

# Data Model

> Schema explanation for the LocInsights SaaS multi-tenant PostgreSQL database
> (Supabase). For the formal schema, see [`prisma/schema.prisma`](../prisma/schema.prisma)
> in this repo, or the SQL migrations in the
> [`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) repo.

## Overview

The v5.0.0 SaaS transformation adds a multi-tenant layer on top of the
existing v4 domain schema. The database now contains **27 Prisma models**
across three logical tiers:

1. **SaaS layer** (6 models) — `Tenant`, `TenantAddon`, `User`, `Role`,
   `UserAuditLog`, `Doc`. These belong to the platform itself.
2. **Tenant-scoped domain data** (16 models) — `Brand`, `Store`, `Mall`,
   `MallTenant`, `CompetitorStore`, `Poi`, `Report`, `ScraperRun`,
   `FieldSurvey`, `ABTest`, `MLModel`, `TrainingRun`, `Prediction`,
   `StagingStore`, `StagingCompetitor`, `StagingMall`. Each row carries a
   `tenant_id` foreign key and is protected by an RLS policy.
3. **Shared reference data** (5 models) — `Country`, `Province`,
   `Kabupaten`, `Kecamatan`, `Kelurahan`. Indonesia-wide BPS admin
   hierarchy, identical across tenants, no RLS.

## Entity-relationship diagram

```
                         ┌──────────────────────────┐
                         │  SaaS PLATFORM LAYER     │
                         │  (no RLS — app-gated)    │
                         │                          │
                         │  tenants ◄────┐          │
                         │     ▲         │          │
                         │     │ 1:N     │          │
                         │  tenant_addons│          │
                         │               │          │
                         │  users ───────┤          │
                         │   ▲           │          │
                         │   │ 1:N       │          │
                         │  user_audit_logs         │
                         │                          │
                         │  roles ◄────────┐        │
                         │  (permissions   │        │
                         │   JSON)         │        │
                         │                 │        │
                         │  docs           │        │
                         │  (DB-backed)    │        │
                         └─────────────────┼────────┘
                                           │
                                           │ tenant_id FK
                                           ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  TENANT-SCOPED DOMAIN DATA (RLS per-tenant)                     │
   │                                                                 │
   │   Each table has: tenant_id (FK → tenants.id, nullable)         │
   │                                                                 │
   │   brands ◄──── stores ────► malls ───► mall_tenants             │
   │                   │              │                              │
   │                   │              └─► pois                       │
   │                   │                                             │
   │                   └─► competitor_stores                         │
   │                                                                 │
   │   ml_models ──► training_runs ──► predictions                   │
   │                                                                 │
   │   ab_tests, reports, scraper_runs, field_surveys                │
   │                                                                 │
   │   staging_stores, staging_competitors, staging_malls            │
   │   (scraper review queue)                                        │
   └─────────────────────────────────────────────────────────────────┘
                                           │
                                           │ (no FK — reference only)
                                           ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  SHARED REFERENCE DATA (no RLS — BPS hierarchy)                 │
   │                                                                 │
   │   countries ──► provinces ──► kabupaten ──► kecamatan ──► kelurahan│
   │                                                                 │
   │   1 country • 1 province • 9 kabupaten • 48 kecamatan •         │
   │   172 kelurahan (Bali scope as of v5.0.0)                       │
   └─────────────────────────────────────────────────────────────────┘
```

## SaaS platform models (6)

### `Tenant` (table: `tenants`)

The SaaS customer registry. Each row = one company subscribed to LocInsights.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | `gen_random_uuid()` | Primary key |
| `name` | String | — | Display name (e.g. "MAP Active Adiperkasa") |
| `slug` | String (unique) | — | URL-safe identifier |
| `plan` | `tenant_plan_enum` | `saas_monthly` | `saas_monthly`, `saas_yearly`, `enterprise_onprem`, `trial`, `internal` |
| `status` | `tenant_status_enum` | `active` | `active`, `suspended`, `terminated`, `provisioning` |
| `region_scope` | String[] | `[]` | E.g. `['bali', 'jakarta']` |
| `data_residency` | String? | — | Optional region constraint |
| **White-labeling** | | | |
| `app_name` | String | `"LocInsights"` | Per-tenant application name |
| `logo_url` | String? | — | Custom logo URL |
| `primary_color` | String | `"#7A0A1A"` | Brand primary color |
| `accent_color` | String | `"#C8102E"` | Brand accent color |
| **Contact** | | | |
| `contact_name`, `contact_email`, `contact_phone` | String? | — | Account contact |
| `notes` | String | `""` | Free-form notes |
| **Limits** | | | |
| `max_users` | Int | `10` | Hard cap on user count |
| `max_api_calls_per_day` | Int | `10000` | API quota |
| **Lifecycle** | | | |
| `trial_ends_at` | DateTime? | — | Trial end timestamp |
| `suspended_at`, `terminated_at` | DateTime? | — | Status change timestamps |
| **Audit** | | | |
| `created_at`, `updated_at` | DateTime | `now()` | Timestamps |
| `created_by` | String? | — | Creator user_id |

Relationships: `users[]`, `default_users[]` (reverse relation
`UserDefaultTenant`), `addons[]`, plus 16 reverse relations to all
tenant-scoped domain tables.

### `TenantAddon` (table: `tenant_addons`)

Tracks Skema C add-on purchases per tenant. Each row = one à la carte
purchase (region expansion, custom scraper, API connector, UI customization).

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | `gen_random_uuid()` | Primary key |
| `tenant_id` | String | — | FK → tenants.id (CASCADE) |
| `addon_type` | `addon_type_enum` | — | `region_expansion`, `custom_scraper`, `api_connector`, `ui_customization` |
| `addon_config` | Json | `{}` | Type-specific config (e.g. `{ province: 'jakarta' }`) |
| `expires_at` | DateTime? | — | NULL = perpetual |
| `is_active` | Boolean | `true` | Soft-disable flag |
| `created_at`, `updated_at` | DateTime | `now()` | Timestamps |
| `created_by` | String? | — | Creator user_id |

Indexes: `@@index([tenant_id])`, `@@index([addon_type])`.

### `User` (table: `users`)

Authentication user. `tenant_id = NULL` means platform-wide superadmin.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | `gen_random_uuid()` | Primary key |
| `username` | String (unique) | — | Login identifier |
| `email` | String? (unique) | — | Optional email |
| `display_name` | String? | — | Display name in UI |
| `password_hash` | String | — | bcrypt hash (10 rounds) |
| `role` | `user_role_enum` | `viewer` | `superadmin`, `admin`, `tenant_admin`, `data`, `analyst`, `viewer` |
| `is_active` | Boolean | `true` | Soft-disable flag |
| `failed_login_count` | Int | `0` | Counter for lockout |
| `locked_until` | DateTime? | — | Lockout expiry (15 min after 5 fails) |
| `last_login_at` | DateTime? | — | Last successful login |
| `created_at`, `updated_at` | DateTime | `now()` | Timestamps |
| `created_by` | String? | — | Creator user_id |
| **Multi-tenant** | | | |
| `tenant_id` | String? | — | FK → tenants.id (SET NULL on delete) |
| `default_tenant_id` | String? | — | FK → tenants.id (SET NULL); superadmin's default |

Indexes: `@@index([role])`, `@@index([is_active])`, `@@index([tenant_id])`,
`@@index([default_tenant_id])`.

### `Role` (table: `roles`)

Role definitions. System roles are global (`tenant_id = NULL`,
`is_system = true`); tenant-scoped custom roles have a `tenant_id` and
`is_tenant_scoped = true`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String | — | Primary key (e.g. `"superadmin"`, `"tenant_admin"`, or custom slug) |
| `name` | String (unique) | — | Display name (e.g. `"Superadmin"`) |
| `description` | String? | `""` | Free-form description |
| `permissions` | Json | `{}` | 17×5 matrix: `{ [menuId]: { [actionId]: boolean } }` |
| `is_system` | Boolean | `true` | System roles cannot be deleted |
| `tenant_id` | String? | — | FK → tenants.id (CASCADE); NULL for system roles |
| `is_tenant_scoped` | Boolean | `false` | True for custom tenant roles |
| `created_at`, `updated_at` | DateTime | `now()` | Timestamps |

Indexes: `@@index([tenant_id])`.

### `UserAuditLog` (table: `user_audit_logs`)

Append-only audit trail for user actions.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | `gen_random_uuid()` | Primary key |
| `user_id` | String | — | FK → users.id (CASCADE) — target of the action |
| `actor_id` | String? | — | The user who performed the action (NULL for self-service like login) |
| `action` | String | — | E.g. `"login"`, `"user.create"`, `"user.delete"`, `"role.update"`, `"tenant.suspend"` |
| `details` | Json? | — | Context-specific payload (e.g. `{ reason: 'invalid_password', attempt_count: 3 }`) |
| `ip_address` | String? | — | Client IP from `x-forwarded-for` |
| `created_at` | DateTime | `now()` | Timestamp |

Indexes: `@@index([user_id])`, `@@index([action])`, `@@index([created_at])`.

### `Doc` (table: `docs`)

DB-backed documentation storage (replaces filesystem on Vercel).

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | `gen_random_uuid()` | Primary key |
| `slug` | String (unique) | — | URL-safe identifier (e.g. `"architecture"`) |
| `title` | String | — | Display title |
| `category` | String | `"General"` | E.g. `"Technical"`, `"User"`, `"Meta"` |
| `order` | Int | `100` | Sort order within category |
| `content` | String | `""` | Markdown body (no front-matter, no first H1 — UI renders title separately) |
| `last_updated` | Date | `now()` | Date-only (for "Updated: Aug 13, 2026" display) |
| `owner` | String | `"Data Team"` | Owning team |
| `tenant_id` | String? | — | FK → tenants.id (CASCADE); NULL = system doc (public) |
| `is_published` | Boolean | `true` | Draft flag (unpublished visible only to admins) |
| `created_at`, `updated_at` | DateTime | `now()` | Timestamps |

Indexes: `@@index([slug])`, `@@index([category])`, `@@index([tenant_id])`.

## Tenant-scoped domain models (16) — RLS enforced

Each of the following 16 models carries a `tenant_id String?` foreign key to
`tenants.id` (FK action varies — `CASCADE` for most, `SET NULL` for some
optional relationships). Each is protected by an RLS policy using the
`current_setting('app.current_tenant_id', true)` pattern.

### Master data — per-tenant

| Model | Table | Purpose | Key fields (beyond tenant_id) |
|---|---|---|---|
| `Brand` | `brands` | Tenant's portfolio brands | `id`, `name`, `parent` (MAP/MAA), `category`, `price_segment`, `brand_strength` |
| `Store` | `stores` | Master MAA/MAP stores | `id`, `brand_id`, `name`, `lat`, `lng`, `kec`, `kab`, `is_in_mall`, `mall_id`, `confirmed` |
| `CompetitorStore` | `competitor_stores` | Competitor stores (separate!) | `id`, `brand_name`, `brand_category`, `name`, `lat`, `lng`, `kec`, `kab`, `is_in_mall`, `mall_id` |
| `Mall` | `malls` | Mall directory | `id`, `name`, `lat`, `lng`, `gla_m2`, `opened_year`, `class` |
| `MallTenant` | `mall_tenants` | Mall tenant directory | `id`, `mall_id`, `mall_name`, `brand_name`, `brand_category`, `is_map_brand`, `is_competitor` |
| `Poi` | `pois` | Points of interest | `id`, `name`, `lat`, `lng`, `poi_type`, `magnitude` |

### ML / Analytics — per-tenant

| Model | Table | Purpose |
|---|---|---|
| `MLModel` | `ml_models` | Model registry (Huff, KMeans, GBR) — per-tenant custom models |
| `TrainingRun` | `training_runs` | Audit history of GBR training runs |
| `Prediction` | `predictions` | Cached kelurahan-level predictions |
| `ABTest` | `ab_tests` | A/B site comparison scenarios |

### Operations — per-tenant

| Model | Table | Purpose |
|---|---|---|
| `FieldSurvey` | `field_surveys` | PWA-submitted field surveys (anon can INSERT) |
| `ScraperRun` | `scraper_runs` | Audit log of every scrape (query, source, found_count, saved_count) |
| `Report` | `reports` | Saved report configurations |

### Staging (scraper review queue) — per-tenant

| Model | Table | Purpose |
|---|---|---|
| `StagingStore` | `staging_stores` | Scraper output for stores — pending review |
| `StagingCompetitor` | `staging_competitors` | Scraper output for competitors — pending review |
| `StagingMall` | `staging_malls` | Scraper output for malls — pending review |

Each staging table has: `batch_id`, `review_status`
(pending/approved/rejected/merged), `reviewer`, `reviewer_notes`,
`reviewed_at`, `merged_to` (FK to the master row after merge),
`quality_issues` (JSON array), `is_duplicate` (bool).

## Shared reference models (5) — no RLS

These tables contain Indonesia-wide BPS administrative hierarchy data
identical across all tenants. They have **no `tenant_id` column and no RLS
policy** — every tenant reads the same rows.

| Model | Table | Purpose | Key fields |
|---|---|---|---|
| `Country` | `countries` | Top-level admin | `id`, `name`, `iso2`, `iso3` |
| `Province` | `provinces` | Indonesian provinces | `code`, `name`, `country` |
| `Kabupaten` | `kabupaten` | 9 Bali kabupaten/kota | `code`, `name`, `type` (Kabupaten/Kota), `tier` (1/2/3), `population_2024`, `gdrp_per_capita_juta` |
| `Kecamatan` | `kecamatan` | 48 Bali kecamatan | `code`, `name`, `kabupaten_code`, `urban_score` |
| `Kelurahan` | `kelurahan` | 172 Bali kelurahan | `id`, `code`, `name`, `kec_code`, `kab_code`, `lat`, `lng`, `population`, `area_km2`, `is_coastal` |

## Why stores and competitor_stores are separate

The v1 design tried to put everything in one `stores` table with a `parent`
enum (`MAA` / `MAP` / `COMPETITOR`). This caused three problems:

1. **Schema drift** — competitor rows had different required fields than MAA
   rows (e.g., no `brand_id` FK, no `opened_year`). The single-table design
   ended up with lots of NULLs and unclear validation.
2. **Query confusion** — every dashboard query had to remember to filter
   `WHERE parent IN ('MAA', 'MAP')` to exclude competitors. Easy to forget,
   caused incorrect KPIs.
3. **Scraper pollution** — when a scraped brand didn't match the MAA catalog,
   it got inserted with `brand_id='BR_SCRAPER'` and `parent='COMPETITOR'`,
   polluting the master table with thousands of low-quality rows.

The v2/v3 design fixes this by using **two separate tables**:

- `stores` — only the tenant's portfolio brands. Has a FK to `brands.id`.
  Strict validation, no scraper pollution possible.
- `competitor_stores` — any non-portfolio brand. No FK to `brands`. Looser
  validation (we don't know all competitor brand IDs upfront).

The `brand-classifier.ts` module enforces this routing during scraping.

## Enums

The v5.0.0 schema defines **22 enums**. The 4 added in v5.0.0 for the SaaS
layer are highlighted with ★.

| Enum | Values |
|---|---|
| ★ `user_role_enum` | `superadmin`, `admin`, `tenant_admin`, `data`, `analyst`, `viewer` |
| ★ `tenant_plan_enum` | `saas_monthly`, `saas_yearly`, `enterprise_onprem`, `trial`, `internal` |
| ★ `tenant_status_enum` | `active`, `suspended`, `terminated`, `provisioning` |
| ★ `addon_type_enum` | `region_expansion`, `custom_scraper`, `api_connector`, `ui_customization` |
| `brand_parent_enum` | `MAA`, `MAP` |
| `brand_category_enum` | `sports`, `fashion`, `food_beverage`, `department_store`, `kids`, `lifestyle`, `beauty`, `athleisure`, `footwear` |
| `brand_price_segment_enum` | `budget`, `mid`, `premium`, `luxury` |
| `location_format_enum` | `mall`, `street`, `both` |
| `competitor_category_enum` | `convenience_store`, `fast_food`, `coffee`, `fashion`, `beauty`, `supermarket`, `pharmacy`, `department_store`, `sports`, `other` |
| `admin_tier_enum` | `1` (urban), `2` (suburban), `3` (rural) |
| `admin_type_enum` | `Kabupaten`, `Kota` |
| `mall_class_enum` | `class_a`, `class_b`, `class_c` |
| `poi_type_enum` | `tourist_attraction`, `hotel`, `transport_hub`, `school`, `hospital`, `government`, `worship`, `market`, `other` |
| `scraper_source_enum` | `osm`, `nominatim`, `manual`, `field_survey`, `bulk_import` |
| `scraper_status_enum` | `pending`, `running`, `completed`, `failed` |
| `approval_status_enum` | `pending`, `approved`, `rejected`, `merged` |
| `review_status_enum` | `pending`, `approved`, `rejected`, `imported` |
| `survey_type_enum` | `site_visit`, `competitor_audit`, `mall_audit`, `market_observation` |
| `traffic_enum` | `low`, `medium`, `high`, `very_high` |
| `outlet_condition_enum` | `excellent`, `good`, `fair`, `poor`, `closed` |
| `ml_algorithm_enum` | `gbr_regressor`, `huff_gravity`, `kmeans` |
| `ml_model_type_enum` | `site_scoring`, `revenue_forecast`, `cluster` |
| `ml_model_status_enum` | `experimental`, `active`, `deprecated` |
| `training_status_enum` | `pending`, `running`, `completed`, `failed` |
| `prediction_target_enum` | `revenue`, `footfall`, `score` |
| `report_format_enum` | `pdf`, `csv`, `json`, `xlsx` |
| `report_status_enum` | `draft`, `published`, `archived` |

## Spatial columns

Every spatial table has both `lat`/`lng` (Float) and `geom` (PostGIS
`geography(point, 4326)`) columns. The `geom` is auto-generated from
`lat`/`lng` via:

```sql
geom geography(point, 4326) GENERATED ALWAYS AS (ST_MakePoint(lng, lat)::geography) STORED
```

This enables efficient spatial queries:

```sql
-- All stores within 5 km of a candidate site (RLS auto-filters to current tenant)
SELECT * FROM stores
WHERE ST_DWithin(geom, ST_MakePoint(115.17, -8.72)::geography, 5000);

-- Competitor density within 1 km of each kelurahan centroid
SELECT k.id, COUNT(c.*) AS competitors_within_1km
FROM kelurahan k
LEFT JOIN competitor_stores c
  ON ST_DWithin(k.geom, c.geom, 1000)
GROUP BY k.id;
```

## Anti-ocean CHECK constraint

All `stores`, `pois`, and `competitor_stores` tables have:

```sql
CHECK (is_on_bali_land(lat, lng))
```

The `is_on_bali_land()` function (defined in migration `0001`) uses a
simplified polygon of Bali's landmass to reject coordinates that fall in
the ocean. This catches a common OSM data-quality issue where some outlets
are mapped offshore.

## RLS policy matrix

All RLS policies live in migration `0009_saas_multi_tenant_auth.sql` in the
[`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) repo. The
core pattern (using `stores` as the example):

```sql
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_stores ON stores
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    OR current_setting('app.current_tenant_id', true) = ''
    OR current_setting('app.current_tenant_id', true) IS NULL
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
  );
```

The `current_setting('app.current_tenant_id', true)` call returns the value
set by `SET LOCAL app.current_tenant_id = '<uuid>'` (issued by
`setTenantContext()` in `src/lib/tenant-context.ts` at the start of every
API route). An empty string `''` or NULL is treated as the platform-wide
superadmin sentinel — RLS allows reads across all tenants in that case.

### Summary: tenant-scoped vs shared vs system

| Tier | Tables | RLS | `tenant_id` column | Notes |
|---|---|---|---|---|
| **Tenant-scoped domain** (16 tables) | `brands`, `stores`, `malls`, `mall_tenants`, `competitor_stores`, `pois`, `reports`, `scraper_runs`, `field_surveys`, `ab_tests`, `ml_models`, `training_runs`, `predictions`, `staging_stores`, `staging_competitors`, `staging_malls` | ✅ Yes (per-tenant isolation) | ✅ Yes (FK to `tenants.id`, nullable) | Defense-in-depth: RLS + Prisma `tenantFilter()` + JWT claim |
| **Shared reference** (5 tables) | `countries`, `provinces`, `kabupaten`, `kecamatan`, `kelurahan` | ❌ No | ❌ No | Indonesia-wide BPS hierarchy, identical across tenants |
| **System** (6 tables) | `tenants`, `tenant_addons`, `users`, `roles`, `user_audit_logs`, `docs` | ❌ No (app-layer gated) | Optional (`users.tenant_id`, `roles.tenant_id`, `docs.tenant_id`) | SaaS platform itself — gated by `requireSuperadmin()` / `requireTenantAdmin()` |

### Tenant-scoped table RLS detail

| Table | anon SELECT | anon INSERT | auth SELECT | auth INSERT/UPDATE/DELETE |
|---|---|---|---|---|
| All 16 tenant-scoped tables | ❌ | ❌ (field_surveys: ✅ for PWA) | ✅ own tenant only (via RLS) | ✅ own tenant only (via RLS + `WITH CHECK`) |

All writes go through the Next.js API (using Prisma with the
`service_role` key server-side). The Supabase anon key can read reference
data and submit field surveys; everything else requires an authenticated
session.

## Permission matrix structure

The 85-cell permission matrix is stored as a JSON object in
`roles.permissions`. The structure is:

```json
{
  "dashboard":  { "read": true, "create": false, "update": false, "delete": false, "export": false },
  "map":        { "read": true, "create": false, "update": false, "delete": false, "export": true  },
  "users":      { "read": true, "create": true,  "update": true,  "delete": true,  "export": false },
  "...":        { "...": "..." }
}
```

- **17 menus**: `dashboard`, `map`, `opportunities`, `analysis`, `brands`,
  `malls`, `competitors`, `ab`, `ml`, `mall_tenants`, `reports`, `data`,
  `scraper`, `methodology`, `docs`, `about`, `settings`, `users`.
- **5 actions**: `read`, `create`, `update`, `delete`, `export`.
- **85 cells per role** (17 × 5).
- **6 default system roles** (defined in `src/lib/permissions.ts`):
  - `superadmin` — full CRUD+export on ALL menus including users
  - `admin` — full CRUD+export on all EXCEPT users
  - `tenant_admin` — same as admin + users CRUD within own tenant
  - `data` — full CRUD only on reports/data/scraper; read-only elsewhere; NO users
  - `analyst` — read+export on ML/AB/analysis; read-only elsewhere; NO users
  - `viewer` — read-only everywhere, NO exports, NO users
- **Tenant-scoped custom roles**: tenant_admin can create custom roles
  within their own tenant. These have `is_system=false`,
  `is_tenant_scoped=true`, `tenant_id=<own tenant>`.
- **Validation**: `validatePermissions()` and `sanitizePermissions()` in
  `src/lib/permissions.ts` enforce that only the 17 known menus and 5
  known actions are present, all values are booleans, and missing menus
  are treated as all-false.

The matrix is checked both client-side (UI gating via `hasPermission()` and
`<PermissionGate>`) and server-side (API routes call
`requirePermission(menu, action)`).

## Migration order

Migrations in [`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) MUST
be applied in numerical order:

1. `0001_init_extensions_and_enums.sql` — PostGIS + pg_trgm + all v4 ENUMs + `is_on_bali_land()`
2. `0002_master_data.sql` — countries, provinces, kabupaten, kecamatan, kelurahan, brands, stores, malls, mall_tenants, pois
3. `0003_staging_and_ml.sql` — staging_* tables, ml_models, training_runs, predictions, ab_tests, reports, field_surveys
4. `0004_rls_and_merge_functions.sql` — RLS policies (v4 anon-only) + `merge_staging_*()` functions
5. `0005_seed_bali_data.sql` — Seed: 1 country, 1 province, 9 kabupaten, 48 kecamatan, 172 kelurahan, 27 brands, 18 malls, 25 POIs
6. `0006_fix_staging_malls_and_functions.sql` — Bugfixes for staging_malls FK + merge functions
7. `0007_*` through `0008_*` — incremental v4 fixes (see `Locinsights_db` repo)
8. **`0009_saas_multi_tenant_auth.sql`** ★ — v5.0.0 SaaS transformation:
   - Adds `tenants`, `tenant_addons`, `users`, `roles`, `user_audit_logs`, `docs` tables
   - Adds `tenant_id` column + FK to all 16 private tables (nullable, with
     backfill to `tnt_map_active_0001` for existing data)
   - Adds 4 new enums (`user_role_enum`, `tenant_plan_enum`,
     `tenant_status_enum`, `addon_type_enum`)
   - Enables RLS + creates per-tenant isolation policies on all 16
     tenant-scoped tables
   - Seeds default tenant `tnt_map_active_0001` (MAP Active Adiperkasa),
     6 system roles with default permission matrices, and 4 default users
     (bayhaqy / admin_map / data_map / demo_map)

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for step-by-step migration instructions.
