-- Migration: 064_perf07_indexes.sql
-- PERF-07: Additional performance indexes for hot query paths not covered in 059.
--
-- This migration targets:
--   1. store_issues   — hottest list page: filtered by warehouse_id + status
--   2. store_issues   — project warehouse list: filtered by project_id via warehouse
--   3. system_notifications — composite for the (user_id + is_read) pattern
--   4. supplier_invoices — discrepancy_status filter used by getDiscrepancyCount()
--   5. user_permission_group_assignments — additional scope_type column for the
--      OR filter used by requirePermission / hasPermission / getAuthorizationContext
--      (scope_type IN (all_projects, main_company) OR project_id = ?)
--
-- All verified against existing migration files before creation.
-- Migration 059 already covers:
--   idx_purchase_requests_project_status_date
--   idx_supplier_invoices_project_status_date
--   idx_invoice_receipt_confirmations_invoice
--   idx_upga_user_active
--   idx_pgp_group_module_action
--   idx_fin_tx_account_date
--   idx_user_access_scopes_user_active (legacy table — kept for safety)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. store_issues — main warehouse list
--    Hot path: warehouse issues list filters by warehouse_id, ordered by date.
--    (warehouse_id is the primary filter for the main warehouse issues page)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_store_issues_warehouse_status_date
  ON public.store_issues(warehouse_id, status, issue_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. store_issues — project warehouse list
--    Hot path: project issues page filters by project_id (via warehouse join).
--    Also covers the getDiscrepancyCount() filter: project_id + discrepancy_status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_store_issues_project_status_date
  ON public.store_issues(project_id, status, issue_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. system_notifications — composite for inbox queries
--    Hot path: getUserNotifications() filters by user_id WHERE is_read = false,
--    ordered by created_at DESC.
--    The existing idx_system_notifications_user_id + idx_system_notifications_is_read
--    are separate single-column indexes — the planner must bitmap AND them.
--    A composite (user_id, is_read, created_at) covers the full pattern in one scan.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_system_notifications_user_unread_date
  ON public.system_notifications(user_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. supplier_invoices — discrepancy_status
--    Hot path: getDiscrepancyCount() filters by discrepancy_status = 'pending'
--    across all project invoices. This is the DiscrepancyBadge query.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_discrepancy_status
  ON public.supplier_invoices(discrepancy_status)
  WHERE discrepancy_status IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. user_permission_group_assignments — scope_type partial index
--    Hot path: getAuthorizationContext / requirePermission / hasPermission all
--    filter by user_id + is_active + scope_type IN (all_projects, main_company).
--
--    Migration 059 added idx_upga_user_active (user_id, is_active, permission_group_id).
--    This adds scope_type to help the OR filter that checks scope_type values
--    in the project-scoped permission resolution path.
--
--    The query pattern is:
--      WHERE user_id = $1 AND is_active = true
--      AND (scope_type IN ('all_projects','main_company')
--           OR (scope_type = 'selected_project' AND project_id = $2))
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_upga_user_active_scope
  ON public.user_permission_group_assignments(user_id, is_active, scope_type, project_id)
  WHERE is_active = true;

COMMIT;
