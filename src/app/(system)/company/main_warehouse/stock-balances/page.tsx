import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { formatDate } from '@/lib/format'

export default async function MainStockBalancesPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()

  // For the main company stock, we fetch stock_balances where warehouse_type = main_company
  // Wait, the stock_balances table doesn't have warehouse_type. It has warehouse_id.
  // We need to join warehouses to filter by type.

  const { data: balances, error } = await supabase
    .from('stock_balances')
    .select(`
      id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at,
      items ( id, item_code, arabic_name, primary_unit_id, unit:units!primary_unit_id(arabic_name) ),
      warehouses!inner ( warehouse_type )
    `)
    .eq('warehouses.warehouse_type', 'main_company')
    .order('quantity_on_hand', { ascending: false })

  if (error) {
    console.error('Error fetching balances:', error)
  }

  // Calculate totals
  const totalValue = balances?.reduce((acc, b) => acc + (Number(b.total_value) || 0), 0) || 0

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أرصدة المخزن الرئيسي</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة كميات وقيم المخزون المتاح في المخزن الرئيسي للشركة
          </p>
        </div>
        <div className="text-left bg-primary/5 rounded-lg px-6 py-3 border border-primary/20">
          <div className="text-sm text-text-secondary font-medium mb-1">إجمالي قيمة المخزون</div>
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
              <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">اسم الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الوحدة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الكمية المتاحة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">متوسط التكلفة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">القيمة الإجمالية</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">آخر حركة</th>
            </tr>
          </thead>
          <tbody>
            {!balances?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد أرصدة مسجلة في المخزن الرئيسي أو لم تتم أي حركات بعد
                </td>
              </tr>
            )}
            {balances?.map((balance: any) => {
              const item = Array.isArray(balance.items) ? balance.items[0] : balance.items
              const unit = item?.units ? (Array.isArray(item.units) ? item.units[0] : item.units) : null

              return (
                <tr key={balance.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
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
                  <td className="px-6 py-4 text-text-secondary text-xs" dir="ltr">
                    {balance.last_movement_at ? formatDate(balance.last_movement_at) : '-'}
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
