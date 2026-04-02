# Antigravity & Claude - Work Inbox Implementation Plan

## Document Role

This document defines the implementation plan for the proposed professional upgrade:

- `مركز العمل الموحد`
- `Work Inbox`
- `Critical Actions Center`

Its purpose is to make the feature executable by `Antigravity` in bounded phases, with clear handoff points when a step becomes architecture-heavy, permission-heavy, or workflow-sensitive.

This document should be used with:

- `PLAN/system modules and navigation.md`
- `PLAN/execution roadmap.md`
- `PLAN/master plan.md`

## 1. Why This Feature Now

The system already has strong business depth:

- projects
- procurement
- warehouse
- subcontractors
- owner billing
- treasury
- audit log

But the shared operating layer is still incomplete.

Current gap:

- the top bar does not yet provide real notifications, approvals inbox, or global search
- `company/critical-actions` exists but is still a placeholder
- `company/approvals` currently covers only a narrow slice of pending work
- users still need to move module by module to know what requires action

That means the system is operationally rich, but the daily management experience is still less professional than the business depth underneath it.

## 2. Product Definition

`Work Inbox` is a cross-system operating surface that answers one question:

`What needs my attention now?`

The feature should provide:

- one company-level page for urgent and pending work
- one top-bar entry point with count badge
- grouped and filterable pending items across modules
- clear action labels
- deep links back to the correct document or dialog
- aging / urgency visibility

The first version should be read-heavy and navigation-heavy before it becomes action-heavy.

## 3. V1 Goal

Build a production-ready `Critical Actions / Work Inbox` experience without changing core finance rules, without replacing current module pages, and without inventing a new approval engine.

## 4. V1 Non-Goals

The first implementation should **not** attempt to do all of the following at once:

- redesign the approval engine
- add threshold routing logic
- rewrite permission architecture
- replace existing module detail pages
- build full-text global search across all business entities
- introduce a new workflow state model

These are future expansions.

## 5. Agent Assignment Rule

Use this rule from start to finish:

- `Antigravity` owns UI shell, page structure, grouping, filters, visual states, badges, navigation polish, and read-only aggregation on top of already-stable rules
- `Claude` owns schema changes, notification persistence, unread state, cross-module permission semantics, workflow-sensitive logic, and any change that could affect approval correctness

If a phase changes:

- schema
- approval semantics
- unread persistence
- per-user event state
- finance-sensitive workflow behavior

that phase should pause and be reassigned to `Claude` or reviewed jointly.

## 6. Current Confirmed Data Sources

These sources are already visible in the current codebase and are the best starting point for aggregation.

| Wave | Module | Pending Signal | Risk | Recommended Owner |
| --- | --- | --- | --- | --- |
| 1 | Purchase Requests | `status = pending_approval` | Low | `Antigravity` |
| 1 | Supplier Invoices Awaiting Receipt | `status = pending_receipt` | Low | `Antigravity` |
| 1 | Supplier Invoice Discrepancies | `discrepancy_status = pending` | Low | `Antigravity` |
| 1 | Subcontractor Certificates | `status = pending_approval` | Medium | `Antigravity` |
| 1 | Owner Billing Documents | `status = submitted` | Medium | `Antigravity` |
| 2 | Store Issues | `status = pending_approval` | Medium | `Antigravity` |
| 2 | Petty Expenses | `status = draft` or `status = pm_approved` depending on next actor | Medium | `Antigravity` with review |
| 2 | Retention Releases | `status = pending_approval` | Medium | `Antigravity` with review |
| 3 | Cutover Batches | `status = in_review` | Higher | `Claude / Antigravity` |

## 7. V1 Success Criteria

The first release is successful if:

- the user sees a pending-count badge in the top bar
- the user can open a real `Critical Actions` page instead of a placeholder
- the page aggregates at least Wave 1 modules
- each item shows project, document, pending reason, age, and route
- counts are consistent with source module pages
- the feature respects current permissions by reusing existing server-side access paths
- no existing business workflow is broken

## 8. Guardrails

Antigravity should follow these rules during implementation:

- do not create new business statuses
- do not bypass existing approval actions
- do not duplicate approval logic in the client
- do not move finance calculations into the inbox layer
- do not rewrite existing procurement or certificate actions unless explicitly required
- do not add schema changes without a checkpoint

Preferred approach:

- aggregate
- classify
- display
- deep-link

Only later:

- acknowledge
- snooze
- mark as read
- inline approve

## 9. Shared Item Contract

Before building multiple screens, freeze one shared DTO for inbox items.

Suggested minimal contract:

