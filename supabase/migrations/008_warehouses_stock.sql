-- ============================================================
-- P05 Migration 008: Warehouses, Stock Balances, Stock Ledger
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Warehouses
-- warehouse_type: main_company (HQ), project (site), temporary
-- project_id is NULL for the main company warehouse
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id          uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  warehouse_code      text NOT NULL,
  arabic_name         text NOT NULL,
  english_name        text,
  warehouse_type      text NOT NULL DEFAULT 'project'
                        CHECK (warehouse_type IN ('main_company','project','temporary')),
  location            text,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, warehouse_code)
);

-- ─────────────────────────────────────────────────────────────
-- 2. Warehouse User Assignments
-- Which users are assigned as managers / storekeepers for a warehouse
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouse_user_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assignment_role     text NOT NULL DEFAULT 'storekeeper'
                        CHECK (assignment_role IN ('manager','storekeeper','viewer')),
  is_active           boolean NOT NULL DEFAULT true,
  assigned_by         uuid REFERENCES public.users(id),
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  notes               text,
  UNIQUE (warehouse_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Stock Balances (current quantity + value per item per warehouse)
-- This is a performance/convenience table updated on every movement.
-- The stock_ledger remains the authoritative source of truth.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity_on_hand    numeric(18,4) NOT NULL DEFAULT 0,
  total_value         numeric(18,2) NOT NULL DEFAULT 0,
  weighted_avg_cost   numeric(18,6) NOT NULL DEFAULT 0,
  last_movement_at    timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, item_id)
);

-- ─────────────────────────────────────────────────────────────
-- 4. Stock Ledger (append-only movement log — source of truth)
-- Every stock movement writes one ledger entry per line.
-- movement_type: in | out | transfer_in | transfer_out | adjustment_in | adjustment_out
-- document_type: goods_receipt | store_issue | store_return | warehouse_transfer | stock_adjustment
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_ledger (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id        uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  item_id             uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  unit_id             uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  project_id          uuid REFERENCES public.projects(id),
  movement_type       text NOT NULL
                        CHECK (movement_type IN (
                          'in','out',
                          'transfer_in','transfer_out',
                          'adjustment_in','adjustment_out'
                        )),
  document_type       text NOT NULL
                        CHECK (document_type IN (
                          'goods_receipt','store_issue','store_return',
                          'warehouse_transfer','stock_adjustment'
                        )),
  document_id         uuid NOT NULL,   -- references the header id of the source document
  document_line_id    uuid,            -- references the specific line for traceability
  document_no         text,            -- human-readable document number (denormalized for speed)
  qty_in              numeric(18,4) NOT NULL DEFAULT 0,
  qty_out             numeric(18,4) NOT NULL DEFAULT 0,
  unit_cost           numeric(18,6) NOT NULL DEFAULT 0,
  total_value         numeric(18,2) NOT NULL DEFAULT 0,
  running_qty         numeric(18,4) NOT NULL DEFAULT 0,   -- balance after this entry
  running_value       numeric(18,2) NOT NULL DEFAULT 0,   -- value balance after this entry
  movement_date       date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
  -- NB: NO update / delete on this table — it is append-only
);

-- Index for fast per-item per-warehouse ledger queries
CREATE INDEX IF NOT EXISTS idx_stock_ledger_warehouse_item
  ON public.stock_ledger (warehouse_id, item_id, movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_document
  ON public.stock_ledger (document_type, document_id);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.warehouses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger              ENABLE ROW LEVEL SECURITY;

-- warehouses: authenticated users can read non-archived warehouses
CREATE POLICY "warehouses_read" ON public.warehouses
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);

CREATE POLICY "warehouses_write" ON public.warehouses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- warehouse_user_assignments
CREATE POLICY "wh_assignments_read" ON public.warehouse_user_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "wh_assignments_write" ON public.warehouse_user_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- stock_balances: authenticated can read
CREATE POLICY "stock_balances_read" ON public.stock_balances
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stock_balances_write" ON public.stock_balances
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- stock_ledger: authenticated can read; only super_admin (or service_role) can insert
CREATE POLICY "stock_ledger_read" ON public.stock_ledger
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stock_ledger_insert" ON public.stock_ledger
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    OR auth.role() = 'service_role'
  );

-- No UPDATE or DELETE policies on stock_ledger — it is intentionally append-only

-- ─────────────────────────────────────────────────────────────
-- Seed: main company warehouse
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE short_code = 'MAIN' LIMIT 1;

  INSERT INTO public.warehouses (company_id, warehouse_code, arabic_name, english_name, warehouse_type, project_id)
  VALUES (v_company_id, 'WH-MAIN', 'المخزن الرئيسي', 'Main Warehouse', 'main_company', NULL)
  ON CONFLICT (company_id, warehouse_code) DO NOTHING;
END $$;
