# Performance Optimization Follow-Up Fixes

Date: 2026-04-02

Purpose:
This document captures the remaining fixes discovered during review of the recent performance optimization work. The production build currently passes, but these items should be completed before we treat the optimization rollout as fully correct and stable.

Important safety rule:
Do not edit already-applied migrations in place if they have been run in any shared environment. For DB corrections, create new corrective migrations after `060`.

Suggested new migrations:
- `061_performance_index_corrections.sql`
- `062_dashboard_aggregation_corrections.sql`

---

## Current Status

What is already good:
- The app builds successfully in production mode.
- The main plan document is much closer to execution-ready.
- The performance work clearly moved the codebase in the right direction.

What still needs follow-up:
- one correctness bug in permission resolution
- one remaining auth/permission round-trip issue
- one outdated RLS/index strategy in the DB migration
- one dashboard semantic decision that must be confirmed
- one layout optimization that is still unfinished
- one plan-document consistency cleanup

---

## Execution Order

Recommended order:

1. `FIX-01` Permission correctness regression
2. `FIX-02` Auth helper round-trip cleanup
3. `FIX-03` Corrective index migration
4. `FIX-04` Dashboard aggregation parity check
5. `FIX-05` Layout dialog lazy-load cleanup
6. `FIX-06` Plan document cleanup

---

## FIX-01: Permission Correctness Regression

Priority: High

Problem:
`src/lib/permissions.ts` now uses the current requester profile via `getUserProfile()` even in functions that accept a `userId` argument. That breaks admin workflows that inspect another user's permissions, because the current viewer identity can leak into the target-user calculation.

Files to update:
- `src/lib/permissions.ts`
- `src/lib/system-context.ts`
- `src/app/(system)/company/settings/access-scopes/actions.ts`

What to do:
- Separate "current requester profile" from "target user profile".
- Keep request-scoped caching, but make it safe for arbitrary target users.
- Add a helper such as `getUserProfileById(userId)` if needed.
- Ensure `getEffectivePermissions(userId, context)` uses the passed `userId` for target permission resolution.
- Ensure super-admin short-circuit logic is applied to the target user only when that is the intended behavior.
- Re-check `fetchUserPermissionsMatrix(userId, projectId?)` so a super admin viewing another user sees that user's actual permissions, not full-system permissions by accident.

Acceptance criteria:
- Viewing your own permissions still works.
- A super admin viewing another user's permissions gets the target user's real matrix.
- A non-super-admin target does not inherit the current viewer's super-admin bypass.
- No change breaks existing permission checks for current-user flows.

Verification:
- Test `fetchUserPermissionsMatrix()` for:
  - super admin viewing self
  - super admin viewing another user
  - regular user data path

---

## FIX-02: Auth Helper Round-Trip Cleanup

Priority: Medium

Problem:
`src/lib/auth.ts` still has hot paths that do extra `auth.getUser()` and `users` queries even after the caching refactor. This weakens the intended PERF-02 / PERF-03 wins.

Files to update:
- `src/lib/auth.ts`
- optionally `src/lib/system-context.ts`

What to do:
- Replace remaining `getSession()`-based permission paths with cached `getAuthUser()` / `getUserProfile()` where safe.
- Remove duplicate profile fetches in `hasPermission()` and `requirePermission()`.
- Make current-user permission checks consistently use the request-scoped cached identity/profile.
- Preserve behavior for redirects and auth failures.

Acceptance criteria:
- `hasPermission()` and `requirePermission()` do not re-fetch the same current user/profile data unnecessarily within one request.
- Existing redirect behavior remains intact.
- No security downgrade from switching helpers.

Verification:
- Production build passes.
- Spot-check company and project permission-gated pages.

---

## FIX-03: Corrective DB Index Migration

Priority: High

Problem:
`supabase/migrations/059_performance_indexes.sql` still contains outdated index logic:
- it treats `user_access_scopes` as the primary RLS hot path
- it adds `user_permission_group_assignments(user_id, is_active, permission_group_id)` which does not match the current scoped permission filters
- it creates indexes that may duplicate UNIQUE-backed coverage

Files to update:
- add new migration: `supabase/migrations/061_performance_index_corrections.sql`
- do not rewrite `059_performance_indexes.sql` if it is already applied anywhere shared

