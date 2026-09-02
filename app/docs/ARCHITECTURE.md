---
title: Architecture
category: Technical
order: 10
---

# Architecture

> System design for LocInsights v5.0.0 — the SaaS multi-tenant transformation
> of the LocInsights platform (Aug 2026). This document supersedes the v4.0
> architecture and should be read alongside [`DATA_MODEL.md`](DATA_MODEL.md)
> for the schema and [`DEPLOYMENT.md`](DEPLOYMENT.md) for provisioning.

## High-level diagram

```
                  ┌──────────────────────────┐
                  │  Browser (any tenant)    │
                  │  JWT carries tenant_id   │
                  └────────────┬─────────────┘
                               │ HTTPS
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Vercel — Next.js 16 App Router                            │
   │  ─ React 19 + Tailwind 4 + shadcn/ui                      │
   │  ─ middleware.ts (withAuth) protects every / route         │
   │  ─ ~50 Route Handlers:                                     │
   │      /api/locinsight/*  (32 domain endpoints)              │
   │      /api/admin/*       (users, roles, tenants, audit)     │
   │      /api/docs/*        (DB-backed documentation CRUD)     │
   │      /api/auth/*        (NextAuth + switch-tenant)         │
   │      /api/cron/*        (anti-sleep every 15 min)          │
   └────────────────────────────────┬───────────────────────────┘
                                    │  Prisma 6 (singleton)
                                    │  + setTenantContext() → SET LOCAL
                                    │    app.current_tenant_id = '<uuid>'
                                    ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Supabase (PostgreSQL 15 + PostGIS + pg_trgm + RLS)        │
   │  ───────────────────────────────────────────────────────── │
   │  SaaS layer (system tables, no RLS):                       │
   │    tenants, tenant_addons, users, roles,                   │
   │    user_audit_logs, docs                                   │
   │                                                            │
   │  Tenant-scoped (RLS via current_setting):                  │
   │    brands, stores, malls, mall_tenants,                    │
   │    competitor_stores, pois, reports, scraper_runs,         │
   │    field_surveys, ab_tests, ml_models,                     │
   │    training_runs, predictions,                             │
   │    staging_stores, staging_competitors, staging_malls      │
   │                                                            │
   │  Shared reference (no RLS):                                │
   │    countries, provinces, kabupaten, kecamatan, kelurahan   │
   └────────────────────────────────┬───────────────────────────┘
                                    │  Anti-sleep cron (every 15 min)
                                    ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Hugging Face Space (static — PyScript + Pyodide)          │
   │  Standalone ML explorer — NOT in the production path       │
   └────────────────────────────────────────────────────────────┘
```

The frontend talks **only** to Supabase via Prisma. Tenant isolation is
enforced at three independent layers (JWT claim → RLS → Prisma app-layer
filter), so a misconfiguration in any one layer cannot leak data across
tenants. The HF Space is an optional standalone analytics surface; it is not
in the request path of the production app.

## Request flow (SaaS)

### 1. Public request (no auth)

1. Browser loads `/` (marketing landing page) or `/docs/[slug]` (a published
   system doc).
2. `middleware.ts` matcher explicitly excludes `/`, `/login`, `/api/auth`,
   `/api/docs`, and static assets from auth checks.
3. The route handler runs without a session; Prisma queries can read
   `tenants`, published system `docs`, and the shared admin hierarchy.

### 2. Authenticated request (any logged-in tenant user)

1. Browser sends request to e.g. `/dashboard` with the JWT cookie.
2. `middleware.ts` (`withAuth`) validates the JWT presence and redirects to
   `/login?callbackUrl=…` if absent.
3. The route group layout `(app)/layout.tsx` calls `getServerSession` — if no
   session, redirect to `/login`. If a session exists, render `<AppShell>`
   with the user's tenant context.
4. Inside the page component (or its child client component), an API call
   hits e.g. `GET /api/locinsight/stores`.
5. The route handler runs:
   1. `requireAuth()` — validates the session, returns 401 if absent.
   2. `setTenantContext(session)` — issues
      `SET LOCAL app.current_tenant_id = '<uuid>'` so RLS policies activate.
   3. Prisma query with `where: { …, ...tenantFilter(session) }` — the
      app-layer filter; redundant with RLS but provides defense-in-depth.
6. PostgreSQL evaluates the query, applies RLS policies, and returns only
   rows where `tenant_id = current_setting('app.current_tenant_id')`.
7. The route returns JSON `{ success: true, data: … }` to the client.

### 3. Admin request (superadmin / tenant_admin)

Same as flow 2, but the route handler additionally calls
`requireSuperadmin()` or `requireTenantAdmin()` (see `src/lib/auth-server.ts`).
Superadmin (role = `superadmin`) has `tenant_id = NULL` in the JWT, so
`setTenantContext` sets `app.current_tenant_id = ''` and RLS allows reads
across all tenants (the policies use `current_setting(...) IS NULL OR ''` as
the "platform-wide" sentinel). Tenant_admin and admin roles are scoped to
their own tenant and cannot read cross-tenant data.

### 4. Scraper flow

The scraper flow is unchanged from v4.0:

1. User picks a location (region/kabupaten/kecamatan/kelurahan) and a mode
   (keyword or brand sweep) in the UI.
2. `POST /api/locinsight/scrape` calls `runScrape()` in `scraper-engine.ts`:
   - Resolves the location filter to a bbox (1× DB query, cached per request).
   - Calls Overpass (3 endpoints raced; first non-empty wins).
   - For each OSM element: reverse-geocode to nearest kelurahan in-memory.
3. Results returned to the UI — **NOT saved yet**.
4. User reviews, multi-selects rows, sees a classification badge on each
   (MAA store / Competitor / Other).
5. `POST /api/locinsight/scrape-save`:
   - Loads existing dedup cache (stores + competitors + malls + POIs) once,
     **filtered by the current tenant_id**.
   - For each selected row:
     - `kind=mall` → `malls` table (with `tenant_id` injected via
       `withTenantId(session, …)`)
     - `kind=poi` → `pois` table (same)
     - `kind=store` → `classifyScrapedBrand(brand_name)`:
       - `maa_store` → `stores` table with `brand_id` + `parent` from catalog
       - `competitor` / `other` → `competitor_stores` table
   - Dedup rule: skip if a record of the same brand exists within 50 m
     (within the same tenant).

### 5. ML prediction flow

1. `GET /api/locinsight/ml?action=predict_revenue&kelurahan_id=…&brand_id=…`
2. `loadModel()` — checks for in-memory trained model first, then falls back
   to the JSON artifact at `prisma/ml-models/gbr-revenue-bali-v1.json`
   (60-second in-process cache).
3. `buildFeatureVector()` — assembles 10 features for the kelurahan × brand
   pair (population, density, urban_index, income_index, tourist_index,
   transport_index, poi_density_index, mall_proximity,
   existing_store_density, brand_strength).
4. `predictGBR()` — walks 100 boosted trees (max depth 4, learning rate 0.1),
   sums predictions, computes per-feature SHAP-style contributions.
5. Response includes `predicted_revenue_juta` + `confidence` + top 5 features.

ML models are tenant-scoped (`ml_models.tenant_id`), so a tenant's custom
trained model is invisible to other tenants. The baseline artifact
`gbr-revenue-bali-v1.json` is shared across all tenants.

## Authentication flow

```
   ┌──────────┐    1. POST /api/auth/callback/credentials
   │  Browser │       { username, password }
   │  (login  │ ──────────────────────────────────────────►
   │   page)  │
   └──────────┘
                    2. authorize() callback:
                       ─ IP rate-limit check (5 / 15 min, in-memory)
                       ─ Lookup User by username
                       ─ Verify is_active = true
                       ─ Check locked_until (DB lockout)
                       ─ bcrypt.compare(password, password_hash)
                       ─ On fail: increment failed_login_count,
                                  lock after 5 attempts for 15 min,
                                  log to user_audit_logs, return null
                       ─ On success: reset counters, set last_login_at,
                                     load role.permissions from Role table,
                                     resolve tenant_id (NULL for superadmin),
                                     build available_tenant_ids list,
                                     log success to user_audit_logs,
                                     return user object

                    3. JWT callback (initial):
                       token.user_id, token.username, token.role,
                       token.display_name, token.tenant_id,
                       token.default_tenant_id,
                       token.available_tenant_ids,
                       token.permissions

                    4. Session cookie set (HttpOnly, Secure, SameSite=Lax,
                       30-day maxAge, refresh every 24h)
   ◄─────────────────────────────────────────────────────
   5. Redirect to /dashboard (or ?callbackUrl=)
```

The JWT carries the full `permissions` object (85 booleans), so permission
checks do not require a DB round-trip on every request. Permission edits
take effect on the next JWT refresh (within 24h) or on next login.

## Tenant switching flow

Tenant switching is **JWT-only** — the URL never changes. This is the same
model used by Vercel, GitHub Organizations, and Slack workspaces.

```
   ┌─────────────────┐                          ┌──────────────────┐
   │ TenantSwitcher  │  1. POST /api/auth/      │  Route Handler   │
   │ (header         │     switch-tenant        │                  │
   │  dropdown)      │     { tenantId }         │  • requireAuth   │
   └────────┬────────┘ ────────────────────────►│  • validate:     │
            │                                     │    - tenantId    │
            │                                     │      exists +    │
            │                                     │      active      │
            │                                     │    - canAccess   │
            │                                     │      Tenant()    │
            │                                     │  • return 200    │
            │  2. { success: true }             ◄│    { tenant_id } │
            │◄───────────────────────────────────┘                  │
            │                                                        │
            │  3. next-auth update() — triggers JWT callback         │
            │     with trigger='update', session={ tenant_id: newId }│
            │                                                        │
            │  4. JWT callback rewrites token.tenant_id              │
            │     (persists to cookie)                               │
            │                                                        │
            │  5. router.refresh() — reloads all server components   │
            │     with the new tenant context                        │
            ▼                                                        │
   ┌─────────────────┐                                                │
   │ All subsequent  │                                                │
   │ API calls now   │                                                │
   │ carry the new   │                                                │
   │ tenant_id       │                                                │
   └─────────────────┘                                                │
```

The `/api/auth/switch-tenant` endpoint only **validates** — it does not
modify the JWT itself. The JWT is updated client-side via next-auth's
`update()` method, which triggers the `jwt` callback in `src/lib/auth.ts`
with `trigger='update'`. This separation lets us run all permission checks
server-side before the JWT changes, and the client only proceeds if
validation succeeds.

**Permission rules:**

