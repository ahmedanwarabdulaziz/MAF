-- ============================================================
-- P05 Migration 009: Stock Movement Documents
-- Tables: goods_receipts/lines, store_issues/lines,
--         store_returns/lines, warehouse_transfers/lines,
--         stock_adjustments/lines
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helper: shared status domain
-- draft → confirmed → cancelled
-- Only confirmed documents post to the stock_ledger
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Goods Receipts (from supplier into warehouse)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  project_id          uuid REFERENCES public.projects(id),
  supplier_party_id   uuid REFERENCES public.parties(id),
  document_no         text NOT NULL,
  receipt_date        date NOT NULL DEFAULT CURRENT_DATE,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','confirmed','cancelled')),
  supplier_invoice_ref text,           -- optional reference to a supplier invoice
  notes               text,
  confirmed_at        timestamptz,
  confirmed_by        uuid REFERENCES public.users(id),
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.users(id),
  cancelled_reason    text,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goods_receipt_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id    uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id             uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  quantity            numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(18,6) NOT NULL DEFAULT 0,
  total_cost          numeric(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Store Issues (from warehouse → project consumption)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_issues (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  document_no         text NOT NULL,
  issue_date          date NOT NULL DEFAULT CURRENT_DATE,
  issued_to_user_id   uuid REFERENCES public.users(id),  -- site engineer or responsible party
  cost_center_id      uuid REFERENCES public.cost_centers(id),
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','confirmed','cancelled')),
  notes               text,
  confirmed_at        timestamptz,
  confirmed_by        uuid REFERENCES public.users(id),
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.users(id),
  cancelled_reason    text,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_issue_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_issue_id      uuid NOT NULL REFERENCES public.store_issues(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id             uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  quantity            numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(18,6) NOT NULL DEFAULT 0,  -- captured at time of issue from stock_balances
  total_cost          numeric(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. Store Returns (from site/engineer back to warehouse)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_returns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  project_id          uuid REFERENCES public.projects(id),
  document_no         text NOT NULL,
  return_date         date NOT NULL DEFAULT CURRENT_DATE,
  returned_by_user_id uuid REFERENCES public.users(id),
  original_issue_id   uuid REFERENCES public.store_issues(id),  -- optional link to original issue
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','confirmed','cancelled')),
  notes               text,
  confirmed_at        timestamptz,
  confirmed_by        uuid REFERENCES public.users(id),
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.users(id),
  cancelled_reason    text,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_return_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_return_id     uuid NOT NULL REFERENCES public.store_returns(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id             uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  quantity            numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(18,6) NOT NULL DEFAULT 0,
  total_cost          numeric(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  condition_note      text,           -- e.g. "good condition", "damaged", "partial use"
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. Warehouse Transfers (between warehouses — quantity + value)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouse_transfers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source_warehouse_id       uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id  uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  project_id                uuid REFERENCES public.projects(id),
  document_no               text NOT NULL,
  transfer_date             date NOT NULL DEFAULT CURRENT_DATE,
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','confirmed','cancelled')),
  notes                     text,
  confirmed_at              timestamptz,
  confirmed_by              uuid REFERENCES public.users(id),
  cancelled_at              timestamptz,
  cancelled_by              uuid REFERENCES public.users(id),
  cancelled_reason          text,
  archived_at               timestamptz,
  archived_by               uuid REFERENCES public.users(id),
  created_by                uuid REFERENCES public.users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.warehouse_transfer_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_transfer_id uuid NOT NULL REFERENCES public.warehouse_transfers(id) ON DELETE CASCADE,
  item_id               uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id               uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  quantity              numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost             numeric(18,6) NOT NULL DEFAULT 0,   -- from source stock_balances at time of transfer
  total_cost            numeric(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. Stock Adjustments (loss, damage, correction, write-off)
-- direction: 'in' increases stock; 'out' decreases stock
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  project_id          uuid REFERENCES public.projects(id),
  document_no         text NOT NULL,
  adjustment_date     date NOT NULL DEFAULT CURRENT_DATE,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','confirmed','cancelled')),
  notes               text,
  confirmed_at        timestamptz,
  confirmed_by        uuid REFERENCES public.users(id),
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES public.users(id),
  cancelled_reason    text,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustment_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_adjustment_id   uuid NOT NULL REFERENCES public.stock_adjustments(id) ON DELETE CASCADE,
  item_id               uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id               uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  adjustment_type       text NOT NULL
                          CHECK (adjustment_type IN ('loss','damage','correction','write_off','found')),
  direction             text NOT NULL CHECK (direction IN ('in','out')),
  quantity              numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost             numeric(18,6) NOT NULL DEFAULT 0,
  total_cost            numeric(18,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes (for document lookup and reporting)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse    ON public.goods_receipts (warehouse_id, receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_project      ON public.goods_receipts (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_issues_warehouse      ON public.store_issues (warehouse_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_issues_project        ON public.store_issues (project_id);
CREATE INDEX IF NOT EXISTS idx_store_returns_warehouse     ON public.store_returns (warehouse_id, return_date DESC);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_source         ON public.warehouse_transfers (source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_destination    ON public.warehouse_transfers (destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_warehouse ON public.stock_adjustments (warehouse_id, adjustment_date DESC);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.goods_receipts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_issues           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_issue_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_returns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_return_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_lines ENABLE ROW LEVEL SECURITY;

-- Macro: authenticated users can read; super_admin can write
-- goods_receipts
CREATE POLICY "goods_receipts_read" ON public.goods_receipts
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);
CREATE POLICY "goods_receipts_write" ON public.goods_receipts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

CREATE POLICY "goods_receipt_lines_read" ON public.goods_receipt_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "goods_receipt_lines_write" ON public.goods_receipt_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

-- store_issues
CREATE POLICY "store_issues_read" ON public.store_issues
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);
CREATE POLICY "store_issues_write" ON public.store_issues
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

CREATE POLICY "store_issue_lines_read" ON public.store_issue_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "store_issue_lines_write" ON public.store_issue_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

-- store_returns
CREATE POLICY "store_returns_read" ON public.store_returns
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);
CREATE POLICY "store_returns_write" ON public.store_returns
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

CREATE POLICY "store_return_lines_read" ON public.store_return_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "store_return_lines_write" ON public.store_return_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

-- warehouse_transfers
CREATE POLICY "wh_transfers_read" ON public.warehouse_transfers
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);
CREATE POLICY "wh_transfers_write" ON public.warehouse_transfers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

CREATE POLICY "wh_transfer_lines_read" ON public.warehouse_transfer_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wh_transfer_lines_write" ON public.warehouse_transfer_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

-- stock_adjustments
CREATE POLICY "stock_adjustments_read" ON public.stock_adjustments
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);
CREATE POLICY "stock_adjustments_write" ON public.stock_adjustments
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));

CREATE POLICY "stock_adjustment_lines_read" ON public.stock_adjustment_lines
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustment_lines_write" ON public.stock_adjustment_lines
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true));
