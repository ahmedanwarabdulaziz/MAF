import { createClient } from '@/lib/supabase-server'

export default async function SupplierStatementsList({ params }: { params: { id: string } }) {
  const supabase = createClient()

// Direct query on supplier_invoices — view was excluding partially_paid status
  const { data: invoices, error } = await supabase
    .from('supplier_invoices')
    .select(`
      id,
      supplier_party_id,
      net_amount,
      paid_to_date,
      outstanding_amount,
      returned_amount,
      status,
      discrepancy_status,
      supplier:supplier_party_id(id, arabic_name)
    `)
    .eq('project_id', params.id)
    .in('status', ['posted', 'partially_paid', 'paid'])

  // Aggregate per supplier
  const supplierMap: Record<string, any> = {}
  invoices?.forEach(inv => {
    const sId = inv.supplier_party_id
    if (!sId) return
    const sup: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
    if (!supplierMap[sId]) {
      supplierMap[sId] = {
        supplier_party_id: sId,
        supplier_name: sup?.arabic_name || 'غير معروف',
        total_invoiced_net: 0,
        total_paid: 0,
        total_outstanding: 0,
        total_returned_net: 0,
        has_pending_discrepancies: false,
      }
    }
    const g = supplierMap[sId]
    g.total_invoiced_net  += Number(inv.net_amount || 0)
    g.total_paid          += Number(inv.paid_to_date || 0)
    
    // حساب المتبقي مباشرةً = الصافي - المسدد (لا نعتمد على outstanding_amount لأنه قد لا يُحدَّث فورياً)
    g.total_outstanding   += Math.max(0, Number(inv.net_amount || 0) - Number(inv.paid_to_date || 0))
    g.total_returned_net  += Number(inv.returned_amount || 0)
    if (inv.discrepancy_status === 'pending') {
      g.has_pending_discrepancies = true
    }
  })

  const accounts = Object.values(supplierMap).sort((a, b) => b.total_outstanding - a.total_outstanding)

  let sysTotalBilled = 0
  let sysTotalPaid = 0
  let sysTotalOutstanding = 0

  accounts.forEach(a => {
    sysTotalBilled      += Number(a.total_invoiced_net)
    sysTotalPaid        += Number(a.total_paid)
    sysTotalOutstanding += Number(a.total_outstanding)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">ارصدة وحسابات الموردين (Supplier Statements)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            لوحة مجمعة حية توضح إجمالي المسحوبات، المرتجعات، وما تم سداده لكل مورد بالمشروع.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي التوريدات (Net Billed)</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{sysTotalBilled.toLocaleString()} ج.م</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي المسدد (Paid)</p>
          <p className="text-2xl font-black text-success dir-ltr text-right">{sysTotalPaid.toLocaleString()} ج.م</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي المديونية (Outstanding)</p>
          <p className="text-2xl font-black text-danger dir-ltr text-right">{sysTotalOutstanding.toLocaleString()} ج.م</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {(!accounts || accounts.length === 0) ? (
            <div className="py-12 text-center text-text-secondary">
              لا توجد أرصدة موردين مسجلة حتى الآن. تأكد من استلام واعتماد فواتير التوريد من المخازن.
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">اسم المورد</th>
                  <th className="px-4 py-4 font-semibold text-navy">إجمالي الفواتير الصافية</th>
                  <th className="px-4 py-4 font-semibold text-amber-700">صافي المرتجعات</th>
                  <th className="px-4 py-4 font-semibold text-success">المدفوعات (Paid)</th>
                  <th className="px-4 py-4 font-semibold text-danger">الرصيد المستحق (Outstanding)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((acc: any) => (
                  <tr key={acc.supplier_party_id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-4 py-4 font-bold text-text-primary whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span>{acc.supplier_name}</span>
                        {acc.has_pending_discrepancies && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full w-max mt-0.5">
                            يوجد نواقص استلام
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-navy font-bold dir-ltr text-right">
                      {Number(acc.total_invoiced_net).toLocaleString()} ج.م
                    </td>
                    
                    <td className="px-4 py-4 text-amber-700 font-medium dir-ltr text-right">
                      {Number(acc.total_returned_net) > 0 ? `(${Number(acc.total_returned_net).toLocaleString()}) ج.م` : '---'}
                    </td>
                    
                    <td className="px-4 py-4 text-success font-medium dir-ltr text-right">
                      {Number(acc.total_paid).toLocaleString()} ج.م
                    </td>
                    
                    <td className="px-4 py-4 font-black dir-ltr text-right">
                      <span className={Number(acc.total_outstanding) > 0 ? 'text-danger' : 'text-text-secondary'}>
                        {Number(acc.total_outstanding).toLocaleString()} ج.م
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
