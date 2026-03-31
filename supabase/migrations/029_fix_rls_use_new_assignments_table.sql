-- ============================================================
-- Migration 029: Fix ALL RLS policies to use new assignments table
-- ============================================================
-- Problem:
--   `user_access_scopes` is EMPTY. Every RLS policy reads from it.
--   Data is in `user_permission_group_assignments` (new table, migration 028).
-- Solution:
--   1. Two SECURITY DEFINER helper functions.
--   2. DROP + recreate every affected policy with its exact original name.
-- ============================================================

-- ─── Helper functions ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_has_project_scope(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permission_group_assignments a
    WHERE a.user_id    = auth.uid()
      AND a.is_active  = true
      AND (
        a.scope_type IN ('all_projects', 'main_company')
        OR (a.scope_type = 'selected_project' AND a.project_id = p_project_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_company_scope()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permission_group_assignments a
    WHERE a.user_id   = auth.uid()
      AND a.is_active = true
      AND a.scope_type IN ('all_projects', 'main_company')
  );
$$;

-- ─── 1. projects ──────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_read" ON public.projects;
CREATE POLICY "projects_read" ON public.projects
  FOR SELECT USING (
    archived_at IS NULL
    AND (
      public.is_current_user_super_admin()
      OR public.user_has_project_scope(projects.id)
    )
  );

-- ─── 2. project_work_items (migration 012) ───────────────────
DROP POLICY IF EXISTS "Users can manage work items in their scoped projects" ON public.project_work_items;
CREATE POLICY "Users can manage work items in their scoped projects"
  ON public.project_work_items FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(project_work_items.project_id)
  );

-- ─── 3. subcontract_agreements (migration 012) ───────────────
DROP POLICY IF EXISTS "Users can manage agreements in their scoped projects" ON public.subcontract_agreements;
CREATE POLICY "Users can manage agreements in their scoped projects"
  ON public.subcontract_agreements FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(subcontract_agreements.project_id)
  );


-- ─── 4. subcontractor_certificates (migration 013) ───────────
DROP POLICY IF EXISTS "Users can manage certificates in their scoped projects" ON public.subcontractor_certificates;
CREATE POLICY "Users can manage certificates in their scoped projects"
  ON public.subcontractor_certificates FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(subcontractor_certificates.project_id)
  );

DROP POLICY IF EXISTS "Users can view and manage cert lines via certificate header" ON public.subcontractor_certificate_lines;
CREATE POLICY "Users can view and manage cert lines via certificate header"
  ON public.subcontractor_certificate_lines FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontractor_certificates c
      WHERE c.id = subcontractor_certificate_lines.certificate_id
        AND public.user_has_project_scope(c.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage allowances via certificate header" ON public.subcontractor_certificate_allowances;
CREATE POLICY "Users can manage allowances via certificate header"
  ON public.subcontractor_certificate_allowances FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontractor_certificates c
      WHERE c.id = subcontractor_certificate_allowances.certificate_id
        AND public.user_has_project_scope(c.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage deductions via certificate header" ON public.subcontractor_certificate_deductions;
CREATE POLICY "Users can manage deductions via certificate header"
  ON public.subcontractor_certificate_deductions FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subcontractor_certificates c
      WHERE c.id = subcontractor_certificate_deductions.certificate_id
        AND public.user_has_project_scope(c.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage retention releases in scoped projects" ON public.subcontractor_retention_releases;
CREATE POLICY "Users can manage retention releases in scoped projects"
  ON public.subcontractor_retention_releases FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(subcontractor_retention_releases.project_id)
  );

-- ─── 5. purchase_requests (migration 014) ───────────────────
DROP POLICY IF EXISTS "Users access PRs in scoped projects" ON public.purchase_requests;
CREATE POLICY "Users access PRs in scoped projects" ON public.purchase_requests
  FOR SELECT USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(purchase_requests.project_id)
  );

-- ─── 6. supplier_invoices (migration 014) ───────────────────
DROP POLICY IF EXISTS "Users access SI in scoped projects" ON public.supplier_invoices;
CREATE POLICY "Users access SI in scoped projects" ON public.supplier_invoices
  FOR SELECT USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(supplier_invoices.project_id)
  );

