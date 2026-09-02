---
title: Changelog
category: Meta
order: 110
---

# Changelog

All notable changes to LocInsights are documented here. Dates are in
`YYYY-MM-DD` format. Versions follow [Semantic Versioning](https://semver.org/).

## [5.0.0] — 2026-08-13

> **Major release: SaaS multi-tenant transformation.** LocInsights evolves
> from a single-tenant PoC for MAP Active Adiperkasa into a multi-tenant SaaS
> platform sold under three commercial tiers (Managed SaaS, Enterprise
> On-Premise, Professional Services Add-ons). This release introduces
> per-tenant row-level security, NextAuth authentication, role-based access
> control, App Router refactor, DB-backed documentation, tenant switching,
> and white-labeling.

### Branding

- **Renamed `LocInsight` → `LocInsights`** (plural with 's') throughout the
  codebase, README, docs, package.json (`name: "locinsights"`), marketing
  landing page, and login screen. The plural form reflects the platform's
  evolution from a single-tenant internal tool into a multi-tenant SaaS
  product serving multiple subscribing organizations (multiple "insights"
  customers).

### Multi-tenant architecture

- **6 new Prisma models**: `Tenant`, `TenantAddon`, `User`, `Role`,
  `UserAuditLog`, `Doc` — bringing the total from 21 to 27 models in
  `prisma/schema.prisma`.
- **`tenant_id` foreign key** added to all 16 private data tables:
  `brands`, `stores`, `malls`, `mall_tenants`, `competitor_stores`, `pois`,
  `reports`, `scraper_runs`, `field_surveys`, `ab_tests`, `ml_models`,
  `training_runs`, `predictions`, `staging_stores`, `staging_competitors`,
  `staging_malls`.
- **Shared database + `tenant_id` + RLS** chosen over schema-per-tenant
  for simpler migrations, cross-tenant analytics for superadmins, and
  stable connection pooling. See `docs/ARCHITECTURE.md` → Defense-in-depth.
- **PostgreSQL RLS per-tenant** via
  `current_setting('app.current_tenant_id', true)` — applied to all 16
  tenant-scoped tables in migration `0009_saas_multi_tenant_auth.sql`.
- **5 reference tables** (`countries`, `provinces`, `kabupaten`,
  `kecamatan`, `kelurahan`) remain shared (no `tenant_id`, no RLS) since
  they hold Indonesia-wide BPS data identical across tenants.

### Authentication system

- **NextAuth v4** (`next-auth@4.24.15`) with the Credentials provider
  (username + password). Session strategy: JWT (30-day maxAge, refresh
  every 24h).
- **bcryptjs** (`bcryptjs@3.0.3`, 10 rounds) for password hashing. The
  previous PoC had no auth — all data was anonymous.
- **Rate-limiting**: in-memory per-IP (5 attempts / 15 min) + DB lockout
  after 5 failed attempts (`users.failed_login_count` +
  `users.locked_until`, 15-minute lockout).
- **Audit logging**: every login attempt (success or failure) and every
  admin mutation writes to `user_audit_logs` with `actor_id`, `action`,
  `ip_address`, and JSON `details` payload.
- **JWT carries tenant context**: `token.tenant_id`,
  `token.available_tenant_ids`, `token.permissions` — so permission checks
  require no DB round-trip per request.

### RBAC: 6 roles × 17 menus × 5 actions

- **6 system roles**: `superadmin`, `admin`, `tenant_admin`, `data`,
  `analyst`, `viewer`.
- **17 menus**: `dashboard`, `map`, `opportunities`, `analysis`, `brands`,
  `malls`, `competitors`, `ab`, `ml`, `mall_tenants`, `reports`, `data`,
  `scraper`, `methodology`, `docs`, `about`, `settings`, `users`.
- **5 actions**: `read`, `create`, `update`, `delete`, `export`.
- **85-cell permission matrix** per role, stored as JSON in
  `roles.permissions`. Editable in-app via the Roles tab (Users Management).
- **Tenant-scoped custom roles**: tenant_admin can create custom roles
  scoped to their own tenant (`roles.tenant_id` + `is_tenant_scoped=true`).

### App Router refactor

- **Refactored from a SPA to Next.js 16 App Router** — `/` is now a public
  marketing landing page (was the SPA shell), and protected routes live
  under the `(app)/` route group: `dashboard`, `map`, `opportunities`,
  `analysis`, `brands`, `malls`, `mall_tenants`, `competitors`, `ab`,
  `ml`, `reports`, `data`, `scraper`, `methodology`, `docs`, `users`,
  `about`, `settings` (18 protected routes total).
- **`middleware.ts`** uses `withAuth` to protect every route except
  `/`, `/login`, `/survey`, `/api/auth/*`, `/api/docs`, and static assets.
- **`(app)/layout.tsx`** is a server component that calls
  `getServerSession` and redirects to `/login` if no session.
- **`/login`** is a public route with a split-screen layout (marketing
  showcase + login form).
- **`app-shell.tsx`** wraps every protected route with the sidebar +
  header + tenant switcher + AI chat + footer.

### Users Management UI (4 tabs)

- **Tenants tab**: tenant list (superadmin) with create/edit/lock/unlock/
  delete, region_scope multi-select, white-labeling fields (app_name,
  logo_url, primary_color, accent_color), max_users, max_api_calls_per_day,
  trial_ends_at, suspended_at, terminated_at, stats (user_count +
  addon_count).
- **Users tab**: 9-column table (username, display_name, email, role,
  tenant_name, status, last_login_at, failed_login_count, actions).
  Create / Edit / Reset Password / Reset Lockout / Delete actions. Row
  tint amber for current user + "you" badge. Locked badge when
  `locked_until > now`. Self-delete + last-superadmin prevention.
- **Roles tab**: card list with system/tenant-scoped badge, user count,
  perms count (X/85). Inline expand reveals read-only permission matrix.
  Edit opens dialog with interactive 17×5 PermissionMatrixEditor
  (sticky header + sticky left column + 3-tier "Select All": master /
  per-row / per-column).
- **Audit tab**: filterable list of `user_audit_logs` entries. Superadmin
  sees all; tenant_admin sees only own-tenant users' logs.

### Documentation UI (DB-backed)

- **DB-backed documentation storage** replaces the filesystem approach.
  The previous `fs.writeFile` approach broke on Vercel's read-only
  serverless filesystem, throwing `EACCES` and returning empty bodies
  that failed JSON parsing on the client. All doc CRUD now goes through
  Prisma → PostgreSQL, never touches the disk.
- **`/docs` route** with 3-column responsive layout: 260px sidebar
  (search + file tree grouped by category) | flex main (view/edit modes)
  | 220px TOC rail (auto-generated from H2/H3 headings).
- **Live markdown editor**: split-pane textarea + preview, auto-save draft
  to `localStorage` every 5 seconds, Restore-on-re-entry prompt.
- **`scripts/seed-docs.ts`**: one-shot migration tool that reads
  `/docs/*.md` and upserts DB `Doc` rows by slug. Idempotent. Strips
  front-matter + first H1, extracts title/category/owner/order defaults.
- **3 new API routes**: `/api/docs` (GET public, POST admin),
  `/api/docs/[slug]` (GET public for system docs, PUT/DELETE admin),
  `/api/docs/categories` (GET public).

### Tenant switching (JWT-only)

- **`/api/auth/switch-tenant`** validates a tenant switch (returns 200
  on success) — does NOT modify the JWT itself. The JWT is updated
  client-side via next-auth's `update()` method, which triggers the
  `jwt` callback with `trigger='update'`.
- **TenantSwitcher component** in the header shows a dropdown of all
  active tenants (for superadmin) or just the current tenant (for
  tenant_admin). On select, calls `switch-tenant` → `update()` →
  `router.refresh()`.
- **No URL change** during tenant switching — the URL stays `/dashboard`
  the whole time. This matches the Vercel / GitHub Orgs / Slack model.

### White-labeling

- **Per-tenant branding fields** on the `Tenant` model: `app_name`
  (default `"LocInsights"`), `logo_url`, `primary_color` (default
  `#7A0A1A`), `accent_color` (default `#C8102E`).
- The login page and app shell read the current tenant's branding fields
  and apply them via CSS custom properties (`--brand-red`,
  `--brand-accent`, `--brand-app-name`).

### SaaS pricing tiers

LocInsights is sold under three commercial models (full pricing in the
README):

- **Skema A — Managed SaaS**: Rp 25jt/month or Rp 250jt/year, cloud-hosted
  by LocInsights. Up to 10 users, 1 region, 10k API calls/day.
- **Skema B — Enterprise On-Premise**: Rp 450jt one-time license +
  Rp 75jt setup + Rp 85jt/year AMC. Perpetual license for internal
  deployment. Unlimited users/regions.
- **Skema C — Professional Services & Data Add-ons**: à la carte
  (region expansion Rp 20jt/province, custom scraper Rp 25jt, API
  connector from Rp 75jt, UI customization Rp 5jt/manday). Tracked as
  `TenantAddon` records with `addon_type` enum + JSON `addon_config`
  + `expires_at`.

### Documentation

- Rewrote `README.md` to reflect SaaS positioning (was LocInsight-MAA-PoC
  single-tenant doc).
- Updated `docs/ARCHITECTURE.md` with the SaaS system diagram, auth flow,
  tenant switching flow, RLS policy catalog, and defense-in-depth layers.
- Updated `docs/DATA_MODEL.md` with the 6 new SaaS models, tenant_id FK
  on 16 tables, and RLS policy matrix.
- Updated `docs/DEPLOYMENT.md` with SaaS topology, env vars, RLS migration,
  seed users/docs scripts, and tenant onboarding flow.
- New `docs/USER_GUIDE.md` covering login, navigation, tenant switching,
  Users Management, documentation editing, and role-based access.

### Tech stack additions

- `next-auth@4.24.15` — NextAuth v4 with Credentials provider + JWT
  strategy.
- `bcryptjs@3.0.3` (+ `@types/bcryptjs`) — bcrypt password hashing.
- `@vercel/analytics@1.5.0` — auto-enabled on Vercel.
- `react-markdown@10.1.0` + `remark-gfm@4.0.1` + `rehype-highlight@7.0.2`
  + `rehype-raw@7.0.0` + `highlight.js@11.12.0` — for the Documentation UI.
- `@radix-ui/react-checkbox`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`,
  `@radix-ui/react-switch`, `@radix-ui/react-select` — for the Users
  Management UI (permission matrix editor, dropdowns, tabs).
- `zod@4.0.2` — schema validation (used in admin API routes).

### Migration (v4 → v5)

See `docs/ARCHITECTURE.md` → Migration guide. Summary:

1. Apply `0009_saas_multi_tenant_auth.sql` to Supabase
2. `bun run db:generate` (regenerate Prisma client)
3. `bun run seed:users` (creates default tenants + users + roles)
4. `bun run scripts/seed-docs.ts` (migrates markdown → DB docs)
5. Set `NEXTAUTH_SECRET` and `NEXTAUTH_URL` env vars
6. Redeploy on Vercel

---

## [4.0.0] — 2026-08-09

### Repository cleanup (this release)

- **New custom domain**: production now served at `https://locinsights.bayhaqy.my.id`
  (was `https://locinsights.vercel.app`).
- **Removed redundant scraper routes**: deleted
  `/api/locinsight/scrape-competitors` and `/api/locinsight/scrape-competitors-save`
  (they were near-duplicates of `/scrape` and `/scrape-save`). The Competitor
  Intel tab now uses `/api/locinsight/competitors?all=true` for listing.
- **Fixed `next.config.ts`**: removed `typescript.ignoreBuildErrors: true`
  (was masking real type errors) and `reactStrictMode: false`. Production builds
  are now type-safe and strict-mode-enabled.
- **Fixed Vercel cron schedule**: was `0 8 * * *` (once daily), now `*/15 * * * *`
  (every 15 min) per the anti-sleep design.
- **Cleaned up `package.json`**: removed 9 unused dependencies
  (`react-day-picker`, `embla-carousel-react`, `input-otp`, `react-hook-form`,
  `@hookform/resolvers`, `cmdk`, `vaul`, `react-resizable-panels`, `sharp`).
  Added `engines.node` constraint and a `typecheck` script.
- **Fixed `tsconfig.json`**: explicitly include only `src/`, exclude `scripts/`,
  `skills/`, `examples/`, `tests/`, `hf-space/`. Eliminates 16 spurious type
  errors from non-app directories.
- **Fixed pre-existing type errors**: 16 errors across `field-survey/route.ts`,
  `mall-tenants/route.ts`, `ml/route.ts`, `ml/train/route.ts` that were masked
  by `ignoreBuildErrors: true`. Now `tsc --noEmit` is clean.
- **Added documentation**: `README.md` (root) + `docs/ARCHITECTURE.md` +
  `docs/SCRAPER.md` + `docs/DATA_MODEL.md` + `docs/DEPLOYMENT.md` +
  `docs/CHANGELOG.md`.
- **Added `LICENSE`** (Apache-2.0).

### From 3.0.0 (previous release)

- Unified scraper (single endpoint replaces two near-duplicates)
- Hierarchical location filter (Bali → Kab → Kec → Kel)
- Brand classifier (prevents competitor pollution of master `stores` table)
- Per-request cache for reverse-geocoding (fixes Vercel 60 s timeout)
- Real GADM GeoJSON for kabupaten/kecamatan choropleth
- About page (moved methodology + scope text out of header)
- Removed Field Surveys from sidebar (kept as PWA at `/survey`)
- HF Space switched to PyScript (Gradio Lite couldn't load scikit-learn)

## [3.0.0] — 2026-08-08

- 8 user-reported bugs fixed (heatmap, GBR train, sidebar text, etc.)
- Competitor Intel tab simplified to data viewer (scraping routed through
  unified scraper)
- Map choropleth uses real GADM admin boundaries with ColorBrewer YlOrRd
  7-step scale + quantile classification

## [2.0.0] — 2026-07-XX

- Initial Vercel + Supabase + HF Space deployment
- 27 MAA/MAP brands, 18 malls, 25 POIs, 172 kelurahan seeded
- AG Grid-style Data Manager with inline editing
- ML/AI Engine tab with GBR training pipeline
- A/B Simulator
- Field Survey PWA at `/survey`

## [1.0.0] — 2026-06-XX

- Initial PoC: pure TypeScript frontend + SQLite (no Supabase, no ML, no scraper)
- Dashboard + Map + Opportunities only
