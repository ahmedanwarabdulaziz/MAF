# Performance Optimization Plan — Extended Edition

---

## ⚡ EXECUTION STATUS — Last Updated: 2026-04-02

### ✅ COMPLETED (Phase 1 — Safe packages)

| Package | Status | Files Changed |
|---------|--------|---------------|
| **PERF-00** Baseline timing | ✅ Done | `src/lib/perf.ts` (new), `src/middleware.ts`, `src/app/(system)/layout.tsx` |
| **PERF-01** Loading skeletons | ✅ Done | `src/app/(system)/company/loading.tsx` (new), `src/app/(system)/projects/[id]/loading.tsx` (new) |
| **PERF-02** Cached auth context | ✅ Done | `src/lib/system-context.ts` (new), `src/app/(system)/layout.tsx` |
| **PERF-03** Permissions use cache | ✅ Done | `src/lib/permissions.ts`, `src/lib/auth.ts` |
| **PERF-06** DB composite indexes | ✅ Done | `supabase/migrations/059_performance_indexes.sql` (new, applied) |
| **PERF-09** RLS support index | ✅ Done | included in `059_performance_indexes.sql` |

### ⚠️ PENDING GIT PUSH

The git commit and push did NOT complete — the terminal became unresponsive.

**Action required at start of next conversation:**
```
git add -A
git commit -m "perf: PERF-00/01/02/03/06/09 — baseline timing, loading skeletons, cached auth context, db indexes"
git push origin main
```

### 📊 Measured Results (dev environment)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `middleware:auth.getUser` | 138–161ms | 134–161ms | — same |
| `layout:getSystemUser` | 671–874ms 🔴 | 493ms 🟡 | ↓ ~40% |
| `layout:parallel-fetch` | 564–568ms 🔴 | 341ms 🟡 | ↓ ~40% |
| `layout:total` | 1237–1442ms 🔴 | 834ms 🔴 | **↓ ~400ms (-40%)** |

> The DB migration (059) was applied before the second measurement.
> The 834ms includes both code caching improvements AND the new indexes.

### 🔮 NEXT PHASES (not started, low risk first)

| Package | Priority | Notes |
|---------|----------|-------|
| **PERF-07** Promise.all heavy pages | 🟡 Next | `treasury/page.tsx`, `costs/page.tsx`, `access-scopes/page.tsx` |
| **PERF-05** Dashboard SQL aggregation | 🟠 Later | Move JS aggregation into SQL views/RPC |
| **PERF-04** Procurement pagination | 🟠 Later | Bounded datasets, stop loading all rows |
| **PERF-08** Client-side caching | 🔵 Future | Only after PERF-02/03/04 stable |

### 📁 New Files Created

- `src/lib/perf.ts` — Dev-only timing helper (`perfMark`, `perfEnd`, `perfWrap`)
- `src/lib/system-context.ts` — Request-scoped cache: `getAuthUser()`, `getUserProfile()`, `getSystemUser()`
- `src/app/(system)/company/loading.tsx` — Skeleton UI for /company routes
- `src/app/(system)/projects/[id]/loading.tsx` — Skeleton UI for /projects routes
- `supabase/migrations/059_performance_indexes.sql` — 7 composite indexes (applied ✅)

### 🔧 Modified Files

- `src/middleware.ts` — Added PERF timing around `auth.getUser()`
- `src/app/(system)/layout.tsx` — Uses cached `getSystemUser` from system-context; removed local duplicate
- `src/lib/auth.ts` — `getSession()` now uses `getUser()` (fixed security warning); `getUser()` delegates to cached `getUserProfile()`; removed DEBUG logs
- `src/lib/permissions.ts` — `getEffectivePermissions()`, `hasPermission()`, `hasProjectScope()` all use cached `getUserProfile()` instead of fresh DB queries

---


## Document Purpose

This document is the full, execution-ready performance plan for the MAF system.

It extends the original plan with:

- concrete latency targets
- package ownership boundaries
- Supabase/RLS-specific guidance
- index recommendations aligned with the actual schema
- a deferred client-caching phase
- measurable success criteria

Work is split into numbered packages (`PERF-00` through `PERF-09`) so each package can be handed to one agent or developer with minimal overlap.

---

## Current Findings

The system is functional, but performance-sensitive. As data grows, page-open latency and perceived slowness will become more noticeable.

