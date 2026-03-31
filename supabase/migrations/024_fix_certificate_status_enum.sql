-- Migration: 024_fix_certificate_status_enum.sql
-- Description: Fix DB functions that incorrectly use 'partially_paid' and 'paid' as
-- status values for subcontractor_certificates. The certificate_status ENUM only allows:
--   'draft' | 'pending_approval' | 'approved' | 'paid_in_full'
-- Certificates stay 'approved' during partial payments; 'paid_in_full' when fully settled.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Fix the allocation trigger: check_and_update_allocation_balance()
--    Replaces the version from 019_company_purchases which used invalid enum values
--    for subcontractor_certificates.
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

    -- Only apply balance deductions when the voucher is already posted.
    -- If draft, allocation is just an intent — balance updates happen on posting.
    IF v_voucher_status != 'posted' THEN
        RETURN NEW;
    END IF;

    IF NEW.source_entity_type = 'supplier_invoice' THEN
        SELECT (net_amount - paid_to_date), status INTO v_outstanding, v_status
        FROM public.supplier_invoices WHERE id = NEW.source_entity_id FOR UPDATE;

        IF NEW.allocated_amount > v_outstanding THEN
            RAISE EXCEPTION 'Allocation limit exceeded: Target supplier invoice has only % outstanding.', v_outstanding;
        END IF;

        -- supplier_invoices uses TEXT status: draft|posted|partially_paid|paid|cancelled
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

        -- certificate_status ENUM: draft|pending_approval|approved|paid_in_full
        -- 'approved' = partially/pending payment; 'paid_in_full' = fully settled
        UPDATE public.subcontractor_certificates
        SET paid_to_date = paid_to_date + NEW.allocated_amount,
            outstanding_amount = outstanding_amount - NEW.allocated_amount,
            status = CASE
                WHEN outstanding_amount - NEW.allocated_amount <= 0 THEN 'paid_in_full'::public.certificate_status
                ELSE 'approved'::public.certificate_status
            END
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

        -- company_purchase_invoices uses TEXT status: draft|posted|partially_paid|paid|cancelled
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
-- 2. Fix post_payment_voucher() RPC to also use correct enum values
--    when cycling through draft allocations on posting.
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

    -- Register the financial transaction (treasury deduction/addition)
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

    -- Mark the voucher as posted
    UPDATE public.payment_vouchers 
    SET status = 'posted',
        posted_at = now(),
        posted_by = p_user_id,
        updated_at = now()
    WHERE id = p_voucher_id;

    -- Settle all draft allocations now that the voucher is posted
    FOR v_alloc IN 
        SELECT pa.* FROM public.payment_allocations pa
        JOIN public.payment_voucher_parties pvp ON pvp.id = pa.payment_voucher_party_id
        WHERE pvp.payment_voucher_id = p_voucher_id
    LOOP
        IF v_alloc.source_entity_type = 'supplier_invoice' THEN
            -- supplier_invoices uses TEXT status (partially_paid valid)
            UPDATE public.supplier_invoices 
            SET paid_to_date = paid_to_date + v_alloc.allocated_amount,
                status = CASE WHEN paid_to_date + v_alloc.allocated_amount >= net_amount THEN 'paid' ELSE 'partially_paid' END
            WHERE id = v_alloc.source_entity_id;

        ELSIF v_alloc.source_entity_type = 'subcontractor_certificate' THEN
            -- certificate_status ENUM: 'approved' for partial, 'paid_in_full' when done
            UPDATE public.subcontractor_certificates 
            SET paid_to_date = paid_to_date + v_alloc.allocated_amount,
                outstanding_amount = outstanding_amount - v_alloc.allocated_amount,
                status = CASE
                    WHEN outstanding_amount - v_alloc.allocated_amount <= 0 THEN 'paid_in_full'::public.certificate_status
                    ELSE 'approved'::public.certificate_status
                END
            WHERE id = v_alloc.source_entity_id;

        ELSIF v_alloc.source_entity_type = 'company_purchase_invoice' THEN
            -- company_purchase_invoices uses TEXT status (partially_paid valid)
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
