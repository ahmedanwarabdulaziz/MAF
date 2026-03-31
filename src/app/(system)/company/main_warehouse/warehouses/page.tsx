import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { getMainCompanyId } from '@/actions/warehouse'
import NewWarehouseDialog from './NewWarehouseDialog'
import EditWarehouseDialog from './EditWarehouseDialog'
import ViewWarehouseStockDialog from './ViewWarehouseStockDialog'

export default async function WarehousesPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .order('arabic_name')

  // Fetch warehouses along with their project if linked
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select(`
      id, warehouse_code, arabic_name, english_name, warehouse_type, location, is_active, project_id, notes,
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
            تعريف المخازن الرئيسية للشركة والمخازن التابعة للمشاريع
          </p>
        </div>
        <NewWarehouseDialog 
          companyId={companyId} 
          projects={projects || []} 
        />
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
                  لا توجد مخازن مسجلة أو ليس لديك صلاحية لعرضها. تأكد من إعداد المخازن بنجاح.
                </td>
              </tr>
            )}
            {warehouses?.filter(wh => wh.warehouse_type !== 'temporary').map(wh => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const project = Array.isArray(wh.project) ? wh.project[0] : wh.project
              return (
                <tr key={wh.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-medium" dir="ltr">{wh.warehouse_code}</td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary font-medium">{wh.arabic_name}</div>
                    <div className="text-text-secondary text-xs" dir="ltr">{wh.english_name || ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    {wh.warehouse_type === 'main_company' && <span className="text-primary font-medium">مخزن شركة (رئيسي)</span>}
                    {wh.warehouse_type === 'project' && <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-100">مخزن مشروع</span>}
                  </td>
                  <td className="px-6 py-4">
                    {project ? (
                      <span className="inline-flex items-center rounded-full bg-background-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary border border-border">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}
                    >
                      {wh.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center justify-start gap-1">
                    <EditWarehouseDialog 
                      companyId={companyId}
                      projects={projects || []}
                      initialData={wh}
                    />
                    <ViewWarehouseStockDialog warehouse={wh} />
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