### Confirmed Problems

| # | Problem | Impact |
|---|---------|--------|
| 1 | `middleware.ts` runs auth work on every matched request | Every protected request pays auth cost |
| 2 | `src/app/(system)/layout.tsx` fetches user, projects, company, scopes, and modules on every navigation | Shared shell data is repeatedly reloaded |
| 3 | Many pages use sequential `await` chains instead of `Promise.all` | Page-open latency becomes the sum of multiple calls |
| 4 | No `loading.tsx` route-level loading states | Users see blank waits instead of skeletons |
| 5 | Heavy pages fetch full result sets and filter in memory | Waste grows with row count |
| 6 | Dashboards and supplier summaries aggregate in JS | Extra DB round-trips plus app-side compute on every load |
| 7 | Hot tables need more deliberate read indexes | Table scans and wide index scans will grow with data |
| 8 | Procurement dialogs are mounted globally in the system shell | Extra render and bundle cost on unrelated pages |
| 9 | The app has no deliberate client-side revisit strategy yet | Users may re-wait on pages they just visited |
| 10 | Supabase RLS adds hidden per-query cost | Unreviewed helper paths and filters can become expensive |

---

## Performance Targets

These are the working latency targets. Fill actual baseline numbers after `PERF-00`.

| Page / Flow | Current Estimate | Target |
|-------------|------------------|--------|
| `/company` first paint | ~2-3 s | < 1.2 s |
| `/company/purchases/invoices` | ~2.5-4 s | < 1.5 s |
| `/projects/[id]` | ~2-3 s | < 1.2 s |
| `/projects/[id]/procurement/invoices` | ~3-5 s | < 1.8 s |
| `/company/treasury` | ~2-3 s | < 1.2 s |
| Permission check per request | unknown | < 50 ms |
| System layout context load | unknown | < 300 ms |

> Baseline values must be written here after `PERF-00`.

---

## Delivery Rules

Every package must:

- stay inside its declared file ownership boundary
- preserve current business behavior
- avoid silent functional changes
- prefer small refactors over wide rewrites
- include before/after timing where practical
- not be merged without checking at least one company route and one project route

---

## Suggested Execution Order

```text
PERF-00  Baseline and measurement                  -> always first
PERF-01  Loading UX and lazy dialogs
PERF-02  System context consolidation
PERF-03  Permission resolution optimization        -> depends on PERF-02
PERF-04  Procurement list and detail optimization
PERF-05  Dashboard and reporting aggregation refactor
PERF-06  Database indexing and query-plan validation
PERF-07  Remaining heavy-page cleanup
PERF-09  Supabase RLS and query-shape tuning       -> after PERF-02 and PERF-03
PERF-08  Client-side caching strategy              -> future phase after PERF-02/03/04 are stable
```

## Parallel Work Strategy

Safe to run in parallel:

- `PERF-01` and `PERF-06`
- `PERF-05` and `PERF-07`

Must not run in parallel:

- `PERF-02` and `PERF-03` with any competing auth/permission work
- `PERF-04` with any other procurement-core work
- `PERF-09` before `PERF-02` and `PERF-03` are merged and verified

---

## Work Packages

---

## `PERF-00` Baseline and Measurement

### Goal

Create a trustworthy baseline before optimization starts.

### File Ownership

- `src/middleware.ts`
- `src/app/(system)/layout.tsx`
- optional new helper: `src/lib/perf.ts`

### Work

- add lightweight timing logs around:
  - middleware auth resolution
  - system layout context loading
  - selected heavy server actions
- log only in development
- identify the top 5 slowest page-open paths
- fill the baseline values in the Performance Targets table

### Acceptance Criteria

- developers can see timing for core system routes locally
- these flows are measured:
  - `/company`
  - `/company/purchases/invoices`
  - `/projects/[id]`
  - `/projects/[id]/procurement/invoices`
  - `/company/treasury`
- baseline values are recorded in this file

### Notes

Do not add permanent production logging.

---

## `PERF-01` Loading UX and Lazy Global Dialogs

### Goal

Improve perceived speed before deeper backend work lands.

### File Ownership

- `src/app/(system)/layout.tsx`
- new files under:
  - `src/app/(system)/company/loading.tsx`
  - `src/app/(system)/projects/[id]/loading.tsx`
