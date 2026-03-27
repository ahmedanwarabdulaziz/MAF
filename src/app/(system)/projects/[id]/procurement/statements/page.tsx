import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function SupplierStatementsList({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // Natively query the view created in Phase 12
  const { data: accounts, error } = await supabase
    .from('supplier_account_summaries_view')
    .select('*')
    .eq('project_id', params.id)
    .order('total_outstanding', { ascending: false })

  let sysTotalBilled = 0
  let sysTotalPaid = 0
  let sysTotalOutstanding = 0

  accounts?.forEach(a => {
    sysTotalBilled += Number(a.total_invoiced_net)
    sysTotalPaid += Number(a.total_paid)
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
                {accounts?.map((acc: any) => (
                  <tr key={acc.supplier_party_id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-4 py-4 font-bold text-text-primary whitespace-nowrap">{acc.supplier_name}</td>
                    
                    <td className="px-4 py-4 text-navy font-bold dir-ltr text-right">
                      {Number(acc.total_invoiced_net).toLocaleString()} ج.م
                    </td>
                    
                    <td className="px-4 py-4 text-amber-700 font-medium dir-ltr text-right">
                      {Number(acc.total_returned_net) > 0 ? `(${Number(acc.total_returned_net).toLocaleString()}) ج.م` : '---'}
                    </td>
                    
                    <td className="px-4 py-4 text-success font-medium dir-ltr text-right">
                      {Number(acc.total_paid).toLocaleString()} ج.م
                    </td>
                    
                    <td className="px-4 py-4 text-danger font-black dir-ltr text-right">
                      {Number(acc.total_outstanding).toLocaleString()} ج.م
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
