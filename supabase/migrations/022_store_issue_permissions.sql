-- ============================================================
-- Migration 022: Add store-issue actions to permissions matrix
-- ============================================================
-- Extends project_warehouse and main_warehouse with the granular
-- actions needed for the dual-approval store-issue workflow.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Register new permission actions
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module_key, module_name_ar, action_key, action_name_ar) VALUES
  -- Project Warehouse – store issues
  ('project_warehouse', 'مخزن المشروع', 'create',      'إنشاء إذن صرف'),
  ('project_warehouse', 'مخزن المشروع', 'edit',        'تعديل إذن صرف'),
  ('project_warehouse', 'مخزن المشروع', 'approve_pm',  'موافقة مدير المشروع'),
  ('project_warehouse', 'مخزن المشروع', 'approve_wm',  'موافقة أمين المخزن'),
  -- Main Warehouse – store issues
  ('main_warehouse', 'المخزن الرئيسي', 'edit',       'تعديل إذن صرف'),
  ('main_warehouse', 'المخزن الرئيسي', 'approve_pm', 'موافقة الاعتماد الأول (سوبر أدمن)'),
  ('main_warehouse', 'المخزن الرئيسي', 'approve_wm', 'موافقة أمين المخزن (مزدوجة)')
ON CONFLICT (module_key, action_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. Assign to permission groups
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  sa_id  uuid;
  pmc_id uuid;
  seo_id uuid;
  whc_id uuid;
  fnc_id uuid;
  emv_id uuid;
  iar_id uuid;
  mro_id uuid;
BEGIN
  SELECT id INTO sa_id  FROM public.permission_groups WHERE group_key = 'super_admin_full_control';
  SELECT id INTO pmc_id FROM public.permission_groups WHERE group_key = 'project_management_control';
  SELECT id INTO seo_id FROM public.permission_groups WHERE group_key = 'site_engineering_operations';
  SELECT id INTO whc_id FROM public.permission_groups WHERE group_key = 'warehouse_control';
  SELECT id INTO fnc_id FROM public.permission_groups WHERE group_key = 'finance_control';
  SELECT id INTO emv_id FROM public.permission_groups WHERE group_key = 'executive_management_view';
  SELECT id INTO iar_id FROM public.permission_groups WHERE group_key = 'internal_audit_read';
  SELECT id INTO mro_id FROM public.permission_groups WHERE group_key = 'management_read_only';

  -- Super admin gets everything (only if the group exists)
  IF sa_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
    SELECT sa_id, module_key, action_key, true
    FROM public.permissions
    WHERE module_key IN ('project_warehouse', 'main_warehouse')
    ON CONFLICT (permission_group_id, module_key, action_key) DO NOTHING;
  END IF;

  -- Project Warehouse
  -- WHC (Warehouse Control): full operational access
  IF whc_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (whc_id, 'project_warehouse', 'view',       true),
      (whc_id, 'project_warehouse', 'create',     true),
      (whc_id, 'project_warehouse', 'edit',       true),
      (whc_id, 'project_warehouse', 'approve',    true),
      (whc_id, 'project_warehouse', 'approve_wm', true),
      (whc_id, 'project_warehouse', 'export',     true),
      (whc_id, 'main_warehouse',    'view',       true),
      (whc_id, 'main_warehouse',    'create',     true),
      (whc_id, 'main_warehouse',    'edit',       true),
      (whc_id, 'main_warehouse',    'approve',    true),
      (whc_id, 'main_warehouse',    'approve_wm', true),
      (whc_id, 'main_warehouse',    'export',     true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- PMC (Project Management Control): can create and approve as PM
  IF pmc_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (pmc_id, 'project_warehouse', 'view',       true),
      (pmc_id, 'project_warehouse', 'create',     true),
      (pmc_id, 'project_warehouse', 'approve',    true),
      (pmc_id, 'project_warehouse', 'approve_pm', true),
      (pmc_id, 'project_warehouse', 'export',     true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- SEO (Site Engineering Operations): can create store issues
  IF seo_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (seo_id, 'project_warehouse', 'view',   true),
      (seo_id, 'project_warehouse', 'create', true),
      (seo_id, 'project_warehouse', 'export', true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- FNC, EMV, IAR, MRO: read-only on both modules
  IF fnc_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (fnc_id, 'project_warehouse', 'view',   true),
      (fnc_id, 'project_warehouse', 'export', true),
      (fnc_id, 'main_warehouse',    'view',   true),
      (fnc_id, 'main_warehouse',    'export', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF emv_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (emv_id, 'project_warehouse', 'view',   true),
      (emv_id, 'project_warehouse', 'export', true),
      (emv_id, 'main_warehouse',    'view',   true),
      (emv_id, 'main_warehouse',    'export', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF iar_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (iar_id, 'project_warehouse', 'view',   true),
      (iar_id, 'project_warehouse', 'export', true),
      (iar_id, 'main_warehouse',    'view',   true),
      (iar_id, 'main_warehouse',    'export', true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF mro_id IS NOT NULL THEN
    INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed) VALUES
      (mro_id, 'project_warehouse', 'view',   true),
      (mro_id, 'project_warehouse', 'export', true),
      (mro_id, 'main_warehouse',    'view',   true),
      (mro_id, 'main_warehouse',    'export', true)
    ON CONFLICT DO NOTHING;
  END IF;


END;
$$;

COMMIT;