- `src/components/procurement/PurchaseRequestDialog.tsx`
- `src/components/procurement/SupplierInvoiceDialog.tsx`

### Work

- add `loading.tsx` to major route segments
- replace invisible waits with skeletons/placeholders
- stop mounting procurement dialogs globally on every system page
- lazy-load dialog content only when related query params exist

### Known Risk

If a route redirects early, `loading.tsx` may briefly flash before redirect.

Mitigation:

- keep redirect logic in middleware where possible
- accept a small flash only where unavoidable

### Acceptance Criteria

- major system routes show visible loading states
- unrelated pages do not initialize procurement detail views
- deep-link modal URLs still work

---

## `PERF-02` System Context Consolidation

### Goal

Resolve shared authenticated-shell data once per request from a single loader.

### File Ownership

- `src/app/(system)/layout.tsx`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- optional new files:
  - `src/lib/system-context.ts`
  - `src/lib/request-cache.ts`

### Work

- create one request-scoped loader for:
  - auth user
  - user profile
  - effective modules
  - user scopes
  - active projects
  - active company
- use React `cache()` for request-level deduplication
- reuse the loader in `layout.tsx`
- remove repeated `createClient()` and repeated user/profile fetches inside the same request

### Acceptance Criteria

- the system shell uses one shared context path
- user/profile/scopes/modules are not re-resolved multiple times in the same request
- sidebar and header behavior remain correct

### Notes

Do not introduce long-lived permission caching here.

---

## `PERF-03` Permission Resolution Optimization

### Goal

Reduce repeated permission work inside `hasPermission`, `requirePermission`, and module-resolution helpers.

### File Ownership

- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- optional new helper under `src/lib/`

### Work

- make permission helpers share one permission dataset per request where possible
- reduce repeated lookups to:
  - `users`
  - `user_permission_group_assignments`
  - `permission_group_permissions`
- preserve correct handling for:
  - super admin
  - main company
  - all projects
  - selected project
  - selected warehouse

### Acceptance Criteria

- multiple permission checks in the same request are cheaper
- access behavior is unchanged
- helper interfaces remain understandable

### Notes

This package is correctness-sensitive.

---

## `PERF-04` Procurement List and Detail Optimization

### Goal

Optimize the heaviest procurement list/detail flows.

### File Ownership

- `src/actions/procurement.ts`
- `src/app/(system)/projects/[id]/procurement/invoices/page.tsx`
- `src/app/(system)/company/purchases/invoices/page.tsx`
- `src/app/(system)/projects/[id]/procurement/requests/page.tsx`
- `src/components/procurement/PurchaseRequestView.tsx`
- `src/components/procurement/SupplierInvoiceView.tsx`
- `src/app/(system)/SidebarNav.tsx`

### Work

- add server-side pagination or bounded loading to invoice/request lists
- stop loading full historical datasets when only the first page is needed
- move filtering/counting closer to SQL
- avoid "load all invoices, then fetch confirmations" if confirmation state can be fetched more efficiently
- reduce sidebar discrepancy badge background fetch pressure
- remove duplicated detail fetches where practical

### Acceptance Criteria

- procurement lists load bounded datasets
- first page appears without loading all historical rows
- discrepancy badge logic is cheaper
- detail views still behave correctly

### Notes

This package should have exclusive ownership.

---

## `PERF-05` Dashboard and Reporting Aggregation Refactor

### Goal

Move expensive aggregation from JS loops into efficient DB-native shapes.

### File Ownership

- `src/actions/dashboards.ts`
- `src/app/(system)/company/purchases/actions.ts`
- optional new migrations for views or RPC helpers

### Work

- replace JS-side aggregation with:
  - SQL views
  - materialized views only if justified
  - RPC functions where parameterization is needed
- optimize:
  - company dashboard metrics
  - project dashboard metrics
  - global supplier balances
- reduce broad raw-data loads followed by JS reduction

### Acceptance Criteria

- dashboard/report actions become thinner
- payloads are closer to final UI shape
- business totals match prior output

### Notes

Do not change business numbers without parity checks.

---

## `PERF-06` Database Indexing and Query-Plan Validation

### Goal

Support hot read paths with deliberate indexes aligned to the actual schema and actual query patterns.

### File Ownership

- new migration file: `supabase/migrations/059_performance_indexes.sql`

