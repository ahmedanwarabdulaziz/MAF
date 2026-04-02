# Performance Optimization Claude Prompts

## How To Use

Each section below is a copy-paste prompt for Claude.

Use one prompt per run.

Recommended order:

1. `PERF-00`
2. `PERF-01`
3. `PERF-02`
4. `PERF-03`
5. `PERF-04`
6. `PERF-05`
7. `PERF-06`
8. `PERF-07`

Important rule:

- ask Claude to stay inside the listed file scope
- do not run multiple Claudes on overlapping packages at the same time
- `PERF-02`, `PERF-03`, and `PERF-04` should each have exclusive ownership during their run

---

## Prompt: `PERF-00` Baseline and Measurement

```text
You are working in the MAF repository.

Task:
Create a lightweight performance measurement baseline for authenticated page loads.

Goal:
Help us understand where page-open latency is coming from before we optimize behavior.

Files you may edit:
- src/middleware.ts
- src/app/(system)/layout.tsx
- optionally a new helper file under src/lib, such as src/lib/perf.ts

Files you should avoid editing:
- business action files
- database migrations
- UI page files outside the authenticated shell

What I want:
- add lightweight timing instrumentation for development only
- measure middleware auth timing
- measure system layout context-loading timing
- optionally add timing wrappers/helpers to keep code clean
- avoid noisy permanent production logging

Required measured flows:
- /company
- /company/purchases/invoices
- /projects/[id]
- /projects/[id]/procurement/invoices

Constraints:
- preserve current behavior
- do not change auth rules
- do not add long-term monitoring vendors or third-party services
- do not introduce new environment variables unless absolutely necessary

Deliverables:
- code changes for local development timing
- brief summary of where timings are emitted
- short note about how to use the measurement

Acceptance criteria:
- route timing is visible in local development
- middleware timing is distinguishable from layout timing
- there is no behavior regression in login-protected routes

When you finish:
- summarize what you changed
- mention any assumptions
- mention any risks or next-step recommendations
```

---

## Prompt: `PERF-01` Loading UX and Lazy Global Dialogs

```text
You are working in the MAF repository.

Task:
Improve perceived performance for system navigation by adding route-level loading states and reducing eager global dialog work.

Goal:
Make the app feel faster even before deeper backend optimizations land.

Primary files you may edit:
- src/app/(system)/layout.tsx
- new loading.tsx files under src/app/(system)/...
- src/components/procurement/PurchaseRequestDialog.tsx
- src/components/procurement/SupplierInvoiceDialog.tsx

Files you may inspect carefully:
- src/components/procurement/PurchaseRequestView.tsx
- src/components/procurement/SupplierInvoiceView.tsx

What I want:
- add loading.tsx files for major dynamic areas
- show useful loading placeholders instead of blank waits
- stop mounting heavy procurement dialogs globally on every authenticated page if not needed
- load dialog content only when corresponding query params exist

Recommended route targets:
- src/app/(system)/company
- src/app/(system)/projects/[id]
- procurement-heavy route groups if needed

Constraints:
- preserve existing query-param modal behavior
- do not change business logic
- keep UI style aligned with the existing app
- avoid unrelated refactors

Acceptance criteria:
- major system routes display a visible loading state
- unrelated pages do not eagerly initialize procurement detail views
- modal open/close behavior still works using query params

When you finish:
- summarize what changed
- list the loading files you added
- mention any remaining perceived-speed gaps
```

---

## Prompt: `PERF-02` System Context Consolidation

