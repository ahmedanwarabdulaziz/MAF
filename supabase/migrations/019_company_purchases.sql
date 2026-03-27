-- Migration: 019_company_purchases.sql
-- Description: Company-level purchases module: expense categories, purchase invoices (general expenses & stock purchases)

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. EXPENSE CATEGORIES (Hierarchical — for general company expenses)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    category_code   VARCHAR(50) NOT NULL,
    arabic_name     TEXT NOT NULL,
    english_name    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, category_code)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_read" ON public.expense_categories;
CREATE POLICY "expense_categories_read" ON public.expense_categories
    FOR SELECT TO authenticated
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "expense_categories_write" ON public.expense_categories;
CREATE POLICY "expense_categories_write" ON public.expense_categories
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type = 'main_company')
    );

-- Seed default expense categories
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-ADM',  'مصروفات إدارية',        'Administrative Expenses'   FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-FIN',  'مصروفات مالية',          'Financial Expenses'        FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-MKT',  'مصروفات تسويق ومبيعات',  'Marketing & Sales Expenses' FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-OPS',  'مصروفات تشغيلية',        'Operational Expenses'      FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-HR',   'مصروفات الموارد البشرية', 'HR Expenses'               FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-IT',   'مصروفات تقنية المعلومات', 'IT Expenses'               FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;
INSERT INTO public.expense_categories (company_id, category_code, arabic_name, english_name)
SELECT id, 'EXP-GEN',  'مصروفات عامة أخرى',      'Other General Expenses'    FROM public.companies WHERE short_code = 'MAIN' ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 2. COMPANY PURCHASE INVOICES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_purchase_invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_party_id   UUID NOT NULL REFERENCES public.parties(id),

    invoice_no          VARCHAR(100) NOT NULL,
    invoice_date        DATE NOT NULL,

    -- Type determines whether this hits a cost center or the main warehouse
    invoice_type        TEXT NOT NULL DEFAULT 'general_expense'
                            CHECK (invoice_type IN ('general_expense', 'stock_purchase')),

    -- For general_expense: links to expense category + optional branch
    expense_category_id UUID REFERENCES public.expense_categories(id),
    branch_id           UUID REFERENCES public.branches(id),

    -- For stock_purchase: links to main warehouse
    warehouse_id        UUID REFERENCES public.warehouses(id),

    -- Financials
    gross_amount        DECIMAL(18,4) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(18,4) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(18,4) NOT NULL DEFAULT 0,
    net_amount          DECIMAL(18,4) NOT NULL DEFAULT 0,
    paid_to_date        DECIMAL(18,4) NOT NULL DEFAULT 0,
    outstanding_amount  DECIMAL(18,4) NOT NULL DEFAULT 0,

    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'posted', 'partially_paid', 'paid', 'cancelled')),

    notes               TEXT,
    created_by          UUID REFERENCES public.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (company_id, invoice_no)
);

ALTER TABLE public.company_purchase_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company purchase invoices accessible by main_company scope" ON public.company_purchase_invoices;
CREATE POLICY "Company purchase invoices accessible by main_company scope"
    ON public.company_purchase_invoices FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.user_access_scopes s
            WHERE s.user_id = auth.uid() AND s.is_active = true
            AND s.scope_type IN ('main_company', 'all_projects')
        )
    );


-- ─────────────────────────────────────────────────────────────
-- 3. COMPANY PURCHASE INVOICE LINES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_purchase_invoice_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES public.company_purchase_invoices(id) ON DELETE CASCADE,

    -- For general_expense: free text description. For stock_purchase: item reference (optional description)
    item_id         UUID REFERENCES public.items(id),           -- NULL for general expense lines
    description     TEXT NOT NULL,                              -- Free text: "إيجار مكتب يناير 2026"
    expense_category_id UUID REFERENCES public.expense_categories(id), -- Can override line-level category

    quantity        DECIMAL(18,4) NOT NULL DEFAULT 1,
    unit_price      DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_gross      DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_net        DECIMAL(18,4) NOT NULL DEFAULT 0,

    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_purchase_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company purchase invoice lines via header" ON public.company_purchase_invoice_lines;
CREATE POLICY "Company purchase invoice lines via header"
    ON public.company_purchase_invoice_lines FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.company_purchase_invoices h
            JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
            WHERE h.id = company_purchase_invoice_lines.invoice_id
            AND s.scope_type IN ('main_company', 'all_projects')
        )
    );


