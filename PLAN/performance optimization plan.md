# Performance Optimization Plan

## Document Role

This document breaks performance work into small, reviewable execution packages so the team can hand them to Claude without mixing concerns or causing avoidable merge conflicts.

It focuses on:

- page-open latency
- perceived loading speed
- repeated server work
- heavy list screens
- expensive aggregation logic
- database support for hot queries

This document is based on the current codebase shape, especially:

- `src/app/(system)/layout.tsx`
- `src/middleware.ts`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/actions/dashboards.ts`
- `src/actions/procurement.ts`
- `src/app/(system)/company/purchases/actions.ts`

## Current Findings

The current system is not broken, but it is performance-sensitive and will feel slower as data grows.

Main reasons:

- `middleware.ts` performs auth work on every matched request.
- `src/app/(system)/layout.tsx` reloads user, projects, company, scopes, and modules on every navigation.
- many pages use multiple sequential `await` calls instead of batching with `Promise.all`
- there are no `loading.tsx` route-level loading states in `src/app`
- heavy pages fetch large result sets and then filter in memory
- dashboards and supplier summaries do aggregation in application code instead of SQL/RPC
- some hot database tables do not show explicit read indexes in migrations
- globally mounted procurement dialogs increase route-level work and perceived UI heaviness

## Target Outcome

The goal is not just “better Lighthouse scores”.

The real target is:

- faster first paint for internal pages
- less waiting when moving between pages after login
- lighter database load per navigation
- clearer loading feedback while data is being fetched
- safer growth when row counts increase

## Delivery Rules

Each package should:

- stay inside its file ownership boundary
- include before/after measurement where practical
- avoid silent functional changes
- preserve current business behavior
- prefer small refactors over wide rewrites

Recommended review rule:

- do not merge optimization work without confirming behavior on at least one company route and one project route

## Suggested Execution Order

Recommended sequence:

1. `PERF-00` Baseline and measurement
2. `PERF-01` Loading UX and lazy global dialogs
3. `PERF-02` System context consolidation
4. `PERF-03` Permission resolution optimization
5. `PERF-04` Procurement list and detail optimization
6. `PERF-05` Dashboard and reporting aggregation refactor
7. `PERF-06` Database indexing and query-plan validation
8. `PERF-07` Remaining heavy-page cleanup

## Parallel Work Strategy

These can run in parallel with low conflict risk:

- `PERF-01` and `PERF-06`
- `PERF-05` and `PERF-07`

These should not be split between multiple agents at the same time:

- `PERF-02` and `PERF-03`
  because both touch auth, permissions, and shared request context
- `PERF-04`
  because procurement files are already heavily coupled

## Work Packages

---

## `PERF-00` Baseline and Measurement

### Goal

Create a trustworthy baseline before optimization starts.

### Why First

Without baseline timings, we may improve code shape but fail to improve actual latency.

### File Ownership

- `src/middleware.ts`
- `src/app/(system)/layout.tsx`
- optional new helper: `src/lib/perf.ts`

### Work

- add lightweight request timing logs around:
  - middleware auth call
  - system layout context loading
  - selected heavy actions
- log timings only in development
- identify top 5 slowest page-open paths
- document baseline timings inside this file or a short sibling note if preferred

### Acceptance Criteria

- developers can see route timing for core system requests locally
- at least these flows are measured:
  - `/company`
  - `/company/purchases/invoices`
  - `/projects/[id]`
  - `/projects/[id]/procurement/invoices`

### Notes for Claude

Do not add noisy permanent logging in production.

---

## `PERF-01` Loading UX and Lazy Global Dialogs

### Goal

Improve perceived speed even before deeper backend work lands.

### File Ownership

- `src/app/(system)/layout.tsx`
- new route loading files under `src/app/(system)/...`
- `src/components/procurement/PurchaseRequestDialog.tsx`
- `src/components/procurement/SupplierInvoiceDialog.tsx`

### Work

- add `loading.tsx` to major segments:
  - `src/app/(system)/company`
  - `src/app/(system)/projects/[id]`
  - procurement-heavy routes if needed
- replace invisible waits with visible skeletons/placeholders
- stop mounting procurement dialogs globally on every system page if they are not needed
- lazy-load dialog content only when related query params exist

### Acceptance Criteria

- major dynamic routes show a loading state instead of a blank wait
- global layout no longer eagerly mounts heavy procurement dialogs on unrelated pages
- opening `/company/treasury` or `/projects/[id]/costs` does not initialize procurement detail views

### Notes for Claude

Preserve existing query-param modal behavior.

---

## `PERF-02` System Context Consolidation

### Goal

Reduce duplicated request-time data fetching in the authenticated shell.

### File Ownership

- `src/app/(system)/layout.tsx`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- optional new helper:
  - `src/lib/system-context.ts`
  - `src/lib/request-cache.ts`

### Work

- create a single request-scoped loader for:
  - auth user
  - user profile
  - effective module access
  - user scopes
  - active projects
  - active company
- reuse it in `src/app/(system)/layout.tsx`
- use request-level caching via `cache()` or equivalent safe server-side pattern
- avoid repeated `createClient()` and repeated user/profile queries within the same request

### Acceptance Criteria

- system layout uses one shared context loader instead of scattered fetch logic
- the same request does not resolve user/profile/scopes multiple times
- no behavior regression in sidebar filtering, header project visibility, or super-admin handling

### Notes for Claude

Prefer request-scoped caching first.
Do not introduce long-lived stale caching for permission-sensitive data without explicit invalidation strategy.

---

## `PERF-03` Permission Resolution Optimization

### Goal

Shrink the cost of permission checks used across the app.

### File Ownership

- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- any new permission helper file created in `src/lib`

### Work

- remove repeated permission-query patterns where possible
- make `hasPermission`, `requirePermission`, and module-resolution helpers share common underlying lookup data
- avoid re-querying:
  - `users`
  - `user_permission_group_assignments`
  - `permission_group_permissions`
  for each permission check in the same request
- keep logic correct for:
  - super admin
  - project scope
  - warehouse scope
  - global scope

### Acceptance Criteria

- permission helpers rely on shared permission context when available
- pages that call multiple permission checks do not trigger repeated full permission resolution
- access behavior remains unchanged

### Notes for Claude

This package is correctness-sensitive.
Optimize only after keeping exact scope behavior intact.

---

## `PERF-04` Procurement List and Detail Optimization

### Goal

Optimize the hottest procurement pages because they combine large lists, extra permission checks, confirmations, and modal detail loading.

### File Ownership

- `src/actions/procurement.ts`
- `src/app/(system)/projects/[id]/procurement/invoices/page.tsx`
- `src/app/(system)/company/purchases/invoices/page.tsx`
- `src/app/(system)/projects/[id]/procurement/requests/page.tsx`
- `src/components/procurement/PurchaseRequestView.tsx`
- `src/components/procurement/SupplierInvoiceView.tsx`
- `src/app/(system)/SidebarNav.tsx`

### Work

- add pagination to invoice and request list screens
- stop loading the full result set when only the first page is needed
- push filtering and counts into SQL where practical
- avoid separate “load all invoices, then fetch confirmations” if confirmation state can be joined or fetched more cheaply
- reduce extra page-load fetches from sidebar discrepancy badges
- review detail dialogs so they do not duplicate list-page data fetches unnecessarily

### Acceptance Criteria

- procurement list pages load a bounded dataset
- first page is visible without loading all historical rows
- discrepancy badge logic does not create avoidable background pressure on every page mount
- procurement detail modal still works correctly

### Notes for Claude

Keep this package owned by one agent only.
`src/actions/procurement.ts` is central and conflict-prone.

---

## `PERF-05` Dashboard and Reporting Aggregation Refactor

### Goal

Move expensive aggregation from Node/JS loops into database-friendly shapes.

### File Ownership

- `src/actions/dashboards.ts`
- `src/app/(system)/company/purchases/actions.ts`
- optional new migrations for views or RPC helpers

### Work

- replace JS-side aggregation where possible with:
  - SQL views
  - materialized views if justified
  - RPC functions
- optimize:
  - company dashboard metrics
  - project dashboard metrics
  - global supplier balances
- avoid loading broad raw datasets only to reduce them in memory

### Acceptance Criteria

- dashboard actions become thinner and more query-efficient
- supplier balance aggregation no longer depends on multiple broad in-memory passes where avoidable
- returned payloads are smaller and closer to final UI shape

### Notes for Claude

If creating DB objects, keep naming clear and business-safe.
Do not change final business numbers without validating parity.

---

## `PERF-06` Database Indexing and Query Plan Validation

### Goal

Support hot read paths with explicit indexes and verify actual query plans.

### File Ownership

- new migration file under `supabase/migrations`
- optional small notes in `PLAN/`

### Work

- review read-heavy predicates and joins for:
  - `purchase_requests`
  - `supplier_invoices`
  - `invoice_receipt_confirmations`
  - `user_permission_group_assignments`
  - `permission_group_permissions`
  - `financial_transactions`
- add composite indexes for actual filter patterns used by the app
- validate with `EXPLAIN ANALYZE` in a representative environment if available

### Acceptance Criteria

- new migration adds only justified indexes
- indexes match real query predicates used in the app
- no duplicate or obviously redundant indexes are introduced

### Notes for Claude

Be conservative.
Bad indexes can hurt write performance and storage.

---

## `PERF-07` Remaining Heavy-Page Cleanup

### Goal

Clean up pages that still use too many sequential fetches after the shared layers are improved.

### Priority Targets

- `src/app/(system)/company/settings/access-scopes/page.tsx`
- `src/app/(system)/projects/[id]/costs/page.tsx`
- `src/app/(system)/company/treasury/page.tsx`
- other pages with 4 or more `await` calls and no batching

### File Ownership

Only the specific page files touched in this package, plus any narrowly related action file.

### Work

- replace sequential independent fetches with `Promise.all`
- request only the columns actually used
- reduce `select('*')` on read paths where possible
- avoid loading reference lists that can be deferred or paginated

### Acceptance Criteria

- targeted pages use parallel fetches where safe
- payload size is smaller
- behavior remains unchanged

### Notes for Claude

Do not bundle unrelated page cleanup into one oversized PR.

## Suggested Task Split for Claude

If one Claude instance will handle everything, follow the execution order above.

If multiple Claude runs are used, recommended split is:

1. Claude A:
   `PERF-00`, then `PERF-01`
2. Claude B:
   `PERF-02`, then `PERF-03`
3. Claude C:
   `PERF-04`
4. Claude D:
   `PERF-05`
5. Claude E:
   `PERF-06`
6. Claude F:
   `PERF-07`

## Review Checklist After Each Package

- route still renders correctly
- access control behavior did not change
- query-param dialogs still work
- no server errors were introduced
- no unnecessary client-side hydration was added
- no unrelated files were changed

## Final Success Definition

We can consider the performance work successful when:

- system navigation feels lighter to end users
- procurement and dashboard pages no longer feel noticeably slow
- repeated permission and layout queries are reduced
- large lists are paginated instead of fully loaded
- visible loading states replace blank waiting
- the database is supporting hot paths with deliberate indexes