```text
You are working in the MAF repository.

Task:
Consolidate repeated authenticated-shell data fetching into a single request-scoped system context loader.

Goal:
Reduce duplicated server work during page navigation inside the authenticated app.

Primary files you may edit:
- src/app/(system)/layout.tsx
- src/lib/auth.ts
- src/lib/permissions.ts

Files you may add:
- src/lib/system-context.ts
- src/lib/request-cache.ts
- another focused helper under src/lib if clearly justified

Do not edit in this task:
- procurement action files
- dashboard action files
- database migrations
- unrelated page components

What I want:
- create one request-scoped loader for:
  - auth user
  - user profile
  - effective modules
  - user scopes
  - active projects
  - active company
- use the shared loader inside src/app/(system)/layout.tsx
- avoid repeated createClient/user/profile queries within the same request
- use a safe request-scoped caching pattern

Constraints:
- permission behavior must remain exactly correct
- super admin behavior must remain exactly correct
- do not introduce long-lived stale caching for permission-sensitive data
- keep the refactor focused and reviewable

Acceptance criteria:
- authenticated shell data is loaded through one shared path
- duplicate user/profile/scope/module fetches are reduced
- sidebar and header still render correctly for both normal users and super admins

When you finish:
- summarize the new context-loading flow
- explain how request-scoped caching is used
- mention any follow-up opportunities
```

---

## Prompt: `PERF-03` Permission Resolution Optimization

```text
You are working in the MAF repository.

Task:
Optimize permission resolution so multiple permission checks do not repeatedly hit the same underlying data within a request.

Goal:
Reduce repeated work in auth and permission helpers while preserving exact access behavior.

Primary files you may edit:
- src/lib/auth.ts
- src/lib/permissions.ts

Files you may add:
- one focused helper under src/lib if needed

Do not edit in this task:
- page files unless absolutely required for integration
- procurement UI
- database migrations

What I want:
- make hasPermission, requirePermission, and module-resolution logic share common permission data where possible
- reduce repeated queries to:
  - users
  - user_permission_group_assignments
  - permission_group_permissions
- keep support for:
  - super admin
  - main company scope
  - all projects scope
  - selected project scope
  - selected warehouse scope

Constraints:
- correctness is more important than cleverness
- do not widen permissions accidentally
- avoid broad architecture changes outside auth/permissions

Acceptance criteria:
- repeated permission checks in the same request are cheaper
- access behavior remains correct
- existing public interfaces remain understandable and maintainable

When you finish:
- summarize the optimization approach
- point out any permissions edge cases you validated mentally or in code
- mention remaining hotspots if any
```

---

## Prompt: `PERF-04` Procurement List and Detail Optimization

```text
You are working in the MAF repository.

Task:
Optimize procurement list and detail flows because they are among the heaviest parts of the app.

Goal:
Reduce page-open latency and unnecessary data fetching in procurement requests, invoices, confirmations, and related badges/dialogs.

This task has exclusive ownership.
Do not overlap this work with another Claude run editing procurement files.

Primary files you may edit:
- src/actions/procurement.ts
- src/app/(system)/projects/[id]/procurement/invoices/page.tsx
- src/app/(system)/company/purchases/invoices/page.tsx
- src/app/(system)/projects/[id]/procurement/requests/page.tsx
- src/components/procurement/PurchaseRequestView.tsx
- src/components/procurement/SupplierInvoiceView.tsx
- src/app/(system)/SidebarNav.tsx

What I want:
- add pagination or another bounded-loading strategy to procurement list pages
- avoid loading complete historical datasets when only the first page is needed
- move filtering/counting closer to SQL where practical
- reduce extra follow-up queries for confirmations if data can be fetched more efficiently
- reduce avoidable badge/background fetch pressure from SidebarNav
- avoid duplicate detail fetches where possible without breaking behavior

Constraints:
- preserve current business behavior and approval flow
- keep URLs and modal behavior compatible
- do not mix in unrelated styling refactors
- do not rewrite the entire procurement module

Acceptance criteria:
- procurement list pages load a bounded amount of data
- first-page rendering is lighter
- discrepancy badge logic is less expensive
- request/invoice detail flows still function correctly

When you finish:
- summarize the data-loading changes
- mention pagination behavior or bounded-loading behavior
- call out any intentional follow-up work still needed
```

---

## Prompt: `PERF-05` Dashboard and Reporting Aggregation Refactor

