-- ============================================================
-- P03 Migration 004: Company, Projects, Cost Centers
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Companies (single active parent company)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arabic_name         text NOT NULL,
  english_name        text NOT NULL,
  short_code          text NOT NULL UNIQUE,
  tax_number          text,
  commercial_reg      text,
  address             text,
  city                text,
  country             text NOT NULL DEFAULT 'Egypt',
  phone               text,
  email               text,
  logo_url            text,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Branches (optional physical branches)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  arabic_name         text NOT NULL,
  english_name        text NOT NULL,
  address             text,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. Departments (used by employee profiles)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  arabic_name         text NOT NULL,
  english_name        text NOT NULL,
  parent_department_id uuid REFERENCES public.departments(id),
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. Cost Centers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cost_center_code    text NOT NULL,
  arabic_name         text NOT NULL,
  english_name        text NOT NULL,
  center_type         text NOT NULL
                        CHECK (center_type IN ('company', 'project', 'department')),
  parent_center_id    uuid REFERENCES public.cost_centers(id),
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cost_center_code)
);

-- ─────────────────────────────────────────────────────────────
-- 5. Projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cost_center_id              uuid REFERENCES public.cost_centers(id),
  project_code                text NOT NULL,
  arabic_name                 text NOT NULL,
  english_name                text NOT NULL,
  status                      text NOT NULL DEFAULT 'planning'
                                CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  project_onboarding_type     text NOT NULL DEFAULT 'new'
                                CHECK (project_onboarding_type IN ('new','existing')),
  project_type                text,
  location                    text,
  start_date                  date,
  expected_end_date           date,
  actual_end_date             date,
  planned_allocation_amount   numeric(18,2),
  estimated_contract_value    numeric(18,2),
  project_manager_user_id     uuid REFERENCES public.users(id),
  owner_party_id              uuid,       -- FK added after parties table exists
  -- Cutover / migration fields (used in P07 if onboarding_type = 'existing')
  cutover_date                date,
  migration_status            text NOT NULL DEFAULT 'not_required'
                                CHECK (migration_status IN ('not_required','draft','in_progress','ready_for_review','approved','locked')),
  opening_balances_approved   boolean NOT NULL DEFAULT false,
  opening_data_locked_at      timestamptz,
  notes                       text,
  archived_at                 timestamptz,
  archived_by                 uuid REFERENCES public.users(id),
  created_by                  uuid REFERENCES public.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, project_code)
);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects    ENABLE ROW LEVEL SECURITY;

-- Companies: authenticated can read; super admin or manager can write
CREATE POLICY "companies_read" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "companies_write" ON public.companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "branches_read" ON public.branches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "branches_write" ON public.branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "departments_read" ON public.departments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "departments_write" ON public.departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "cost_centers_read" ON public.cost_centers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "cost_centers_write" ON public.cost_centers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- Projects: users can see projects they have scope for OR super admin sees all
CREATE POLICY "projects_read" ON public.projects
  FOR SELECT USING (
    archived_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
      OR EXISTS (
        SELECT 1 FROM public.user_access_scopes s
        WHERE s.user_id = auth.uid() AND s.is_active = true
          AND (
            s.scope_type IN ('all_projects', 'main_company')
            OR (s.scope_type = 'selected_project' AND s.project_id = projects.id)
          )
      )
    )
  );

CREATE POLICY "projects_write" ON public.projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- ─────────────────────────────────────────────────────────────
-- Seed: default parent company
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.companies (arabic_name, english_name, short_code, country)
VALUES ('الشركة الرئيسية', 'Main Company', 'MAIN', 'Egypt')
ON CONFLICT (short_code) DO NOTHING;

-- Seed: corporate-level cost center
INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type)
SELECT id, 'CC-CORP', 'مركز التكلفة العام', 'Corporate Cost Center', 'company'
FROM public.companies WHERE short_code = 'MAIN'
ON CONFLICT (company_id, cost_center_code) DO NOTHING;