- `superadmin` can switch to ANY active tenant, or to `null` (platform-wide
  mode — sees all tenants' data at once).
- `admin` / `tenant_admin` can only switch to tenants in their
  `available_tenant_ids` list (which contains only their own tenant_id).
  In practice this means non-superadmin users cannot switch at all.
- `data`, `analyst`, `viewer` — same as admin; no switching.

## RLS policy catalog

All RLS policies live in migration `0009_saas_multi_tenant_auth.sql` in the
[`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) repo. The
core pattern is:

```sql
-- Example: stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_stores ON stores
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    -- Allow platform-wide superadmin reads (tenant_id setting is empty)
    OR current_setting('app.current_tenant_id', true) = ''
    OR current_setting('app.current_tenant_id', true) IS NULL
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::text
  );
```

The `current_setting('app.current_tenant_id', true)` call:
- Returns the value set by `SET LOCAL app.current_tenant_id = '<uuid>'`
  (issued by `setTenantContext()` at the start of every API route).
- The second argument `true` means "missing is OK, return NULL instead of
  erroring" — this allows the connection pool to start up before any
  request has set the variable.
- An empty string `''` (or NULL) is treated as the "platform-wide
  superadmin" sentinel — RLS allows reads across all tenants in that case.

### Tenant-scoped tables (16) — RLS enforced

| Table | RLS Policy | Notes |
|---|---|---|
| `brands` | tenant isolation | Tenant's brand catalog |
| `stores` | tenant isolation | Tenant's master stores (MAA/MAP brands) |
| `malls` | tenant isolation | Tenant's mall directory |
| `mall_tenants` | tenant isolation | Mall tenant audit |
| `competitor_stores` | tenant isolation | Tracked competitors |
| `pois` | tenant isolation | Points of interest |
| `reports` | tenant isolation | Saved report configs |
| `scraper_runs` | tenant isolation | Scraper audit log |
| `field_surveys` | tenant isolation (with anon INSERT) | PWA submissions |
| `ab_tests` | tenant isolation | A/B scenarios |
| `ml_models` | tenant isolation | Model registry |
| `training_runs` | tenant isolation | Training history |
| `predictions` | tenant isolation | Cached predictions |
| `staging_stores` | tenant isolation | Scraper review queue |
| `staging_competitors` | tenant isolation | Scraper review queue |
| `staging_malls` | tenant isolation | Scraper review queue |

### Shared reference tables (5) — no RLS

These tables contain Indonesia-wide reference data identical across all
tenants (BPS admin hierarchy), so they have no `tenant_id` column and no
RLS policy:

| Table | Purpose |
|---|---|
| `countries` | Top-level admin |
| `provinces` | Indonesian provinces |
| `kabupaten` | 9 Bali kabupaten/kota |
| `kecamatan` | 48 Bali kecamatan |
| `kelurahan` | 172 Bali kelurahan |

### System tables (6) — no RLS, app-layer filter only

These tables belong to the SaaS platform itself (not tenant data) and are
gated at the application layer rather than via RLS:

| Table | Access pattern |
|---|---|
| `tenants` | Read: superadmin (all), tenant_admin (own row). Write: superadmin only. |
| `tenant_addons` | Read: superadmin (all), tenant_admin (own tenant). Write: superadmin only. |
| `users` | Read: superadmin (all), tenant_admin (own tenant). Write: superadmin + tenant_admin (own tenant). |
| `roles` | Read: all authenticated. Write: superadmin (system roles), tenant_admin (own tenant's custom roles). |
| `user_audit_logs` | Read: superadmin (all), tenant_admin (own tenant's users). Write: server only (via `logAudit()` helper). |
| `docs` | Read: system docs public; tenant docs require tenant match. Write: superadmin (system), tenant_admin (own tenant). |

## Defense-in-depth layers

Tenant isolation is enforced at three independent layers. Each layer is
sufficient on its own; the others are safety nets.

| Layer | Where | What it does | Bypass risk |
|---|---|---|---|
| **1. JWT claim** | `src/lib/auth.ts` (jwt callback) | `token.tenant_id` set at login; consumed by `requireAuth()` in every route | JWT secret leak |
| **2. PostgreSQL RLS** | Migration `0009_saas_multi_tenant_auth.sql` | `current_setting('app.current_tenant_id', true)` silently filters queries | PgBouncer transaction mode may not propagate `SET LOCAL` — falls back to layer 3 |
| **3. Prisma `tenantFilter`** | `src/lib/tenant-context.ts` | Every query explicitly adds `where: { tenant_id: … }` | Developer forgets to call `tenantFilter()` — caught by code review |

The RLS layer is the **authoritative guard**; the Prisma app-layer filter is
the **safety net**. Even if RLS is bypassed (e.g. by a misconfigured
PgBouncer transaction-mode pool that doesn't propagate `SET LOCAL`), the
app-layer filter still prevents data leakage. Both layers must fail
simultaneously for a leak to occur.

For INSERT operations, `withTenantId(session, data)` injects the tenant_id
server-side — the client cannot forge a different tenant_id because the
field is overwritten, not just validated.

## Directory layout (deep dive)

### `src/app/api/locinsight/` — 32 domain endpoints

| Resource group | Endpoints |
|---|---|
| `overview` | `GET /overview` — aggregated dashboard data |
| `locations` | `GET /locations` — admin hierarchy |
| `countries` / `provinces` | GET / CRUD |
| `kabupaten` / `kecamatan` / `kelurahan` | GET / CRUD |
| `brands` / `stores` / `competitors` | GET / CRUD (tenant-scoped) |
| `malls` + `mall-tenants` | GET / CRUD (tenant-scoped) |
| `pois` | GET / CRUD (tenant-scoped) |
| `opportunities` | `GET /opportunities` — ranked kelurahan list |
| `analyze` | `GET /analyze?kelurahan_id=…` — per-kelurahan deep dive |
| `ab-test` | `POST /ab-test` — A/B comparison |
| `reports` | `GET /reports?type=…` — export PDF/CSV/JSON |
| `field-survey` | `GET/POST/PATCH` — PWA survey submission + review |
| `bulk` | `POST /bulk` — import/export CSV |
| `scrape` + `scrape-save` | `POST /scrape` (unified scraper) + `POST /scrape-save` (review save) |
| `ml` + `ml/train` | `GET /ml?action=…` + `POST /ml/train` |
| `chat` | `POST /chat` — Z.AI-powered assistant |
| `cron/anti-sleep` | `GET` (cron-only, every 15 min) |

### `src/app/api/admin/` — Users Management API

| Endpoint | Methods | Permission |
|---|---|---|
| `/api/admin/tenants` | GET, POST | superadmin (POST); GET also available to tenant_admin for the switcher |
| `/api/admin/tenants/[id]` | GET, PUT, DELETE | superadmin only |
| `/api/admin/users` | GET, POST | superadmin or tenant_admin (scoped to own tenant) |
| `/api/admin/users/[id]` | GET, PUT, DELETE | superadmin or tenant_admin (own tenant) |
| `/api/admin/users/[id]/reset-password` | POST | superadmin or tenant_admin (own tenant) |
| `/api/admin/users/[id]/reset-lockout` | POST | superadmin or tenant_admin (own tenant) |
| `/api/admin/roles` | GET, POST | superadmin (POST for system roles); tenant_admin (POST for own tenant's custom roles) |
| `/api/admin/roles/[id]` | GET, PUT, DELETE | superadmin or tenant_admin (own tenant) |
| `/api/admin/audit-logs` | GET | superadmin (all); tenant_admin (own tenant's users) |

Every mutating call writes a row to `user_audit_logs` via the `logAudit()`
helper with `actor_id`, `action`, `ip_address`, and a JSON `details` payload.

### `src/app/api/docs/` — DB-backed documentation

| Endpoint | Methods | Notes |
|---|---|---|
| `/api/docs` | GET (public), POST (admin) | List docs (no content); create new |
| `/api/docs/[slug]` | GET (public for system docs), PUT, DELETE (admin) | Fetch full doc; update; delete |
| `/api/docs/categories` | GET (public) | Distinct category list |

System docs (`tenant_id IS NULL`) are publicly readable so the marketing
landing page can render them to anonymous visitors. Tenant docs require
authentication + tenant match.

### `src/app/api/auth/` — NextAuth + tenant switching

| Endpoint | Methods | Notes |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth v4 catch-all (sign-in, sign-out, session, JWT) |
| `/api/auth/switch-tenant` | POST | Validates a tenant switch before the client updates the JWT |

### `src/lib/` — Shared libraries

| File | Purpose |
|---|---|
| `auth.ts` | NextAuth options (Credentials provider, JWT callbacks, rate-limiting, bcrypt verify, audit logging) |
| `auth-server.ts` | `requireAuth()`, `requireSuperadmin()`, `requireTenantAdmin()`, `canAccessTenant()`, `getCurrentTenantId()` |
| `auth-provider.tsx` | Client-side `<SessionProvider>` wrapper |
| `permissions.ts` | 17-menu × 5-action permission catalog + default matrices for 6 system roles |
| `tenant-context.ts` | `setTenantContext()`, `withTenantContext()`, `tenantFilter()`, `strictTenantFilter()`, `withTenantId()` |
| `audit-log.ts` | `logUserAction()` helper that writes to `user_audit_logs` |
| `db.ts` | Prisma client singleton (avoid pool exhaustion) |
| `api-helpers.ts` | Shared paginate + error handlers |
| `brand-classifier.ts` | MAA vs competitor routing for scraper |
| `scraper-engine.ts` | Unified OSM scraper (keyword + brand modes) |
| `scoring/engine.ts` | Composite opportunity score (10 weighted factors) |
| `ml/gbr.ts`, `ml/dataset.ts`, `ml/model-cache.ts` | Pure-TS GBR model |

### `src/components/locinsight/` — 32 domain components

Each sidebar tab maps to one component. Notable SaaS-specific additions:

- `user-management.tsx` — 4-tab admin panel (Tenants, Users, Roles, Audit)
- `documentation.tsx` — DB-backed docs UI with live markdown editor (1345 lines)
- `tenant-switcher.tsx` — header dropdown for superadmin
- `permission-gate.tsx` — client-side RBAC wrapper (`<PermissionGate menu="users" action="read">`)
- `sidebar.tsx` — renders menus based on the user's permission matrix
- `app-shell.tsx` — wraps every protected route (sidebar + header + tenant switcher + AI chat + footer)

### `src/lib/scoring/engine.ts` — Composite Opportunity Score

The engine computes a 0–100 score for every kelurahan using 10 weighted factors:

| Factor | Weight | Source |
|---|---|---|
| Population density | 12 % | BPS 2024 |
| Income index (GDRP per capita × urban score) | 15 % | BPS 2024 |
| Tourist index (POI magnitude + hotel count) | 12 % | OSM + BPS |
| Transport index (road density + transit hubs) | 8 % | OSM |
| POI density within 5 km | 10 % | OSM |
| Mall proximity index | 10 % | malls table |
| Existing store density (1 km) | 8 % | stores table |
| Competitor density (1 km) | 10 % | competitor_stores table |
| Coastal flag (tourist boost) | 5 % | bali-land.ts |
| Brand-fit multiplier | 10 % | brand catalog |

Total weights sum to 100 %. The methodology is fully transparent — see the
Methodology tab in the app and `src/components/locinsight/methodology.tsx`.

## Performance budget

| Metric | Target | Actual |
|---|---|---|
| First Contentful Paint | < 1.5 s | ~1.2 s (Vercel edge) |
| `/overview` response | < 800 ms | ~450 ms (cached Prisma) |
| Scraper (keyword mode) | < 60 s | ~18 s average |
| Scraper (brand sweep, 27 brands) | < 60 s | ~22 s average |
| ML prediction | < 200 ms | ~80 ms (in-memory model) |
| Map choropleth render | < 1 s | ~600 ms (GADM polygons) |
| Tenant switch (end-to-end) | < 500 ms | ~200 ms (JWT rewrite + router.refresh) |

## Security

- **RLS enabled** on all 16 tenant-scoped tables. Anon key can read master
  data within the tenant context; writes require the service_role key
  (server-only, never exposed to client).
- **Authentication**: NextAuth v4 Credentials provider + bcrypt (10 rounds)
  + JWT (30-day, refresh every 24h).
- **Rate limiting**: in-memory per-IP (5 attempts / 15 min) + DB lockout
  after 5 failed attempts (`users.failed_login_count` + `users.locked_until`).
- **Audit logging**: every login attempt (success or failure) and every
  admin mutation writes to `user_audit_logs` with `actor_id`, `action`,
  `ip_address`, and JSON `details`.
- **Self-delete prevention**: server-side 409 "You cannot delete your own
  account" on `DELETE /api/admin/users/[id]` when `id === session.user.user_id`.
- **Last-superadmin prevention**: server-side 409 on `DELETE` or `PUT` (role
  change) when the action would leave zero active superadmins.
- **Staging tables** (scraper review queue) — tenant-scoped via RLS; only
  authenticated users within the tenant can read/write.
- **Field surveys** — anon can INSERT (PWA submission) but cannot SELECT,
  UPDATE, or DELETE (prevents scraping of competitor survey data).
- **Secrets** — `NEXTAUTH_SECRET` is server-only (Vercel env var); the
  Supabase service_role key is server-only; the publishable (anon) key is
  safe to expose due to RLS.

## Failure modes & mitigations

| Failure | Mitigation |
|---|---|
| Overpass rate-limit (429) | Race 3 endpoints; throw on empty so `Promise.any` keeps waiting |
| Overpass timeout (>20 s) | Abort controller + 20 s cap; UI shows "scrape failed, try again" |
| Supabase cold start | Anti-sleep cron every 15 min pings `SELECT 1` |
| HF Space cold start | Anti-sleep cron pings `/health`; static Space has no cold start anyway |
| Prisma connection pool exhaustion | Singleton client; `pgbouncer=true` in connection string |
| OSM coordinates in ocean | `is_on_bali_land()` CHECK constraint at the DB level rejects |
| PgBouncer transaction mode breaks `SET LOCAL` | `setTenantContext()` catches the error and logs a warning; app-layer `tenantFilter()` still applies (defense-in-depth) |
| JWT secret leak | Rotate `NEXTAUTH_SECRET` (forces re-login for all users) |
| Brute-force login | IP rate-limit (5/15 min) + DB lockout (5 attempts → 15 min) |
| Tenant data leak via misconfigured RLS | Defense-in-depth: Prisma `tenantFilter()` still applies |

## Migration guide (v4 → v5)

The v5.0.0 SaaS transformation adds a single SQL migration to the
[`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) repo:

