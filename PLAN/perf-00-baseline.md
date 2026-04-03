# PERF-00 — Performance Baseline Capture

Captured: 2026-04-03

This document is the fixed reference for the PERF-08 final audit.
All comparisons must be made against the numbers in this file.

---

## Build Baseline — `next build` Output (2026-04-03)

### Shared First Load JS

| Chunk | Size |
|---|---|
| chunks/660-b91f92c6ed6f25d4.js | 31.5 kB |
| chunks/e6e143be-e467026c992ffcd0.js | 53.6 kB |
| other shared chunks (total) | 1.96 kB |
| **Total shared First Load JS** | **87.1 kB** |

Middleware: **79.9 kB**

---

### Hot Route Baselines (Full Route Size = Page JS + Shared JS)

| Route | Page JS | Total First Load JS |
|---|---|---|
| `/company` | 2.48 kB | **105 kB** |
| `/company/approvals` | 2.63 kB | **172 kB** |
| `/company/critical-actions` | 4.8 kB | **98.6 kB** |
| `/company/purchases` | 9.16 kB | **173 kB** |
| `/company/purchases/invoices` | 2.26 kB | **166 kB** |
| `/company/purchases/approved-prs` | 303 B | **162 kB** |
| `/company/projects` | 5.92 kB | **167 kB** |
| `/company/treasury` | 2.95 kB | **101 kB** |
| `/company/treasury/queue` | 4.11 kB | **158 kB** |
| `/company/main_warehouse/issues` | 7.24 kB | **94.3 kB** |
| `/company/main_warehouse/items` | 8.61 kB | **156 kB** |
| `/company/main_warehouse/items/[id]` | 11 kB | **165 kB** |
| `/company/parties` | 4.07 kB | **158 kB** |
| `/projects/[id]/procurement/invoices` | 1.14 kB | **172 kB** |
| `/projects/[id]/procurement/requests` | 4.71 kB | **165 kB** |
| `/projects/[id]/procurement/requests/[pr_id]` | 434 B | **170 kB** |
| `/projects/[id]/payments/queue` | 4 kB | **168 kB** |
| `/projects/[id]/project_warehouse/issues` | 9.51 kB | **96.6 kB** |
| `/projects/[id]/certificates` | 12 kB | **99.1 kB** |
| `/projects/[id]/collections` | 7.78 kB | **155 kB** |
| `/projects/[id]/petty-expenses` | 8.11 kB | **155 kB** |
| `/login` | 1.53 kB | **149 kB** |

---

### Routes Above 160 kB (Primary Targets)

| Route | Total Size |
|---|---|
| `/company/purchases` | 173 kB |
| `/company/approvals` | 172 kB |
| `/projects/[id]/procurement/invoices` | 172 kB |
| `/company/purchases/invoices` | 166 kB |
| `/company/projects` | 167 kB |
| `/projects/[id]/procurement/requests` | 165 kB |
| `/company/main_warehouse/items/[id]` | 165 kB |
| `/company/purchases/approved-prs` | 162 kB |
| `/projects/[id]/procurement/invoices/[inv_id]` | 162 kB |
| `/projects/[id]/agreements` | 159 kB |
| `/company/parties` | 158 kB |
| `/company/treasury/queue` | 158 kB |
| `/company/main_warehouse/items` | 156 kB |
| `/projects/[id]/collections` | 155 kB |
| `/projects/[id]/petty-expenses` | 155 kB |

**Target:** Move all common operational routes below 160 kB.

---

## Polling / Timed Refresh Inventory

| Surface | Behavior | Interval | Source File |
|---|---|---|---|
| `TopbarInboxButton` | `getWorkInboxCount()` via `useEffect` + `setInterval` | **every 2 minutes** | `src/components/work-inbox/TopbarInboxButton.tsx:13-26` |
| `CriticalActionsClient` | `router.refresh()` via `setInterval` | **every 5 minutes** | `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx:75-81` |
| `DiscrepancyBadge` (Sidebar) | `getDiscrepancyInvoices()` via `useEffect` on mount | **once on mount** (no interval) | `src/app/(system)/SidebarNav.tsx:10-12` |

---

## Client Mount Fetch Inventory

| Component | Fetch | Trigger |
|---|---|---|
| `TopbarInboxButton` | `getWorkInboxCount()` — 9 parallel `COUNT` queries | mount + 2-min interval |
| `DiscrepancyBadge` | `getDiscrepancyInvoices()` — full row fetch | mount once |

---

## Known Issues Observed in Source Review

| Issue | File | Notes |
|---|---|---|
| `ReactQueryDevtools` ships in production bundle | `src/providers/query-provider.tsx:4,25` | No `process.env.NODE_ENV` guard |
| `TopbarInboxButton` runs 9 parallel COUNT queries on every mount and every 2 min | `src/components/work-inbox/TopbarInboxButton.tsx` | `getWorkInboxCount` fires 9 Supabase HEAD requests |
| `CriticalActionsClient` auto-refreshes every 5 min via `router.refresh()` | `src/app/(system)/company/critical-actions/CriticalActionsClient.tsx:75-81` | Triggers full server re-render of the entire page |
| `DiscrepancyBadge` fires a full-row fetch (not COUNT) on every sidebar mount | `src/app/(system)/SidebarNav.tsx:11` | `getDiscrepancyInvoices()` returns full rows, not a count |
| `getWorkInboxCount` duplicates all 9 queries that `getWorkInboxData` already runs | `src/actions/work-inbox.ts:442-471` | Badge count has no shared source of truth with full inbox data |

---

## Success Targets (From Plan Section 2)

- [ ] Shared First Load JS below **80 kB** (currently 87.1 kB)
- [ ] No common operational route above **160 kB** without explicit reason
- [ ] Global shell performs **zero non-essential client fetches** on initial mount
- [ ] Critical actions page stops **background refresh polling** by default
- [ ] Hot routes show measurable reduction in at least one of: server round-trips, TTFB, server response time

---

*This file must not be updated during the optimization pass. It is the fixed reference for PERF-08.*
