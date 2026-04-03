# Antigravity & Claude - Performance Optimization Roadmap

## Document Role

This file is the execution plan for improving:

- page-load speed
- route-to-route navigation speed
- repeated shell data fetching
- heavy global UI behavior
- server/client data-loading hygiene

It is designed to help:

- you
- Antigravity
- Claude

work from one phased performance plan without mixing low-risk UI cleanup with high-risk auth or workflow changes.

This file should be used with:

- `PLAN/execution roadmap.md`
- `PLAN/work inbox implementation plan.md`

It does not replace code review, profiling, or database verification.

## 0. Baseline First

Before any optimization work starts, we should capture a fixed baseline.

Without this, the final audit becomes too qualitative.

Baseline capture should record:

- `next build` output per route
- shared `First Load JS`
- a fixed set of 3-5 hot operational routes
- approximate server round-trips per hot route
- Chrome DevTools timings for the same hot routes
- current polling or timed refresh behavior in shell and inbox surfaces

Suggested hot routes for baseline:

- `/company`
- `/company/purchases`
- `/projects/[id]/procurement/invoices`
- `/projects/[id]/project_warehouse/issues`
- `/company/critical-actions`

## 1. Why This Plan Now

The current system is functionally rich, but the operating shell is doing too much work on every request and every navigation.

Observed issues from the April 3, 2026 review:

- middleware validates auth on every request
- the system layout reloads user, permissions, scopes, projects, and company data before each page render
- many pages repeat permission checks multiple times
- global shell UI still performs client-side fetches after mount
- inbox and notification surfaces duplicate aggregation work
- some server pages use the browser Supabase client
- many actions use broad `router.refresh()` calls even when a smaller local update would be enough

Production build baseline collected on `2026-04-03`:

- shared `First Load JS`: `87.1 kB`
- heavy routes observed in the `165-173 kB` range
- most application routes are dynamic server-rendered routes

## 2. Success Criteria

This plan is successful if we reach all of the following:

- no global dev-only tooling ships in production bundles
- top bar and sidebar do not trigger avoidable mount-time fetches
- inbox badge and drawer no longer duplicate heavy aggregation work
- no server page uses the browser Supabase client for server data reads
- permission resolution is deduplicated per request or per page context
- heavy routes drop materially in JS cost and server round-trips
- route navigation feels faster without changing business behavior
- final results can be compared against a documented `PERF-00` baseline

Target metrics for the first stabilization pass:

- shared `First Load JS` moves below `80 kB`
- no common operational route remains above `160 kB` without an explicit reason
- global shell performs zero non-essential client fetches on initial mount
- critical actions page stops background refresh polling by default
- hot routes show measurable reduction against baseline in at least one of:
  - server round-trips
  - TTFB
  - server response time

## 3. Agent Assignment Rule

Use this rule for the whole roadmap:

- `Antigravity` owns bounded implementation work, client-shell cleanup, page fetch cleanup, route slimming, lazy loading, and non-sensitive data-loading refactors
- `Claude` owns auth/permission architecture changes, cross-cutting request context changes, database/index design, and any change that can alter access correctness

If a phase changes:

- permission semantics
- auth flow
- middleware behavior
- RLS assumptions
- notification/inbox persistence semantics
- database indexes or schema

that phase should pause for review before merge.

## 4. Guardrails

Antigravity should follow these rules during implementation:

- do not change financial workflows
- do not change approval semantics
- do not introduce schema changes unless the phase explicitly allows it
- do not weaken permission checks in order to reduce latency
- do not replace server validation with client-only logic
- prefer smaller isolated refactors over broad rewrites
- measure before and after each phase with a production build

Preferred optimization order:

1. remove obvious waste
2. deduplicate repeated fetches
3. simplify global shell behavior
4. slim heavy pages
5. only then touch deeper auth/database architecture

## 5. Build Order

The recommended order is:

1. baseline capture
2. production bundle cleanup
3. global shell fetch cleanup
4. inbox and notifications rationalization
5. heavy page query cleanup
6. navigation refresh cleanup
7. auth and permission deduplication
8. database/index verification
9. final measurement and regression audit

## 6. Execution Phases

### Phase PERF-00

- Phase ID: `PERF-00`
- Title: Baseline Capture and Measurement Setup
- Difficulty: `L1`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - capture the current performance baseline before any optimization changes begin
- Inputs:
  - current production build output
  - current hot routes
  - current inbox and shell behavior
- Deliverables:
  - recorded `next build` route table
  - selected list of 3-5 hot routes to track through the roadmap
  - documented approximate server round-trips for those routes
  - Chrome DevTools timings for those same routes
  - inventory of polling and timed refresh behavior
