-- Migration: 010_cutover_core_model.sql
-- Description: Core cutover schema for onboarding existing projects
-- Includes cutover batches, snapshot position tables, and lockdown RPCs.

BEGIN;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.cutover_status AS ENUM ('draft', 'in_review', 'approved', 'locked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.cutover_account_type AS ENUM ('petty_cash', 'treasury', 'bank', 'parent_funding');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. MAIN BATCH TABLE
CREATE TABLE IF NOT EXISTS public.cutover_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    cutover_date DATE NOT NULL,
    status public.cutover_status NOT NULL DEFAULT 'draft',
    prepared_by UUID REFERENCES public.users(id),
    reviewed_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    locked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id) -- Only one active cutover per project
);

ALTER TABLE public.cutover_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage cutover batches in their companies"
    ON public.cutover_batches
    FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.user_access_scopes s
            WHERE s.user_id = auth.uid() AND s.is_active = true
            AND (
                s.scope_type IN ('all_projects', 'main_company')
                OR (s.scope_type = 'selected_project' AND s.project_id = cutover_batches.project_id)
            )
        )
    );

-- 3. FINANCIAL BALANCES
CREATE TABLE IF NOT EXISTS public.cutover_financial_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    account_type public.cutover_account_type NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    opening_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_financial_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage financial balances if they have access to batch"
    ON public.cutover_financial_balances
    FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
            SELECT 1 FROM public.cutover_batches cb
            JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
            WHERE cb.id = cutover_financial_balances.batch_id
            AND (
                s.scope_type IN ('all_projects', 'main_company')
                OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id)
            )
        )
    );

-- 4. SUBCONTRACTOR POSITIONS
CREATE TABLE IF NOT EXISTS public.cutover_subcontractor_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    subcontractor_id UUID NOT NULL REFERENCES public.parties(id),
    work_item_name VARCHAR(255) NOT NULL, -- Simplified for now until work items catalog is ready
    previous_quantity DECIMAL(16,4) NOT NULL DEFAULT 0,
    cumulative_quantity DECIMAL(16,4) NOT NULL DEFAULT 0,
    agreed_rate DECIMAL(16,4) NOT NULL DEFAULT 0,
    gross_certified_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    taliya_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    advance_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    other_deductions_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    paid_to_date DECIMAL(16,4) NOT NULL DEFAULT 0,
    outstanding_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_subcontractor_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage subcontractor positions if they have access to batch"
    ON public.cutover_subcontractor_positions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.cutover_batches cb
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE cb.id = cutover_subcontractor_positions.batch_id 
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id))
    ));

-- 5. SUPPLIER POSITIONS
CREATE TABLE IF NOT EXISTS public.cutover_supplier_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.parties(id),
    open_invoice_number VARCHAR(100),
    invoice_date DATE,
    gross_invoice_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    advance_paid DECIMAL(16,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_supplier_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage supplier positions if they have access to batch"
    ON public.cutover_supplier_positions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.cutover_batches cb
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE cb.id = cutover_supplier_positions.batch_id 
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id))
    ));

-- 6. OWNER POSITIONS
CREATE TABLE IF NOT EXISTS public.cutover_owner_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.parties(id),
    open_certificate_number VARCHAR(100),
    billing_date DATE,
    billed_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    collected_amount DECIMAL(16,4) NOT NULL DEFAULT 0,
    remaining_receivable DECIMAL(16,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_owner_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage owner positions if they have access to batch"
    ON public.cutover_owner_positions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.cutover_batches cb
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE cb.id = cutover_owner_positions.batch_id 
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id))
    ));

-- 7. WAREHOUSE STOCK
CREATE TABLE IF NOT EXISTS public.cutover_warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
    item_id UUID NOT NULL REFERENCES public.items(id),
    unit_id UUID NOT NULL REFERENCES public.units(id),
    opening_quantity DECIMAL(16,4) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(16,4) NOT NULL DEFAULT 0,
    opening_value DECIMAL(16,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage warehouse stock if they have access to batch"
    ON public.cutover_warehouse_stock FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.cutover_batches cb
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE cb.id = cutover_warehouse_stock.batch_id 
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id))
    ));

-- 8. EMPLOYEE CUSTODY
CREATE TABLE IF NOT EXISTS public.cutover_employee_custody (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cutover_batches(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.users(id),
    custody_account_type VARCHAR(100),
    opening_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    temporary_advance_balance DECIMAL(16,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.cutover_employee_custody ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage employee custody if they have access to batch"
    ON public.cutover_employee_custody FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.cutover_batches cb
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE cb.id = cutover_employee_custody.batch_id 
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = cb.project_id))
    ));


-- 9. RPC LOGIC FOR LOCKING
CREATE OR REPLACE FUNCTION public.lock_cutover_batch(p_batch_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch RECORD;
    v_stock RECORD;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM public.cutover_batches WHERE id = p_batch_id;
    
    IF v_batch IS NULL THEN
        RAISE EXCEPTION 'Cutover batch not found';
    END IF;

    IF v_batch.status = 'locked' THEN
        RAISE EXCEPTION 'Batch is already locked';
    END IF;

    IF v_batch.status != 'approved' THEN
        RAISE EXCEPTION 'Batch must be approved before locking. Currently: %', v_batch.status;
    END IF;

    -- For each cutover stock, inject into live stock ledgers
    -- Currently using the basic stock_balances mechanism (direct upsert for now)
    FOR v_stock IN 
        SELECT 
           cws.warehouse_id, cws.item_id, cws.opening_quantity, cws.opening_value, cws.unit_cost
        FROM public.cutover_warehouse_stock cws
        WHERE cws.batch_id = p_batch_id
    LOOP
        INSERT INTO public.stock_balances (
            company_id, warehouse_id, item_id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at
        ) VALUES (
            v_batch.company_id, v_stock.warehouse_id, v_stock.item_id, 
            v_stock.opening_quantity, v_stock.opening_value, v_stock.unit_cost, v_batch.cutover_date
        )
        ON CONFLICT (warehouse_id, item_id) DO UPDATE SET
            quantity_on_hand = public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
            total_value = public.stock_balances.total_value + EXCLUDED.total_value,
            weighted_avg_cost = CASE 
                WHEN (public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand) > 0 
                THEN (public.stock_balances.total_value + EXCLUDED.total_value) / (public.stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand)
                ELSE 0 END,
            last_movement_at = EXCLUDED.last_movement_at,
            updated_at = timezone('utc', now());
    END LOOP;

    -- NOTE: Similarly, any Future RPC updates for subcontractors, suppliers, and financials 
    -- will be incrementally added as their live ledger ledgers are built.
    
    -- Lock it
    UPDATE public.cutover_batches
    SET status = 'locked',
        locked_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = p_batch_id;

    RETURN json_build_object('success', true, 'message', 'Batch locked and propagated successfully');
END;
$$;

COMMIT;
