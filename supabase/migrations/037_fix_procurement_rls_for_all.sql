-- ============================================================
-- Migration 037: Fix ALL RLS policies for procurement tables from FOR SELECT to FOR ALL
-- ============================================================
-- Problem:
--   Migration 029 accidentally converted the main policies for 
--   purchase_requests, supplier_invoices, and supplier_return_invoices
--   to FOR SELECT instead of FOR ALL, breaking INSERT/UPDATE capabilities.
-- Solution:
--   DROP the SELECT policies and recreate them as FOR ALL.
-- ============================================================

-- ─── 1. purchase_requests ───────────────────────────────────
DROP POLICY IF EXISTS "Users access PRs in scoped projects" ON public.purchase_requests;
CREATE POLICY "Users access PRs in scoped projects" ON public.purchase_requests
  FOR ALL USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(purchase_requests.project_id)
  );

-- ─── 2. supplier_invoices ───────────────────────────────────
DROP POLICY IF EXISTS "Users access SI in scoped projects" ON public.supplier_invoices;
CREATE POLICY "Users access SI in scoped projects" ON public.supplier_invoices
  FOR ALL USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(supplier_invoices.project_id)
  );

-- ─── 3. supplier_return_invoices ────────────────────────────
DROP POLICY IF EXISTS "Users access Returns in scoped projects" ON public.supplier_return_invoices;
CREATE POLICY "Users access Returns in scoped projects" ON public.supplier_return_invoices
  FOR ALL USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(supplier_return_invoices.project_id)
  );
