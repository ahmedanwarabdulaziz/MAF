import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// TEMPORARY SEED ROUTE — DELETE AFTER USE
// GET /api/seed-permissions

const PERMISSIONS = [
  // لوحة التحكم
  { module_key: 'dashboard', module_name_ar: 'لوحة التحكم', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'dashboard', module_name_ar: 'لوحة التحكم', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'dashboard', module_name_ar: 'لوحة التحكم', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الاعتمادات
  { module_key: 'approvals', module_name_ar: 'الاعتمادات والموافقات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'approvals', module_name_ar: 'الاعتمادات والموافقات', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'approvals', module_name_ar: 'الاعتمادات والموافقات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المرفقات
  { module_key: 'attachments', module_name_ar: 'المرفقات والملفات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'attachments', module_name_ar: 'المرفقات والملفات', action_key: 'upload', action_name_ar: 'رفع ملفات' },
  { module_key: 'attachments', module_name_ar: 'المرفقات والملفات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المشروعات
  { module_key: 'projects', module_name_ar: 'المشروعات (عرض عام)', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'projects', module_name_ar: 'المشروعات (عرض عام)', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'projects', module_name_ar: 'المشروعات (عرض عام)', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المستخدمون والصلاحيات
  { module_key: 'users_and_access', module_name_ar: 'المستخدمون والصلاحيات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'users_and_access', module_name_ar: 'المستخدمون والصلاحيات', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'users_and_access', module_name_ar: 'المستخدمون والصلاحيات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // سير الاعتماد
  { module_key: 'approval_workflows', module_name_ar: 'سير اعتماد العمليات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'approval_workflows', module_name_ar: 'سير اعتماد العمليات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الإعدادات
  { module_key: 'settings', module_name_ar: 'إعدادات النظام', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'settings', module_name_ar: 'إعدادات النظام', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الكتوفر
  { module_key: 'cutover', module_name_ar: 'ادخال أرصدة المشاريع الجارية', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'cutover', module_name_ar: 'ادخال أرصدة المشاريع الجارية', action_key: 'enter', action_name_ar: 'إدخال بيانات الافتتاح' },
  { module_key: 'cutover', module_name_ar: 'ادخال أرصدة المشاريع الجارية', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'cutover', module_name_ar: 'ادخال أرصدة المشاريع الجارية', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الخزينة
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'operate', action_name_ar: 'تشغيل وتسجيل حركات' },
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'execute', action_name_ar: 'تنفيذ صرف واستلام' },
  { module_key: 'treasury', module_name_ar: 'الخزينة والحسابات البنكية', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الأصول
  { module_key: 'assets', module_name_ar: 'الأصول الثابتة', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'assets', module_name_ar: 'الأصول الثابتة', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'assets', module_name_ar: 'الأصول الثابتة', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الأطراف
  { module_key: 'party_masters', module_name_ar: 'دليل الأطراف (موردين/مقاولين)', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'party_masters', module_name_ar: 'دليل الأطراف (موردين/مقاولين)', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'party_masters', module_name_ar: 'دليل الأطراف (موردين/مقاولين)', action_key: 'operate', action_name_ar: 'إضافة وتعديل' },
  { module_key: 'party_masters', module_name_ar: 'دليل الأطراف (موردين/مقاولين)', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // الأصناف
  { module_key: 'item_master', module_name_ar: 'دليل الأصناف والوحدات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'item_master', module_name_ar: 'دليل الأصناف والوحدات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المخزن الرئيسي
  { module_key: 'main_warehouse', module_name_ar: 'المخزن الرئيسي للشركة', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'main_warehouse', module_name_ar: 'المخزن الرئيسي للشركة', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'main_warehouse', module_name_ar: 'المخزن الرئيسي للشركة', action_key: 'warehouse', action_name_ar: 'تشغيل مخزني (استلام/إصدار/تحويل)' },
  { module_key: 'main_warehouse', module_name_ar: 'المخزن الرئيسي للشركة', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // مصروفات الشركة
  { module_key: 'corporate_expenses', module_name_ar: 'مصروفات الشركة العامة', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'corporate_expenses', module_name_ar: 'مصروفات الشركة العامة', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'corporate_expenses', module_name_ar: 'مصروفات الشركة العامة', action_key: 'operate', action_name_ar: 'إدخال مصروفات' },
  { module_key: 'corporate_expenses', module_name_ar: 'مصروفات الشركة العامة', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'corporate_expenses', module_name_ar: 'مصروفات الشركة العامة', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // التقارير المجمعة
  { module_key: 'consolidated_reports', module_name_ar: 'التقارير التحليلية المجمعة', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'consolidated_reports', module_name_ar: 'التقارير التحليلية المجمعة', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'consolidated_reports', module_name_ar: 'التقارير التحليلية المجمعة', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // بيانات المشروع
  { module_key: 'project_profile', module_name_ar: 'بيانات وموازنة المشروع', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'project_profile', module_name_ar: 'بيانات وموازنة المشروع', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'project_profile', module_name_ar: 'بيانات وموازنة المشروع', action_key: 'operate', action_name_ar: 'إدخال وتعديل' },
  { module_key: 'project_profile', module_name_ar: 'بيانات وموازنة المشروع', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'project_profile', module_name_ar: 'بيانات وموازنة المشروع', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // مستخلصات المقاولين
  { module_key: 'subcontractor_certificates', module_name_ar: 'مستخلصات المقاولين', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'subcontractor_certificates', module_name_ar: 'مستخلصات المقاولين', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'subcontractor_certificates', module_name_ar: 'مستخلصات المقاولين', action_key: 'operate', action_name_ar: 'إنشاء وتحرير مستخلصات' },
  { module_key: 'subcontractor_certificates', module_name_ar: 'مستخلصات المقاولين', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'subcontractor_certificates', module_name_ar: 'مستخلصات المقاولين', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المشتريات
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'operate', action_name_ar: 'إنشاء وتسجيل' },
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'warehouse', action_name_ar: 'تأكيد استلام المخزن' },
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'supplier_procurement', module_name_ar: 'مشتريات وفواتير الموردين', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // مخزن المشروع
  { module_key: 'project_warehouse', module_name_ar: 'مخزن المشروع', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'project_warehouse', module_name_ar: 'مخزن المشروع', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'project_warehouse', module_name_ar: 'مخزن المشروع', action_key: 'warehouse', action_name_ar: 'تشغيل مخزني (استلام/إصدار/تحويل)' },
  { module_key: 'project_warehouse', module_name_ar: 'مخزن المشروع', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'project_warehouse', module_name_ar: 'مخزن المشروع', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // العهد والمصروفات النثرية
  { module_key: 'employee_custody', module_name_ar: 'العهد والمصروفات النثرية', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'employee_custody', module_name_ar: 'العهد والمصروفات النثرية', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'employee_custody', module_name_ar: 'العهد والمصروفات النثرية', action_key: 'operate', action_name_ar: 'إدخال مصروفات وعهد' },
  { module_key: 'employee_custody', module_name_ar: 'العهد والمصروفات النثرية', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'employee_custody', module_name_ar: 'العهد والمصروفات النثرية', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // فواتير المالك
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'operate', action_name_ar: 'إنشاء وتسجيل' },
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'execute', action_name_ar: 'تأكيد تحصيل وتسجيل مدفوع' },
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'owner_billing', module_name_ar: 'فواتير المالك والتحصيلات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // المدفوعات
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'operate', action_name_ar: 'إعداد سند الدفع' },
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'execute', action_name_ar: 'تنفيذ صرف (خزينة)' },
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'review', action_name_ar: 'مراجعة واعتماد' },
  { module_key: 'payments', module_name_ar: 'سندات الصرف والمدفوعات', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // وثائق المشروع
  { module_key: 'project_documents', module_name_ar: 'وثائق وملفات المشروع', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'project_documents', module_name_ar: 'وثائق وملفات المشروع', action_key: 'operate', action_name_ar: 'رفع وتنظيم ملفات' },
  { module_key: 'project_documents', module_name_ar: 'وثائق وملفات المشروع', action_key: 'manage', action_name_ar: 'إدارة كاملة' },

  // تقارير المشروع
  { module_key: 'project_reports', module_name_ar: 'تقارير المشروع', action_key: 'view', action_name_ar: 'عرض' },
  { module_key: 'project_reports', module_name_ar: 'تقارير المشروع', action_key: 'export', action_name_ar: 'تصدير' },
  { module_key: 'project_reports', module_name_ar: 'تقارير المشروع', action_key: 'manage', action_name_ar: 'إدارة كاملة' },
]

export async function GET() {
  const supabase = createClient()

  const { error } = await supabase
    .from('permissions')
    .upsert(PERMISSIONS, { onConflict: 'module_key,action_key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count } = await supabase
    .from('permissions')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    success: true,
    message: `تم تحميل ${count} صلاحية بنجاح`,
    count
  })
}