**`0009_saas_multi_tenant_auth.sql`** — adds:

- 6 new tables: `tenants`, `tenant_addons`, `users`, `roles`,
  `user_audit_logs`, `docs`
- `tenant_id` foreign key column on all 16 private tables (nullable, so
  existing data is assigned to the default tenant during the migration)
- 4 new enums: `tenant_plan_enum`, `tenant_status_enum`,
  `addon_type_enum`, `user_role_enum`
- RLS policies on all 16 tenant-scoped tables using the
  `current_setting('app.current_tenant_id', true)` pattern
- Default tenant `tnt_map_active_0001` (MAP Active Adiperkasa) — all
  existing v4 data is reassigned to this tenant
- 6 system roles (superadmin, admin, tenant_admin, data, analyst, viewer)
  with default permission matrices
- 4 default users (bayhaqy, admin_map, data_map, demo_map)

**Application steps:**

1. Apply migration `0009` to your Supabase project (see
   [`DEPLOYMENT.md`](DEPLOYMENT.md) for instructions).
2. Generate the new Prisma client: `bun run db:generate`
3. Seed SaaS layer: `bun run seed:users` (creates tenants + users + roles)
4. (Optional) Migrate docs: `bun run scripts/seed-docs.ts`
5. Set `NEXTAUTH_SECRET` env var (generate with `openssl rand -base64 32`)
6. Set `NEXTAUTH_URL` env var (your production URL)
7. Redeploy on Vercel — push to `main`

## Operational runbook

See [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for:
- SaaS deployment topology (Vercel + Supabase + multi-tenant)
- Environment variables (including `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
  `DIRECT_URL`)
- Vercel project setup (build command: `prisma generate && next build`)
- Supabase RLS configuration (migration `0009`)
- Seed users: `bun run seed:users`
- Seed docs: `bun run scripts/seed-docs.ts`
- Tenant onboarding flow (admin panel → create tenant → create tenant_admin user)
