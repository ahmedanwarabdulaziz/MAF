-- ============================================================
-- P02 Migration 001: Users and Full Access Control Tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. User profiles (extends auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  email           text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  is_super_admin  boolean NOT NULL DEFAULT false,
  avatar_url      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. Employee profiles (optional HR linkage)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  arabic_name     text,
  national_id     text,
  department      text,
  job_title       text,
  hire_date       date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Business roles (organizational function labels)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key        text NOT NULL UNIQUE,
  arabic_name     text NOT NULL,
  english_name    text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 4. Permission groups (reusable access bundles)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key       text NOT NULL UNIQUE,
  group_name      text NOT NULL,
  arabic_name     text NOT NULL,
  is_system_group boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 5. Module-level permission keys registry
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key      text NOT NULL,
  module_name_ar  text NOT NULL,
  action_key      text NOT NULL,
  action_name_ar  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, action_key)
);

-- ─────────────────────────────────────────────────────────────
-- 6. Permission group → permission assignments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_group_permissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  module_key          text NOT NULL,
  action_key          text NOT NULL,
  is_allowed          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (permission_group_id, module_key, action_key)
);

-- ─────────────────────────────────────────────────────────────
-- 7. User → Role assignments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by     uuid REFERENCES public.users(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, role_id)
);

-- ─────────────────────────────────────────────────────────────
-- 8. User → Permission group assignments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_permission_group_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  assigned_by         uuid REFERENCES public.users(id),
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  is_active           boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, permission_group_id)
);

-- ─────────────────────────────────────────────────────────────
-- 9. User access scopes (WHERE permissions apply)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_access_scopes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scope_type      text NOT NULL
                    CHECK (scope_type IN ('main_company','all_projects','selected_project','selected_warehouse')),
  project_id      uuid,   -- nullable; filled when scope_type = 'selected_project'
  warehouse_id    uuid,   -- nullable; filled when scope_type = 'selected_warehouse'
  granted_by      uuid REFERENCES public.users(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────────────────────
-- 10. Approval delegations (time-bound)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_delegations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delegate_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_key      text,   -- NULL = all modules
  valid_from      timestamptz NOT NULL,
  valid_until     timestamptz NOT NULL,
  reason          text,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; super admins can read all
CREATE POLICY "users_self_read" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.is_super_admin = true
    )
  );

CREATE POLICY "users_super_admin_write" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.is_super_admin = true
    )
  );

-- Permission groups: anyone authenticated can read; only super admin writes
CREATE POLICY "pg_read_authenticated" ON public.permission_groups
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pg_super_admin_write" ON public.permission_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "permissions_read_all" ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pgp_read_all" ON public.permission_group_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pgp_super_admin_write" ON public.permission_group_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "roles_read_all" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ura_read_own" ON public.user_role_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "upga_read_own" ON public.user_permission_group_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "upga_super_admin_write" ON public.user_permission_group_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "scopes_read_own" ON public.user_access_scopes
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "scopes_super_admin_write" ON public.user_access_scopes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "ep_read_own" ON public.employee_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "delegations_read_own" ON public.approval_delegations
  FOR SELECT USING (
    delegator_id = auth.uid() OR delegate_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );
