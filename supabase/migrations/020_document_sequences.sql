-- Migration 020: Global Document Sequences System

CREATE TABLE IF NOT EXISTS public.document_sequences (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    prefix TEXT NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, document_type, prefix)
);

ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view sequences of their companies"
    ON public.document_sequences FOR SELECT TO authenticated
    USING (true);

CREATE OR REPLACE FUNCTION public.get_next_document_no(p_company_id UUID, p_doc_type TEXT, p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    v_next_val BIGINT;
    v_result TEXT;
BEGIN
    INSERT INTO public.document_sequences (company_id, document_type, prefix, current_value)
    VALUES (p_company_id, p_doc_type, p_prefix, 1)
    ON CONFLICT (company_id, document_type, prefix)
    DO UPDATE SET 
        current_value = public.document_sequences.current_value + 1,
        updated_at = NOW()
    RETURNING current_value INTO v_next_val;
    
    v_result := p_prefix || '-' || LPAD(v_next_val::TEXT, 6, '0');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.peek_next_document_no(p_company_id UUID, p_doc_type TEXT, p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    v_current BIGINT;
BEGIN
    SELECT current_value INTO v_current 
    FROM public.document_sequences 
    WHERE company_id = p_company_id AND document_type = p_doc_type AND prefix = p_prefix;
    
    IF v_current IS NULL THEN
        RETURN p_prefix || '-000001';
    ELSE
        RETURN p_prefix || '-' || LPAD((v_current + 1)::TEXT, 6, '0');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.assign_document_no()
RETURNS TRIGGER AS $$
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procurement Triggers
DROP TRIGGER IF EXISTS tr_pr_seq ON public.purchase_requests;
CREATE TRIGGER tr_pr_seq BEFORE INSERT ON public.purchase_requests FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('PR', 'request_no');

DROP TRIGGER IF EXISTS tr_si_seq ON public.supplier_invoices;
CREATE TRIGGER tr_si_seq BEFORE INSERT ON public.supplier_invoices FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('INV', 'invoice_no');

DROP TRIGGER IF EXISTS tr_sri_seq ON public.supplier_return_invoices;
CREATE TRIGGER tr_sri_seq BEFORE INSERT ON public.supplier_return_invoices FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('SRV', 'invoice_no');

-- Company Purchases
DROP TRIGGER IF EXISTS tr_cpi_seq ON public.company_purchase_invoices;
CREATE TRIGGER tr_cpi_seq BEFORE INSERT ON public.company_purchase_invoices FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('PINV', 'invoice_no');

-- Warehouse / Inventory
DROP TRIGGER IF EXISTS tr_grn_seq ON public.goods_receipts;
CREATE TRIGGER tr_grn_seq BEFORE INSERT ON public.goods_receipts FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('GRN', 'document_no');

DROP TRIGGER IF EXISTS tr_isu_seq ON public.store_issues;
CREATE TRIGGER tr_isu_seq BEFORE INSERT ON public.store_issues FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('ISU', 'document_no');

DROP TRIGGER IF EXISTS tr_rtn_seq ON public.store_returns;
CREATE TRIGGER tr_rtn_seq BEFORE INSERT ON public.store_returns FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('RTN', 'document_no');

DROP TRIGGER IF EXISTS tr_trf_seq ON public.warehouse_transfers;
CREATE TRIGGER tr_trf_seq BEFORE INSERT ON public.warehouse_transfers FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('TRF', 'document_no');

DROP TRIGGER IF EXISTS tr_adj_seq ON public.stock_adjustments;
CREATE TRIGGER tr_adj_seq BEFORE INSERT ON public.stock_adjustments FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('ADJ', 'document_no');

-- Treasury & Payments
DROP TRIGGER IF EXISTS tr_pay_seq ON public.payment_vouchers;
CREATE TRIGGER tr_pay_seq BEFORE INSERT ON public.payment_vouchers FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('PAY', 'voucher_no');

-- Owner Billing
DROP TRIGGER IF EXISTS tr_bill_seq ON public.owner_billing_documents;
CREATE TRIGGER tr_bill_seq BEFORE INSERT ON public.owner_billing_documents FOR EACH ROW EXECUTE PROCEDURE public.assign_document_no('BILL', 'document_no');
