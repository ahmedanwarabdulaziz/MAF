-- ============================================================
-- Migration 033: Internal Store Issues + Cost Center Improvements
-- ============================================================
-- 1. Adds issue_type column to store_issues ('project' | 'internal')
-- 2. Adds constraint: internal issues must have cost_center_id
-- 3. Opens cost_centers write to company admins (not just super_admin)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Add issue_type to store_issues
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.store_issues
  ADD COLUMN IF NOT EXISTS issue_type text NOT NULL DEFAULT 'project'
    CHECK (issue_type IN ('project', 'internal'));

-- ─────────────────────────────────────────────────────────────
-- 2. Constraint: internal issues must reference a cost_center
--    (project issues may omit cost_center_id)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.store_issues
  DROP CONSTRAINT IF EXISTS check_internal_has_cost_center;

ALTER TABLE public.store_issues
  ADD CONSTRAINT check_internal_has_cost_center
    CHECK (
      issue_type = 'project'
      OR (issue_type = 'internal' AND cost_center_id IS NOT NULL)
    );

-- ─────────────────────────────────────────────────────────────
-- 3. Open cost_centers to authenticated writes (company admins)
--    The old policy only allowed super_admin; we need company
--    admins (main_company scope) to manage cost centers too.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cost_centers_write" ON public.cost_centers;

CREATE POLICY "cost_centers_write" ON public.cost_centers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
    OR auth.role() = 'service_role'
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Seed: Rename CC-CORP to "الشركة الرئيسية" (the top-level node)
-- ─────────────────────────────────────────────────────────────
UPDATE public.cost_centers
SET arabic_name = 'الشركة الرئيسية', english_name = 'Main Company'
WHERE cost_center_code = 'CC-CORP';

-- ─────────────────────────────────────────────────────────────
-- 5. Seed: Sub cost centers — all children of CC-CORP
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type, parent_center_id)
SELECT c.id, 'CC-ADMIN', 'الإدارة العامة', 'General Administration', 'department',
  (SELECT id FROM public.cost_centers WHERE cost_center_code = 'CC-CORP' AND company_id = c.id)
FROM public.companies c WHERE c.short_code = 'MAIN'
ON CONFLICT (company_id, cost_center_code) DO UPDATE
  SET parent_center_id = EXCLUDED.parent_center_id;

INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type, parent_center_id)
SELECT c.id, 'CC-OPS', 'العمليات والتشغيل', 'Operations', 'department',
  (SELECT id FROM public.cost_centers WHERE cost_center_code = 'CC-CORP' AND company_id = c.id)
FROM public.companies c WHERE c.short_code = 'MAIN'
ON CONFLICT (company_id, cost_center_code) DO UPDATE
  SET parent_center_id = EXCLUDED.parent_center_id;

INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type, parent_center_id)
SELECT c.id, 'CC-MAINT', 'الصيانة والمنشآت', 'Maintenance & Facilities', 'department',
  (SELECT id FROM public.cost_centers WHERE cost_center_code = 'CC-CORP' AND company_id = c.id)
FROM public.companies c WHERE c.short_code = 'MAIN'
ON CONFLICT (company_id, cost_center_code) DO UPDATE
  SET parent_center_id = EXCLUDED.parent_center_id;

INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type, parent_center_id)
SELECT c.id, 'CC-IT', 'تقنية المعلومات', 'Information Technology', 'department',
  (SELECT id FROM public.cost_centers WHERE cost_center_code = 'CC-CORP' AND company_id = c.id)
FROM public.companies c WHERE c.short_code = 'MAIN'
ON CONFLICT (company_id, cost_center_code) DO UPDATE
  SET parent_center_id = EXCLUDED.parent_center_id;

-- ─────────────────────────────────────────────────────────────
-- 6. Link existing projects to cost centers
--    Each project already has cost_center_id column.
--    If a project has no cost_center_id, create one automatically.
-- ─────────────────────────────────────────────────────────────
-- Insert cost centers for projects that don't have one yet
INSERT INTO public.cost_centers (company_id, cost_center_code, arabic_name, english_name, center_type)
SELECT
  p.company_id,
  'CC-PRJ-' || p.project_code,
  p.arabic_name,
  p.english_name,
  'project'
FROM public.projects p
WHERE p.cost_center_id IS NULL
  AND p.archived_at IS NULL
ON CONFLICT (company_id, cost_center_code) DO NOTHING;

-- Link them back
UPDATE public.projects p
SET cost_center_id = cc.id
FROM public.cost_centers cc
WHERE cc.cost_center_code = 'CC-PRJ-' || p.project_code
  AND cc.company_id = p.company_id
  AND p.cost_center_id IS NULL;

COMMIT;
