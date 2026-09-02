---
title: User Guide
category: User
order: 100
---

# User Guide

> How to use LocInsights v5.0.0 — the multi-tenant SaaS location-intelligence
> platform. Covers login, navigation, tenant switching, Users Management,
> documentation editing, and role-based access. For architecture and
> deployment, see [`ARCHITECTURE.md`](ARCHITECTURE.md) and
> [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 1. Logging in

### 1.1 Open the login page

Visit **https://locinsights.bayhaqy.my.id/login** in your browser. The login
page uses a split-screen layout:

- **Left side**: Marketing showcase — LocInsights value proposition, key
  capabilities, and pricing tiers (Skema A / B / C).
- **Right side**: Login form (username + password).

### 1.2 Enter credentials

Enter the username and password provided by your LocInsights administrator.
Usernames are case-sensitive. Passwords are case-sensitive.

If you don't have credentials, contact your tenant administrator (the
person who provisioned your account). If you don't know who that is,
contact `bayhaqy@locinsights.local` and mention your organization name.

### 1.3 Default credentials (development only)

For local development or the demo deployment, the following default users
are seeded by `bun run seed:users`:

| Username | Password | Role | What you can see |
|---|---|---|---|
| `bayhaqy` | `LocInsights@01!!` | superadmin | All tenants' data (platform-wide) + Users Management |
| `admin_map` | `admin_map` | admin | MAP Active Adiperkasa data only |
| `data_map` | `data_map` | data | MAP Active Adiperkasa — can edit data + run scrapers |
| `demo_map` | `demo_map` | viewer | MAP Active Adiperkasa — read-only |

**Rotate these passwords immediately** in any non-local environment via
the Users Management UI (Reset Password dialog).

### 1.4 Login failure handling

The login form shows inline error messages for common failure cases:

- **"Invalid username or password"** — wrong credentials. After 5 failed
  attempts from the same IP, the IP is rate-limited for 15 minutes.
- **"Account is locked. Try again in X minutes"** — your account hit 5
  failed password attempts; it's now DB-locked for 15 minutes. Contact
  your administrator to reset the lockout (Users Management → Users tab →
  Reset Lockout icon).
- **"Account is inactive"** — your `is_active` flag is `false`. Contact
  your administrator.

All login attempts (success and failure) are written to the audit log
with the IP address and a reason code.

### 1.5 After successful login

You will be redirected to `/dashboard` (or to the `?callbackUrl=` value if
you were sent to `/login` from a protected route). The JWT cookie is set
for 30 days and refreshed every 24 hours.

## 2. Navigation

### 2.1 The sidebar

The left sidebar (`<Sidebar>` component) lists up to **17 menus**, filtered
by your role's permission matrix. You only see menus where your role has
`read: true`. The menus are grouped as follows:

**Analytics** (visible to most roles):
- Dashboard — KPIs and overview
- Map Explorer — choropleth + scatter plot of stores
- Opportunity Finder — ranked kelurahan list
- Deep Analysis — per-kelurahan deep dive

**Brand & Market Intelligence**:
- Brand Coverage — tenant's brand portfolio + gap analysis
- Malls — mall directory
- Mall Tenants — mall tenant audit
- Competitor Intel — tracked competitors

**Decision Tools**:
- A/B Site Simulator — compare two candidate sites
- ML / AI Engine — GBR revenue forecasting + training pipeline
- Reports — export PDF / CSV / JSON

**Data Operations**:
- Data Manager — CRUD master data with inline editing
- Data Scraper — unified OSM scraper with review workflow
- Methodology — transparent scoring rubric + math

**Reference**:
- Documentation — DB-backed docs (in-app)
- About — project context, data sources, FAQ

**Admin**:
- Users Management — 4-tab admin panel (only for superadmin / tenant_admin)
- Settings — per-tenant settings (white-labeling, etc.)

Click any menu to navigate. The current menu is highlighted in brand red.
The sidebar can be collapsed via the panel toggle in the header.

### 2.2 The header

The header (top bar) contains:

- **Sidebar toggle** (left) — collapse / expand the sidebar
- **Breadcrumb** — current page label (i18n-aware: English / Indonesian)
- **Language switcher** — toggle EN / ID translations
- **Tenant switcher** — dropdown showing the current tenant; superadmin can
  switch to any active tenant (see [§3 Tenant switching](#3-tenant-switching))
- **User menu** — shows your display name + role; dropdown with "Sign out"

### 2.3 The AI chat assistant

A floating chat bubble in the bottom-right corner opens the AI assistant
(powered by Z.AI). The assistant can answer questions about LocInsights
features, explain methodology, and help with site-selection decisions.
Type your question and press Enter. The assistant's context is scoped to
your tenant's data where applicable.

### 2.4 Mobile

The app is responsive — on mobile screens, the sidebar collapses to a
hamburger menu, the TOC rail (in Documentation) hides, and the AI chat
remains accessible as a floating bubble.

## 3. Tenant switching

### 3.1 Who can switch tenants

Only **superadmin** can switch tenants. All other roles are locked to
their own tenant and the Tenant Switcher dropdown shows only their
current tenant (greyed out, not selectable).

### 3.2 How to switch

1. Click the **Tenant Switcher** dropdown in the header (top-right area,
   next to the user menu).
2. A list of all active tenants appears, showing each tenant's name,
   slug, plan, status, and region scope.
3. Click the tenant you want to switch to.
4. The client calls `POST /api/auth/switch-tenant` to validate the switch.
   If validation passes, the JWT is updated client-side via next-auth's
   `update()` method, and `router.refresh()` reloads all server components.
5. The URL **stays the same** (e.g. `/dashboard`) — only the data context
   changes.

### 3.3 Platform-wide mode

Superadmin can also switch to "Platform-wide" mode (the first option in
the dropdown, labelled with the LocInsights logo). In this mode:

- `tenant_id` in the JWT is `NULL`
- RLS policies allow reads across ALL tenants (the empty-string sentinel)
- The Dashboard shows aggregated KPIs across all tenants
- The Users Management → Users tab shows users from ALL tenants

Platform-wide mode is useful for cross-tenant analytics and for
administering tenants themselves (creating new tenants, suspending a
tenant, etc.). Switch back to a specific tenant when you need to perform
tenant-scoped mutations (creating a user in that tenant, editing that
tenant's brands, etc.) — the Prisma app-layer filter enforces the
selected tenant_id on INSERT via `withTenantId()`.

### 3.4 Switching back

To switch back to a specific tenant, just select it from the dropdown
again. There is no "undo" button — switching is fast and freely
reversible.

## 4. Users Management

Accessible at `/users`. **Restricted to superadmin, tenant_admin, and
admin roles** (superadmin sees all tenants; tenant_admin and admin see
only their own tenant).

The Users Management UI has **4 tabs**: Tenants, Users, Roles, Audit Log.

### 4.1 Tenants tab (superadmin only)

Lists all tenants in a 7-column table: Name, Slug, Plan, Status, Region
Scope, Users (count), Add-ons (count), and Actions.

**Actions per tenant**:
- **Edit** (pencil icon) — opens a dialog with all tenant fields:
  - Basic: name, slug, plan, status, region_scope (multi-select buttons)
  - White-labeling: app_name, logo_url, primary_color, accent_color
    (each color has a `<input type="color">` picker + hex text input)
  - Contact: contact_name, contact_email, contact_phone, notes
  - Limits: max_users, max_api_calls_per_day, trial_ends_at
  - Audit: created_at, updated_at, created_by (read-only)
- **Lock/Unlock** (lock icon) — toggles status between `active` and
  `suspended`. The PUT endpoint auto-manages `suspended_at` /
  `terminated_at` timestamps.
- **Delete** (trash icon) — confirms with an AlertDialog, then DELETE.
  Tenant deletion CASCADE-deletes all tenant-scoped data (stores, malls,
  etc.) — use with caution.

**"New Tenant" button** (top-right) — opens the same dialog as Edit, but
empty. See [DEPLOYMENT.md §8 Tenant onboarding flow](DEPLOYMENT.md) for
the full procedure.

**Tenant detail panel** — clicking a tenant row expands an inline detail
panel showing the tenant's full record + add-on list + StatBox cards
for current user count vs max_users, current API call count vs
max_api_calls_per_day, and trial expiry countdown.

### 4.2 Users tab

Lists users in a 9-column table: Username, Display Name, Email, Role,
Tenant, Status, Last Login, Failed Login Count, Actions.

**Filters** (above the table):
- Tenant dropdown (superadmin only — tenant_admin sees only their own)
- Role dropdown
- Active state (active / inactive / all)
- Search (matches username, email, display name)

**Actions per user**:
- **Edit** (pencil) — opens dialog with display_name, email, role, tenant
  (superadmin only), is_active. No password field — that's a separate
  "Reset Password" action.
- **Reset Password** (key icon) — opens dialog with new password input
  (show/hide toggle) and a note that this will clear any active lockout.
- **Reset Lockout** (unlock icon) — only visible when
  `failed_login_count > 0` or `locked_until > now`. Clears the lockout
  counters and unlocks the account immediately.
- **Delete** (trash icon) — confirms with AlertDialog. Disabled for the
  current user (with tooltip "You cannot delete your own account") and
  for the last active superadmin (server enforces).

**Create User dialog** — username, email, display_name, password, role
dropdown, tenant dropdown (superadmin only), is_active switch. On
submit, the password is bcrypt-hashed (10 rounds) server-side.

**Visual cues**:
- The current user's row gets an amber background tint + "you" badge.
- A "Locked" badge appears when `locked_until > now`.

### 4.3 Roles tab

Lists roles in a card grid. Each card shows:
- Role ID (e.g. "superadmin")
- Role name (e.g. "Superadmin")
- System / Tenant-scoped badge (system roles have a "SYSTEM" badge;
  tenant-scoped custom roles show "Tenant: <name>")
- User count (how many users have this role)
- Permission count (X/85 — number of `true` cells in the matrix)

**Expand chevron** — reveals an inline read-only `PermissionMatrixView`
showing all 85 cells as checkmarks (✓) for granted and X marks (✗) for
denied. Sticky header row + sticky left column.

**Edit** (pencil icon) — opens a dialog with the interactive
`PermissionMatrixEditor`:
- 17×5 grid of checkboxes
- Sticky left column with per-row "Select All" checkbox (toggles all 5
  actions for one menu)
- Sticky header row with per-column "Select All" checkbox (toggles all
  17 menus for one action)
- Top-left master "Select All" checkbox (toggles all 85 cells)
- Save button calls `PUT /api/admin/roles/[id]` with the new
  `permissions` JSON.

**Permission rules**:
- System roles (`superadmin`, `admin`, `tenant_admin`, `data`, `analyst`,
  `viewer`) — only superadmin can edit their permissions.
- Tenant-scoped custom roles — tenant_admin can edit (within own tenant).
- System roles cannot be deleted (DELETE returns 409 "System roles
  cannot be deleted").
- Roles with assigned users cannot be deleted (DELETE returns 409 "Role
  has N users assigned — reassign them first").

### 4.4 Audit Log tab

Lists `user_audit_logs` entries in a paginated table: Timestamp, User
(target), Actor, Action, IP Address, Details.

**Filters**:
- Tenant dropdown (superadmin only)
- User search (by username)
- Action filter (free-text, matches the `action` column)
- Date range (from / to)

**Action types** you'll see:
- `login` — every login attempt (success or failure). Details include
  `reason` (`success`, `invalid_password`, `account_locked`,
  `user_not_found`, `user_inactive`, `ip_rate_limited`) and
  `attempt_count` for failures.
- `user.create`, `user.update`, `user.delete` — admin mutations on
  users. Details include the changed fields.
- `user.reset_password`, `user.reset_lockout` — admin password/lockout
  resets.
- `role.create`, `role.update`, `role.delete` — role mutations.
- `tenant.create`, `tenant.update`, `tenant.suspend`, `tenant.terminate`
  — tenant mutations.

Superadmin sees ALL audit logs. Tenant_admin sees only logs for users
in their own tenant (the `WHERE user.tenant_id = own_tenant` filter
applies — the user join is required because `user_audit_logs` only
has `user_id`, not `tenant_id`).

## 5. Documentation editing

Accessible at `/docs`. **Visible to all authenticated users** with
`read` permission on the `docs` menu. Edit/create/delete requires
`create` / `update` / `delete` permissions respectively (granted to
superadmin, admin, and tenant_admin by default).

### 5.1 Browsing docs

The `/docs` page has a 3-column layout:

- **Left sidebar (260px)** — search box + file tree grouped by category.
  Each category is collapsible (chevron + folder icon + count badge).
  Each doc shows title + last_updated date + system/tenant indicator.
  Active doc is highlighted with brand-red background.
- **Main panel (flex)** — view mode or edit mode (see below).
- **Right TOC rail (220px, sticky on lg+)** — auto-generated table of
  contents from the doc's H2 and H3 headings. Each entry is a button
  that `scrollIntoView`s the matching heading anchor. Hidden on small
  screens.

System docs (those with `tenant_id IS NULL`) are public — they show up
on the marketing landing page too. Tenant docs (with `tenant_id = your
tenant`) are only visible within your tenant.

### 5.2 Reading a doc

Click any doc in the left sidebar to open it. The main panel shows:
- **Header**: title, category badge, system/tenant badge, draft badge
  (if unpublished), updated date, owner, slug.
- **Action buttons** (top-right): Edit (if you have update permission),
  Delete (if you have delete permission), Print (window.print()).
- **Body**: rendered markdown with brand-styled elements (cream
  backgrounds for inline code, ink backgrounds for code blocks with
  github.css highlight.js theme, red accents for links and blockquote
  borders, etc.). Tables, lists, blockquotes, images, and all standard
  markdown features are supported (via react-markdown + remark-gfm +
  rehype-raw + rehype-highlight).

### 5.3 Editing a doc

Click the Edit button. The main panel switches to **split-pane edit mode**:

- **Left pane**: textarea with the raw markdown.
- **Right pane**: live preview rendered with the same ReactMarkdown
  components as view mode.
- **Top metadata bar**: Title, Category (datalist autocomplete from
  existing categories), Owner, Order (integer for sort within category).
- **Live char count + heading count** at the bottom of the textarea.
- **Auto-save**: every 5 seconds, the current content is saved to
  `localStorage` under the key `locinsights.doc.draft.[slug]`. On
  re-entering edit mode for a doc with a saved draft, you'll see a
  prompt to restore or discard.

Click **Save** to write to the DB (`PUT /api/docs/[slug]`). The draft in
`localStorage` is cleared on success. Click **Cancel** to discard
unsaved changes (with a confirm prompt).

### 5.4 Creating a new doc

Click the **"New Doc"** button in the sidebar header (visible only to
admin roles). The create dialog has:
- **Title** — display title (required).
- **Slug** — auto-generated from title via slugify (editable; validates
  against `/^[a-z0-9-]+$/`).
- **Category** — free-text with datalist autocomplete from existing
  categories.
- **Owner** — defaults to your username.
- **Order** — integer for sort within category (defaults to 100).
- **Content** — textarea for the markdown body.

On submit, `POST /api/docs` creates the row. **Tenant resolution**:
superadmin can create system docs (`tenant_id = NULL`) or tenant-scoped
docs (with explicit `tenant_id`). Tenant_admin and admin are forced to
their own tenant — they cannot create system docs.

### 5.5 Deleting a doc

Click the Delete button. An AlertDialog confirms: "Are you sure you want
to delete '<title>'? This cannot be undone."

**Permission rules**:
- System docs (`tenant_id = NULL`) — **only superadmin** can delete.
- Tenant docs — superadmin OR tenant_admin/admin within the same tenant.

If you lack permission for a specific doc, the Delete button is hidden
entirely (defense-in-depth with the server-side 403 check).

### 5.6 DB-backed storage (no filesystem)

All doc CRUD goes through Prisma → PostgreSQL. The filesystem is never
touched in the request path. This fixes a long-standing bug where
`fs.writeFile` threw `EACCES` on Vercel's read-only serverless FS,
returning empty bodies that broke the client's JSON parser.

The `/docs/*.md` files in this repo are the **source of truth** — they
are migrated into the DB by `scripts/seed-docs.ts` (a one-shot tool run
manually after doc updates). After editing any `.md` file, re-run:

```bash
bun run scripts/seed-docs.ts
```

to sync the changes to the database. The script is idempotent (upserts
by slug).

## 6. Role-based access

The 6 system roles have different default permission matrices. Below is
a summary; for the full 85-cell matrix per role, see the Users Management
→ Roles tab (expand any role card).

### 6.1 superadmin

- **Scope**: platform-wide (no `tenant_id`) — sees all tenants' data.
- **Menus**: all 17 (including Users Management).
- **Actions**: full CRUD + export on every menu.
- **Special powers**:
  - Create / edit / suspend / delete tenants
  - Create / edit / delete system roles (and their permissions)
  - Create / edit / delete system docs (those with `tenant_id = NULL`)
  - Switch between any active tenant + platform-wide mode
  - See all audit logs across all tenants
  - Cannot delete own account (server-enforced 409)
  - Cannot delete or demote the last active superadmin (server-enforced 409)

### 6.2 admin

- **Scope**: own tenant only (RLS + Prisma filter).
- **Menus**: 16 of 17 (all EXCEPT Users Management).
- **Actions**: full CRUD + export on all 16 visible menus.
- **Cannot**: manage users, manage tenants, edit system roles/docs, see
  audit logs, switch tenants.

### 6.3 tenant_admin

- **Scope**: own tenant only.
- **Menus**: all 17 (including Users Management).
- **Actions on domain menus (16)**: full CRUD + export.
- **Actions on Users Management**: read + create + update + delete users
  **within own tenant**. No export.
- **Can**:
  - Create / edit / delete users within own tenant
  - Reset passwords + reset lockouts for own-tenant users
  - Create / edit / delete **tenant-scoped custom roles** (roles with
    `is_tenant_scoped=true` and `tenant_id=own`)
  - Edit permissions of tenant-scoped custom roles
  - See audit logs for own-tenant users only
  - Create / edit / delete **tenant-scoped docs** (docs with
    `tenant_id=own`)
- **Cannot**:
  - Create / edit tenants themselves (superadmin only)
  - Edit system roles (superadmin only)
  - Edit system docs (superadmin only)
  - Switch tenants (locked to own tenant)
  - See cross-tenant audit logs

### 6.4 data

- **Scope**: own tenant only.
- **Menus**: 16 of 17 (all EXCEPT Users Management).
- **Actions**:
  - Full CRUD + export on: `reports`, `data`, `scraper`
  - Read-only on all other visible menus
- **Use case**: data engineers / data stewards who maintain the master
  data and run scrapers but don't need analytics or admin powers.

### 6.5 analyst

- **Scope**: own tenant only.
- **Menus**: 16 of 17 (all EXCEPT Users Management).
- **Actions**:
  - Read + export on: `ml`, `ab`, `analysis`
  - Read-only on all other visible menus
- **Use case**: retail analysts who consume dashboards, run ML
  predictions, and export reports but don't edit master data.

### 6.6 viewer

- **Scope**: own tenant only.
- **Menus**: 16 of 17 (all EXCEPT Users Management).
- **Actions**: read-only everywhere. **No exports**.
- **Use case**: stakeholders / executives who need to view dashboards
  but not modify data or export (e.g. for compliance reasons).

### 6.7 Tenant-scoped custom roles

In addition to the 6 system roles, tenant_admin can create **custom
roles** scoped to their own tenant. These roles can have any combination
of the 85 permission cells — useful for fine-grained access like "read
Map + read Opportunities + export Reports" for a regional manager.

Custom roles:
- Have a unique string `id` (e.g. `regional_manager_bali`)
- Have `is_system = false` and `is_tenant_scoped = true`
- Have `tenant_id` set to the tenant_admin's own tenant
- Can be assigned to users via the Users tab → Edit dialog → Role
  dropdown (which lists system roles + own tenant's custom roles)
- Can be deleted only if no users are assigned (server enforces)

## 7. Troubleshooting

### 7.1 "I can't log in"

1. Check your username and password (case-sensitive).
2. Wait 15 minutes if your IP is rate-limited (5 failed attempts).
3. Ask your administrator to check `failed_login_count` and `locked_until`
   in the Users tab — they can use the Reset Lockout action to unlock
   your account immediately.
4. If your account shows "inactive", ask your administrator to toggle
   `is_active` back to true via the Edit dialog.

### 7.2 "I can't see my tenant's data"

1. Check the Tenant Switcher in the header — make sure you're switched to
   the correct tenant (superadmin in platform-wide mode sees all data;
   other roles are locked to their own tenant).
2. Log out and log back in — your JWT may have a stale `tenant_id` from
   a previous tenant merge or rename.
3. If you're a superadmin in platform-wide mode and STILL can't see
   data, check that the data's `tenant_id` is not NULL — only
   platform-wide mode can see NULL-tenant rows; tenant-scoped queries
   filter them out.
4. Contact support if the issue persists — there may be an RLS policy
   misconfiguration (see `docs/ARCHITECTURE.md` → RLS policy catalog).

### 7.3 "I can't access the Users Management page"

Users Management (`/users`) is restricted to `superadmin`, `tenant_admin`,
and `admin` roles. If you have a different role (`data`, `analyst`,
`viewer`), the menu won't appear in your sidebar, and direct navigation
to `/users` will be denied by the `<PermissionGate>` wrapper.

Ask your administrator to upgrade your role if you need access.

### 7.4 "Documentation page is empty"

If `/docs` shows no documents:
1. The seed script may not have been run. Run `bun run scripts/seed-docs.ts`
   locally (or ask an admin to do so).
2. You may be filtering by a category with no docs — clear the search box
   and any category filter.
3. The docs may be unpublished (draft). Only admin roles can see
   unpublished docs — ask an admin to publish them via the Edit dialog.
4. If you're a tenant_admin, you may be switched to a tenant that has no
   tenant-scoped docs. Switch to "Platform-wide" mode (superadmin only)
   to see system docs.

### 7.5 "My edits to a doc didn't save"

1. Check your internet connection — the Save button calls the API
   synchronously and shows a toast on failure.
2. If you see "Empty response from server", the route handler may have
   crashed. Check Vercel function logs.
3. Your draft is auto-saved to `localStorage` every 5 seconds — re-enter
   edit mode and you should see a "Restore draft?" prompt.
4. If you lack update permission for the specific doc (e.g. tenant_admin
   trying to edit a system doc), the Edit button will be hidden. This is
   intentional — system docs are superadmin-only.

## 8. Getting help

- **In-app**: Click the AI chat bubble (bottom-right) and ask "How do I…?"
- **Email**: `bayhaqy@locinsights.local` — Data Team, MAP Active Adiperkasa
- **Audit trail**: If you believe an unauthorized change was made to
  your account or data, ask your administrator to check the Audit Log
  tab in Users Management. Every login and admin mutation is recorded
  with timestamp, actor, IP, and details.
- **Source code**: https://github.com/bayhaqy/LocInsights
- **DB migrations**: https://github.com/bayhaqy/Locinsights_db

For Skema A (Managed SaaS) customers, support is included in the
subscription — email priority support is available during business hours
(Jakarta time, GMT+7). For Skema B (Enterprise On-Premise) customers,
support is provided under the AMC (Annual Maintenance Contract) — see
your license agreement for SLA details.
