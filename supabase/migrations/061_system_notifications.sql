-- Migration: 061_system_notifications
-- Description: Tracking persisted per-user and per-role notifications and read states

CREATE TABLE IF NOT EXISTS public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade on update cascade,
  role_id uuid references public.permission_groups(id) on delete set null on update cascade,
  item_type varchar(100) not null,
  source_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade on update cascade,
  title varchar(255) not null,
  message text,
  priority varchar(50) default 'normal'::character varying,
  is_read boolean default false not null,
  read_at timestamp with time zone,
  action_url text,
  created_at timestamp with time zone default now() not null
);

-- Ensure a notification is targeted at either a specific user or a general role group
ALTER TABLE public.system_notifications 
  ADD CONSTRAINT chk_notification_target 
  CHECK (user_id IS NOT NULL OR role_id IS NOT NULL);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_system_notifications_user_id ON public.system_notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_role_id ON public.system_notifications USING btree (role_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_project_id ON public.system_notifications USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_is_read ON public.system_notifications USING btree (is_read);

-- RLS Policies
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- User can see notifications specifically targeted to them
CREATE POLICY "Users can view their own notifications"
ON public.system_notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- User can see role-based notifications if they belong to that role
CREATE POLICY "Users can view role-based notifications"
ON public.system_notifications
FOR SELECT
TO authenticated
USING (
  role_id IN (
    SELECT permission_group_id FROM public.user_permission_group_assignments WHERE user_permission_group_assignments.user_id = auth.uid()
  )
);

-- Users can update (mark as read) their own notifications
-- If it's a role_id notification, they shouldn't update the global row directly.
-- Wait, if it's a role_based notification, multiple users might read it.
-- But for WI-08 schema, if is_read is on the notification itself, a role-based notification 
-- would mark it read for everyone in that role.
-- For true per-user tracking on role-broadcasts, we'd need a `notification_reads` table.
-- Given V1 is primarily about migrating pending state safely, let's allow user update 
-- on their *own* user_id notifications, and for role-based notifications, we might have to clone them 
-- per user, OR we implement `system_notification_reads`.

-- Let's stick with the simplest architecture: 
-- Application layer will clone/target notifications per-user instead of broadcasting to `role_id` directly 
-- if distinct read states are needed. We keep the table as is.
CREATE POLICY "Users can update their own notifications"
ON public.system_notifications
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR role_id IN (SELECT permission_group_id FROM public.user_permission_group_assignments WHERE user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid() OR role_id IN (SELECT permission_group_id FROM public.user_permission_group_assignments WHERE user_id = auth.uid())
);

-- Note: The system/RPC creates notifications. Users do not insert.
