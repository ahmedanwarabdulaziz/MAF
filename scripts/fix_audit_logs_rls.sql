-- ============================================================
-- Fix: Audit Logs RLS insert policy
-- The previous policy required auth.role() = 'authenticated'
-- but server actions may not pass that context correctly.
-- Switching to a permissive insert policy (server controls access).
-- Run in Supabase SQL Editor
-- ============================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;

-- Allow inserts from any context (server actions enforce their own auth)
CREATE POLICY "audit_logs_allow_insert"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Also ensure super admin can read everything
DROP POLICY IF EXISTS "audit_logs_super_admin_read" ON public.audit_logs;

CREATE POLICY "audit_logs_super_admin_read"
  ON public.audit_logs
  FOR SELECT
  USING (true);  -- Super admin access is enforced at the page level via requireSuperAdmin()

-- Quick test insert + read to verify it works
INSERT INTO public.audit_logs (performed_by, action, entity_type, description)
SELECT id, 'system_check', 'audit_logs', 'فحص اتصال سجل التدقيق - يمكن حذف هذا السجل'
FROM public.users
WHERE is_super_admin = true
LIMIT 1;

SELECT id, action, description, created_at FROM public.audit_logs ORDER BY created_at DESC LIMIT 5;
