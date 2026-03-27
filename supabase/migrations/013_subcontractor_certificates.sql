-- Migration: 013_subcontractor_certificates.sql
-- Description: Core schema for Subcontractor Certificates, Allowances, Deductions, and Retention.

BEGIN;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.certificate_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid_in_full');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. SUBCONTRACTOR CERTIFICATES (Header)
CREATE TABLE IF NOT EXISTS public.subcontractor_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    subcontractor_party_id UUID NOT NULL REFERENCES public.parties(id),
    subcontract_agreement_id UUID NOT NULL REFERENCES public.subcontract_agreements(id),
    certificate_no VARCHAR(100) NOT NULL,
    certificate_date DATE NOT NULL,
    period_from DATE,
    period_to DATE,
    status public.certificate_status NOT NULL DEFAULT 'draft',
    
    -- Financial Totals (computed or locked versions to prevent drift)
    gross_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    taaliya_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    other_deductions_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    net_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    paid_to_date DECIMAL(18,4) NOT NULL DEFAULT 0,
    outstanding_amount DECIMAL(18,4) NOT NULL DEFAULT 0,

    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(subcontract_agreement_id, certificate_no)
);

ALTER TABLE public.subcontractor_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage certificates in their scoped projects"
    ON public.subcontractor_certificates FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = subcontractor_certificates.project_id))
    ));


-- 3. CERTIFICATE LINES
CREATE TABLE IF NOT EXISTS public.subcontractor_certificate_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES public.subcontractor_certificates(id) ON DELETE CASCADE,
    project_work_item_id UUID NOT NULL REFERENCES public.project_work_items(id),
    unit_id UUID NOT NULL REFERENCES public.units(id),
    
    -- Quantity tracking
    previous_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    current_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    cumulative_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    agreed_rate DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    -- Value tracking
    gross_line_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    taaliya_type public.taliya_type,
    taaliya_value DECIMAL(16,4),
    taaliya_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    net_line_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    owner_billable BOOLEAN NOT NULL DEFAULT true,
    owner_description_override TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(certificate_id, project_work_item_id)
);

ALTER TABLE public.subcontractor_certificate_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage cert lines via certificate header"
    ON public.subcontractor_certificate_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.subcontractor_certificates c
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE c.id = subcontractor_certificate_lines.certificate_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = c.project_id))
    ));


-- 4. ALLOWANCES
CREATE TABLE IF NOT EXISTS public.subcontractor_certificate_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES public.subcontractor_certificates(id) ON DELETE CASCADE,
    certificate_line_id UUID REFERENCES public.subcontractor_certificate_lines(id) ON DELETE CASCADE,
    base_project_work_item_id UUID REFERENCES public.project_work_items(id),
    
    current_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
    allowance_rate_difference DECIMAL(18,4),
    allowance_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    reason TEXT NOT NULL,
    approval_reference VARCHAR(100),
    show_as_notice_in_next_certificate BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.subcontractor_certificate_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage allowances via certificate header"
    ON public.subcontractor_certificate_allowances FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.subcontractor_certificates c
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE c.id = subcontractor_certificate_allowances.certificate_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = c.project_id))
    ));


-- 5. DEDUCTIONS
CREATE TABLE IF NOT EXISTS public.subcontractor_certificate_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES public.subcontractor_certificates(id) ON DELETE CASCADE,
    
    deduction_type VARCHAR(50) NOT NULL, -- e.g. Tax, Penalty, Retentions, Advance Recovery
    calculation_type VARCHAR(50) NOT NULL DEFAULT 'amount', -- 'amount' or 'percentage_of_gross'
    rate_or_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    deduction_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.subcontractor_certificate_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage deductions via certificate header"
    ON public.subcontractor_certificate_deductions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.subcontractor_certificates c
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE c.id = subcontractor_certificate_deductions.certificate_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = c.project_id))
    ));


-- 6. RETENTION (TA'LIYA) RELEASES
CREATE TABLE IF NOT EXISTS public.subcontractor_retention_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    subcontractor_party_id UUID NOT NULL REFERENCES public.parties(id),
    subcontract_agreement_id UUID REFERENCES public.subcontract_agreements(id),
    
    release_date DATE NOT NULL,
    released_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, approved, paid
    
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.subcontractor_retention_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage retention releases in scoped projects"
    ON public.subcontractor_retention_releases FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = subcontractor_retention_releases.project_id))
    ));

-- Triggers for timestamps
CREATE TRIGGER tr_sub_certs_updated_at BEFORE UPDATE ON public.subcontractor_certificates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_cert_lines_updated_at BEFORE UPDATE ON public.subcontractor_certificate_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_cert_allow_updated_at BEFORE UPDATE ON public.subcontractor_certificate_allowances FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_cert_ded_updated_at BEFORE UPDATE ON public.subcontractor_certificate_deductions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_ret_rel_updated_at BEFORE UPDATE ON public.subcontractor_retention_releases FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

COMMIT;
