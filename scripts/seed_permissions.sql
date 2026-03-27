-- ============================================================
-- MAF System — Permissions Table Seed
-- Seeds all module + action combinations into public.permissions
-- Run in: Supabase SQL Editor
-- Safe to run multiple times (INSERT ... ON CONFLICT DO NOTHING)
-- ============================================================

INSERT INTO public.permissions (module_key, module_name_ar, action_key, action_name_ar)
VALUES

-- ── الوحدات المشتركة ─────────────────────────────────────────
('dashboard',           'لوحة التحكم',                   'view',     'عرض'),
('dashboard',           'لوحة التحكم',                   'export',   'تصدير'),
('dashboard',           'لوحة التحكم',                   'manage',   'إدارة كاملة'),

('approvals',           'الاعتمادات والموافقات',           'view',     'عرض'),
('approvals',           'الاعتمادات والموافقات',           'review',   'مراجعة واعتماد'),
('approvals',           'الاعتمادات والموافقات',           'manage',   'إدارة كاملة'),

('attachments',         'المرفقات والملفات',               'view',     'عرض'),
('attachments',         'المرفقات والملفات',               'upload',   'رفع ملفات'),
('attachments',         'المرفقات والملفات',               'manage',   'إدارة كاملة'),

('projects',            'المشروعات (عرض عام)',             'view',     'عرض'),
('projects',            'المشروعات (عرض عام)',             'export',   'تصدير'),
('projects',            'المشروعات (عرض عام)',             'manage',   'إدارة كاملة'),

-- ── الحوكمة والإدارة ─────────────────────────────────────────
('users_and_access',    'المستخدمون والصلاحيات',          'view',     'عرض'),
('users_and_access',    'المستخدمون والصلاحيات',          'export',   'تصدير'),
('users_and_access',    'المستخدمون والصلاحيات',          'manage',   'إدارة كاملة'),

('approval_workflows',  'سير اعتماد العمليات',            'view',     'عرض'),
('approval_workflows',  'سير اعتماد العمليات',            'manage',   'إدارة كاملة'),

('settings',            'إعدادات النظام',                  'view',     'عرض'),
('settings',            'إعدادات النظام',                  'manage',   'إدارة كاملة'),

('cutover',             'ادخال أرصدة المشاريع الجارية',   'view',     'عرض'),
('cutover',             'ادخال أرصدة المشاريع الجارية',   'enter',    'إدخال بيانات الافتتاح'),
('cutover',             'ادخال أرصدة المشاريع الجارية',   'review',   'مراجعة واعتماد'),
('cutover',             'ادخال أرصدة المشاريع الجارية',   'manage',   'إدارة كاملة'),

-- ── الشركة الرئيسية ──────────────────────────────────────────
('treasury',            'الخزينة والحسابات البنكية',       'view',     'عرض'),
('treasury',            'الخزينة والحسابات البنكية',       'export',   'تصدير'),
('treasury',            'الخزينة والحسابات البنكية',       'operate',  'تشغيل وتسجيل حركات'),
('treasury',            'الخزينة والحسابات البنكية',       'review',   'مراجعة واعتماد'),
('treasury',            'الخزينة والحسابات البنكية',       'execute',  'تنفيذ صرف واستلام'),
('treasury',            'الخزينة والحسابات البنكية',       'manage',   'إدارة كاملة'),

('assets',              'الأصول الثابتة',                  'view',     'عرض'),
('assets',              'الأصول الثابتة',                  'export',   'تصدير'),
('assets',              'الأصول الثابتة',                  'manage',   'إدارة كاملة'),

('party_masters',       'دليل الأطراف (موردين/مقاولين)',   'view',     'عرض'),
('party_masters',       'دليل الأطراف (موردين/مقاولين)',   'export',   'تصدير'),
('party_masters',       'دليل الأطراف (موردين/مقاولين)',   'operate',  'إضافة وتعديل'),
('party_masters',       'دليل الأطراف (موردين/مقاولين)',   'manage',   'إدارة كاملة'),

('item_master',         'دليل الأصناف والوحدات',           'view',     'عرض'),
('item_master',         'دليل الأصناف والوحدات',           'manage',   'إدارة كاملة'),

('main_warehouse',      'المخزن الرئيسي للشركة',           'view',     'عرض'),
('main_warehouse',      'المخزن الرئيسي للشركة',           'export',   'تصدير'),
('main_warehouse',      'المخزن الرئيسي للشركة',           'warehouse','تشغيل مخزني (استلام / إصدار / تحويل)'),
('main_warehouse',      'المخزن الرئيسي للشركة',           'manage',   'إدارة كاملة'),

('corporate_expenses',  'مصروفات الشركة العامة',           'view',     'عرض'),
('corporate_expenses',  'مصروفات الشركة العامة',           'export',   'تصدير'),
('corporate_expenses',  'مصروفات الشركة العامة',           'operate',  'إدخال مصروفات'),
('corporate_expenses',  'مصروفات الشركة العامة',           'review',   'مراجعة واعتماد'),
('corporate_expenses',  'مصروفات الشركة العامة',           'manage',   'إدارة كاملة'),

