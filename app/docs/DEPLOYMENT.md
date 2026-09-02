---
title: Deployment
category: Technical
order: 80
---

# Deployment

> How to deploy LocInsights v5.0.0 (SaaS multi-tenant) from scratch. Assumes
> you have Vercel, Supabase, and Hugging Face accounts. This document
> supersedes the v4.0 deployment guide and adds the SaaS-specific steps
> (NEXTAUTH_SECRET, migration 0009, seed:users, tenant onboarding).

## SaaS deployment topology

```
                   ┌──────────────────────────┐
                   │  Tenant A users           │
                   │  Tenant B users           │
                   │  Tenant C users           │
                   │  Superadmin               │
                   └────────────┬─────────────┘
                                │ HTTPS
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Vercel (Next.js 16 App Router, standalone build)          │
   │  ─ Single deployment serves ALL tenants                    │
   │  ─ JWT carries tenant_id claim (no URL change)             │
   │  ─ Build command: prisma generate && next build            │
   │  ─ Cron: /api/cron/anti-sleep every 15 min                 │
   └────────────────────────────────┬───────────────────────────┘
                                    │  Prisma 6 + RLS context
                                    ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Supabase (PostgreSQL 15 + PostGIS + RLS per-tenant)       │
   │  ─ Single database, all tenants share tables               │
   │  ─ Row isolation via current_setting('app.current_tenant_  │
   │    id', true) in RLS policies                              │
   │  ─ tenants, tenant_addons, users, roles, user_audit_logs,  │
   │    docs (system tables)                                    │
   │  ─ 16 tenant-scoped tables with tenant_id FK               │
   │  ─ 5 shared reference tables (BPS admin hierarchy)         │
   └────────────────────────────────────────────────────────────┘
```

A single Vercel deployment serves **all tenants** — there is no per-tenant
URL or per-tenant build. Tenant identity is carried inside the JWT cookie,
and Supabase RLS policies silently filter every query to the user's
tenant. This is the same model used by Vercel, Notion, and Linear.

## 1. Supabase setup

### 1.1 Create a project

1. Go to https://supabase.com/dashboard → New Project
2. Pick a name (e.g., `locinsights-prod`), set a strong DB password
3. Region: **Singapore** (closest to Bali/Indonesia users). For Skema B
   Enterprise On-Premise deployments, the customer chooses their own region
   (typically ap-southeast-3 Jakarta or ap-southeast-1 Singapore).
4. Plan: Free is sufficient for development; **Pro or Team** recommended
   for production (PgBouncer transaction pooling, daily backups, no
   auto-pause).

### 1.2 Apply database migrations