- Dependencies:
  - none
- Review Notes:
  - this phase creates the measurement reference for `PERF-08`
  - the same routes must be reused in the final audit

### Phase PERF-01

- Phase ID: `PERF-01`
- Title: Production Bundle Cleanup
- Difficulty: `L1`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - remove obvious production-only bundle waste from the global app shell
- Inputs:
  - `src/providers/query-provider.tsx`
  - `src/app/(system)/layout.tsx`
- Deliverables:
  - `ReactQueryDevtools` only loads in development
  - any shell-only client helpers that can be lazily loaded are reviewed
  - no behavior change to business pages
- Dependencies:
  - `PERF-00`
- Review Notes:
  - verify production build output after completion
  - verify no regression in query behavior

### Phase PERF-02

- Phase ID: `PERF-02`
- Title: Global Shell Fetch Cleanup
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - remove avoidable mount-time client fetches from sidebar and topbar surfaces
- Inputs:
  - `src/app/(system)/layout.tsx`
  - `src/app/(system)/SidebarNav.tsx`
  - `src/components/work-inbox/TopbarInboxButton.tsx`
  - `src/components/layout/GlobalSearchBar.tsx`
- Deliverables:
  - discrepancy badges no longer fetch via client `useEffect` on mount
  - topbar inbox button avoids unnecessary polling on initial shell load
  - global search remains client-driven but does not add extra shell work before user intent
  - data needed by shell badges is pushed from server where reasonable
- Dependencies:
  - `PERF-01`
- Review Notes:
  - keep shell behavior unchanged from the user perspective
  - no new global state library
  - do not finalize a new badge source-of-truth in isolation if `PERF-03` will rework inbox count ownership
  - this phase and `PERF-03` must be designed together even if shipped separately

### Phase PERF-03

- Phase ID: `PERF-03`
- Title: Inbox and Notification Rationalization
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review checkpoint
- Status: `Ready`
- Goal:
  - stop duplicating live inbox aggregation work across badge, drawer, and critical actions surfaces
- Inputs:
  - `src/actions/work-inbox.ts`
  - `src/actions/notifications.ts`
  - `src/components/work-inbox/TopbarInboxButton.tsx`
  - `src/components/work-inbox/WorkInboxDrawer.tsx`
  - `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx`
- Deliverables:
  - one clear source of truth for badge counts
  - drawer loads only the minimum data needed
  - critical actions page no longer auto-refreshes on a timer by default
  - avoid double work between persisted notifications and dynamic inbox aggregation
- Dependencies:
  - `PERF-02`
- Review Notes:
  - do not change unread/read business semantics without explicit review
  - if this phase starts affecting notification architecture, pause and escalate
  - explicitly review any count-source change started in `PERF-02` before merge to avoid redoing the work twice

### Phase PERF-04

- Phase ID: `PERF-04`
- Title: Heavy Page Server Query Cleanup
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - clean up heavy list pages that currently add extra server work or incorrect client choice
- Inputs:
  - `src/app/(system)/projects/[id]/procurement/invoices/page.tsx`
  - `src/app/(system)/company/purchases/invoices/page.tsx`
  - `src/app/(system)/projects/[id]/project_warehouse/issues/page.tsx`
  - `src/app/(system)/company/main_warehouse/issues/page.tsx`
- Deliverables:
  - no use of browser Supabase client in Server Components
  - confirmation lookups are done with server client reads
  - repeated permission checks inside heavy pages are reduced where safe
  - selected columns are reviewed and narrowed where possible
  - large joined reads are reviewed for unnecessary payload
- Dependencies:
  - `PERF-02`
- Review Notes:
  - page output and permissions must remain identical
  - avoid schema work in this phase

### Phase PERF-05

- Phase ID: `PERF-05`
- Title: Navigation Refresh Cleanup
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - reduce unnecessary full-page refreshes after mutations
- Inputs:
  - modal and dialog components across procurement, warehouse, treasury, and petty-expense flows
- Deliverables:
  - high-frequency flows stop relying on blanket `router.refresh()` where a smaller update is enough
  - close-and-refresh patterns are reviewed for user-visible delay
  - optimistic or local state updates are used in safe low-risk places
- Dependencies:
  - `PERF-04`
- Review Notes:
  - do not use optimistic updates on finance-sensitive outcomes without care
  - prefer incremental wins on the busiest flows first

### Phase PERF-05A

- Phase ID: `PERF-05A`
- Title: Server Component Supabase Client Cleanup
- Difficulty: `L3`
- Recommended Agent: `Antigravity` with review checkpoint
- Status: `Ready`
- Goal:
  - replace browser Supabase client usage in Server Components safely
- Inputs:
  - `src/app/(system)/projects/[id]/procurement/invoices/page.tsx`
  - `src/app/(system)/company/purchases/invoices/page.tsx`
  - any related server helpers
- Deliverables:
  - no browser client usage remains in targeted Server Components
  - targeted pages use the server client consistently
  - cookie/session behavior is verified after the swap
  - explicit regression test notes are recorded for auth/session-sensitive pages
- Dependencies:
  - `PERF-04`
- Review Notes:
  - this looks simple but can regress cookie or session handling if done carelessly
  - include an explicit test pass for authenticated reads after the refactor

### Phase PERF-06

- Phase ID: `PERF-06`
- Title: Auth and Permission Dedup Foundation
- Difficulty: `L4`
- Recommended Agent: `Claude / Antigravity`
- Status: `Ready`
- Goal:
  - reduce repeated auth and permission queries across middleware, layout, and pages without changing access correctness
- Inputs:
  - `src/middleware.ts`
  - `src/lib/system-context.ts`
  - `src/lib/auth.ts`
  - `src/lib/permissions.ts`
  - pages that stack `requirePermission()` plus multiple `hasPermission()` calls
- Deliverables:
  - request-scoped auth/profile lookup is reused consistently
  - permission resolution is centralized per request or per page context
  - duplicate `getUser()` / profile lookups are removed
  - pages stop performing repeated permission round-trips for the same context
  - a shared `AuthorizationContext` or `getAuthorizationContext()` helper is introduced as the single source of truth for access checks
  - the shared authorization layer exposes:
    - current user/profile
    - `isSuperAdmin`
    - effective scopes for the current context
    - effective permission set for the current context
    - cheap in-memory helpers such as `can(module, action)` and `require(module, action)`
  - `requirePermission()` and `hasPermission()` become wrappers over the shared authorization context instead of issuing fresh queries independently
  - at least 2 pilot pages are migrated to the new authorization context before broader adoption
- Dependencies:
  - `PERF-04`
- Review Notes:
  - this phase is access-sensitive
  - every change must be reviewed against permission correctness
  - authorization caching must remain request-scoped only, never cross-user or cross-request

### PERF-06 Target End-State

The professional end-state for permissions should look like this:

- one request builds one authorization object
- pages and layouts read from that object instead of re-querying auth and permissions repeatedly
- UI visibility checks and server enforcement share the same resolved permission data
- page code follows a pattern like:
  - `const authz = await getAuthorizationContext({ projectId })`
  - `authz.require('project_warehouse', 'view')`
  - `const canApprovePM = authz.can('project_warehouse', 'approve_pm')`
  - `const canEdit = authz.can('project_warehouse', 'edit')`
- the layout, route pages, and action helpers all reuse the same request-scoped source of truth

This phase should not attempt:

- cross-request permission caching
- JWT-stored full permission matrices
- client-only authorization as a substitute for server enforcement
- silent permission behavior changes in the name of performance

### Phase PERF-07

- Phase ID: `PERF-07`
- Title: Database and Index Verification
- Difficulty: `L4`
- Recommended Agent: `Claude`
- Status: `Ready`
- Goal:
  - verify that the hottest filters and joins are backed by the right indexes
- Inputs:
  - inbox/status queries
  - procurement invoice filters
  - store issues list/detail queries
  - permission and assignment lookups
- Deliverables:
  - query inventory for the hottest pages
  - index recommendations or migrations where justified
  - validation of status/project/date filter paths
- Dependencies:
  - `PERF-06`
- Review Notes:
  - use real query plans where possible
  - do not add indexes speculatively without evidence
  - this phase requires access to Supabase SQL tools, Supabase dashboard query analysis, or an equivalent `psql` path to run `EXPLAIN ANALYZE`
  - confirm access path before starting the phase

### Phase PERF-08

- Phase ID: `PERF-08`
- Title: Final Measurement and Regression Audit
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `Ready`
- Goal:
  - verify that the optimization pass created measurable gains without breaking workflows
- Inputs:
  - final branch after phases `PERF-01` through `PERF-07`
- Deliverables:
  - fresh production build report
  - before/after route-size comparison
  - before/after server round-trip and latency comparison for the same `PERF-00` hot routes
  - regression checklist for shell, inbox, permissions, and heavy pages
  - final notes on what remains acceptable technical debt
- Dependencies:
  - `PERF-07`
- Review Notes:
  - this phase should produce the final acceptance summary

## 7. Ready-to-Assign Antigravity Tickets

These are the cleanest implementation packets for `Antigravity`.

### Ticket AG-PERF-01

- Goal:
  - remove production-only bundle waste from query tooling
- Write Scope:
  - `src/providers/query-provider.tsx`