('consolidated_reports','التقارير التحليلية المجمعة',      'view',     'عرض'),
('consolidated_reports','التقارير التحليلية المجمعة',      'export',   'تصدير'),
('consolidated_reports','التقارير التحليلية المجمعة',      'manage',   'إدارة كاملة'),

-- ── الموقع والمشروع ──────────────────────────────────────────
('project_profile',     'بيانات وموازنة المشروع',          'view',     'عرض'),
('project_profile',     'بيانات وموازنة المشروع',          'export',   'تصدير'),
('project_profile',     'بيانات وموازنة المشروع',          'operate',  'إدخال وتعديل'),
('project_profile',     'بيانات وموازنة المشروع',          'review',   'مراجعة واعتماد'),
('project_profile',     'بيانات وموازنة المشروع',          'manage',   'إدارة كاملة'),

('subcontractor_certificates', 'مستخلصات المقاولين',       'view',     'عرض'),
('subcontractor_certificates', 'مستخلصات المقاولين',       'export',   'تصدير'),
('subcontractor_certificates', 'مستخلصات المقاولين',       'operate',  'إنشاء وتحرير مستخلصات'),
('subcontractor_certificates', 'مستخلصات المقاولين',       'review',   'مراجعة واعتماد'),
('subcontractor_certificates', 'مستخلصات المقاولين',       'manage',   'إدارة كاملة'),

('supplier_procurement','مشتريات وفواتير الموردين',        'view',     'عرض'),
('supplier_procurement','مشتريات وفواتير الموردين',        'export',   'تصدير'),
('supplier_procurement','مشتريات وفواتير الموردين',        'operate',  'إنشاء وتسجيل'),
('supplier_procurement','مشتريات وفواتير الموردين',        'warehouse','تأكيد استلام المخزن'),
('supplier_procurement','مشتريات وفواتير الموردين',        'review',   'مراجعة واعتماد'),
('supplier_procurement','مشتريات وفواتير الموردين',        'manage',   'إدارة كاملة'),

('project_warehouse',   'مخزن المشروع',                   'view',     'عرض'),
('project_warehouse',   'مخزن المشروع',                   'export',   'تصدير'),
('project_warehouse',   'مخزن المشروع',                   'warehouse','تشغيل مخزني (استلام / إصدار / تحويل)'),
('project_warehouse',   'مخزن المشروع',                   'review',   'مراجعة واعتماد'),
('project_warehouse',   'مخزن المشروع',                   'manage',   'إدارة كاملة'),

('employee_custody',    'العهد والمصروفات النثرية',        'view',     'عرض'),
('employee_custody',    'العهد والمصروفات النثرية',        'export',   'تصدير'),
('employee_custody',    'العهد والمصروفات النثرية',        'operate',  'إدخال مصروفات وعهد'),
('employee_custody',    'العهد والمصروفات النثرية',        'review',   'مراجعة واعتماد'),
('employee_custody',    'العهد والمصروفات النثرية',        'manage',   'إدارة كاملة'),

('owner_billing',       'فواتير المالك والتحصيلات',        'view',     'عرض'),
('owner_billing',       'فواتير المالك والتحصيلات',        'export',   'تصدير'),
('owner_billing',       'فواتير المالك والتحصيلات',        'operate',  'إنشاء وتسجيل'),
('owner_billing',       'فواتير المالك والتحصيلات',        'execute',  'تأكيد تحصيل وتسجيل مدفوع'),
('owner_billing',       'فواتير المالك والتحصيلات',        'review',   'مراجعة واعتماد'),
('owner_billing',       'فواتير المالك والتحصيلات',        'manage',   'إدارة كاملة'),

('payments',            'سندات الصرف والمدفوعات',         'view',     'عرض'),
('payments',            'سندات الصرف والمدفوعات',         'export',   'تصدير'),
('payments',            'سندات الصرف والمدفوعات',         'operate',  'إعداد سند الدفع'),
('payments',            'سندات الصرف والمدفوعات',         'execute',  'تنفيذ صرف (خزينة)'),
('payments',            'سندات الصرف والمدفوعات',         'review',   'مراجعة واعتماد'),
('payments',            'سندات الصرف والمدفوعات',         'manage',   'إدارة كاملة'),

('project_documents',   'وثائق وملفات المشروع',           'view',     'عرض'),
('project_documents',   'وثائق وملفات المشروع',           'operate',  'رفع وتنظيم ملفات'),
('project_documents',   'وثائق وملفات المشروع',           'manage',   'إدارة كاملة'),

('project_reports',     'تقارير المشروع',                  'view',     'عرض'),
('project_reports',     'تقارير المشروع',                  'export',   'تصدير'),
('project_reports',     'تقارير المشروع',                  'manage',   'إدارة كاملة')

ON CONFLICT (module_key, action_key) DO NOTHING;

-- Confirm count
SELECT count(*) AS total_permissions_seeded FROM public.permissions;