Clone the [`Locinsights_db`](https://github.com/bayhaqy/Locinsights_db) repo
and apply migrations in order. Easiest: paste each SQL file into the
Supabase SQL Editor.

```bash
git clone https://github.com/bayhaqy/Locinsights_db.git
cd Locinsights_db
# Apply 0001 → 0009 in order via Supabase SQL Editor
```

**Critical for v5.0.0**: migration `0009_saas_multi_tenant_auth.sql` adds:

- 6 new tables: `tenants`, `tenant_addons`, `users`, `roles`,
  `user_audit_logs`, `docs`
- `tenant_id` column + FK on all 16 private tables (with backfill of
  existing data to the default tenant `tnt_map_active_0001`)
- 4 new enums: `user_role_enum`, `tenant_plan_enum`,
  `tenant_status_enum`, `addon_type_enum`
- RLS policies on all 16 tenant-scoped tables using the
  `current_setting('app.current_tenant_id', true)` pattern
- Default tenant + 6 system roles + 4 default users (bayhaqy, admin_map,
  data_map, demo_map)

**Do not skip migration 0009** — the v5.0.0 application code requires
these tables and policies to exist. Without it, login will fail (no
`users` table) and tenant isolation will not work.

### 1.3 Get connection strings

In Supabase Dashboard → Settings → Database → Connection string:

- **Transaction pooler** (port 6543, with `?pgbouncer=true`) → use as `DATABASE_URL`
- **Session pooler** (port 5432) → use as `DIRECT_URL` (for Prisma migrations)

Format:
```
postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note on PgBouncer transaction mode**: `SET LOCAL` (used by
`setTenantContext()` to activate RLS) may not propagate reliably under
PgBouncer transaction pooling. The application code catches this failure
and falls back to the Prisma app-layer `tenantFilter()` — defense-in-depth
per `docs/ARCHITECTURE.md`. For maximum safety, use the **session pooler**
(5432) for `DATABASE_URL` as well, accepting slightly higher connection
overhead.

### 1.4 Get API keys

In Supabase Dashboard → Settings → API:

- `sb_publishable_...` (anon key) — safe to expose client-side
- `sb_secret_...` (service_role key) — **server-only**, never expose

### 1.5 Supabase RLS configuration

After migration `0009` is applied, verify RLS is active on all 16
tenant-scoped tables:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'brands', 'stores', 'malls', 'mall_tenants', 'competitor_stores',
    'pois', 'reports', 'scraper_runs', 'field_surveys', 'ab_tests',
    'ml_models', 'training_runs', 'predictions',
    'staging_stores', 'staging_competitors', 'staging_malls'
  );
-- All 16 rows should show rowsecurity = true (t)
```

To list all RLS policies:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Each tenant-scoped table should have exactly one policy named
`tenant_isolation_<table>` with `FOR ALL` and the
`current_setting('app.current_tenant_id', true)` predicate. See
`docs/ARCHITECTURE.md` → RLS policy catalog for the full policy text.

## 2. Vercel setup

### 2.1 Import the GitHub repo

1. Push this repo to `github.com/<you>/LocInsights`
2. Go to https://vercel.com/new → Import the repo
3. Framework preset: **Next.js** (auto-detected)
4. **Build command**: `prisma generate && next build` (already in
   `package.json`'s `"build"` script — Vercel picks this up automatically)
5. Output directory: `.next` (auto)
6. Install command: `bun install` (or `npm install`)

### 2.2 Set environment variables

In Vercel → Project → Settings → Environment Variables, set the following.
**All variables below are required for v5.0.0.**

| Variable | Value | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://...pooler.supabase.com:6543/...?pgbouncer=true` | ✅ | Transaction pooler. **Required for Prisma runtime queries.** |
| `DIRECT_URL` | `postgresql://...pooler.supabase.com:5432/...` | ✅ | Session pooler. **Required for `prisma db push` and `prisma migrate`.** |
| `NEXTAUTH_SECRET` | `<random 32-byte base64 string>` | ✅ | **Generate with `openssl rand -base64 32`.** Used to sign JWTs. **Never commit to git.** |
| `NEXTAUTH_URL` | `https://locinsights.bayhaqy.my.id` | ✅ | **Your production URL** (the canonical NextAuth base URL). For local dev use `http://localhost:3000`. |
| `ZAI_BASE_URL` | `https://internal-api.z.ai/v1` | ✅ | For the AI chat assistant |
| `ZAI_API_KEY` | `<your Z.AI key>` | ✅ | Server-only |
| `ZAI_TOKEN` | `<your Z.AI JWT>` | ✅ | Server-only |
| `ZAI_USER_ID` | `<your Z.AI user id>` | ✅ | Server-only |
| `ZAI_CHAT_ID` | `<your Z.AI chat id>` | ✅ | Server-only |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[project-ref].supabase.co` | Optional | Only if client uses Supabase JS directly (we currently use Prisma only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | Optional | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Optional | Server-only, for direct Supabase admin operations |
| `HF_SPACE_URL` | `https://bayhaqy-locinsights-ml.static.hf.space` | Optional | For anti-sleep cron ping |

**Critical**: `NEXTAUTH_SECRET` must be set BEFORE the first deploy. Without
it, login will throw `JWTSecretMissingError` and the entire app will be
inaccessible.

### 2.3 Add custom domain

1. Vercel → Project → Settings → Domains → Add
2. Enter `locinsights.bayhaqy.my.id` (or your domain)
3. Vercel shows the DNS records to add:
   - **CNAME** `locinsights` → `cname.vercel-dns.com` (or A record to `76.76.21.21`)
4. Wait for DNS to propagate (5–60 min)
5. Vercel auto-issues a TLS cert via Let's Encrypt

After the custom domain is live, update `NEXTAUTH_URL` in Vercel env vars
to match (e.g. `https://locinsights.bayhaqy.my.id`).

### 2.4 Configure cron

The `vercel.json` already declares the cron:

```json
"crons": [{ "path": "/api/cron/anti-sleep", "schedule": "*/15 * * * *" }]
```

Vercel crons run on the free plan with a 2-week daily limit. The anti-sleep
cron pings:
- The HF Space `/health` endpoint
- Supabase `SELECT 1`

No `CRON_SECRET` is set by default — the endpoint is read-only and harmless.

### 2.5 Deploy

Push to `main` → Vercel auto-builds and deploys. The first deploy will:

1. Run `bun install` (or `npm install`)
2. Run `prisma generate` (regenerates Prisma client from `schema.prisma`)
3. Run `next build` (compiles all routes, generates static pages where possible)
4. Deploy the standalone output to Vercel's edge network

Production URL after custom domain: **https://locinsights.bayhaqy.my.id**

## 3. Seed data

After the first successful deploy, seed the SaaS layer so you can actually
log in.

### 3.1 Seed users (`bun run seed:users`)

This script creates:
- **1 default tenant**: `tnt_map_active_0001` (MAP Active Adiperkasa,
  plan=`internal`, region_scope=`['bali']`, max_users=50)
- **6 system roles** with default permission matrices: `superadmin`,
  `admin`, `tenant_admin`, `data`, `analyst`, `viewer`
- **4 default users**:

| Username | Default password | Role | Tenant |
|---|---|---|---|
| `bayhaqy` | `LocInsights@01!!` | superadmin | (platform-wide, `tenant_id=NULL`) |
| `admin_map` | `admin_map` | admin | MAP Active Adiperkasa |
| `data_map` | `data_map` | data | MAP Active Adiperkasa |
| `demo_map` | `demo_map` | viewer | MAP Active Adiperkasa |

Run locally (requires `DATABASE_URL` in `.env.local`):

```bash
bun run seed:users
```

Or with arguments:

```bash
bun run seed:users --reset-password             # reset all 4 passwords to defaults
bun run seed:users --password=admin_map --new-pass=secret123   # reset one user's password
```

**Rotate these passwords immediately in any non-local environment** via
the Users Management UI (Reset Password dialog). The defaults are documented
in `scripts/seed-users.ts` and should not be used in production.

### 3.2 Seed Bali data (`bun run seed`)

This script seeds the shared reference data + the default tenant's master
data: 1 country, 1 province, 9 kabupaten, 48 kecamatan, 172 kelurahan,
27 MAA/MAP brands, 18 malls, 25 POIs.

```bash
bun run seed
```

### 3.3 Seed docs (`bun run scripts/seed-docs.ts`)

This script reads `/docs/*.md` (the markdown source files in this repo) and
upserts DB `Doc` rows by slug. Idempotent — safe to re-run.

```bash
bun run scripts/seed-docs.ts
```

After running, all 6 markdown files (`ARCHITECTURE.md`, `CHANGELOG.md`,
`DATA_MODEL.md`, `DEPLOYMENT.md`, `SCRAPER.md`, `USER_GUIDE.md`) are
migrated to DB rows with slug, title, category, order, and content. The
`/docs` page in the app will render these from PostgreSQL.

## 4. Hugging Face Space setup (optional)

The HF Space is a **standalone ML explorer** — analysts can run ad-hoc
predictions outside the main app. It is NOT in the production request path.

### 4.1 Create the Space

1. Go to https://huggingface.co/new-space
2. Name: `LocInsights_ml`
3. SDK: **Static** (free, no compute quota needed)
4. License: Apache-2.0

### 4.2 Push the code

```bash
cd hf-space/LocInsights_ml
git remote add origin https://huggingface.co/spaces/<you>/LocInsights_ml
git push -u origin main
```

HF auto-rebuilds on every push. The Space is served at:
`https://<you>-locinsights-ml.static.hf.space`

### 4.3 Verify

Open the Space URL — should show the LocInsights ML Engine UI with:
- Health Check tab (Supabase connection status)
- Predict Site Score tab
- Find Blank Spots tab
- Train GBR Model tab (in-browser scikit-learn via Pyodide)
- Data Explorer tab
- About tab

## 5. Anti-sleep cron

Both Supabase and HF Spaces have idle-shutdown behaviors on free tiers:

- **Supabase**: Free-tier project pauses after 7 days of inactivity
- **HF Spaces**: Free static Spaces don't sleep (no compute quota needed)

The `/api/cron/anti-sleep` endpoint runs every 15 min and:
1. `SELECT 1` on Supabase (keeps connection pool warm)
2. `GET /health` on the HF Space (verifies it's alive)
3. Logs the result

If the HF Space goes down, the main app continues to work — it has its own
in-process TypeScript ML engine as a fallback.

## 6. Local development

### 6.1 Prerequisites

- **Bun ≥ 1.3** (preferred) or Node.js ≥ 20
- A Supabase project (or local Postgres + PostGIS — see below)
- `openssl` CLI (for generating `NEXTAUTH_SECRET`)

### 6.2 Local Postgres alternative

If you want a local DB instead of Supabase:

```bash
docker run -d --name locinsights-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=locinsights \
  -p 5432:5432 \
  postgis/postgis:15-3.4

# Set .env.local:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/locinsights"
# DIRECT_URL="postgresql://postgres:postgres@localhost:5432/locinsights"
# NEXTAUTH_SECRET="<openssl rand -base64 32>"
# NEXTAUTH_URL="http://localhost:3000"

# Apply migrations:
psql $DATABASE_URL -f ../Locinsights_db/migrations/0001_init_extensions_and_enums.sql
psql $DATABASE_URL -f ../Locinsights_db/migrations/0002_master_data.sql
# ... continue for 0003-0009
```

### 6.3 Install + run

```bash
bun install
bun run db:generate      # Generate Prisma client
bun run db:push          # Push schema (alternative to migrations)
bun run seed             # Seed Bali data
bun run seed:users       # Seed SaaS layer (tenants + users + roles)
bun run scripts/seed-docs.ts   # Migrate docs to DB
bun run dev              # http://localhost:3000
```

After `bun run dev`, visit:
- `http://localhost:3000/` — public marketing landing page
- `http://localhost:3000/login` — sign in with `bayhaqy` / `LocInsights@01!!`
- `http://localhost:3000/dashboard` — protected (redirects to /login if not authed)

## 7. CI/CD

Currently using Vercel's GitHub integration (auto-deploy on push to `main`).

For a more robust CI pipeline, add a GitHub Action:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test"
      DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/test"
      NEXTAUTH_SECRET: "test-secret-not-for-production"
      NEXTAUTH_URL: "http://localhost:3000"
    services:
      postgres:
        image: postgis/postgis:15-3.4
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run build
```

## 8. Tenant onboarding flow

When a new SaaS customer signs up (Skema A or B), follow this flow to
provision their tenant.

### 8.1 Create the tenant record

As superadmin in the Users Management UI (Tenants tab → "New Tenant"):

1. Fill in the form:
   - **Name**: Customer's company name (e.g. "Retail Brands Indonesia")
   - **Slug**: URL-safe identifier (e.g. `retail-brands-indonesia`)
   - **Plan**: `saas_monthly`, `saas_yearly`, `enterprise_onprem`,
     `trial`, or `internal`
   - **Status**: `provisioning` initially (will switch to `active` after
     onboarding completes)
   - **Region scope**: multi-select the provinces the tenant has access to
     (e.g. `bali`, `jakarta`)
   - **White-labeling**: `app_name`, `logo_url`, `primary_color`,
     `accent_color` — leave at defaults for non-white-labeled tenants
   - **Contact**: `contact_name`, `contact_email`, `contact_phone`
   - **Limits**: `max_users` (default 10), `max_api_calls_per_day`
     (default 10000)
   - **Trial**: `trial_ends_at` if plan=`trial`
2. Click "Create" → POST `/api/admin/tenants` → row created in `tenants`
   table.

### 8.2 Create the tenant_admin user

In the same UI, switch to the Users tab → "New User":

1. Fill in the form:
   - **Username**: e.g. `admin_rbi` (must be unique across the platform)
   - **Email**: e.g. `it@retailbrands.co.id`
   - **Display name**: e.g. "RBI Admin"
   - **Password**: a strong temporary password (the user will use Reset
     Password later if needed)
   - **Role**: `tenant_admin`
   - **Tenant**: select the tenant you just created (superadmin-only field)
   - **Is active**: `true`
2. Click "Create" → POST `/api/admin/users` → row created in `users`
   table with `tenant_id` set to the new tenant's id.

### 8.3 Hand off credentials to the customer

Share the following with the customer's designated tenant_admin:
- Production URL: `https://locinsights.bayhaqy.my.id`
- Their username + temporary password
- Instruction to change their password after first login (via Users
  Management → Users tab → Reset Password on their own row, OR via
  `bun run seed:users --password=<username> --new-pass=<newpassword>` if
  they prefer to send the new password through support)

### 8.4 (Optional) Create additional users

The tenant_admin can now create additional users within their own tenant
via the Users Management UI (their access is scoped to their own tenant
automatically by the JWT claim + RLS + Prisma `tenantFilter`).

### 8.5 (Optional) Provision add-ons (Skema C)

If the customer purchased any Skema C add-ons (region expansion, custom
scraper, API connector, UI customization), create `TenantAddon` records
via the Tenants tab → tenant detail panel → "Add Add-on" button. Each
addon record tracks:
- `addon_type` (enum)
- `addon_config` (JSON — type-specific config, e.g.
  `{ province: 'jakarta' }` for region_expansion)
- `expires_at` (NULL for perpetual)
- `is_active` (true/false)

### 8.6 Switch tenant status to `active`

Once the tenant_admin has successfully logged in and confirmed they can
see their tenant's data, switch the tenant's status from `provisioning`
to `active` via the Tenants tab → Lock/Unlock icon (which toggles between
`active` and `suspended`) or the Edit dialog (which allows setting any
status). The `suspended_at` / `terminated_at` timestamps are auto-managed
by the PUT endpoint based on the new status.

## 9. Monitoring

- **Vercel Analytics** — auto-enabled via `@vercel/analytics` package.
  Visible in Vercel Dashboard → Analytics. Free tier covers PoC traffic.
- **Supabase Logs** — Dashboard → Logs → Postgres logs (slow queries,
  RLS policy denials)
- **Audit logs in-app** — Users Management → Audit tab. Filterable by
  user, action, date range. Superadmin sees all; tenant_admin sees own
  tenant only.
- **Sentry** — not configured yet (add `@sentry/nextjs` if needed)

### RLS policy denial monitoring

If a user reports "I can't see my data", check the Supabase Postgres logs
for `permission denied` or rows being silently filtered. Common causes:

1. `setTenantContext()` failed silently (PgBouncer transaction mode) —
   check Vercel function logs for `[tenant-context] Failed to set RLS
   context (non-fatal, app-layer filter will apply)` warnings.
2. User's JWT has stale `tenant_id` (post-tenant-merge) — instruct the
   user to log out and back in.
3. Data was inserted without `tenant_id` (NULL) — only superadmin in
   platform-wide mode can see NULL-tenant rows.

## 10. Backup

Supabase free tier does daily automatic backups (7-day retention). For
additional safety, use the `backup.sh` script in `Locinsights_db/scripts/`:

```bash
# Set these env vars first:
# SUPABASE_DB_URL=postgresql://...
# BACKUP_DIR=/backups/locinsights

./Locinsights_db/scripts/backup.sh
```

This dumps the full DB to a timestamped `.sql.gz` file. Schedule via cron.

For Skema B (Enterprise On-Premise) deployments, the customer is
responsible for their own backup strategy — typically `pg_dump` scheduled
nightly with off-site replication to a secondary region.
