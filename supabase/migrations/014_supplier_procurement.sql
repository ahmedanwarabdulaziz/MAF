-- Migration: 014_supplier_procurement.sql
-- Description: Core schema for Purchase Requests, Supplier Invoices, Returns, and Warehouse Confirmations.

BEGIN;

-- 1. PURCHASE REQUESTS
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    request_no VARCHAR(100) NOT NULL,
    request_date DATE NOT NULL,
    required_by_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, closed, rejected
    
    notes TEXT,
    requested_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id, request_no)
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access PRs in scoped projects"
    ON public.purchase_requests FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = purchase_requests.project_id))
    ));


CREATE TABLE IF NOT EXISTS public.purchase_request_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id),
    
    requested_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    estimated_unit_price DECIMAL(18,4),
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.purchase_request_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access PR lines via header"
    ON public.purchase_request_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.purchase_requests h
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE h.id = purchase_request_lines.pr_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = h.project_id))
    ));


-- 2. SUPPLIER INVOICES (Converted directly from PRs to match physical supply delivery)
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_party_id UUID NOT NULL REFERENCES public.parties(id),
    pr_id UUID REFERENCES public.purchase_requests(id), -- Optional strict link to PR
    
    invoice_no VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, pending_receipt, receipt_confirmed, posted, returned
    
    gross_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    net_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    paid_to_date DECIMAL(18,4) NOT NULL DEFAULT 0,
    outstanding_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(supplier_party_id, invoice_no)
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access SI in scoped projects"
    ON public.supplier_invoices FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = supplier_invoices.project_id))
    ));


CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    pr_line_id UUID REFERENCES public.purchase_request_lines(id),
    item_id UUID NOT NULL REFERENCES public.items(id),
    
    invoiced_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_gross DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_net DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access SI lines via header"
    ON public.supplier_invoice_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.supplier_invoices h
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE h.id = supplier_invoice_lines.invoice_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = h.project_id))
    ));


-- 3. WAREHOUSE RECEIPT CONFIRMATION
CREATE TABLE IF NOT EXISTS public.invoice_receipt_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE UNIQUE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    
    warehouse_manager_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    pm_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.invoice_receipt_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access receipt confirmations via invoice"
    ON public.invoice_receipt_confirmations FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.supplier_invoices h
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE h.id = invoice_receipt_confirmations.supplier_invoice_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = h.project_id))
    ));

CREATE TABLE IF NOT EXISTS public.invoice_receipt_confirmation_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confirmation_id UUID NOT NULL REFERENCES public.invoice_receipt_confirmations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    role_type VARCHAR(50) NOT NULL, -- 'warehouse_manager' or 'pm'
    action_taken VARCHAR(50) NOT NULL, -- 'approved', 'rejected'
    action_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    notes TEXT
);

ALTER TABLE public.invoice_receipt_confirmation_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read confirmation signatures" ON public.invoice_receipt_confirmation_users FOR SELECT TO authenticated USING (true);


-- 4. RETURNS
CREATE TABLE IF NOT EXISTS public.supplier_return_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    supplier_party_id UUID NOT NULL REFERENCES public.parties(id),
    original_invoice_id UUID REFERENCES public.supplier_invoices(id),
    
    return_no VARCHAR(100) NOT NULL,
    return_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    
    net_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.supplier_return_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access Returns in scoped projects"
    ON public.supplier_return_invoices FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = supplier_return_invoices.project_id))
    ));

CREATE TABLE IF NOT EXISTS public.supplier_return_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.supplier_return_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id),
    
    returned_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    line_net DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.supplier_return_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access Returns lines via header"
    ON public.supplier_return_invoice_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.supplier_return_invoices h
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE h.id = supplier_return_invoice_lines.return_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = h.project_id))
    ));


-- Trigger functions
CREATE TRIGGER tr_pr_updated_at BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_prl_updated_at BEFORE UPDATE ON public.purchase_request_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_si_updated_at BEFORE UPDATE ON public.supplier_invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sil_updated_at BEFORE UPDATE ON public.supplier_invoice_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_irc_updated_at BEFORE UPDATE ON public.invoice_receipt_confirmations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sri_updated_at BEFORE UPDATE ON public.supplier_return_invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sril_updated_at BEFORE UPDATE ON public.supplier_return_invoice_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. SUPPLIER ACCOUNT SUMMARIES (VIEW)
CREATE OR REPLACE VIEW public.supplier_account_summaries_view AS
SELECT 
    si.project_id,
    si.company_id,
    si.supplier_party_id,
    p.arabic_name as supplier_name,
    SUM(si.gross_amount) as total_invoiced_gross,
    SUM(si.discount_amount) as total_discount,
    SUM(si.tax_amount) as total_tax,
    SUM(si.net_amount) as total_invoiced_net,
    SUM(si.paid_to_date) as total_paid,
    SUM(si.outstanding_amount) as total_outstanding,
    COALESCE((SELECT SUM(r.net_amount) FROM public.supplier_return_invoices r WHERE r.supplier_party_id = si.supplier_party_id AND r.project_id = si.project_id AND r.status IN ('posted', 'approved')), 0) as total_returned_net
FROM public.supplier_invoices si
JOIN public.parties p ON p.id = si.supplier_party_id
WHERE si.status IN ('receipt_confirmed', 'posted')
GROUP BY si.project_id, si.company_id, si.supplier_party_id, p.arabic_name;

COMMIT;
