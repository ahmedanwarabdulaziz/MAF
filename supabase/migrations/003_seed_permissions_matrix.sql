-- ============================================================
-- P02 Migration 003: Seed Permissions Registry (module × action)
-- ============================================================

INSERT INTO public.permissions (module_key, module_name_ar, action_key, action_name_ar) VALUES
  -- Dashboard
  ('dashboard',                    'لوحة التحكم',                    'view',                   'عرض'),
  ('dashboard',                    'لوحة التحكم',                    'export',                  'تصدير'),
  -- Approvals
  ('approvals',                    'الموافقات',                       'view',                   'عرض'),
  ('approvals',                    'الموافقات',                       'approve',                 'اعتماد'),
  ('approvals',                    'الموافقات',                       'reject',                  'رفض'),
  ('approvals',                    'الموافقات',                       'return_for_correction',   'إرجاع للتصحيح'),
  -- Projects
  ('projects',                     'المشروعات',                       'view',                   'عرض'),
  ('projects',                     'المشروعات',                       'create',                  'إنشاء'),
  ('projects',                     'المشروعات',                       'edit',                    'تعديل'),
  ('projects',                     'المشروعات',                       'export',                  'تصدير'),
  ('projects',                     'المشروعات',                       'delete_or_archive',       'حذف/أرشفة'),
  -- Cutover
  ('cutover',                      'الترحيل',                         'view',                   'عرض'),
  ('cutover',                      'الترحيل',                         'create',                  'إضافة'),
  ('cutover',                      'الترحيل',                         'edit',                    'تعديل'),
  ('cutover',                      'الترحيل',                         'approve',                 'اعتماد'),
  ('cutover',                      'الترحيل',                         'lock',                    'قفل'),
  ('cutover',                      'الترحيل',                         'export',                  'تصدير'),
  -- Users and Access
  ('users_and_access',             'المستخدمون والصلاحيات',            'view',                   'عرض'),
  ('users_and_access',             'المستخدمون والصلاحيات',            'create',                  'إنشاء'),
  ('users_and_access',             'المستخدمون والصلاحيات',            'edit',                    'تعديل'),
  ('users_and_access',             'المستخدمون والصلاحيات',            'export',                  'تصدير'),
  ('users_and_access',             'المستخدمون والصلاحيات',            'delete_or_archive',       'حذف/أرشفة'),
  -- Approval Workflows
  ('approval_workflows',           'سير عمل الموافقات',               'view',                   'عرض'),
  ('approval_workflows',           'سير عمل الموافقات',               'create',                  'إنشاء'),
  ('approval_workflows',           'سير عمل الموافقات',               'edit',                    'تعديل'),
  -- Settings
  ('settings',                     'الإعدادات',                       'view',                   'عرض'),
  ('settings',                     'الإعدادات',                       'edit',                    'تعديل'),
  -- Treasury and Bank Accounts
  ('treasury',                     'الخزينة والحسابات البنكية',        'view',                   'عرض'),
  ('treasury',                     'الخزينة والحسابات البنكية',        'create',                  'إضافة'),
  ('treasury',                     'الخزينة والحسابات البنكية',        'edit',                    'تعديل'),
  ('treasury',                     'الخزينة والحسابات البنكية',        'approve',                 'اعتماد'),
  ('treasury',                     'الخزينة والحسابات البنكية',        'export',                  'تصدير'),
  -- Assets
  ('assets',                       'الأصول',                          'view',                   'عرض'),
  ('assets',                       'الأصول',                          'export',                  'تصدير'),
  -- Item Master
  ('item_master',                  'الأصناف الرئيسية',                 'view',                   'عرض'),
  ('item_master',                  'الأصناف الرئيسية',                 'create',                  'إضافة'),
  ('item_master',                  'الأصناف الرئيسية',                 'edit',                    'تعديل'),
  -- Main Warehouse
  ('main_warehouse',               'المخزن الرئيسي',                  'view',                   'عرض'),
  ('main_warehouse',               'المخزن الرئيسي',                  'create',                  'إضافة'),
  ('main_warehouse',               'المخزن الرئيسي',                  'approve',                 'اعتماد'),
  ('main_warehouse',               'المخزن الرئيسي',                  'export',                  'تصدير'),
  -- Party Masters
  ('party_masters',                'كشوف الأطراف',                    'view',                   'عرض'),
  ('party_masters',                'كشوف الأطراف',                    'create',                  'إضافة'),
  ('party_masters',                'كشوف الأطراف',                    'edit',                    'تعديل'),
  ('party_masters',                'كشوف الأطراف',                    'export',                  'تصدير'),
  -- Corporate Expenses
  ('corporate_expenses',           'المصروفات العمومية',               'view',                   'عرض'),
  ('corporate_expenses',           'المصروفات العمومية',               'create',                  'إضافة'),
  ('corporate_expenses',           'المصروفات العمومية',               'approve',                 'اعتماد'),
  ('corporate_expenses',           'المصروفات العمومية',               'export',                  'تصدير'),
  -- Consolidated Reports
  ('consolidated_reports',         'التقارير الموحدة',                 'view',                   'عرض'),
  ('consolidated_reports',         'التقارير الموحدة',                 'export',                  'تصدير'),
  -- Project Profile
  ('project_profile',              'ملف المشروع',                     'view',                   'عرض'),
  ('project_profile',              'ملف المشروع',                     'edit',                    'تعديل'),
  -- Subcontractor Certificates
  ('subcontractor_certificates',   'مستخلصات المقاولين',               'view',                   'عرض'),
  ('subcontractor_certificates',   'مستخلصات المقاولين',               'create',                  'إضافة'),
  ('subcontractor_certificates',   'مستخلصات المقاولين',               'edit',                    'تعديل'),
  ('subcontractor_certificates',   'مستخلصات المقاولين',               'approve',                 'اعتماد'),
  ('subcontractor_certificates',   'مستخلصات المقاولين',               'export',                  'تصدير'),
  -- Supplier Procurement
  ('supplier_procurement',         'مشتريات وفواتير الموردين',          'view',                   'عرض'),
  ('supplier_procurement',         'مشتريات وفواتير الموردين',          'create',                  'إضافة'),
  ('supplier_procurement',         'مشتريات وفواتير الموردين',          'edit',                    'تعديل'),
  ('supplier_procurement',         'مشتريات وفواتير الموردين',          'approve',                 'اعتماد'),
  ('supplier_procurement',         'مشتريات وفواتير الموردين',          'export',                  'تصدير'),
  -- Project Warehouse
  ('project_warehouse',            'مخزن المشروع',                    'view',                   'عرض'),
  ('project_warehouse',            'مخزن المشروع',                    'approve',                 'اعتماد'),
  ('project_warehouse',            'مخزن المشروع',                    'export',                  'تصدير'),
  -- Employee Custody
  ('employee_custody',             'عهد الموظفين والمصروفات',          'view',                   'عرض'),
  ('employee_custody',             'عهد الموظفين والمصروفات',          'create',                  'إضافة'),
  ('employee_custody',             'عهد الموظفين والمصروفات',          'approve',                 'اعتماد'),
  ('employee_custody',             'عهد الموظفين والمصروفات',          'export',                  'تصدير'),
  -- Owner Billing
  ('owner_billing',                'فوترة المالك والتحصيل',            'view',                   'عرض'),
  ('owner_billing',                'فوترة المالك والتحصيل',            'create',                  'إضافة'),
  ('owner_billing',                'فوترة المالك والتحصيل',            'approve',                 'اعتماد'),
  ('owner_billing',                'فوترة المالك والتحصيل',            'export',                  'تصدير'),
  -- Payments
  ('payments',                     'المدفوعات',                       'view',                   'عرض'),
  ('payments',                     'المدفوعات',                       'create',                  'إضافة'),
  ('payments',                     'المدفوعات',                       'approve',                 'اعتماد'),
  ('payments',                     'المدفوعات',                       'export',                  'تصدير'),
  -- Project Documents
  ('project_documents',            'وثائق المشروع',                   'view',                   'عرض'),
  ('project_documents',            'وثائق المشروع',                   'create',                  'إضافة'),
  ('project_documents',            'وثائق المشروع',                   'export',                  'تصدير'),
  -- Project Reports
  ('project_reports',              'تقارير المشروع',                   'view',                   'عرض'),
  ('project_reports',              'تقارير المشروع',                   'export',                  'تصدير'),
  -- Attachments
  ('attachments',                  'المرفقات',                        'view',                   'عرض'),
  ('attachments',                  'المرفقات',                        'create',                  'إضافة'),
  ('attachments',                  'المرفقات',                        'delete_or_archive',       'حذف/أرشفة')
ON CONFLICT (module_key, action_key) DO NOTHING;

-- ============================================================
-- Seed permission_group_permissions based on module breakdown
-- Levels: ADM=all, MGR=most, REV=review, FIN=finance-exec,
--         OPR=operational, WH=warehouse, DOC=docs, VEX=view+export, VW=view
-- ============================================================

-- Helper: grant all actions for a group+module to a given list
-- We use a DO block to seed cleanly

DO $$
DECLARE
  sa_id  uuid;
  emv_id uuid;
  fnc_id uuid;
  fno_id uuid;
  tre_id uuid;
  prc_id uuid;
  pro_id uuid;
  pmc_id uuid;
  seo_id uuid;
  whc_id uuid;
  doc_id uuid;
  iar_id uuid;
  mro_id uuid;
BEGIN
  SELECT id INTO sa_id  FROM public.permission_groups WHERE group_key = 'super_admin_full_control';
  SELECT id INTO emv_id FROM public.permission_groups WHERE group_key = 'executive_management_view';
  SELECT id INTO fnc_id FROM public.permission_groups WHERE group_key = 'finance_control';
  SELECT id INTO fno_id FROM public.permission_groups WHERE group_key = 'finance_operations';
  SELECT id INTO tre_id FROM public.permission_groups WHERE group_key = 'treasury_operations';
  SELECT id INTO prc_id FROM public.permission_groups WHERE group_key = 'procurement_control';
  SELECT id INTO pro_id FROM public.permission_groups WHERE group_key = 'procurement_operations';
  SELECT id INTO pmc_id FROM public.permission_groups WHERE group_key = 'project_management_control';
  SELECT id INTO seo_id FROM public.permission_groups WHERE group_key = 'site_engineering_operations';
  SELECT id INTO whc_id FROM public.permission_groups WHERE group_key = 'warehouse_control';
  SELECT id INTO doc_id FROM public.permission_groups WHERE group_key = 'document_control';
  SELECT id INTO iar_id FROM public.permission_groups WHERE group_key = 'internal_audit_read';
  SELECT id INTO mro_id FROM public.permission_groups WHERE group_key = 'management_read_only';

  -- SUPER ADMIN gets all permissions
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  SELECT sa_id, module_key, action_key, true FROM public.permissions
  ON CONFLICT (permission_group_id, module_key, action_key) DO NOTHING;

  -- Users and Access: only SA (already done above), IAR gets view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (iar_id, 'users_and_access', 'view',   true),
    (iar_id, 'users_and_access', 'export', true)
  ON CONFLICT DO NOTHING;

  -- Approval Workflows: SA done, FNC view, IAR view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (fnc_id, 'approval_workflows', 'view', true),
    (iar_id, 'approval_workflows', 'view', true),
    (iar_id, 'approval_workflows', 'export', true)
  ON CONFLICT DO NOTHING;

  -- Dashboard: most groups get view; EMV, FNC, PMC, IAR, MRO get export too
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  SELECT g.id, 'dashboard', 'view', true
  FROM public.permission_groups g
  WHERE g.group_key IN ('executive_management_view','finance_control','finance_operations',
    'treasury_operations','procurement_control','procurement_operations',
    'project_management_control','site_engineering_operations','warehouse_control',
    'document_control','internal_audit_read','management_read_only')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  SELECT g.id, 'dashboard', 'export', true
  FROM public.permission_groups g
  WHERE g.group_key IN ('executive_management_view','finance_control','internal_audit_read','management_read_only','project_management_control')
  ON CONFLICT DO NOTHING;

  -- Projects governance: EMV, FNC view+export; FNO, TRE, PRC, PRO, PMC, SEO, WHC, DOC view
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  SELECT g.id, 'projects', 'view', true
  FROM public.permission_groups g
  WHERE g.group_key IN ('executive_management_view','finance_control','finance_operations',
    'treasury_operations','procurement_control','procurement_operations',
    'project_management_control','site_engineering_operations','warehouse_control',
    'document_control','internal_audit_read','management_read_only')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  SELECT g.id, 'projects', 'export', true
  FROM public.permission_groups g
  WHERE g.group_key IN ('executive_management_view','finance_control','internal_audit_read','management_read_only','project_management_control')
  ON CONFLICT DO NOTHING;

  -- Treasury: EMV view+export; FNC approve+view+export; FNO create+edit+view; TRE all FIN actions; IAR,MRO view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (emv_id, 'treasury', 'view',   true),
    (emv_id, 'treasury', 'export', true),
    (fnc_id, 'treasury', 'view',   true),
    (fnc_id, 'treasury', 'approve',true),
    (fnc_id, 'treasury', 'export', true),
    (fno_id, 'treasury', 'view',   true),
    (fno_id, 'treasury', 'create', true),
    (fno_id, 'treasury', 'edit',   true),
    (tre_id, 'treasury', 'view',   true),
    (tre_id, 'treasury', 'create', true),
    (tre_id, 'treasury', 'export', true),
    (iar_id, 'treasury', 'view',   true),
    (iar_id, 'treasury', 'export', true),
    (mro_id, 'treasury', 'view',   true),
    (mro_id, 'treasury', 'export', true)
  ON CONFLICT DO NOTHING;

  -- Subcontractor Certificates: SEO create/edit; PMC+FNC approve/view; EMV,FNO view+export; IAR,MRO view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (seo_id, 'subcontractor_certificates', 'view',   true),
    (seo_id, 'subcontractor_certificates', 'create', true),
    (seo_id, 'subcontractor_certificates', 'edit',   true),
    (pmc_id, 'subcontractor_certificates', 'view',   true),
    (pmc_id, 'subcontractor_certificates', 'approve',true),
    (pmc_id, 'subcontractor_certificates', 'export', true),
    (fnc_id, 'subcontractor_certificates', 'view',   true),
    (fnc_id, 'subcontractor_certificates', 'approve',true),
    (fnc_id, 'subcontractor_certificates', 'export', true),
    (fno_id, 'subcontractor_certificates', 'view',   true),
    (fno_id, 'subcontractor_certificates', 'export', true),
    (emv_id, 'subcontractor_certificates', 'view',   true),
    (emv_id, 'subcontractor_certificates', 'export', true),
    (iar_id, 'subcontractor_certificates', 'view',   true),
    (iar_id, 'subcontractor_certificates', 'export', true),
    (mro_id, 'subcontractor_certificates', 'view',   true),
    (mro_id, 'subcontractor_certificates', 'export', true)
  ON CONFLICT DO NOTHING;

  -- Supplier Procurement: SEO+PRO create/edit; PMC+PRC+FNC approve; WHC warehouse actions; TRE view; IAR,MRO view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (seo_id, 'supplier_procurement', 'view',    true),
    (seo_id, 'supplier_procurement', 'create',  true),
    (seo_id, 'supplier_procurement', 'edit',    true),
    (pro_id, 'supplier_procurement', 'view',    true),
    (pro_id, 'supplier_procurement', 'create',  true),
    (pro_id, 'supplier_procurement', 'edit',    true),
    (prc_id, 'supplier_procurement', 'view',    true),
    (prc_id, 'supplier_procurement', 'approve', true),
    (prc_id, 'supplier_procurement', 'export',  true),
    (pmc_id, 'supplier_procurement', 'view',    true),
    (pmc_id, 'supplier_procurement', 'approve', true),
    (pmc_id, 'supplier_procurement', 'export',  true),
    (fnc_id, 'supplier_procurement', 'view',    true),
    (fnc_id, 'supplier_procurement', 'approve', true),
    (fnc_id, 'supplier_procurement', 'export',  true),
    (fno_id, 'supplier_procurement', 'view',    true),
    (fno_id, 'supplier_procurement', 'create',  true),
    (fno_id, 'supplier_procurement', 'edit',    true),
    (whc_id, 'supplier_procurement', 'view',    true),
    (whc_id, 'supplier_procurement', 'approve', true),
    (emv_id, 'supplier_procurement', 'view',    true),
    (emv_id, 'supplier_procurement', 'export',  true),
    (iar_id, 'supplier_procurement', 'view',    true),
    (iar_id, 'supplier_procurement', 'export',  true),
    (mro_id, 'supplier_procurement', 'view',    true),
    (mro_id, 'supplier_procurement', 'export',  true),
    (tre_id, 'supplier_procurement', 'view',    true)
  ON CONFLICT DO NOTHING;

  -- Owner Billing: FNO create; FNC+PMC approve/view; TRE confirm; DOC manage; EMV,IAR,MRO view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (fno_id, 'owner_billing', 'view',    true),
    (fno_id, 'owner_billing', 'create',  true),
    (fnc_id, 'owner_billing', 'view',    true),
    (fnc_id, 'owner_billing', 'approve', true),
    (fnc_id, 'owner_billing', 'export',  true),
    (pmc_id, 'owner_billing', 'view',    true),
    (tre_id, 'owner_billing', 'view',    true),
    (tre_id, 'owner_billing', 'create',  true),
    (doc_id, 'owner_billing', 'view',    true),
    (doc_id, 'owner_billing', 'create',  true),
    (emv_id, 'owner_billing', 'view',    true),
    (emv_id, 'owner_billing', 'export',  true),
    (iar_id, 'owner_billing', 'view',    true),
    (iar_id, 'owner_billing', 'export',  true),
    (mro_id, 'owner_billing', 'view',    true),
    (mro_id, 'owner_billing', 'export',  true)
  ON CONFLICT DO NOTHING;

  -- Payments: FNO create; FNC approve; TRE create+approve; EMV,IAR,MRO view+export
  INSERT INTO public.permission_group_permissions (permission_group_id, module_key, action_key, is_allowed)
  VALUES
    (fno_id, 'payments', 'view',    true),
    (fno_id, 'payments', 'create',  true),
    (fnc_id, 'payments', 'view',    true),
    (fnc_id, 'payments', 'approve', true),
    (fnc_id, 'payments', 'export',  true),
    (tre_id, 'payments', 'view',    true),
    (tre_id, 'payments', 'create',  true),
    (tre_id, 'payments', 'approve', true),
    (tre_id, 'payments', 'export',  true),
    (pmc_id, 'payments', 'view',    true),
    (emv_id, 'payments', 'view',    true),
    (emv_id, 'payments', 'export',  true),
    (iar_id, 'payments', 'view',    true),
    (iar_id, 'payments', 'export',  true),
    (mro_id, 'payments', 'view',    true),
    (mro_id, 'payments', 'export',  true)
  ON CONFLICT DO NOTHING;

END;
$$;