- Constraints:
  - devtools must remain available in development
  - no change to query cache behavior

### Ticket AG-PERF-02

- Goal:
  - remove sidebar discrepancy badge client fetches
- Write Scope:
  - `src/app/(system)/layout.tsx`
  - `src/app/(system)/SidebarNav.tsx`
  - supporting server-side read helper if needed
- Constraints:
  - no new polling
  - preserve current badge meaning

### Ticket AG-PERF-03

- Goal:
  - slim topbar inbox loading path
- Write Scope:
  - `src/components/work-inbox/TopbarInboxButton.tsx`
  - `src/components/work-inbox/WorkInboxDrawer.tsx`
  - `src/actions/work-inbox.ts`
  - `src/actions/notifications.ts`
- Constraints:
  - avoid schema changes
  - prefer count-only badge path
  - drawer should stay lazy-loaded
  - align the badge-count approach with `PERF-03` before locking the implementation

### Ticket AG-PERF-04

- Goal:
  - remove timed auto-refresh from critical actions and keep manual refresh only
- Write Scope:
  - `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx`
- Constraints:
  - no change to item grouping or UI semantics
  - manual refresh stays available

### Ticket AG-PERF-05

- Goal:
  - replace browser Supabase client usage in server invoice pages safely
- Write Scope:
  - `src/app/(system)/projects/[id]/procurement/invoices/page.tsx`
  - `src/app/(system)/company/purchases/invoices/page.tsx`
- Constraints:
  - no client-only data reads in Server Components
  - preserve current table output and row actions
  - explicitly test auth/session behavior after the refactor

### Ticket AG-PERF-06

- Goal:
  - slim heavy store issue pages by reducing duplicate permission and user checks
- Write Scope:
  - `src/app/(system)/projects/[id]/project_warehouse/issues/page.tsx`
  - `src/app/(system)/company/main_warehouse/issues/page.tsx`
- Constraints:
  - do not change approval logic
  - preserve current action visibility rules

### Ticket AG-PERF-07

- Goal:
  - replace obvious broad `router.refresh()` patterns in the busiest dialogs
- Write Scope:
  - top 5 busiest mutation flows only
- Suggested starting points:
  - procurement invoice actions
  - store issue approval actions
  - petty expense quick approval
  - treasury execution dialogs
- Constraints:
  - keep the write scope bounded
  - do not attempt whole-repo refresh cleanup in one pass
  - identify the target flows using real baseline or lightweight instrumentation first

### Ticket AG-PERF-08

- Goal:
  - introduce the shared authorization context foundation and migrate pilot pages to it
- Write Scope:
  - `src/lib/system-context.ts`
  - `src/lib/auth.ts`
  - `src/lib/permissions.ts`
  - one or two pilot pages with repeated access checks
- Suggested pilot pages:
  - `src/app/(system)/projects/[id]/project_warehouse/issues/page.tsx`
  - `src/app/(system)/company/main_warehouse/issues/page.tsx`
- Constraints:
  - request-scoped only
  - no cross-request cache
  - preserve existing page gating and action visibility exactly
  - stop and escalate if the refactor starts changing permission semantics

## 8. Review Checkpoints

Stop and review before merging if any phase starts to change:

- permission meaning
- auth redirection behavior
- inbox unread/read semantics
- finance-sensitive action outcomes
- RLS expectations

Mandatory review checkpoints:

- after `PERF-03`
- before and after `PERF-06`
- before any database migration in `PERF-07`

## 9. QA Checklist

Every completed phase should be reviewed against this checklist:

- Does the production build still pass?
- Did shared `First Load JS` improve or at least not regress?
- Did the targeted routes improve in network or server round-trips?
- Did the targeted routes improve against the same `PERF-00` baseline set?
- Did shell badges still show correct counts?
- Did permissions still gate the same pages and actions?
- Did dialogs and list pages still show the same records?
- Was any refresh/polling behavior removed without leaving stale UI behind?

## 10. Definition of Done

This roadmap is done when:

- the system shell stops doing avoidable client fetches
- inbox surfaces no longer duplicate heavy aggregation work
- server pages use server-side data access correctly
- repeated permission work is materially reduced
- heavy routes become lighter and faster to navigate
- the final build and QA pass confirm measurable gains

## 11. Final Recommendation

The safest and highest-value path is:

1. ship low-risk shell cleanup first
2. rationalize inbox behavior second
3. fix heavy page data-loading third
4. handle Server Component client cleanup with an explicit test pass
5. only then touch auth/permission architecture
6. finish with database verification and a fresh benchmark

This keeps most of the work inside the kind of bounded implementation `Antigravity` handles well, while clearly separating the parts that deserve a stricter review checkpoint.