```ts
export type WorkInboxItemType =
  | 'purchase_request'
  | 'supplier_invoice_receipt'
  | 'supplier_invoice_discrepancy'
  | 'subcontractor_certificate'
  | 'owner_billing'
  | 'store_issue'
  | 'petty_expense'
  | 'retention_release'
  | 'cutover_batch'

export type WorkInboxPriority = 'critical' | 'high' | 'normal'

export type WorkInboxItem = {
  id: string
  type: WorkInboxItemType
  sourceId: string
  projectId?: string | null
  projectName?: string | null
  projectCode?: string | null
  companyId?: string | null
  title: string
  subtitle?: string | null
  amount?: number | null
  currency?: string | null
  statusLabel: string
  actionLabel: string
  createdAt?: string | null
  dueAt?: string | null
  ageDays?: number | null
  priority: WorkInboxPriority
  href: string
  dialogKey?:
    | 'purchase_request'
    | 'supplier_invoice'
    | 'subcontractor_certificate'
    | 'owner_billing'
    | 'store_issue'
    | 'petty_expense'
    | 'retention_release'
    | 'cutover_batch'
    | null
  badges?: string[]
  metadata?: Record<string, unknown>
}
```

Rules:

- `href` must always be usable even if dialog behavior fails
- `dialogKey` is optional and should only be used when an existing dialog already exists
- `priority` should be derived, not stored
- `ageDays` should be computed in the adapter layer

### 9.1 Priority Rules for V1

To avoid cross-module inconsistency, V1 should use one simple rule set across all Wave 1 and Wave 2 sources.

Default rule:

- `normal`: `ageDays` from `0` to `6`
- `high`: `ageDays` from `7` to `13`
- `critical`: `ageDays >= 14`

Promotion rule:

- if `dueAt` exists and the item is overdue, promote it one level
- promotion is capped at `critical`

Explicit V1 boundary:

- `amount` does **not** change priority in V1
- module-specific priority overrides are not allowed unless approved during `WI-00`
- if the business later wants amount-based urgency, that should be introduced as a reviewed rule change, not ad-hoc per adapter

### 9.2 Dialog Key Rule

The `dialogKey` set is intentionally wider than the first implemented dialogs.

Rule:

- `dialogKey` may name a supported existing document viewer or action surface
- if a module does not yet have a stable dialog, its inbox item should still ship with `href` only
- adding a brand-new dialog type after Wave 1 requires a `WI-06` review checkpoint so the DTO contract stays stable

## 10. Recommended Build Order

Build in this order:

1. freeze the item contract
2. build the page shell
3. connect Wave 1 read-only sources
4. in parallel: finalize the `Critical Actions` page V1 and add top-bar badge / drawer
5. add deep-link behavior
6. add Wave 2 sources
7. consider persistence and unread state
8. expand later into search and tasks

Parallelization note:

- after `WI-03`, `WI-04` and `WI-05` may proceed in parallel because both depend on the same normalized Wave 1 payload

Performance note for top-bar badge:

- the header badge must not block authenticated page render by doing a heavy full inbox fetch inside `layout.tsx`
- preferred pattern is a lightweight count-only fetch owned by a client component
- use cache-aware client fetching with periodic refresh
- the full recent-items payload should load lazily when the drawer opens
- if React Query is used in the header, move the provider high enough in the layout tree or wrap the header entry point appropriately

## 11. Phases

### Phase WI-00