-- ─── 7. supplier_return_invoices (migration 014) ─────────────
DROP POLICY IF EXISTS "Users access Returns in scoped projects" ON public.supplier_return_invoices;
CREATE POLICY "Users access Returns in scoped projects" ON public.supplier_return_invoices
  FOR SELECT USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(supplier_return_invoices.project_id)
  );

-- ─── 8. cutover tables (migration 010) ───────────────────────
DROP POLICY IF EXISTS "Users can manage cutover batches in their companies" ON public.cutover_batches;
CREATE POLICY "Users can manage cutover batches in their companies"
  ON public.cutover_batches FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_project_scope(cutover_batches.project_id)
  );

DROP POLICY IF EXISTS "Users can manage financial balances if they have access to batch" ON public.cutover_financial_balances;
CREATE POLICY "Users can manage financial balances if they have access to batch"
  ON public.cutover_financial_balances FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_financial_balances.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage subcontractor positions if they have access to batch" ON public.cutover_subcontractor_positions;
CREATE POLICY "Users can manage subcontractor positions if they have access to batch"
  ON public.cutover_subcontractor_positions FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_subcontractor_positions.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage supplier positions if they have access to batch" ON public.cutover_supplier_positions;
CREATE POLICY "Users can manage supplier positions if they have access to batch"
  ON public.cutover_supplier_positions FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_supplier_positions.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage owner positions if they have access to batch" ON public.cutover_owner_positions;
CREATE POLICY "Users can manage owner positions if they have access to batch"
  ON public.cutover_owner_positions FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_owner_positions.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage warehouse stock if they have access to batch" ON public.cutover_warehouse_stock;
CREATE POLICY "Users can manage warehouse stock if they have access to batch"
  ON public.cutover_warehouse_stock FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_warehouse_stock.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage employee custody if they have access to batch" ON public.cutover_employee_custody;
CREATE POLICY "Users can manage employee custody if they have access to batch"
  ON public.cutover_employee_custody FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.cutover_batches cb
      WHERE cb.id = cutover_employee_custody.batch_id
        AND public.user_has_project_scope(cb.project_id)
    )
  );

-- ─── 9. store_issues (migration 021) ─────────────────────────
DROP POLICY IF EXISTS "store_issues_read"   ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_insert" ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_update" ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_delete" ON public.store_issues;
DROP POLICY IF EXISTS "store_issues_write"  ON public.store_issues;

CREATE POLICY "store_issues_read" ON public.store_issues
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND archived_at IS NULL
    AND (
      public.is_current_user_super_admin()
      OR public.user_has_project_scope(store_issues.project_id)
    )
  );

CREATE POLICY "store_issues_insert" ON public.store_issues
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      public.is_current_user_super_admin()
      OR public.user_has_project_scope(store_issues.project_id)
    )
  );

CREATE POLICY "store_issues_update" ON public.store_issues
  FOR UPDATE USING (
    public.is_current_user_super_admin()
    OR auth.role() = 'service_role'
    OR public.user_has_project_scope(store_issues.project_id)
  );

CREATE POLICY "store_issues_delete" ON public.store_issues
  FOR DELETE USING (
    public.is_current_user_super_admin()
    OR auth.role() = 'service_role'
  );

-- ─── 10. company_purchase_invoices (migration 019) ───────────
DROP POLICY IF EXISTS "Company purchase invoices accessible by main_company scope" ON public.company_purchase_invoices;
CREATE POLICY "Company purchase invoices accessible by main_company scope"
  ON public.company_purchase_invoices FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_company_scope()
  );

DROP POLICY IF EXISTS "Company purchase invoice lines via header" ON public.company_purchase_invoice_lines;
CREATE POLICY "Company purchase invoice lines via header"
  ON public.company_purchase_invoice_lines FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_company_scope()
  );