-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGERS
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER tr_expense_categories_updated_at
    BEFORE UPDATE ON public.expense_categories
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_cpi_updated_at ON public.company_purchase_invoices;
CREATE TRIGGER tr_cpi_updated_at
    BEFORE UPDATE ON public.company_purchase_invoices
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_cpil_updated_at ON public.company_purchase_invoice_lines;
CREATE TRIGGER tr_cpil_updated_at
    BEFORE UPDATE ON public.company_purchase_invoice_lines
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- ─────────────────────────────────────────────────────────────
-- 5. RPC: POST COMPANY PURCHASE INVOICE
-- Posts the invoice: generates stock movement (if stock_purchase), sets status to posted
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_company_purchase_invoice(
    p_invoice_id UUID,
    p_user_id    UUID
)
RETURNS VOID AS $$
DECLARE
    v_invoice RECORD;
    v_line    RECORD;
    v_movement_id UUID;
BEGIN
    -- 1. Lock and fetch invoice
    SELECT * INTO v_invoice
    FROM public.company_purchase_invoices
    WHERE id = p_invoice_id FOR UPDATE;

    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;

    IF v_invoice.status != 'draft' THEN
        RAISE EXCEPTION 'Invoice is already posted or cancelled (status: %)', v_invoice.status;
    END IF;

    -- 2. If stock_purchase: create a stock ledger entry for each line
    IF v_invoice.invoice_type = 'stock_purchase' THEN
        IF v_invoice.warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Stock purchase invoice must have a warehouse assigned';
        END IF;

        FOR v_line IN
            SELECT cpil.*, i.primary_unit_id
            FROM public.company_purchase_invoice_lines cpil
            JOIN public.items i ON i.id = cpil.item_id
            WHERE cpil.invoice_id = p_invoice_id AND cpil.item_id IS NOT NULL
        LOOP
            DECLARE
                v_running_qty NUMERIC;
                v_running_val NUMERIC;
                v_warehouse_project_id UUID;
            BEGIN
                -- Get warehouse project_id if any
                SELECT project_id INTO v_warehouse_project_id FROM public.warehouses WHERE id = v_invoice.warehouse_id;

                -- Get current running totals
                SELECT quantity_on_hand, total_value INTO v_running_qty, v_running_val
                FROM public.stock_balances
                WHERE warehouse_id = v_invoice.warehouse_id AND item_id = v_line.item_id;

                v_running_qty := COALESCE(v_running_qty, 0) + v_line.quantity;
                v_running_val := COALESCE(v_running_val, 0) + v_line.line_net;

                -- Insert into stock_ledger
                INSERT INTO public.stock_ledger (
                    warehouse_id,
                    item_id,
                    unit_id,
                    project_id,
                    movement_type,
                    document_type,
                    document_id,
                    document_line_id,
                    document_no,
                    qty_in,
                    qty_out,
                    unit_cost,
                    total_value,
                    running_qty,
                    running_value,
                    movement_date,
                    notes,
                    created_by
                ) VALUES (
                    v_invoice.warehouse_id,
                    v_line.item_id,
                    COALESCE(v_line.unit_id, v_line.primary_unit_id),
                    v_warehouse_project_id,
                    'in',
                    'goods_receipt',
                    v_invoice.id,
                    v_line.id,
                    v_invoice.invoice_no,
                    v_line.quantity,
                    0,
                    v_line.unit_price,
                    v_line.line_net,
                    v_running_qty,
                    v_running_val,
                    v_invoice.invoice_date,
                    'فاتورة مشتريات شركة رقم ' || v_invoice.invoice_no,
                    p_user_id
                );

                -- Update stock_balances
                INSERT INTO public.stock_balances (warehouse_id, item_id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at)
                VALUES (
                    v_invoice.warehouse_id, 
                    v_line.item_id, 
                    v_line.quantity, 
                    v_line.line_net, 
                    v_line.unit_price, 
                    now()
                )
                ON CONFLICT (warehouse_id, item_id)
                DO UPDATE SET
                    quantity_on_hand = EXCLUDED.quantity_on_hand + stock_balances.quantity_on_hand,
                    total_value = EXCLUDED.total_value + stock_balances.total_value,
                    weighted_avg_cost = (EXCLUDED.total_value + stock_balances.total_value) / NULLIF(EXCLUDED.quantity_on_hand + stock_balances.quantity_on_hand, 0),
                    last_movement_at = now(),
                    updated_at = now();
            END;
        END LOOP;
    END IF;

    -- 3. Set outstanding amount and post
    UPDATE public.company_purchase_invoices
    SET
        outstanding_amount = net_amount - paid_to_date,
        status = 'posted',
        updated_at = now()
    WHERE id = p_invoice_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────
