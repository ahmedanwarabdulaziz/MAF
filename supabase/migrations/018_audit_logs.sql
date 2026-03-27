-- ============================================================
-- Migration 018: Audit Log Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action        text NOT NULL,          -- e.g. 'grant_scope', 'revoke_scope', 'save_permissions'
  entity_type   text,                   -- e.g. 'user_access_scope', 'permission_group'
  entity_id     text,                   -- UUID or slug of the affected record
  description   text,                   -- Human-readable Arabic summary
  metadata      jsonb,                  -- Extra structured data (old/new values etc)
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by actor, action type, date
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- RLS: only super admins can read; service role can write (via server actions)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_super_admin_read" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- Allow insert from authenticated session (server actions run as authenticated user)
CREATE POLICY "audit_logs_authenticated_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
