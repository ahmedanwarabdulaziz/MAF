-- Migration: 038_company_purchase_returns.sql
-- Description: Implement Returns for Company Purchase Invoices (General Expenses and Stock Purchases)

BEGIN;

-- 1. Add returned_amount to invoices and returned_quantity to lines to track returns easily
ALTER TABLE public.company_purchase_invoices
ADD COLUMN IF NOT EXISTS returned_amount DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE public.company_purchase_invoice_lines
ADD COLUMN IF NOT EXISTS returned_quantity DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 2. Create the Company Purchase Returns Header Table
CREATE TABLE IF NOT EXISTS public.company_purchase_returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    original_invoice_id UUID NOT NULL REFERENCES public.company_purchase_invoices(id) ON DELETE RESTRICT,
    
    return_no           VARCHAR(100) NOT NULL,
    return_date         DATE NOT NULL,
    
    gross_amount        DECIMAL(18,4) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(18,4) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(18,4) NOT NULL DEFAULT 0,
    net_amount          DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'posted', 'cancelled')),
                            
    notes               TEXT,
    created_by          UUID REFERENCES public.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (company_id, return_no)
);

ALTER TABLE public.company_purchase_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company purchase returns accessible by main_company scope" ON public.company_purchase_returns;
CREATE POLICY "Company purchase returns accessible by main_company scope"
    ON public.company_purchase_returns FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.user_access_scopes s
            WHERE s.user_id = auth.uid() AND s.is_active = true
            AND s.scope_type IN ('main_company', 'all_projects')
        )
    );

-- 3. Create the Company Purchase Returns Lines Table
CREATE TABLE IF NOT EXISTS public.company_purchase_return_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           UUID NOT NULL REFERENCES public.company_purchase_returns(id) ON DELETE CASCADE,
    original_line_id    UUID NOT NULL REFERENCES public.company_purchase_invoice_lines(id) ON DELETE RESTRICT,
    
    return_quantity     DECIMAL(18,4) NOT NULL DEFAULT 1 CHECK (return_quantity > 0),
    unit_price          DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_gross          DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_net            DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_purchase_return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company purchase return lines via header" ON public.company_purchase_return_lines;
CREATE POLICY "Company purchase return lines via header"
    ON public.company_purchase_return_lines FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.company_purchase_returns h
            JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
            WHERE h.id = company_purchase_return_lines.return_id
            AND s.scope_type IN ('main_company', 'all_projects')
        )
    );

-- 4. Triggers for updated_at
DROP TRIGGER IF EXISTS tr_cpr_updated_at ON public.company_purchase_returns;
CREATE TRIGGER tr_cpr_updated_at
    BEFORE UPDATE ON public.company_purchase_returns
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_cprl_updated_at ON public.company_purchase_return_lines;
CREATE TRIGGER tr_cprl_updated_at
    BEFORE UPDATE ON public.company_purchase_return_lines
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. RPC to POST a Purchase Return
CREATE OR REPLACE FUNCTION public.post_company_purchase_return(
    p_return_id UUID,
    p_user_id   UUID
)
RETURNS VOID AS $$
DECLARE
    v_return        RECORD;
    v_original_inv  RECORD;
    v_line          RECORD;
    v_orig_line     RECORD;