-- 6. EXTEND payment_allocations to support company_purchase_invoice
--    (The trigger in 017 checks source_entity_type. We add the branch here.)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_update_allocation_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_outstanding NUMERIC(18,2);
    v_status TEXT;
    v_voucher_status TEXT;
BEGIN
    SELECT pv.status INTO v_voucher_status
    FROM public.payment_vouchers pv
    JOIN public.payment_voucher_parties pvp ON pvp.id = NEW.payment_voucher_party_id
    WHERE pv.id = pvp.payment_voucher_id;

    IF v_voucher_status != 'posted' THEN
        RETURN NEW;
    END IF;

    IF NEW.source_entity_type = 'supplier_invoice' THEN
        SELECT (net_amount - paid_to_date), status INTO v_outstanding, v_status
        FROM public.supplier_invoices WHERE id = NEW.source_entity_id FOR UPDATE;

        IF NEW.allocated_amount > v_outstanding THEN
            RAISE EXCEPTION 'Allocation limit exceeded: Target supplier invoice has only % outstanding.', v_outstanding;
        END IF;

        UPDATE public.supplier_invoices
        SET paid_to_date = paid_to_date + NEW.allocated_amount,
            status = CASE WHEN paid_to_date + NEW.allocated_amount >= net_amount THEN 'paid' ELSE 'partially_paid' END
        WHERE id = NEW.source_entity_id;

    ELSIF NEW.source_entity_type = 'subcontractor_certificate' THEN
        SELECT outstanding_amount, status INTO v_outstanding, v_status
        FROM public.subcontractor_certificates WHERE id = NEW.source_entity_id FOR UPDATE;

        IF NEW.allocated_amount > v_outstanding THEN
            RAISE EXCEPTION 'Allocation limit exceeded: Target subcontractor certificate has only % outstanding.', v_outstanding;
        END IF;

        UPDATE public.subcontractor_certificates
        SET paid_to_date = paid_to_date + NEW.allocated_amount,
            outstanding_amount = outstanding_amount - NEW.allocated_amount,
            status = CASE WHEN outstanding_amount - NEW.allocated_amount <= 0 THEN 'paid' ELSE 'partially_paid' END
        WHERE id = NEW.source_entity_id;

    ELSIF NEW.source_entity_type = 'company_purchase_invoice' THEN
        SELECT outstanding_amount, status INTO v_outstanding, v_status
        FROM public.company_purchase_invoices WHERE id = NEW.source_entity_id FOR UPDATE;

        IF v_status NOT IN ('posted', 'partially_paid') THEN
            RAISE EXCEPTION 'Cannot allocate payment to a company invoice that is not posted (status: %)', v_status;
        END IF;

        IF NEW.allocated_amount > v_outstanding THEN
            RAISE EXCEPTION 'Allocation limit exceeded: Company purchase invoice has only % outstanding.', v_outstanding;
        END IF;

        UPDATE public.company_purchase_invoices
        SET paid_to_date = paid_to_date + NEW.allocated_amount,
            outstanding_amount = outstanding_amount - NEW.allocated_amount,
            status = CASE
                WHEN outstanding_amount - NEW.allocated_amount <= 0 THEN 'paid'
                ELSE 'partially_paid'
            END,
            updated_at = now()
        WHERE id = NEW.source_entity_id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────
-- 7. Summary view: Company supplier balances (company-level)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.company_supplier_balances_view AS
SELECT
    cpi.company_id,
    cpi.supplier_party_id,
    p.arabic_name               AS supplier_name,
    cpi.invoice_type,
    COUNT(cpi.id)               AS invoice_count,
    SUM(cpi.gross_amount)       AS total_gross,
    SUM(cpi.discount_amount)    AS total_discount,
    SUM(cpi.tax_amount)         AS total_tax,
    SUM(cpi.net_amount)         AS total_net,
    SUM(cpi.paid_to_date)       AS total_paid,
    SUM(cpi.outstanding_amount) AS total_outstanding
FROM public.company_purchase_invoices cpi
JOIN public.parties p ON p.id = cpi.supplier_party_id
WHERE cpi.status IN ('posted', 'partially_paid', 'paid')
GROUP BY cpi.company_id, cpi.supplier_party_id, p.arabic_name, cpi.invoice_type;


