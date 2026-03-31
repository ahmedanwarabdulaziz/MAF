-- ============================================================
-- P02 Migration 028: Contextual Permissions (Role Templates)
-- ============================================================

-- 1. Drop existing unique constraint on (user_id, permission_group_id)
DO $$
DECLARE
    c_name text;
BEGIN
    SELECT c.conname INTO c_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_permission_group_assignments' 
      AND c.contype = 'u';

    IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_permission_group_assignments DROP CONSTRAINT ' || quote_ident(c_name);
    END IF;
END $$;

-- 2. Add Scope columns directly to assignments table
ALTER TABLE public.user_permission_group_assignments
  ADD COLUMN IF NOT EXISTS scope_type text CHECK (scope_type IN ('main_company','all_projects','selected_project','selected_warehouse')),
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid;

-- 3. Backfill data from user_access_scopes
-- We map the existing global roles to whatever access scope the user had.
-- If they had multiple scopes, we pick one randomly for the backfill (they will need manual readjustment for complex cases, but this prevents crashes).
UPDATE public.user_permission_group_assignments uga
SET 
  scope_type = COALESCE((SELECT scope_type FROM public.user_access_scopes uas WHERE uas.user_id = uga.user_id LIMIT 1), 'main_company'),
  project_id = (SELECT project_id FROM public.user_access_scopes uas WHERE uas.user_id = uga.user_id AND uas.scope_type = 'selected_project' LIMIT 1),
  warehouse_id = (SELECT warehouse_id FROM public.user_access_scopes uas WHERE uas.user_id = uga.user_id AND uas.scope_type = 'selected_warehouse' LIMIT 1)
WHERE uga.scope_type IS NULL;

-- 4. Enforce NOT NULL for scope_type
ALTER TABLE public.user_permission_group_assignments 
  ALTER COLUMN scope_type SET NOT NULL;

-- 5. Create a new composite unique index utilizing COALESCE for NULL safety (avoid parallel identical assignments)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uga_contextual_unique 
  ON public.user_permission_group_assignments (
    user_id, 
    permission_group_id, 
    scope_type, 
    COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- We still keep user_access_scopes structurally for now to avoid breaking UI that reads from it,
-- but our new assignment logic will write to both or purely rely on assignments.

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
