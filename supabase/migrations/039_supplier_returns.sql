-- Migration: 039_supplier_returns.sql
-- Description: Extending schema to fully support Supplier Returns (Procurement) with financial tracking and stock deduction.

BEGIN;

-- 0. FIX STOCK LEDGER DOCUMENT TYPE CHECK CONSTRAINT --
ALTER TABLE public.stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_document_type_check;
ALTER TABLE public.stock_ledger ADD CONSTRAINT stock_ledger_document_type_check 
    CHECK (document_type IN (
        'goods_receipt', 'store_issue', 'store_return', 
        'warehouse_transfer', 'stock_adjustment', 
        'supplier_return', 'company_purchase_return'
    ));

-- 1. ADD TRACKING COLUMNS TO SUPPLIER INVOICES --
ALTER TABLE public.supplier_invoices 
    ADD COLUMN IF NOT EXISTS returned_amount DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE public.supplier_invoice_lines 
    ADD COLUMN IF NOT EXISTS returned_quantity DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 2. EXTEND RETURN TABLES (Created in 014_supplier_procurement.sql) --
ALTER TABLE public.supplier_return_invoices 
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(18,4) NOT NULL DEFAULT 0;

-- NOTE: supplier_return_invoice_lines already has unit_price, line_net, returned_quantity from 014.
ALTER TABLE public.supplier_return_invoice_lines 
    ADD COLUMN IF NOT EXISTS original_line_id UUID REFERENCES public.supplier_invoice_lines(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS line_gross DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 3. POST SUPPLIER RETURN RPC --
CREATE OR REPLACE FUNCTION public.post_supplier_return(p_return_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return record;
    v_line record;
    v_invoice_status text;
    v_item record;
    v_qty_in_stock numeric;
    v_current_total_val numeric;
    v_new_running_qty numeric;
    v_new_running_val numeric;
    v_qty_to_return numeric;
BEGIN
    -- 1. Fetch return header
    SELECT r.*, i.invoice_no 
    INTO v_return
    FROM public.supplier_return_invoices r
    JOIN public.supplier_invoices i ON i.id = r.original_invoice_id
    WHERE r.id = p_return_id FOR UPDATE;

    IF v_return IS NULL THEN
        RAISE EXCEPTION 'Return document not found.';
    END IF;

    IF v_return.status != 'draft' THEN
        RAISE EXCEPTION 'Only draft returns can be posted.';
    END IF;

    -- Validate warehouse_id constraint (we need to deduct from where it was received)
    IF v_return.warehouse_id IS NULL THEN
        RAISE EXCEPTION 'Warehouse cannot be null for posting stock returns.';
    END IF;

    -- 2. Validate original invoice status
    SELECT status INTO v_invoice_status 
    FROM public.supplier_invoices 
    WHERE id = v_return.original_invoice_id FOR UPDATE;
    
    IF v_invoice_status NOT IN ('posted', 'receipt_confirmed', 'paid', 'partially_paid') THEN
        RAISE EXCEPTION 'Cannot return an invoice that is not receipt_confirmed/posted/paid.';
    END IF;

    -- 3. Loop through lines to deduct stock and calculate financial impact
    FOR v_line IN (
        SELECT rl.*, il.invoiced_quantity, il.returned_quantity as previously_returned
        FROM public.supplier_return_invoice_lines rl
        JOIN public.supplier_invoice_lines il ON il.id = rl.original_line_id
        WHERE rl.return_id = p_return_id
    ) LOOP
        v_qty_to_return := COALESCE(v_line.returned_quantity, 0);
        
        IF v_qty_to_return <= 0 THEN
            CONTINUE;
        END IF;

        -- Validate returns don't exceed original billed quantity
        IF (v_qty_to_return + COALESCE(v_line.previously_returned, 0)) > COALESCE(v_line.invoiced_quantity, 0) THEN
            RAISE EXCEPTION 'Return quantity % exceeds remaining available quantity % for item %', v_qty_to_return, (COALESCE(v_line.invoiced_quantity, 0) - COALESCE(v_line.previously_returned, 0)), v_line.item_id;
        END IF;

        -- Get Item Unit
        SELECT i.primary_unit_id INTO v_item FROM public.items i WHERE i.id = v_line.item_id;

        -- Get Stock Balances
        SELECT quantity_on_hand, total_value 
        INTO v_qty_in_stock, v_current_total_val
        FROM public.stock_balances
        WHERE warehouse_id = v_return.warehouse_id AND item_id = v_line.item_id
        FOR UPDATE;

        IF v_qty_in_stock IS NULL THEN
            v_qty_in_stock := 0;
            v_current_total_val := 0;
        END IF;

        IF v_qty_in_stock < v_qty_to_return THEN
             RAISE EXCEPTION 'Insufficient stock in warehouse for item %. Attempted to return % but only % on hand.', v_line.item_id, v_qty_to_return, v_qty_in_stock;
        END IF;

        v_new_running_qty := COALESCE(v_qty_in_stock, 0) - v_qty_to_return;
        v_new_running_val := COALESCE(v_current_total_val, 0) - COALESCE(v_line.line_gross, 0); -- value is removed based on return gross value.

        -- Update stock_balances
        UPDATE public.stock_balances
        SET quantity_on_hand = v_new_running_qty,
            total_value = v_new_running_val,
            weighted_avg_cost = CASE WHEN v_new_running_qty > 0 THEN v_new_running_val / v_new_running_qty ELSE 0 END,
            last_movement_at = now()
        WHERE warehouse_id = v_return.warehouse_id AND item_id = v_line.item_id;

        -- Insert stock ledger entry (OUT movement)
        INSERT INTO public.stock_ledger (
            warehouse_id, item_id, unit_id, project_id, 
            movement_type, document_type, document_id, document_line_id, document_no, 
            qty_in, qty_out, unit_cost, total_value, running_qty, running_value, 
            movement_date, notes, created_by
        ) VALUES (
            v_return.warehouse_id, v_line.item_id, v_item.primary_unit_id, v_return.project_id, 
            'out', 'supplier_return', v_return.id, v_line.id, v_return.return_no, 
            0, v_qty_to_return, COALESCE(v_line.unit_price, 0), v_line.line_gross, v_new_running_qty, v_new_running_val, 
            v_return.return_date, 'مرتجع فاتورة مورد: ' || v_return.invoice_no, p_user_id
        );

        -- Update parent invoice line's returned quantity
        UPDATE public.supplier_invoice_lines
        SET returned_quantity = COALESCE(returned_quantity, 0) + v_qty_to_return
        WHERE id = v_line.original_line_id;

    END LOOP;

    -- 4. Update parent invoice financial impact
    UPDATE public.supplier_invoices
    SET returned_amount = COALESCE(returned_amount, 0) + COALESCE(v_return.net_amount, 0),
        -- The outstanding amount decreases. Even if fully paid, it will drop to negative, creating supplier credit.
        outstanding_amount = COALESCE(outstanding_amount, 0) - COALESCE(v_return.net_amount, 0)
    WHERE id = v_return.original_invoice_id;

    -- 5. Mark the return as posted
    UPDATE public.supplier_return_invoices
    SET status = 'posted'
    WHERE id = p_return_id;

END;
$$;

-- 4. FIX DOCUMENT SEQUENCE TRIGGERS FOR return_no --
CREATE OR REPLACE FUNCTION public.assign_document_no()
RETURNS TRIGGER AS $func$
DECLARE
    v_prefix TEXT := TG_ARGV[0];
    v_field TEXT := TG_ARGV[1];
    v_doc_type TEXT := TG_TABLE_NAME;
BEGIN
    IF v_field = 'request_no' THEN
        IF NEW.request_no IS NULL OR NEW.request_no = '' OR NEW.request_no = 'تلقائي' OR NEW.request_no LIKE (v_prefix || '-%') THEN
            NEW.request_no := public.get_next_document_no(NEW.company_id, v_doc_type, v_prefix);
        END IF;
    ELSIF v_field = 'invoice_no' THEN
        IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' OR NEW.invoice_no = 'تلقائي' OR NEW.invoice_no LIKE (v_prefix || '-%') THEN
            NEW.invoice_no := public.get_next_document_no(NEW.company_id, v_doc_type, v_prefix);
        END IF;
    ELSIF v_field = 'document_no' THEN
        IF NEW.document_no IS NULL OR NEW.document_no = '' OR NEW.document_no = 'تلقائي' OR NEW.document_no LIKE (v_prefix || '-%') THEN
            NEW.document_no := public.get_next_document_no(NEW.company_id, v_doc_type, v_prefix);
        END IF;
    ELSIF v_field = 'voucher_no' THEN
        IF NEW.voucher_no IS NULL OR NEW.voucher_no = '' OR NEW.voucher_no = 'تلقائي' OR NEW.voucher_no LIKE (v_prefix || '-%') THEN
            NEW.voucher_no := public.get_next_document_no(NEW.company_id, v_doc_type, v_prefix);
        END IF;
    ELSIF v_field = 'return_no' THEN
        IF NEW.return_no IS NULL OR NEW.return_no = '' OR NEW.return_no = 'تلقائي' OR NEW.return_no LIKE (v_prefix || '-%') THEN
            NEW.return_no := public.get_next_document_no(NEW.company_id, v_doc_type, v_prefix);
        END IF;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the trigger on supplier_return_invoices
DROP TRIGGER IF EXISTS tr_sri_seq ON public.supplier_return_invoices;
CREATE TRIGGER tr_sri_seq BEFORE INSERT ON public.supplier_return_invoices FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('SRV', 'return_no');

-- Also fix company_purchase_returns missing sequence trigger
DROP TRIGGER IF EXISTS tr_cpr_seq ON public.company_purchase_returns;
CREATE TRIGGER tr_cpr_seq BEFORE INSERT ON public.company_purchase_returns FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('CPRT', 'return_no');

COMMIT;