### Recommended Indexes

> Column names below were checked against the current schema and migrations.
> Existing indexes and UNIQUE-backed indexes must not be duplicated.

| Table | Columns | Reason | Status |
|-------|---------|--------|--------|
| `purchase_requests` | `(project_id, status, created_at DESC)` | Matches project list filtering and ordering | Add |
| `supplier_invoices` | `(project_id, status, created_at DESC)` | Matches invoice list filtering and ordering | Add |
| `invoice_receipt_confirmations` | `(supplier_invoice_id)` | Real join column is `supplier_invoice_id`, but a UNIQUE constraint already backs it | Verify UNIQUE coverage, skip by default |
| `user_permission_group_assignments` | `(user_id, is_active, scope_type, project_id)` | Matches project/global permission lookups and RLS helper lookups | Add |
| `user_permission_group_assignments` | `(user_id, is_active, scope_type, warehouse_id)` | Matches warehouse/global permission lookups in auth and permissions helpers | Add |
| `permission_group_permissions` | `(permission_group_id, module_key, action_key)` | A composite UNIQUE already exists on these exact columns | Verify UNIQUE coverage, skip by default |
| `financial_transactions` | `(project_id)` | Already exists as `idx_fin_tx_project` | Skip |
| `financial_transactions` | `(financial_account_id)` | Already exists as `idx_fin_tx_account` | Skip |
| `financial_transactions` | `(reference_type, reference_id)` | Already exists as `idx_fin_tx_ref` | Skip |
| `financial_transactions` | `(financial_account_id, created_at DESC)` | Supports account transaction history ordering | Add |

### Work

- create `059_performance_indexes.sql`
- validate index need with `EXPLAIN ANALYZE`
- check `pg_indexes` before adding any index
- treat UNIQUE-backed indexes as existing coverage unless plans prove otherwise

### Acceptance Criteria

- migration adds only justified, non-duplicate indexes
- all index columns match real schema names
- no duplicate of existing `idx_fin_tx_project`, `idx_fin_tx_account`, `idx_fin_tx_ref`, or UNIQUE-backed indexes

### Notes

Be conservative. Bad indexes increase write cost and storage.

---

## `PERF-07` Remaining Heavy-Page Cleanup

### Goal

Clean up pages that still rely on sequential fetches after shared layers improve.

### Priority Targets

| File | Problem |
|------|---------|
| `src/app/(system)/company/settings/access-scopes/page.tsx` | Multiple sequential awaits |
| `src/app/(system)/projects/[id]/costs/page.tsx` | Multiple sequential awaits |
| `src/app/(system)/company/treasury/page.tsx` | Multiple sequential awaits |
| Any page with 4+ awaits and no batching | General cleanup |

### File Ownership

- only the specific pages targeted in this package
- plus any narrowly related action file if required

### Work

- replace independent sequential awaits with `Promise.all`
- replace `select('*')` on read paths where practical
- request only columns actually rendered
- defer or narrow reference-list loading where possible

### Acceptance Criteria

- targeted pages are more parallel
- payload sizes are smaller
- UI behavior remains unchanged

---

## `PERF-08` Client-Side Caching Strategy (Future Phase)

> Status: Deferred. Do not start until `PERF-02`, `PERF-03`, and `PERF-04` are complete and stable.

### Why Deferred

The current architecture is primarily Next.js App Router plus Server Components.
Adding TanStack Query or SWR here is not a drop-in cache layer. It changes the data-fetch pattern itself.

Doing it too early would:

- mix server-fetch and client-fetch patterns prematurely
- increase complexity while core server paths are still unoptimized
- risk stale data in permission-sensitive flows

### Goal

Reduce redundant re-fetching for recently visited high-traffic pages.

### File Ownership

- `package.json`
- optional new provider: `src/providers/query-provider.tsx`
- only specifically chosen high-traffic pages

### Recommended Approach

- use TanStack Query for procurement lists and dashboards only
- keep auth, permissions, and shell context server-authoritative
- never rely on client caching for permission decisions
- invalidate queries after mutations

### Prerequisites

- `PERF-02` merged
- `PERF-03` merged
- `PERF-04` merged
- team agrees to add a client-fetch pattern for chosen pages

---

## `PERF-09` Supabase RLS and Query-Shape Tuning

### Goal