- Phase ID: `WI-00`
- Title: Scope Freeze and Shared Item Contract
- Difficulty: `L3`
- Recommended Agent: `Claude / Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - freeze the V1 source list
  - freeze the shared `WorkInboxItem` contract
  - freeze priority and aging rules
- Deliverables shipped:
  - DTO shape: `src/lib/work-inbox-types.ts`
  - Priority rules frozen in section 9.1 of this document
  - Dialog key rules frozen in section 9.2
  - Wave 1 + 2 source matrix confirmed in section 6
- Dependencies:
  - none

### Phase WI-01

- Phase ID: `WI-01`
- Title: Page Shell and UI Foundation
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - replace placeholder `critical-actions` page with a real shell
  - build reusable presentational components before real data wiring
- Deliverables shipped:
  - `src/app/(system)/company/critical-actions/page.tsx` — server page with live data
  - `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx` — filter + section logic
  - `src/components/work-inbox/WorkInboxCard.tsx` — priority-aware item card
  - `src/components/work-inbox/WorkInboxSection.tsx` — grouped section with header
  - `src/components/work-inbox/WorkInboxKPI.tsx` — KPI strip (total / critical / high / normal)
- Dependencies:
  - `WI-00`

### Phase WI-02

- Phase ID: `WI-02`
- Title: Shared Aggregation Adapter
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - create one server-side adapter that returns a normalized inbox payload
  - reuse current read paths where possible
- Deliverables shipped:
  - `src/actions/work-inbox.ts` — `getWorkInboxData()` + `getWorkInboxCount()`
  - `src/lib/work-inbox-types.ts` — DTO, `computeAgeDays()`, `derivePriority()`, labels
  - All 5 Wave 1 sources fetched in parallel via `Promise.all`
  - Items sorted: critical first, then by ageDays desc
- Dependencies:
  - `WI-00`

### Phase WI-03

- Phase ID: `WI-03`
- Title: Wave 1 Data Wiring
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - connect the inbox to the safest existing pending sources
- Sources wired:
  - purchase requests `status = pending_approval` ✅
  - supplier invoices `status = pending_receipt` ✅
  - supplier invoice discrepancies `discrepancy_status = pending` ✅
  - subcontractor certificates `status = pending_approval` ✅
  - owner billing documents `status = submitted` ✅
- Notes:
  - all adapters are read-only — zero changes to source module actions
  - each item carries a valid `href` and optional `dialogKey`
- Dependencies:
  - `WI-02`

### Phase WI-04

- Phase ID: `WI-04`
- Title: Critical Actions Page V1
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - make the page usable as a true daily operations surface
- Deliverables shipped:
  - KPI strip: total / critical / high / normal counts
  - Filter bar: by priority + by module type
  - Visual sections shipped:
    - `حرج الآن` — items with priority = critical
    - `بانتظار اعتماد` — PRs, certificates, owner billing (non-critical)
    - `بحاجة إلى استلام أو مطابقة` — invoice receipt + discrepancies (non-critical)
  - All-clear empty state
  - Filter resets to flat list view
- Dependencies:
  - `WI-03`

### Phase WI-05

- Phase ID: `WI-05`
- Title: Header Badge and Recent Items Drawer
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - surface inbox awareness from anywhere in the system
- Deliverables shipped:
  - `src/components/work-inbox/TopbarInboxButton.tsx` — badge button with live count
  - `src/components/work-inbox/WorkInboxDrawer.tsx` — compact drawer with top 10 items
  - `src/app/(system)/layout.tsx` — static "الإشعارات" replaced with `<TopbarInboxButton />`
- Implementation decisions:
  - badge uses standalone `useEffect` fetch — no QueryProvider dependency
  - count refreshes every 2 minutes (non-aggressive)
  - drawer lazy-loads full payload only when opened
  - QueryProvider stayed in `<main>` — no layout restructuring needed
- Dependencies:
  - `WI-03`

### Phase WI-06

- Phase ID: `WI-06`
- Title: Deep Links and Existing Dialog Integration
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - reduce navigation friction using current dialogs and current pages
- Deliverables shipped:
  - purchase request cards → `?view_pr={id}&projectId={id}` (opens `PurchaseRequestDialog`)
  - supplier invoice receipt cards → `?view_invoice={id}&projectId={id}` (opens `SupplierInvoiceDialog`)
  - supplier discrepancy cards → same invoice dialog deep-link
  - subcontractor certificates → list page fallback (no dialog yet)
  - owner billing → list page fallback (no dialog yet)
- Dependencies:
  - `WI-04`
  - `WI-05`

### Phase WI-07

- Phase ID: `WI-07`
- Title: Wave 2 Source Expansion
- Difficulty: `L2`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - expand inbox coverage after Wave 1 stabilizes
- Sources added:
  - store issues `status = pending_approval` ✅ — routes to warehouse issues page
  - petty expenses `status = draft` ✅ — bانتظار موافقة م.م
  - petty expenses `status = pm_approved` ✅ — بانتظار موافقة م.ع
  - retention releases `status = pending_approval` ✅ — routes to suppliers page
- New visual section added:
  - `عمليات داخلية بانتظار اعتماد` — covers store_issue + petty_expense
  - retention_release added to `بانتظار اعتماد` section
- `getWorkInboxCount()` updated to include all 9 sources
- Dependencies:
  - `WI-04`
  - `WI-06`

### Phase WI-07.5

- Phase ID: `WI-07.5`
- Title: Polish & Enhancements
- Difficulty: `L1`
- Recommended Agent: `Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - add quality-of-life UI improvements without architecture changes
  - provide a project-scoped inbox view for project dashboards