What to do:
- Drop or avoid relying on `idx_user_access_scopes_user_active` unless `EXPLAIN ANALYZE` proves it is still needed.
- Add scope-aware indexes that match the real query patterns:
  - `user_permission_group_assignments(user_id, is_active, scope_type, project_id)`
  - `user_permission_group_assignments(user_id, is_active, scope_type, warehouse_id)`
- Re-check whether `invoice_receipt_confirmations(supplier_invoice_id)` needs an explicit index, since `supplier_invoice_id` is already UNIQUE.
- Re-check whether `permission_group_permissions(permission_group_id, module_key, action_key)` needs another explicit index, since a UNIQUE constraint already exists there too.
- Document which existing indexes are kept, which are verified-only, and which are corrected.

Schema references:
- `supabase/migrations/029_fix_rls_use_new_assignments_table.sql`
- `supabase/migrations/001_users_and_access.sql`
- `supabase/migrations/014_supplier_procurement.sql`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`

Acceptance criteria:
- The corrective migration matches the actual RLS helper path on `user_permission_group_assignments`.
- The corrective migration matches the real auth/permission query filters in the app code.
- No duplicate low-value indexes are added without justification.

Verification:
- Run `EXPLAIN ANALYZE` on representative permission-scope lookups.
- Confirm the planner uses the new UPGA indexes on the hot paths.

---

## FIX-04: Dashboard Aggregation Parity Check

Priority: Medium

Problem:
`supabase/migrations/060_dashboard_aggregations.sql` uses `projects.estimated_contract_value` as project `budget`. That may be correct, but it changes the meaning of "budget" unless product explicitly wants that definition.

Files to review:
- `supabase/migrations/060_dashboard_aggregations.sql`
- `src/actions/dashboards.ts`
- any previous dashboard source logic if needed

What to do:
- Confirm with product/business whether project dashboard `budget` should mean:
  - estimated contract value
  - estimated project cost / BOQ-derived total
  - some other finance-specific metric
- If the current SQL view is wrong, create a corrective migration after `060` rather than editing `060` in place.
- Make the chosen meaning explicit in the SQL comments and action-layer naming.

Acceptance criteria:
- `vw_project_financial_summary.budget` matches the intended business meaning.
- The dashboard does not silently change meaning after the performance refactor.
- If semantics changed intentionally, it is documented clearly.

Verification:
- Compare at least one known project before/after using real data.
- Confirm the displayed dashboard numbers match product expectation.

---

## FIX-05: Layout Dialog Lazy-Load Cleanup

Priority: Medium

Problem:
The system layout still mounts procurement dialogs globally, so unrelated pages continue paying extra shell cost.

Files to update:
- `src/app/(system)/layout.tsx`
- any related dialog entry points/components

What to do:
- Remove global always-mounted procurement dialogs from the shared system shell.
- Lazy-load them only where they are needed.
- Keep user-visible behavior intact.

Acceptance criteria:
- Unrelated pages do not mount procurement dialogs.
- Procurement flows still open correctly where used.
- No regression in routing or modal behavior.

Verification:
- Check at least one procurement page and one unrelated page.
- Rebuild and verify no import/runtime errors.

---

## FIX-06: Plan Document Cleanup

Priority: Low

Problem:
`PLAN/performance optimization plan - extended.md` mixes "future phases" wording with "done" statuses in a way that can confuse handoff and execution tracking.

Files to update:
- `PLAN/performance optimization plan - extended.md`

What to do:
- Make execution status, next phases, and deferred work sections consistent.
- Ensure `PERF-08` is either:
  - clearly marked as done and no longer future work
  - or clearly marked as deferred and removed from completed sections
- Keep the doc aligned with the actual repo state.

Acceptance criteria:
- A new agent can read the plan and understand what is done, what is pending, and what is intentionally deferred.
- No contradictory package status remains.

---

## Definition of Done

This follow-up plan is complete when:
- permission inspection for arbitrary users is correct
- current-user permission helpers avoid unnecessary duplicate round-trips
- the DB index strategy matches the actual RLS and scoped-query path
- dashboard budget semantics are confirmed and documented
- procurement dialogs are no longer globally mounted in the shared shell
- the extended plan document reflects reality cleanly
- production build still passes

---

## Final Verification Checklist

- Run a production build.
- Manually verify one company page and one project page.
- Manually verify one procurement page.
- Manually verify the access-scopes permission matrix for another user.
- Review the corrective migration SQL before applying it.
