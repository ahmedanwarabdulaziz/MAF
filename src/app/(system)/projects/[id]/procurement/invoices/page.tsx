import Link from 'next/link'
import { getSupplierInvoices } from '@/actions/procurement'
import NewSupplierInvoiceDialog from './NewSupplierInvoiceDialog'
import SupplierInvoiceRowActions from './SupplierInvoiceRowActions'
import { hasPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'

export default async function SupplierInvoicesList({ params, searchParams }: { params: { id: string }, searchParams: { filter?: string } }) {
  const invoices = await getSupplierInvoices(params.id)
  
  const canApprove = await hasPermission('supplier_procurement', 'review')
  const canWhApprove = await hasPermission('project_warehouse', 'review')

  // Fetch confirmations for all these invoices so we can show quick icons
  const db = createClient()
  const invIds = invoices?.map(i => i.id) || []
  let confirmations: Record<string, any> = {}
  if (invIds.length > 0) {
    const { data: confs } = await db.from('invoice_receipt_confirmations').select('*').in('supplier_invoice_id', invIds)
    confs?.forEach(c => confirmations[c.supplier_invoice_id] = c)
  }
  
  const pendingCount = invoices?.filter(i => i.status === 'pending_receipt').length || 0
  const isFiltered = searchParams.filter === 'pending'
  const filteredInvoices = isFiltered
    ? invoices?.filter(i => i.status === 'pending_receipt')
    : invoices

  return (
    <div className="space-y-6 pb-24 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">فواتير الموردين (Supplier Invoices)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة فواتير التوريد، الاستلام في المخازن، والاعتمادات.
          </p>
        </div>
        <NewSupplierInvoiceDialog projectId={params.id} />
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link 
          href={isFiltered ? `/projects/${params.id}/procurement/invoices` : `/projects/${params.id}/procurement/invoices?filter=pending`}
          className={`rounded-xl border p-5 shadow-sm transition-colors text-right relative overflow-hidden group ${isFiltered ? 'bg-amber-50 border-amber-300' : 'bg-white border-border hover:border-amber-300'}`}
        >
          <div className={`absolute top-0 right-0 w-1 h-full ${isFiltered ? 'bg-amber-500' : 'bg-transparent group-hover:bg-amber-400'}`}></div>
          <p className="text-xs font-semibold text-text-secondary mb-1">تحتاج مطابقة / استلام</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            {isFiltered && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">تصنيف مفعل (X)</span>}
          </div>
        </Link>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm text-right">
          <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي الفواتير</p>
          <p className="text-2xl font-bold text-navy">{invoices?.length || 0}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {(!filteredInvoices || filteredInvoices.length === 0) ? (
            <div className="py-12 text-center text-text-secondary">لا توجد فواتير مطابقة لهذا التصنيف.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">رقم الفاتورة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المورد</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">التاريخ</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الصافي للدفع</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الحالة / الاستلام</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices?.map((inv) => {
                  const sup: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
                  return (
                    <tr key={inv.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{inv.invoice_no}</td>
                      <td className="px-4 py-4 text-text-primary font-medium">{sup?.arabic_name || 'غير محدد'}</td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{inv.invoice_date}</td>
                      <td className="px-4 py-4 font-bold text-success dir-ltr text-right">
                        {Number(inv.net_amount).toLocaleString()} ج.م
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          inv.status === 'posted' ? 'bg-success/10 text-success' : 
                          inv.status === 'pending_receipt' ? 'bg-amber-100 text-amber-700' :
                          'bg-text-tertiary/10 text-text-secondary'
                        }`}>
                          {inv.status === 'draft' ? 'تحت التجهيز (مسودة)' :
                           inv.status === 'pending_receipt' ? 'بانتظار استلام المخزن والمدير' :
                           inv.status === 'posted' ? 'تم الاستلام والاعتماد' : inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <SupplierInvoiceRowActions 
                          inv={inv} 
                          projectId={params.id} 
                          canApprove={canApprove}
                          canWhApprove={canWhApprove}
                          confirmation={confirmations[inv.id]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
