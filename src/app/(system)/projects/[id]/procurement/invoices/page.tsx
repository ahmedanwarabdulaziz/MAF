import Link from 'next/link'
import { getPaginatedSupplierInvoices, getSupplierInvoiceStats } from '@/actions/procurement'
import NewSupplierInvoiceDialog from './NewSupplierInvoiceDialog'
import SupplierInvoiceRowActions from './SupplierInvoiceRowActions'
// PERF-04 / PERF-05A: use server client for server-side reads, not browser client
import { createClient } from '@/lib/supabase-server'
import { getAuthorizationContext } from '@/lib/authorization-context'
import Pagination from '@/components/Pagination'

export default async function SupplierInvoicesList({ params, searchParams }: { params: { id: string }, searchParams: { filter?: string, page?: string } }) {
  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1
  const filter = searchParams.filter
  
  // AG-PERF-09: getAuthorizationContext() runs in parallel with data queries.
  // 2 DB queries total for all permission work instead of 2×hasPermission sequential calls.
  const db = createClient()
  const [stats, response, authz] = await Promise.all([
    getSupplierInvoiceStats(params.id),
    getPaginatedSupplierInvoices(currentPage, 15, params.id, filter),
    getAuthorizationContext({ projectId: params.id }),
  ])

  authz.require('supplier_procurement', 'view')
  const canApprove = authz.can('supplier_procurement', 'review')
  const canWhApprove = authz.can('project_warehouse', 'review')

  // Fetch confirmations for all invoices in the current page
  const invIds = response.data.map((i: any) => i.id) || []
  let confirmations: Record<string, any> = {}
  if (invIds.length > 0) {
    const { data: confs } = await db.from('invoice_receipt_confirmations').select('*').in('supplier_invoice_id', invIds)
    confs?.forEach(c => confirmations[c.supplier_invoice_id] = c)
  }
  
  const pendingCount = stats.pendingCount
  const partialCount = stats.partialCount
  const isFilteredPending = filter === 'pending'
  const isFilteredPartial = filter === 'partial'
  
  const filteredInvoices = response.data

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
          href={isFilteredPending ? `/projects/${params.id}/procurement/invoices` : `/projects/${params.id}/procurement/invoices?filter=pending`}
          className={`rounded-xl border p-5 shadow-sm transition-colors text-right relative overflow-hidden group ${isFilteredPending ? 'bg-amber-50 border-amber-300' : 'bg-white border-border hover:border-amber-300'}`}
        >
          <div className={`absolute top-0 right-0 w-1 h-full ${isFilteredPending ? 'bg-amber-500' : 'bg-transparent group-hover:bg-amber-400'}`}></div>
          <p className="text-xs font-semibold text-text-secondary mb-1">تحتاج مطابقة / استلام</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            {isFilteredPending && <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">تصنيف مفعل (X)</span>}
          </div>
        </Link>
        <Link 
          href={isFilteredPartial ? `/projects/${params.id}/procurement/invoices` : `/projects/${params.id}/procurement/invoices?filter=partial`}
          className={`rounded-xl border p-5 shadow-sm transition-colors text-right relative overflow-hidden group ${isFilteredPartial ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-border hover:border-indigo-300'}`}
        >
          <div className={`absolute top-0 right-0 w-1 h-full ${isFilteredPartial ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-400'}`}></div>
          <p className="text-xs font-semibold text-text-secondary mb-1">مستلمة جزئياً (يوجد نواقص)</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-indigo-700">{partialCount}</p>
            {isFilteredPartial && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">تصنيف مفعل (X)</span>}
          </div>
        </Link>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm text-right">
          <p className="text-xs font-semibold text-text-secondary mb-1">إجمالي الفواتير</p>
          <p className="text-2xl font-bold text-navy">{stats.totalCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {(!filteredInvoices || filteredInvoices.length === 0) ? (
            <div className="py-12 text-center text-text-secondary">لا توجد فواتير مطابقة لهذا التصنيف.</div>
          ) : (
            <>
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
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium w-max ${
                          inv.status === 'posted' && inv.discrepancy_status === 'pending' ? 'bg-indigo-100 text-indigo-700' :
                          inv.status === 'posted' ? 'bg-success/10 text-success' : 
                          inv.status === 'pending_receipt' ? 'bg-amber-100 text-amber-700' :
                          'bg-text-tertiary/10 text-text-secondary'
                        }`}>
                          {inv.status === 'draft' ? 'تحت التجهيز (مسودة)' :
                           inv.status === 'pending_receipt' ? 'بانتظار استلام المخزن والمدير' :
                           inv.status === 'posted' && inv.discrepancy_status === 'pending' ? 'مستلم جزئياً (يوجد نواقص)' :
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
            <Pagination currentPage={response.page} totalPages={response.totalPages} totalCount={response.count} />
          </>
        )}
        </div>
      </div>
    </div>
  )
}
