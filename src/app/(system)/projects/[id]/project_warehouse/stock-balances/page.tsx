import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth'

export default async function ProjectStockBalancesPage({
  params
}: {
  params: { id: string }
}) {
  await requireAuth()
  const supabase = createClient()

  // Fetch stock_balances where warehouse belongs to this project
  const { data: balances, error } = await supabase
    .from('stock_balances')
    .select(`
      id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at,
      items ( id, item_code, arabic_name, primary_unit_id, units(arabic_name) ),
      warehouses!inner ( id, arabic_name, project_id )
    `)
    .eq('warehouses.project_id', params.id)
    .order('quantity_on_hand', { ascending: false })

  if (error) {
    console.error('Error fetching project balances:', error)
  }

  // Calculate totals
  const totalValue = balances?.reduce((acc, b) => acc + (Number(b.total_value) || 0), 0) || 0

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أرصدة مخزن المشروع</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة كميات وقيم المخزون المتاح في المستودعات التابعة لهذا المشروع
          </p>
        </div>
        <div className="text-left bg-primary/5 rounded-lg px-6 py-3 border border-primary/20">
          <div className="text-sm text-text-secondary font-medium mb-1">إجمالي قيمة المخزون الحالي</div>
          <div className="text-2xl font-bold text-primary">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP' }).format(totalValue)}
          </div>
        </div>
      </div>

      {/* Balances table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">المخزن الأساسي</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">اسم الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الوحدة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الكمية المتاحة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">متوسط التكلفة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">القيمة الإجمالية</th>
            </tr>
          </thead>
          <tbody>
            {!balances?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد أرصدة مسجلة في مخازن هذا المشروع
                </td>
              </tr>
            )}
            {balances?.map((balance: any) => {
              const item = Array.isArray(balance.items) ? balance.items[0] : balance.items
              const unit = item?.units ? (Array.isArray(item.units) ? item.units[0] : item.units) : null
              const warehouse = Array.isArray(balance.warehouses) ? balance.warehouses[0] : balance.warehouses

              return (
                <tr key={balance.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">{warehouse?.arabic_name}</td>
                  <td className="px-6 py-4 font-medium" dir="ltr">{item?.item_code}</td>
                  <td className="px-6 py-4 text-text-primary font-medium">{item?.arabic_name}</td>
                  <td className="px-6 py-4 text-text-secondary">{unit?.arabic_name}</td>
                  <td className="px-6 py-4 font-bold text-text-primary" dir="ltr">
                    {Number(balance.quantity_on_hand).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">
                    {Number(balance.weighted_avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 font-medium text-text-primary" dir="ltr">
                    {Number(balance.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