BEGIN
    -- 1. Lock and fetch return
    SELECT * INTO v_return
    FROM public.company_purchase_returns
    WHERE id = p_return_id FOR UPDATE;

    IF v_return IS NULL THEN
        RAISE EXCEPTION 'Return document not found: %', p_return_id;
    END IF;

    IF v_return.status != 'draft' THEN
        RAISE EXCEPTION 'Return is already posted or cancelled (status: %)', v_return.status;
    END IF;

    -- 2. Lock and fetch original invoice
    SELECT * INTO v_original_inv
    FROM public.company_purchase_invoices
    WHERE id = v_return.original_invoice_id FOR UPDATE;

    IF v_original_inv.status NOT IN ('posted', 'partially_paid', 'paid') THEN
        RAISE EXCEPTION 'Cannot return an invoice that is not posted (status: %)', v_original_inv.status;
    END IF;

    -- 3. Process each return line
    FOR v_line IN
        SELECT cprl.*
        FROM public.company_purchase_return_lines cprl
        WHERE cprl.return_id = p_return_id
    LOOP
        -- Lock specific original line
        SELECT * INTO v_orig_line
        FROM public.company_purchase_invoice_lines
        WHERE id = v_line.original_line_id FOR UPDATE;

        IF v_orig_line IS NULL THEN
            RAISE EXCEPTION 'Original invoice line not found for return line %', v_line.id;
        END IF;

        -- Validate quantity
        IF v_line.return_quantity > (v_orig_line.quantity - v_orig_line.returned_quantity) THEN
            RAISE EXCEPTION 'Return quantity % exceeds available quantity % for line %', 
                v_line.return_quantity, (v_orig_line.quantity - v_orig_line.returned_quantity), v_orig_line.id;
        END IF;

        -- Update returned_quantity on the original line
        UPDATE public.company_purchase_invoice_lines
        SET returned_quantity = returned_quantity + v_line.return_quantity,
            updated_at = now()
        WHERE id = v_line.original_line_id;

        -- If the original invoice was a stock_purchase, we must reduce stock.
        IF v_original_inv.invoice_type = 'stock_purchase' AND v_orig_line.item_id IS NOT NULL THEN
            DECLARE
                v_running_qty NUMERIC;
                v_running_val NUMERIC;
                v_warehouse_project_id UUID;
                v_primary_unit_id UUID;
            BEGIN
                -- Get warehouse project_id if any
                SELECT project_id INTO v_warehouse_project_id 
                FROM public.warehouses 
                WHERE id = v_original_inv.warehouse_id;

                -- Get item primary unit
                SELECT primary_unit_id INTO v_primary_unit_id
                FROM public.items
                WHERE id = v_orig_line.item_id;

                -- Get current stock balance
                SELECT quantity_on_hand, total_value 
                INTO v_running_qty, v_running_val
                FROM public.stock_balances
                WHERE warehouse_id = v_original_inv.warehouse_id AND item_id = v_orig_line.item_id
                FOR UPDATE;

                IF v_running_qty IS NULL OR v_running_qty < v_line.return_quantity THEN
                    RAISE EXCEPTION 'Insufficient stock in warehouse for item % to process return (Available: %, Trying to return: %)',
                        v_orig_line.item_id, COALESCE(v_running_qty, 0), v_line.return_quantity;
                END IF;

                v_running_qty := COALESCE(v_running_qty, 0) - v_line.return_quantity;
                v_running_val := COALESCE(v_running_val, 0) - v_line.line_net;

                -- Determine document type for ledger ('goods_receipt' with movement_type 'out')
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
                    v_original_inv.warehouse_id,
                    v_orig_line.item_id,
                    v_primary_unit_id,
                    v_warehouse_project_id,
                    'out',
                    'goods_receipt', -- Using goods receipt as document type but movement 'out' serves as return
                    v_return.id,
                    v_line.id,
                    v_return.return_no,
                    0,
                    v_line.return_quantity,
                    v_line.unit_price,
                    v_line.line_net,
                    v_running_qty,
                    v_running_val,
                    v_return.return_date,
                    'مرتجع فاتورة مشتريات شركة رقم ' || v_return.return_no || ' (فاتورة أصلية: ' || v_original_inv.invoice_no || ')',
                    p_user_id
                );

                -- Update stock_balances
                UPDATE public.stock_balances
                SET quantity_on_hand = v_running_qty,
                    total_value = v_running_val,
                    weighted_avg_cost = CASE WHEN v_running_qty = 0 THEN weighted_avg_cost ELSE v_running_val / v_running_qty END,
                    last_movement_at = now(),
                    updated_at = now()
                WHERE warehouse_id = v_original_inv.warehouse_id AND item_id = v_orig_line.item_id;

            END;
        END IF;

    END LOOP;

    -- 4. Update the original invoice financials
    -- Add to returned_amount, deduct from outstanding_amount
    -- This means if fully paid (outstanding=0), it becomes negative (supplier credit).
    UPDATE public.company_purchase_invoices
    SET returned_amount = returned_amount + v_return.net_amount,
        outstanding_amount = outstanding_amount - v_return.net_amount,
        updated_at = now()
    WHERE id = v_return.original_invoice_id;

    -- 5. Mark the return as posted
    UPDATE public.company_purchase_returns
    SET status = 'posted',
        updated_at = now()
    WHERE id = p_return_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