DROP POLICY IF EXISTS "expense_categories_write" ON public.expense_categories;
CREATE POLICY "expense_categories_write" ON public.expense_categories
  FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_company_scope()
  );

-- ─── 11. financial_accounts (migration 017) ──────────────────
DROP POLICY IF EXISTS "FNC and TRE Users can view corporate financial accounts" ON public.financial_accounts;
CREATE POLICY "FNC and TRE Users can view corporate financial accounts"
  ON public.financial_accounts FOR SELECT TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR (project_id IS NULL     AND public.user_has_company_scope())
    OR (project_id IS NOT NULL AND public.user_has_project_scope(project_id))
  );

-- ─── 12. financial_transactions (migration 017) ──────────────
DROP POLICY IF EXISTS "Financial transactions are viewable by authorized scopes" ON public.financial_transactions;
CREATE POLICY "Financial transactions are viewable by authorized scopes"
  ON public.financial_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_accounts fa
      WHERE fa.id = financial_account_id
        AND (
          public.is_current_user_super_admin()
          OR (fa.project_id IS NULL     AND public.user_has_company_scope())
          OR (fa.project_id IS NOT NULL AND public.user_has_project_scope(fa.project_id))
        )
    )
  );

-- ─── 13. payment_vouchers (migration 017) ────────────────────
DROP POLICY IF EXISTS "Payment Vouchers accessible by scope"                ON public.payment_vouchers;
DROP POLICY IF EXISTS "Authorized roles can manage corporate payment drafts" ON public.payment_vouchers;

CREATE POLICY "Payment Vouchers accessible by scope" ON public.payment_vouchers
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR (project_id IS NULL     AND public.user_has_company_scope())
    OR (project_id IS NOT NULL AND public.user_has_project_scope(project_id))
  );

CREATE POLICY "Authorized roles can manage corporate payment drafts" ON public.payment_vouchers
  FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR public.user_has_company_scope()
    OR public.user_has_project_scope(project_id)
  );

-- ─── 14. payment_voucher_parties & payment_allocations ───────
DROP POLICY IF EXISTS "Authorized roles can insert voucher components" ON public.payment_voucher_parties;
CREATE POLICY "Authorized roles can insert voucher components"
  ON public.payment_voucher_parties FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_permission_group_assignments a
      WHERE a.user_id = auth.uid() AND a.is_active = true
    )
  );

DROP POLICY IF EXISTS "Authorized roles can allocate payments" ON public.payment_allocations;
CREATE POLICY "Authorized roles can allocate payments"
  ON public.payment_allocations FOR ALL TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_permission_group_assignments a
      WHERE a.user_id = auth.uid() AND a.is_active = true
    )
  );

-- ─── 15. petty_expenses & expense taxonomy (migrations 016 & 026) ─
-- Note: employee_custody_accounts & employee_custody_transactions were
-- dropped in migration 026. Only these tables remain:

-- expense_groups & expense_items — open to all authenticated after migration 026
DROP POLICY IF EXISTS "expense_groups_select" ON public.expense_groups;
CREATE POLICY "expense_groups_select" ON public.expense_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_items_select" ON public.expense_items;
CREATE POLICY "expense_items_select" ON public.expense_items
  FOR SELECT TO authenticated USING (true);

-- petty_expenses
DROP POLICY IF EXISTS "petty_expenses_select"        ON public.petty_expenses;
DROP POLICY IF EXISTS "petty_expenses_insert_update" ON public.petty_expenses;
DROP POLICY IF EXISTS "petty_expenses_read"          ON public.petty_expenses;
DROP POLICY IF EXISTS "petty_expenses_write"         ON public.petty_expenses;
CREATE POLICY "petty_expenses_select" ON public.petty_expenses
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_current_user_super_admin()
    OR public.user_has_project_scope(petty_expenses.project_id)
    OR public.user_has_company_scope()
  );
CREATE POLICY "petty_expenses_insert_update" ON public.petty_expenses
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_current_user_super_admin()
    OR public.user_has_company_scope()
  );



-- ─── Refresh schema cache ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';
