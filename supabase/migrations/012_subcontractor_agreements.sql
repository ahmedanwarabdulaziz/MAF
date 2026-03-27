-- Migration: 012_subcontractor_agreements.sql
-- Description: Core schema for project work items and subcontractor agreements

BEGIN;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.agreement_status AS ENUM ('draft', 'active', 'suspended', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.taliya_type AS ENUM ('percentage', 'fixed_amount');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. PROJECT WORK ITEMS (Catalog)
CREATE TABLE IF NOT EXISTS public.project_work_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_code VARCHAR(100),
    arabic_description TEXT NOT NULL,
    english_description TEXT,
    default_unit_id UUID REFERENCES public.units(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id, item_code)
);

ALTER TABLE public.project_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage work items in their scoped projects"
    ON public.project_work_items FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = project_work_items.project_id))
    ));


-- 3. SUBCONTRACT AGREEMENTS (Header)
CREATE TABLE IF NOT EXISTS public.subcontract_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    subcontractor_party_id UUID NOT NULL REFERENCES public.parties(id),
    agreement_code VARCHAR(100) NOT NULL,
    status public.agreement_status NOT NULL DEFAULT 'draft',
    default_taaliya_type public.taliya_type NOT NULL DEFAULT 'percentage',
    default_taaliya_value DECIMAL(16,4) NOT NULL DEFAULT 5, -- e.g. 5%
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id, agreement_code)
);

ALTER TABLE public.subcontract_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage agreements in their scoped projects"
    ON public.subcontract_agreements FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = subcontract_agreements.project_id))
    ));


-- 4. SUBCONTRACT AGREEMENT LINES
CREATE TABLE IF NOT EXISTS public.subcontract_agreement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcontract_agreement_id UUID NOT NULL REFERENCES public.subcontract_agreements(id) ON DELETE CASCADE,
    work_item_id UUID NOT NULL REFERENCES public.project_work_items(id),
    unit_id UUID NOT NULL REFERENCES public.units(id),
    agreed_rate DECIMAL(16,4) NOT NULL DEFAULT 0,
    taaliya_type public.taliya_type, 
    taaliya_value DECIMAL(16,4),
    owner_billable_default BOOLEAN NOT NULL DEFAULT true,
    estimated_quantity DECIMAL(16,4),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.subcontract_agreement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage agreement lines through agreements"
    ON public.subcontract_agreement_lines FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
        OR EXISTS (
        SELECT 1 FROM public.subcontract_agreements a
        JOIN public.user_access_scopes s ON s.user_id = auth.uid() AND s.is_active = true
        WHERE a.id = subcontract_agreement_lines.subcontract_agreement_id
        AND (s.scope_type IN ('all_projects', 'main_company') OR (s.scope_type = 'selected_project' AND s.project_id = a.project_id))
    ));

-- Add trigger boilerplate for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_p_work_items_updated_at BEFORE UPDATE ON public.project_work_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_agreements_updated_at BEFORE UPDATE ON public.subcontract_agreements FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_sub_agreement_lines_updated_at BEFORE UPDATE ON public.subcontract_agreement_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

COMMIT;
