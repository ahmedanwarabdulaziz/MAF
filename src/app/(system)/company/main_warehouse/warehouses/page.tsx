import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'

export default async function WarehousesPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()

  // Fetch warehouses along with their project if linked
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select(`
      id, warehouse_code, arabic_name, english_name, warehouse_type, location, is_active,
      project:project_id(arabic_name)
    `)
    .order('warehouse_type', { ascending: true })
    .order('warehouse_code')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">إدارة المخازن</h1>
          <p className="mt-1 text-sm text-text-secondary">
            تعريف المخازن الرئيسية ومخازن المشاريع والمخازن المؤقتة
          </p>
        </div>
        <Link
          href="/company/main_warehouse/warehouses/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة مخزن جديد
        </Link>
      </div>

      {/* Warehouses table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">كود المخزن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">اسم المخزن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">نوع المخزن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">المشروع المرتبط</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الموقع</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {!warehouses?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد مخازن مسجلة أو لديك صلاحية لعرضها. تأكد من إعداد المخزن الرئيسي.
                </td>
              </tr>
            )}
            {warehouses?.map(wh => {
              const project = Array.isArray(wh.project) ? wh.project[0] : wh.project
              return (
                <tr key={wh.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-medium" dir="ltr">{wh.warehouse_code}</td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary font-medium">{wh.arabic_name}</div>
                    <div className="text-text-secondary text-xs" dir="ltr">{wh.english_name || ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    {wh.warehouse_type === 'main_company' && <span className="text-primary font-medium">مخزن رئيسي</span>}
                    {wh.warehouse_type === 'project' && <span className="text-secondary font-medium">مخزن مشروع</span>}
                    {wh.warehouse_type === 'temporary' && <span className="text-text-secondary font-medium">مؤقت</span>}
                  </td>
                  <td className="px-6 py-4">
                    {project ? (
                      <span className="inline-flex items-center rounded-full bg-background-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        {(project as any).arabic_name}
                      </span>
                    ) : (
                      <span className="text-text-secondary text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{wh.location || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        wh.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {wh.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/company/main_warehouse/warehouses/${wh.id}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      تعديل
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
