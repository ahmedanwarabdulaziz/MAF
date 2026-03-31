-- ============================================================
-- Migration 034: Integrate Cost Centers into Expenses
-- ============================================================
-- 1. Adds cost_center_id to petty_expenses and backfills it.
-- 2. Adds cost_center_id to company_purchase_invoices and 
--    enforces it ONLY for 'general_expense'.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. petty_expenses
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.petty_expenses 
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);

-- Backfill: If project_id exists, use project's cost center. 
-- Otherwise, use the Main Company (CC-CORP) cost center.
UPDATE public.petty_expenses pe
SET cost_center_id = (
  CASE 
    WHEN pe.project_id IS NOT NULL THEN (
      SELECT cc.id FROM public.cost_centers cc JOIN public.projects p ON p.cost_center_id = cc.id WHERE p.id = pe.project_id LIMIT 1
    )
    ELSE COALESCE(
      (SELECT cc.id FROM public.cost_centers cc WHERE cc.cost_center_code = 'CC-CORP' AND cc.company_id = pe.company_id LIMIT 1),
      (SELECT cc.id FROM public.cost_centers cc WHERE cc.company_id = pe.company_id LIMIT 1)
    )
  END
)
WHERE pe.cost_center_id IS NULL;

-- Enforce cost_center_id is always filled for petty expenses
ALTER TABLE public.petty_expenses
  DROP CONSTRAINT IF EXISTS check_pe_cost_center;

ALTER TABLE public.petty_expenses
  ADD CONSTRAINT check_pe_cost_center
    CHECK (cost_center_id IS NOT NULL);


-- ─────────────────────────────────────────────────────────────
-- 2. company_purchase_invoices
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.company_purchase_invoices 
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);

-- Backfill: All existing invoices go to CC-CORP (Main Company) or the first available CC.
UPDATE public.company_purchase_invoices cpi
SET cost_center_id = COALESCE(
  (SELECT cc.id FROM public.cost_centers cc WHERE cc.cost_center_code = 'CC-CORP' AND cc.company_id = cpi.company_id LIMIT 1),
  (SELECT cc.id FROM public.cost_centers cc WHERE cc.company_id = cpi.company_id LIMIT 1)
)
WHERE cpi.cost_center_id IS NULL;

-- Enforce cost_center_id ONLY for 'general_expense'
-- (Stock purchases go to inventory asset, not an expense center until issued)
ALTER TABLE public.company_purchase_invoices
  DROP CONSTRAINT IF EXISTS check_cpi_cost_center;

ALTER TABLE public.company_purchase_invoices
  ADD CONSTRAINT check_cpi_cost_center
    CHECK (
      (invoice_type = 'stock_purchase') OR
      (invoice_type = 'general_expense' AND cost_center_id IS NOT NULL)
    );

COMMIT;
