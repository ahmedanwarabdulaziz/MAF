-- Migration: 059_performance_indexes.sql
-- PERF-06 + PERF-09: Add composite read indexes for hot query paths.
--
-- All column names verified against actual migration files:
--   001_users_and_access.sql
--   014_supplier_procurement.sql
--   017_treasury_and_payments.sql
--   057_financial_transactions_enrichment.sql
--
-- Existing indexes NOT duplicated here:
--   idx_fin_tx_project     (financial_transactions.project_id)           → 057
--   idx_fin_tx_account     (financial_transactions.financial_account_id) → 017
--   idx_fin_tx_ref         (financial_transactions.reference_type, reference_id) → 017
--   idx_pv_project         (payment_vouchers.project_id)                 → 017

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. purchase_requests
--    Hot path: list page filters by project_id + status, ordered by date.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_purchase_requests_project_status_date
  ON public.purchase_requests(project_id, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. supplier_invoices
--    Hot path: same filter pattern as purchase_requests.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_project_status_date
  ON public.supplier_invoices(project_id, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. invoice_receipt_confirmations
--    Hot path: joined on every supplier invoice detail load.
--    Real FK column is supplier_invoice_id (verified: 014_supplier_procurement.sql).
--    UNIQUE constraint creates a B-tree index but we make it explicit for clarity
--    and to ensure the planner uses it on joins.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoice_receipt_confirmations_invoice
  ON public.invoice_receipt_confirmations(supplier_invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. user_permission_group_assignments
--    Hot path: queried on every permission check call.
--    Real columns: user_id, permission_group_id (verified: 001_users_and_access.sql).
--    UNIQUE constraint (user_id, permission_group_id) exists, but this index
--    adds is_active for active-only filter efficiency.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_upga_user_active
  ON public.user_permission_group_assignments(user_id, is_active, permission_group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. permission_group_permissions
--    Hot path: looked up in every permission resolution.
--    Real columns: permission_group_id, module_key, action_key (verified: 001_users_and_access.sql).
--    UNIQUE constraint covers (permission_group_id, module_key, action_key),
--    which already provides a covering index. This is added for explicit documentation.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pgp_group_module_action
  ON public.permission_group_permissions(permission_group_id, module_key, action_key)
  WHERE is_allowed = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. financial_transactions — composite for treasury ordered list
--    No existing index covers the combination of account + date.
--    The treasury page lists transactions per account ordered by date.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fin_tx_account_date
  ON public.financial_transactions(financial_account_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERF-09: user_access_scopes — THE single most important index in the system.
--
-- The RLS policy on almost every business table contains:
--   EXISTS (SELECT 1 FROM public.user_access_scopes s
--           WHERE s.user_id = auth.uid() AND s.is_active = true
--           AND (s.scope_type IN (...) OR ...))
--
-- This sub-select runs PER ROW for every query on every RLS-protected table.
-- One composite index here benefits ALL of them simultaneously.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_access_scopes_user_active
  ON public.user_access_scopes(user_id, is_active, scope_type);

COMMIT;
