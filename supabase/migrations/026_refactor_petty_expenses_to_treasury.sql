-- Migration 026: Refactor Petty Expenses to use Project Cashboxes
-- Eliminates personal employee custody ledgers and connects expenses directly to company/project treasury accounts.

-- 1. Modify petty_expenses to point to financial_accounts
ALTER TABLE public.petty_expenses 
  ADD COLUMN IF NOT EXISTS financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT;

-- For any existing data (if any), we need to handle it or drop it. Since this is a structural shift in Dev/Test, 
-- we will drop the employee_custody_account_id. Note: if there is data, this will drop the relationship.
ALTER TABLE public.petty_expenses 
  DROP COLUMN IF EXISTS employee_custody_account_id CASCADE;

-- Also fix the foreign keys for users so PostgREST can join them correctly
ALTER TABLE public.petty_expenses
  DROP CONSTRAINT IF EXISTS petty_expenses_created_by_fkey,
  DROP CONSTRAINT IF EXISTS petty_expenses_pm_approved_by_fkey,
  DROP CONSTRAINT IF EXISTS petty_expenses_gm_approved_by_fkey;

ALTER TABLE public.petty_expenses
  ADD CONSTRAINT petty_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT petty_expenses_pm_approved_by_fkey FOREIGN KEY (pm_approved_by) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT petty_expenses_gm_approved_by_fkey FOREIGN KEY (gm_approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Drop the old personal custody tables and views
DROP FUNCTION IF EXISTS public.check_custody_negative_limit();
DROP VIEW IF EXISTS public.employee_custody_balances_view;

DROP TABLE IF EXISTS public.employee_custody_transactions CASCADE;
DROP TABLE IF EXISTS public.employee_custody_accounts CASCADE;

-- 3. Fix RLS on expense_groups and expense_items so Project Managers can read them
DROP POLICY IF EXISTS "expense_groups_select" ON public.expense_groups;
CREATE POLICY "expense_groups_select" ON public.expense_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_items_select" ON public.expense_items;
CREATE POLICY "expense_items_select" ON public.expense_items FOR SELECT TO authenticated USING (true);

-- 4. Seed basic expense taxonomy if missing
INSERT INTO public.expense_groups (company_id, group_code, arabic_name, english_name)
SELECT id, 'EXP-001', 'مصروفات تشغيل وموقع', 'Site Operating Expenses' FROM public.companies LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_groups (company_id, group_code, arabic_name, english_name)
SELECT id, 'EXP-002', 'أدوات مكتبية وقرطاسية', 'Stationery & Office Supplies' FROM public.companies LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_groups (company_id, group_code, arabic_name, english_name)
SELECT id, 'EXP-003', 'ضيافة وبوفيه', 'Hospitality & Buffet' FROM public.companies LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_items (expense_group_id, item_code, arabic_name, english_name)
SELECT id, 'ITM-001', 'نقل ومواصلات', 'Transportation' FROM public.expense_groups WHERE group_code = 'EXP-001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_items (expense_group_id, item_code, arabic_name, english_name)
SELECT id, 'ITM-002', 'مصاريف تحميل وتنزيل', 'Loading & Unloading Fees' FROM public.expense_groups WHERE group_code = 'EXP-001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_items (expense_group_id, item_code, arabic_name, english_name)
SELECT id, 'ITM-003', 'أوراق وطباعة', 'Papers & Printing' FROM public.expense_groups WHERE group_code = 'EXP-002' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_items (expense_group_id, item_code, arabic_name, english_name)
SELECT id, 'ITM-004', 'مشروبات وبوفيه', 'Beverages & Buffet' FROM public.expense_groups WHERE group_code = 'EXP-003' LIMIT 1
ON CONFLICT DO NOTHING;

-- 5. Recreate RLS on petty_expenses
-- Since we CASCADE dropped the old column, the old petty_expenses_select policy was dropped.
DROP POLICY IF EXISTS "petty_expenses_select" ON public.petty_expenses;
CREATE POLICY "petty_expenses_select" ON public.petty_expenses FOR SELECT TO authenticated
USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true) OR
    EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = petty_expenses.project_id)))
);