-- ─────────────────────────────────────────────────────────────
-- 8. Summary view: Expenses by category
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.company_expenses_by_category_view AS
SELECT
    cpi.company_id,
    cpi.branch_id,
    b.arabic_name               AS branch_name,
    cpil.expense_category_id,
    COALESCE(ec.arabic_name, hec.arabic_name) AS category_name,
    ec.parent_id                AS parent_category_id,
    hec.arabic_name             AS parent_category_name,
    SUM(cpil.line_net)          AS total_amount,
    COUNT(DISTINCT cpi.id)      AS invoice_count
FROM public.company_purchase_invoices cpi
JOIN public.company_purchase_invoice_lines cpil ON cpil.invoice_id = cpi.id
LEFT JOIN public.expense_categories ec  ON ec.id  = cpil.expense_category_id
LEFT JOIN public.expense_categories hec ON hec.id = ec.parent_id
LEFT JOIN public.branches b ON b.id = cpi.branch_id
WHERE cpi.status IN ('posted', 'partially_paid', 'paid')
  AND cpi.invoice_type = 'general_expense'
GROUP BY cpi.company_id, cpi.branch_id, b.arabic_name,
         cpil.expense_category_id, ec.arabic_name, ec.parent_id, hec.arabic_name;

-- ─────────────────────────────────────────────────────────────
-- 9. Overriding post_payment_voucher to include company_purchase_invoice
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_payment_voucher(
    p_voucher_id UUID,
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_voucher RECORD;
    v_trans_type TEXT;
    v_alloc RECORD;
BEGIN
    SELECT * INTO v_voucher FROM public.payment_vouchers WHERE id = p_voucher_id FOR UPDATE;
    
    IF v_voucher IS NULL THEN
        RAISE EXCEPTION 'Voucher not found';
    END IF;

    IF v_voucher.status = 'posted' THEN
        RAISE EXCEPTION 'Voucher is already posted';
    END IF;

    IF v_voucher.financial_account_id IS NULL THEN
        RAISE EXCEPTION 'Cannot post a payment voucher without a financial account source';
    END IF;

    IF v_voucher.direction = 'outflow' THEN
        v_trans_type := 'withdrawal';
    ELSE
        v_trans_type := 'deposit';
    END IF;

    INSERT INTO public.financial_transactions (
        financial_account_id,
        transaction_date,
        transaction_type,
        amount,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        v_voucher.financial_account_id,
        v_voucher.payment_date,
        v_trans_type,
        v_voucher.total_amount,
        'payment_voucher',
        p_voucher_id,
        'Auto-generated by Payment Voucher ' || v_voucher.voucher_no,
        p_user_id
    );

    UPDATE public.payment_vouchers 
    SET status = 'posted',
        posted_at = now(),
        posted_by = p_user_id,
        updated_at = now()
    WHERE id = p_voucher_id;

    FOR v_alloc IN 
        SELECT pa.* FROM public.payment_allocations pa
        JOIN public.payment_voucher_parties pvp ON pvp.id = pa.payment_voucher_party_id
        WHERE pvp.payment_voucher_id = p_voucher_id
    LOOP
        IF v_alloc.source_entity_type = 'supplier_invoice' THEN
            UPDATE public.supplier_invoices 
            SET paid_to_date = paid_to_date + v_alloc.allocated_amount,
                status = CASE WHEN paid_to_date + v_alloc.allocated_amount >= net_amount THEN 'paid' ELSE 'partially_paid' END
            WHERE id = v_alloc.source_entity_id;
        ELSIF v_alloc.source_entity_type = 'subcontractor_certificate' THEN
            UPDATE public.subcontractor_certificates 
            SET paid_to_date = paid_to_date + v_alloc.allocated_amount,
                outstanding_amount = outstanding_amount - v_alloc.allocated_amount,
                status = CASE WHEN outstanding_amount - v_alloc.allocated_amount <= 0 THEN 'paid' ELSE 'partially_paid' END
            WHERE id = v_alloc.source_entity_id;
        ELSIF v_alloc.source_entity_type = 'company_purchase_invoice' THEN
            UPDATE public.company_purchase_invoices 
            SET paid_to_date = paid_to_date + v_alloc.allocated_amount,
                outstanding_amount = outstanding_amount - v_alloc.allocated_amount,
                status = CASE WHEN outstanding_amount - v_alloc.allocated_amount <= 0 THEN 'paid' ELSE 'partially_paid' END,
                updated_at = now()
            WHERE id = v_alloc.source_entity_id;
        END IF;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