```text
You are working in the MAF repository.

Task:
Refactor expensive dashboard and reporting aggregations so less work happens in application-side loops.

Goal:
Move aggregation closer to the database and reduce large raw-data fetches.

Primary files you may edit:
- src/actions/dashboards.ts
- src/app/(system)/company/purchases/actions.ts

Files you may add:
- one or more new SQL migration files under supabase/migrations if views or RPC helpers are needed

What I want:
- optimize company dashboard metrics
- optimize project dashboard metrics
- optimize global supplier balances
- reduce JS-side reduce/filter loops over broad result sets
- prefer SQL views, RPCs, or other DB-native aggregation where appropriate

Constraints:
- preserve output numbers and business meaning
- keep naming clear and maintainable
- do not change unrelated procurement behavior
- if you add DB objects, keep them focused and documented in code comments only where necessary

Acceptance criteria:
- dashboard/report actions become thinner
- returned payloads are closer to final UI shape
- aggregation is pushed down to DB-native structures where practical

When you finish:
- summarize the new aggregation strategy
- list any migrations added
- mention any parity checks you performed logically
```

---

## Prompt: `PERF-06` Database Indexing and Query Plan Validation

```text
You are working in the MAF repository.

Task:
Add justified database indexes for hot read paths and document the rationale.

Goal:
Support real application query patterns with deliberate indexing.

Primary files you may edit:
- new migration file(s) under supabase/migrations

Files you may inspect:
- src/lib/auth.ts
- src/lib/permissions.ts
- src/actions/procurement.ts
- src/actions/dashboards.ts
- src/app/(system)/company/purchases/actions.ts

What I want:
- review read-heavy filters and joins for:
  - purchase_requests
  - supplier_invoices
  - invoice_receipt_confirmations
  - user_permission_group_assignments
  - permission_group_permissions
  - financial_transactions
- add composite indexes that match real filter patterns
- avoid duplicate or low-value indexes

Constraints:
- be conservative
- do not add indexes “just in case”
- avoid changing application code unless absolutely necessary
- keep migration naming and SQL style consistent with the repo

Acceptance criteria:
- new indexes are tied to real query patterns from the app
- migration is clean and focused
- no obviously redundant indexes are introduced

When you finish:
- summarize each new index and why it exists
- mention any query-plan assumptions
- mention any tables you intentionally did not index and why
```

---

## Prompt: `PERF-07` Remaining Heavy-Page Cleanup

```text
You are working in the MAF repository.

Task:
Clean up remaining heavy server-rendered pages that still use too many sequential fetches after shared optimization work is done.

Goal:
Reduce unnecessary latency on secondary heavy pages without broad rewrites.

Priority files:
- src/app/(system)/company/settings/access-scopes/page.tsx
- src/app/(system)/projects/[id]/costs/page.tsx
- src/app/(system)/company/treasury/page.tsx

You may also update a narrowly related action/helper file if needed, but keep scope tight.

What I want:
- replace independent sequential awaits with Promise.all where safe
- reduce select('*') usage on read paths where possible
- request only columns actually used
- defer or limit heavy reference-list loading when practical

Constraints:
- do not bundle unrelated pages into one giant refactor
- preserve current behavior
- keep page structure readable
- avoid touching auth architecture or procurement core files in this package

Acceptance criteria:
- targeted pages perform fewer sequential waits
- payload sizes are smaller where practical
- behavior remains unchanged

When you finish:
- summarize which pages were optimized
- explain where Promise.all or narrower selects were introduced
- mention any remaining pages that still deserve follow-up
```

---

## Optional Coordinator Prompt

```text
You are working in the MAF repository.

Read these plan files first:
- PLAN/performance optimization plan.md
- PLAN/performance optimization claude prompts.md

Task:
Act as a coordinator only.
Do not make code changes yet.

What I want:
- review the performance packages
- identify dependencies between them
- confirm which packages can run in parallel safely
- point out any file-scope conflicts
- suggest the safest execution order for multiple Claude runs

Output format:
- recommended execution order
- safe parallel groups
- conflict-risk notes
- high-risk packages requiring exclusive ownership
```
