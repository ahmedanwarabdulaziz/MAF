-- ============================================================
-- P03 Migration 005: Parties, Roles, Accounts, Contacts
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Parties (master business entities)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parties (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  arabic_name         text NOT NULL,
  english_name        text,
  tax_number          text,
  commercial_reg      text,
  phone               text,
  email               text,
  address             text,
  city                text,
  country             text,
  website             text,
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  archived_at         timestamptz,
  archived_by         uuid REFERENCES public.users(id),
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Party Roles (which financial roles this party plays)
-- A single party can be owner, subcontractor, AND supplier
-- simultaneously — each role has independent accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.party_roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  role_type           text NOT NULL
                        CHECK (role_type IN ('owner','subcontractor','supplier','consultant','other')),
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, role_type)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Party Role Accounts
-- Independent financial account per role (balances MUST NOT be netted)
-- project_id is nullable: NULL = company-wide account
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.party_role_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  role_type           text NOT NULL
                        CHECK (role_type IN ('owner','subcontractor','supplier','consultant','other')),
  project_id          uuid REFERENCES public.projects(id),
  account_code        text,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','closed','suspended')),
  opening_balance     numeric(18,2) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. Party Contacts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.party_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  full_name           text NOT NULL,
  job_title           text,
  email               text,
  phone               text,
  is_primary          boolean NOT NULL DEFAULT false,
  preferred_language  text NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar','en')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. Project Parties (party linked to a project with a role)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_parties (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  party_id            uuid NOT NULL REFERENCES public.parties(id) ON DELETE RESTRICT,
  project_role        text NOT NULL
                        CHECK (project_role IN ('owner','subcontractor','supplier','consultant','other')),
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','completed')),
  start_date          date,
  end_date            date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, party_id, project_role)
);

-- ─────────────────────────────────────────────────────────────
-- 6. Project Party Contacts (project-specific contact linkage)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_party_contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  party_id              uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  party_contact_id      uuid NOT NULL REFERENCES public.party_contacts(id) ON DELETE CASCADE,
  contact_role          text,
  is_primary_for_project boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Add FK from projects.owner_party_id → parties.id
-- (deferred because parties table didn't exist in migration 004)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD CONSTRAINT fk_projects_owner_party
  FOREIGN KEY (owner_party_id) REFERENCES public.parties(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.parties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_role_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_parties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_party_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_read" ON public.parties
  FOR SELECT USING (auth.role() = 'authenticated' AND archived_at IS NULL);

CREATE POLICY "parties_write" ON public.parties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "party_roles_read" ON public.party_roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "party_roles_write" ON public.party_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "party_role_accounts_read" ON public.party_role_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "party_role_accounts_write" ON public.party_role_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "party_contacts_read" ON public.party_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "party_contacts_write" ON public.party_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "project_parties_read" ON public.project_parties
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "project_parties_write" ON public.project_parties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "project_party_contacts_read" ON public.project_party_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "project_party_contacts_write" ON public.project_party_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );
