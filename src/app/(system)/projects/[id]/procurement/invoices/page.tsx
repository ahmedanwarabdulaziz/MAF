import Link from 'next/link'
import { getSupplierInvoices } from '@/actions/procurement'

export default async function SupplierInvoicesList({ params }: { params: { id: string } }) {
  const invoices = await getSupplierInvoices(params.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">فواتير الموردين (Supplier Invoices)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة فواتير التوريد، الاستلام في المخازن، والاعتمادات.
          </p>
        </div>
        <Link 
          href={`/projects/${params.id}/procurement/invoices/new`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          + فاتورة توريد جديدة
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {invoices?.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد فواتير موردين مسجلة بعد.</div>
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
                {invoices?.map((inv) => {
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
                        <Link 
                          href={`/projects/${params.id}/procurement/invoices/${inv.id}`}
                          className="text-primary hover:text-navy text-sm font-medium"
                        >
                          تأكيد الاستلام والتفاصيل
                        </Link>
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
