-- ============================================================
-- Migration 006: Fix infinite recursion in users table RLS policies
-- The previous policies did EXISTS (SELECT 1 FROM public.users ...)
-- inside a policy ON public.users — causing infinite recursion.
-- Fix: use a SECURITY DEFINER helper function that bypasses RLS.
-- ============================================================

-- Step 1: Create a helper function that checks is_super_admin
-- without going through RLS (SECURITY DEFINER bypasses row-level security)
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.users WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Step 2: Drop the old recursive policies on users
DROP POLICY IF EXISTS "users_self_read"         ON public.users;
DROP POLICY IF EXISTS "users_super_admin_write" ON public.users;

-- Step 3: Recreate them using the non-recursive helper
CREATE POLICY "users_self_read" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_current_user_super_admin()
  );

CREATE POLICY "users_super_admin_write" ON public.users
  FOR ALL USING (
    public.is_current_user_super_admin()
  );

-- Step 4: Fix the same recursion in all other tables that have the same pattern
-- (they do EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true))

-- permission_groups
DROP POLICY IF EXISTS "pg_super_admin_write" ON public.permission_groups;
CREATE POLICY "pg_super_admin_write" ON public.permission_groups
  FOR ALL USING (public.is_current_user_super_admin());

-- permission_group_permissions
DROP POLICY IF EXISTS "pgp_super_admin_write" ON public.permission_group_permissions;
CREATE POLICY "pgp_super_admin_write" ON public.permission_group_permissions
  FOR ALL USING (public.is_current_user_super_admin());

-- user_role_assignments
DROP POLICY IF EXISTS "ura_read_own" ON public.user_role_assignments;
CREATE POLICY "ura_read_own" ON public.user_role_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_current_user_super_admin()
  );

-- user_permission_group_assignments
DROP POLICY IF EXISTS "upga_read_own"           ON public.user_permission_group_assignments;
DROP POLICY IF EXISTS "upga_super_admin_write"  ON public.user_permission_group_assignments;
CREATE POLICY "upga_read_own" ON public.user_permission_group_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_current_user_super_admin()
  );
CREATE POLICY "upga_super_admin_write" ON public.user_permission_group_assignments
  FOR ALL USING (public.is_current_user_super_admin());

-- user_access_scopes
DROP POLICY IF EXISTS "scopes_read_own"          ON public.user_access_scopes;
DROP POLICY IF EXISTS "scopes_super_admin_write" ON public.user_access_scopes;
CREATE POLICY "scopes_read_own" ON public.user_access_scopes
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_current_user_super_admin()
  );
CREATE POLICY "scopes_super_admin_write" ON public.user_access_scopes
  FOR ALL USING (public.is_current_user_super_admin());

-- employee_profiles
DROP POLICY IF EXISTS "ep_read_own" ON public.employee_profiles;
CREATE POLICY "ep_read_own" ON public.employee_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_current_user_super_admin()
  );

-- approval_delegations
DROP POLICY IF EXISTS "delegations_read_own" ON public.approval_delegations;
CREATE POLICY "delegations_read_own" ON public.approval_delegations
  FOR SELECT USING (
    delegator_id = auth.uid() OR delegate_id = auth.uid()
    OR public.is_current_user_super_admin()
  );

-- Verify the function works
SELECT public.is_current_user_super_admin();
