import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import NewTransferDialog from './NewTransferDialog'
import { TransferActions } from './TransferActions'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function TransfersPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: transfers } = await supabase
    .from('warehouse_transfers')
    .select(`
      id, document_no, transfer_date, status, notes,
      source:source_warehouse_id(arabic_name),
      destination:destination_warehouse_id(arabic_name),
      lines:warehouse_transfer_lines(
        id, quantity, unit_cost, item:items(item_code, arabic_name), unit:units(arabic_name)
      )
    `)
    .order('transfer_date', { ascending: false })
    .order('document_no', { ascending: false })
    .limit(50)

  // Fetch prerequisites for Transfer Dialog
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, arabic_name, warehouse_type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('arabic_name')

  const { data: itemGroups } = await supabase
    .from('item_groups')
    .select('id, arabic_name, group_code, parent_group_id')
    .eq('is_active', true)

  const { data: items } = await supabase
    .from('items')
    .select('id, item_code, arabic_name, primary_unit_id, item_group_id, item_group:item_groups(id, arabic_name), unit:units!primary_unit_id(arabic_name)')
    .eq('is_active', true)
    .order('arabic_name')

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أذون التحويل المخزني</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة تحويلات المخزون من وإلى المخزن الرئيسي ومخازن المشاريع
          </p>
        </div>
        <NewTransferDialog 
          companyId={companyId}
          warehouses={warehouses || []}
          items={items || []}
          itemGroups={itemGroups || []}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">رقم الإذن المستندي</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">التاريخ</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">من (المرسل)</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">إلى (المستلم)</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary w-24">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {!transfers?.length && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد أذون تحويل بعد.
                </td>
              </tr>
            )}
            {transfers?.map(t => {
              const src = Array.isArray(t.source) ? t.source[0] : t.source
              const dst = Array.isArray(t.destination) ? t.destination[0] : t.destination
              
              return (
                <tr key={t.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary" dir="ltr">{t.document_no}</td>
                  <td className="px-6 py-4 text-text-secondary">{t.transfer_date}</td>
                  <td className="px-6 py-4 font-medium">{src?.arabic_name || '-'}</td>
                  <td className="px-6 py-4 font-medium">{dst?.arabic_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.status === 'confirmed'
                          ? 'bg-success/10 text-success'
                          : t.status === 'dispatched'
                          ? 'bg-info/10 text-info'
                          : t.status === 'draft'
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {t.status === 'confirmed' ? 'مستلمة' : t.status === 'dispatched' ? 'في الطريق' : t.status === 'draft' ? 'مسودة' : 'ملغية'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <TransferActions transfer={t} />
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
