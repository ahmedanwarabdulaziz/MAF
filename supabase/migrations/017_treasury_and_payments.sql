-- Migration 017: Treasury and Payment Execution Core Logic
-- Creates financial accounts, vouchers, and settlement logic.

-- 1. Financial Accounts (Treasury/Cashboxes)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL if it's a corporate-level account
    account_type TEXT NOT NULL CHECK (account_type IN ('cashbox', 'bank', 'deposit', 'certificate')),
    arabic_name TEXT NOT NULL,
    english_name TEXT,
    currency TEXT NOT NULL DEFAULT 'EGP',
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_company ON public.financial_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_project ON public.financial_accounts(project_id);

-- 2. Financial Transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    reference_type TEXT NOT NULL, -- e.g., 'payment_voucher', 'owner_collection', 'manual_adjustment', 'transfer_in', 'transfer_out'
    reference_id UUID, -- ID of the underlying document
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON public.financial_transactions(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_ref ON public.financial_transactions(reference_type, reference_id);

-- 3. Financial Account Balances View
CREATE OR REPLACE VIEW public.financial_account_balances_view AS
SELECT 
    fa.id AS financial_account_id,
    fa.company_id,
    fa.project_id,
    fa.account_type,
    fa.arabic_name,
    fa.is_active,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'deposit' THEN ft.amount ELSE -ft.amount END), 0) AS current_balance
FROM public.financial_accounts fa
LEFT JOIN public.financial_transactions ft ON fa.id = ft.financial_account_id
GROUP BY fa.id;

-- 4. Payment Vouchers
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL if corporate payment
    voucher_no TEXT NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'other')),
    financial_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount > 0),
    direction TEXT NOT NULL CHECK (direction IN ('outflow', 'inflow')), -- Typically 'outflow' for expenses, 'inflow' for refunds/collections
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    receipt_reference_no TEXT, -- Physical cheque number or bank transfer ID
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES public.users(id),
    UNIQUE(company_id, voucher_no)
);

CREATE INDEX IF NOT EXISTS idx_pv_project ON public.payment_vouchers(project_id);

-- 5. Payment Voucher Parties
CREATE TABLE IF NOT EXISTS public.payment_voucher_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_voucher_id UUID NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
    paid_amount NUMERIC(18,2) NOT NULL CHECK (paid_amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvp_voucher ON public.payment_voucher_parties(payment_voucher_id);
CREATE INDEX IF NOT EXISTS idx_pvp_party ON public.payment_voucher_parties(party_id);

-- 6. Payment Allocations (Settling specific documents)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_voucher_party_id UUID NOT NULL REFERENCES public.payment_voucher_parties(id) ON DELETE CASCADE,
    source_entity_type TEXT NOT NULL, -- e.g., 'supplier_invoice', 'subcontractor_certificate'
    source_entity_id UUID NOT NULL,
    allocated_amount NUMERIC(18,2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_pvp ON public.payment_allocations(payment_voucher_party_id);
CREATE INDEX IF NOT EXISTS idx_pa_source ON public.payment_allocations(source_entity_type, source_entity_id);

-- 7. Trigger: Update outstanding balances based on Allocations
CREATE OR REPLACE FUNCTION public.check_and_update_allocation_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_outstanding NUMERIC(18,2);
    v_status TEXT;
    v_voucher_status TEXT;
BEGIN
    -- Only process allocations if the parent voucher is posted. 
    -- Actually, to keep it simple, the voucher posts first, then allocations are frozen,
    -- OR allocations instantly update when the voucher shifts to 'posted'.
    -- We will build the logic so that inserting an allocation explicitly updates the source document,
    -- but only if the payment voucher is posted.
    
    SELECT pv.status INTO v_voucher_status
    FROM public.payment_vouchers pv
    JOIN public.payment_voucher_parties pvp ON pvp.id = NEW.payment_voucher_party_id
    WHERE pv.id = pvp.payment_voucher_id;

    IF v_voucher_status != 'posted' THEN
        -- If voucher is draft, we just log the intent. Balance deduction happens on Posting the voucher.
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

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_payment_allocation
AFTER INSERT ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.check_and_update_allocation_balance();

-- 8. RPC: Post Payment Voucher
-- Commits the voucher, executes treasury deduction, and finalizes allocations
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
    -- 1. Grab voucher
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

    -- 2. Establish transaction type (payment outflow = treasury withdrawal)
    IF v_voucher.direction = 'outflow' THEN
        v_trans_type := 'withdrawal';
    ELSE
        v_trans_type := 'deposit';
    END IF;

    -- 3. Register Financial Transaction for the treasury ledger
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

    -- 4. Mark Voucher as Posted
    UPDATE public.payment_vouchers 
    SET status = 'posted',
        posted_at = now(),
        posted_by = p_user_id,
        updated_at = now()
    WHERE id = p_voucher_id;

    -- 5. Trigger allocation settlement updates
    -- Since the trigger on payment_allocations only acts when `posted`,
    -- the allocations that were already present as drafts haven't hit the balances yet.
    -- We must manually cycle through them and apply the deduction equations now that it is posted.
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
        END IF;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Row Level Security Models

-- Enable RLS
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_voucher_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Base View Policies
CREATE POLICY "FNC and TRE Users can view corporate financial accounts" ON public.financial_accounts
    FOR SELECT TO authenticated
    USING (
        (project_id IS NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type = 'main_company')) OR
        (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = financial_accounts.project_id)))) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    );

CREATE POLICY "Financial transactions are viewable by authorized scopes" ON public.financial_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.financial_accounts fa 
            WHERE fa.id = financial_account_id AND (
                (fa.project_id IS NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type = 'main_company')) OR
                (fa.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = fa.project_id)))) OR
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
            )
        )
    );

CREATE POLICY "Payment Vouchers accessible by scope" ON public.payment_vouchers
    FOR SELECT TO authenticated
    USING (
        (project_id IS NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND s.scope_type = 'main_company')) OR
        (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = payment_vouchers.project_id)))) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    );

-- Linked execution tables inherit parent voucher visibility
CREATE POLICY "Payment voucher parties linked to voucher" ON public.payment_voucher_parties
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.payment_vouchers pv WHERE pv.id = payment_voucher_id));

CREATE POLICY "Payment allocations linked to partys voucher" ON public.payment_allocations
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.payment_voucher_parties pvp 
        JOIN public.payment_vouchers pv ON pv.id = pvp.payment_voucher_id
        WHERE pvp.id = payment_voucher_party_id
    ));

-- Execution Rules: Only SA, FNC/FNO, TRE can manipulate Vouchers. 
-- For simplicity in generic DB scripts, we check if they are authorized by ensuring they hold an active scope. Real logic depends on application layer server actions.
CREATE POLICY "Authorized roles can manage corporate payment drafts" ON public.payment_vouchers
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    );

CREATE POLICY "Authorized roles can insert voucher components" ON public.payment_voucher_parties
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    );

CREATE POLICY "Authorized roles can allocate payments" ON public.payment_allocations
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_access_scopes s WHERE s.user_id = auth.uid() AND s.is_active = true) OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    );

-- System RPC handles transaction inserts securely.
CREATE POLICY "Block direct financial transaction inserts" ON public.financial_transactions
    FOR INSERT TO authenticated
    WITH CHECK (false);

-- System manages account balances and records directly.