- Deliverables shipped:
  - `ProjectWorkInbox.tsx` component built for project dashboards
  - `getWorkInboxData()` and `getWorkInboxCount()` support `projectId` param
  - `WorkInboxDrawer.tsx` has slide-in animation, Escape key support, priority summary, and priority grouping
  - `WorkInboxKPI.tsx` has counting-up animation
  - `WorkInboxSection.tsx` supports collapsible sections
  - `CriticalActionsClient.tsx` has auto-refresh, manual refresh, new empty states
  - `loading.tsx` skeleton added for Critical Actions page
- Dependencies:
  - `WI-07`

### Phase WI-08

- Phase ID: `WI-08`
- Title: Persisted Notifications and Unread State
- Difficulty: `L3`
- Recommended Agent: `Claude` for backend design, `Antigravity` for UI follow-up
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - move from derived pending counts to real per-user notification state
- Deliverables:
  - notification event table or equivalent persistence layer
  - unread / seen state per user
  - mark as read behavior
  - future-ready notification center
- Dependencies:
  - `WI-05`
- Review Notes:
  - this phase changes architecture and should not be folded into the earlier UI-only phases

### Phase WI-09

- Phase ID: `WI-09`
- Title: Global Document Search
- Difficulty: `L3`
- Recommended Agent: `Claude / Antigravity`
- Status: `✅ Done`
- Completed: `2026-04-02`
- Goal:
  - extend the inbox into a broader operating cockpit
- Deliverables:
  - global search entry in top bar
  - document search by number
  - party and project lookup
  - *Personal Tasks track cancelled explicitly by user request*
- Dependencies:
  - `WI-04`
- Review Notes:
  - this should be treated as a separate product track after inbox V1 is stable

## 12. Ready-to-Assign Antigravity Tickets

These are the cleanest implementation packets for `Antigravity`.

### Ticket AG-WI-01

- Goal:
  - build presentational components for the inbox page
- Write Scope:
  - `src/components/work-inbox/*`
  - `src/app/(system)/company/critical-actions/page.tsx`
- Constraints:
  - use mock data only
  - do not touch business actions yet

### Ticket AG-WI-02

- Goal:
  - create normalized `WorkInboxItem` type and aggregation helper
- Write Scope:
  - `src/actions/work-inbox.ts`
  - `src/lib/work-inbox.ts`
- Constraints:
  - read-only aggregation
  - no schema changes

### Ticket AG-WI-03

- Goal:
  - wire Wave 1 sources into the critical actions page
- Write Scope:
  - `src/actions/work-inbox.ts`
  - `src/app/(system)/company/critical-actions/page.tsx`
  - `src/components/work-inbox/*`
- Constraints:
  - counts must match source pages

### Ticket AG-WI-04

- Goal:
  - add top-bar inbox button, badge, and recent items drawer
- Write Scope:
  - `src/app/(system)/layout.tsx`
  - `src/components/work-inbox/TopbarInboxButton.tsx`
  - `src/components/work-inbox/TopbarInboxDrawer.tsx`
- Constraints:
  - use existing authenticated shell
  - avoid global state libraries unless already needed
  - do not block layout render with a heavy server fetch
  - prefer count-only fetch for badge and lazy-load drawer contents

### Ticket AG-WI-05

- Goal:
  - connect inbox items to current dialogs and routes
- Write Scope:
  - `src/components/work-inbox/*`
  - routing helpers
- Constraints:
  - prefer existing document dialogs over new modal systems

### Ticket AG-WI-06

- Goal:
  - expand coverage to Wave 2 modules
- Write Scope:
  - `src/actions/work-inbox.ts`
  - `src/components/work-inbox/*`
- Constraints:
  - if permission logic is unclear, stop and escalate

## 13. QA Checklist

Every phase should be reviewed against this checklist:

- Does the item count match the source module?
- Does each inbox item open the correct document?
- Is the Arabic label understandable to non-technical users?
- Does the page remain usable on smaller screens?
- Does the feature avoid duplicating core approval logic?
- Does it preserve current permission checks?
- Does it degrade gracefully if one module source fails?

## 14. Definition of Done for Inbox V1

Inbox V1 is done when:

- `critical-actions` is a real operational screen
- top bar exposes a live pending count
- Wave 1 sources are aggregated
- users can move from pending item to source document in one click
- the implementation did not alter core financial or workflow semantics
- the feature is ready for a later persistence layer

## 15. Final Recommendation

The safest and highest-value path is:

1. ship read-only unified inbox first
2. ship top-bar awareness second
3. expand source coverage third
4. only then consider unread persistence and search

This keeps the first release professional, useful, and low-risk while staying well within the kind of work `Antigravity` handles best.
