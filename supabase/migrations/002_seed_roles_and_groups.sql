-- ============================================================
-- P02 Migration 002: Seed Business Roles
-- ============================================================

INSERT INTO public.roles (role_key, arabic_name, english_name) VALUES
  ('super_admin',              'مدير النظام الأعلى',         'Super Admin'),
  ('executive_management',     'الإدارة التنفيذية',          'Executive Management'),
  ('finance_manager',          'مدير المالية',               'Finance Manager'),
  ('accountant',               'محاسب',                      'Accountant'),
  ('treasury_cashier',         'أمين الخزينة',               'Treasury / Cashier'),
  ('procurement_manager',      'مدير المشتريات',             'Procurement Manager'),
  ('procurement_officer',      'مسؤول مشتريات',              'Procurement Officer'),
  ('hr_manager',               'مدير الموارد البشرية',       'HR Manager'),
  ('hr_officer',               'مسؤول موارد بشرية',           'HR Officer'),
  ('project_manager',          'مدير مشروع',                 'Project Manager'),
  ('site_engineer',            'مهندس موقع',                 'Site Engineer'),
  ('warehouse_manager',        'مدير مخزن',                  'Storekeeper / Warehouse'),
  ('document_controller',      'مراقب وثائق',                'Document Controller'),
  ('internal_auditor',         'مدقق داخلي',                 'Internal Auditor'),
  ('management_read_only',     'مستخدم عرض فقط',             'Read-Only Management Viewer')
ON CONFLICT (role_key) DO NOTHING;

-- ============================================================
-- P02 Migration 002: Seed 14 Standard Permission Groups
-- ============================================================

INSERT INTO public.permission_groups (group_key, group_name, arabic_name, is_system_group) VALUES
  ('super_admin_full_control',      'Super Admin Full Control',       'مدير النظام الكامل',          true),
  ('executive_management_view',     'Executive Management View',      'عرض الإدارة التنفيذية',       true),
  ('finance_control',               'Finance Control',                'التحكم المالي',               true),
  ('finance_operations',            'Finance Operations',             'العمليات المالية',            true),
  ('treasury_operations',           'Treasury Operations',            'عمليات الخزينة',              true),
  ('procurement_control',           'Procurement Control',            'التحكم في المشتريات',         true),
  ('procurement_operations',        'Procurement Operations',         'عمليات المشتريات',            true),
  ('project_management_control',    'Project Management Control',     'التحكم في إدارة المشاريع',    true),
  ('site_engineering_operations',   'Site Engineering Operations',    'عمليات هندسة الموقع',         true),
  ('warehouse_control',             'Warehouse Control',              'التحكم في المخزن',            true),
  ('document_control',              'Document Control',               'التحكم في الوثائق',           true),
  ('internal_audit_read',           'Internal Audit Read',            'قراءة التدقيق الداخلي',       true),
  ('management_read_only',          'Management Read Only',           'عرض الإدارة فقط',             true),
  ('hr_admin_control',              'HR Admin Control',               'التحكم في الموارد البشرية',   true)
ON CONFLICT (group_key) DO NOTHING;