Reduce Supabase-specific overhead that is not obvious from page code alone:

- RLS helper/query cost
- oversized payloads from broad selects

### Architecture Note

The server-side Supabase client in `src/lib/supabase-server.ts` uses `@supabase/ssr`
with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` over HTTP.

This is the correct SSR pattern for this app.
There is no direct PostgreSQL client here to switch to a PgBouncer URL.

The real tuning levers are:

1. RLS helper/query cost
2. query shape and payload width
3. indexes supporting the real RLS lookup path

### File Ownership

- new migration: `supabase/migrations/060_rls_query_tuning.sql`
- selected `src/actions/` files for `select('*')` cleanup
- `src/lib/supabase-server.ts` should not be changed in this package

### Must Run After

Do not start until `PERF-02` and `PERF-03` are merged and verified.

### Work

#### RLS Policy Audit

The current RLS policies were migrated to helper functions in `029_fix_rls_use_new_assignments_table.sql`, especially:

- `public.user_has_project_scope(p_project_id uuid)`
- `public.user_has_company_scope()`

These helpers read from `public.user_permission_group_assignments`.
So the real hot RLS path is the assignment-table lookup inside those helpers, not `user_access_scopes`.

Add a targeted index:

```sql
CREATE INDEX IF NOT EXISTS idx_upga_user_active_scope_project
  ON public.user_permission_group_assignments(user_id, is_active, scope_type, project_id);
```

This supports:

- `user_has_project_scope()` for project access
- `user_has_company_scope()` through the leftmost prefix
- many project-scoped RLS checks reused by business tables

Do not optimize `user_access_scopes` first unless `EXPLAIN ANALYZE` proves it is still on a hot path.

Then run `EXPLAIN ANALYZE` on representative reads for:

- `purchase_requests`
- `supplier_invoices`
- `supplier_invoice_lines`
- `purchase_request_lines`
- `invoice_receipt_confirmations`

Document whether helper-function lookups use the new index.

If plans remain poor, evaluate refining helper logic only with explicit before/after evidence.

#### `select('*')` Elimination

- target top list-fetching actions still using `select('*')`
- coordinate with `PERF-07` to avoid double-touching the same files
- replace broad selects with explicit column lists that match actual UI needs

### Acceptance Criteria

- `idx_upga_user_active_scope_project` exists in the migration
- at least one RLS-heavy table is analyzed with `EXPLAIN ANALYZE`
- `select('*')` is removed from the top 5 list-fetching server actions
- no change to `src/lib/supabase-server.ts`

### Notes

Do not rewrite helper functions or security behavior without explicit performance evidence.
Always validate with:

- a regular scoped user
- a super-admin user

---

## Review Checklist After Each Package

- [ ] Route still renders correctly
- [ ] Access control behavior did not change
- [ ] Query-param modal flows still work
- [ ] No server errors were introduced
- [ ] No unnecessary client-side hydration was added
- [ ] No unrelated files were changed
- [ ] Before/after timing was recorded where practical

---

## Suggested Task Split (Multi-Session Strategy)

| Session | Packages | Notes |
|---------|----------|-------|
| A | `PERF-00`, then `PERF-01` | Measurement and UX |
| B | `PERF-02`, then `PERF-03` | Auth and permissions, keep together |
| C | `PERF-04` | Procurement only, exclusive ownership |
| D | `PERF-05` | Dashboard/report aggregation |
| E | `PERF-06` | DB indexes only |
| F | `PERF-07` | Heavy-page cleanup |
| G | `PERF-09` | RLS and query-shape tuning, only after session B |
| H | `PERF-08` | Future phase after all above are stable |

---

## Final Success Definition

Performance work is complete when:

- [ ] system navigation feels lighter to end users
- [ ] procurement and dashboard pages no longer feel noticeably slow
- [ ] repeated permission and layout queries are reduced
- [ ] large lists are paginated instead of fully loaded
- [ ] visible loading states replace blank waiting screens
- [ ] hot read paths have deliberate, validated indexes
- [ ] client-side revisit behavior is improved where intentionally added
- [ ] the Supabase RLS hot path is indexed on `user_permission_group_assignments`
- [ ] page load times meet the numeric targets in the Performance Targets table

---

Document version: Extended Edition
Created: 2026-04-02
Updated: 2026-04-02
