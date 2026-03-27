import Link from 'next/link'
import { getOwnerReceivables, getOwnerCollections } from '@/actions/owner_billing'

export default async function CollectionsDashboard({ params }: { params: { id: string } }) {
  const [receivables] = await getOwnerReceivables(params.id) // it returns an array mapping to view rows, usually length 1 for this project
  const collections = await getOwnerCollections(params.id)

  const hasReceivables = !!receivables
  const totalBilled = hasReceivables ? (receivables.total_billed || 0) : 0
  const totalCollected = hasReceivables ? (receivables.total_collected || 0) : 0
  const totalOutstanding = hasReceivables ? (receivables.total_outstanding || 0) : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">التحصيلات النقدية والبنكية (Collections)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة الموقف المالي وحركة التحصيل لمديونية المالك.
          </p>
        </div>
        <Link 
          href={`/projects/${params.id}/collections/new`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          + تسجيل تحصيل جديد
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-text-secondary mb-1">إجمالي الفواتير المعتمدة (Billed)</p>
          <div className="text-2xl font-bold text-navy dir-ltr text-right">
            {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-text-secondary mb-1">المُحصل الفعلي (Collected)</p>
          <div className="text-2xl font-bold text-success dir-ltr text-right">
            {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`rounded-xl border p-6 shadow-sm ${totalOutstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-success/5 border-success/20'}`}>
          <p className={`text-sm font-medium mb-1 ${totalOutstanding > 0 ? 'text-amber-800' : 'text-success'}`}>المستحق / المديونية (Outstanding)</p>
          <div className={`text-2xl font-bold dir-ltr text-right ${totalOutstanding > 0 ? 'text-amber-700' : 'text-success'}`}>
            {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Ledger History */}
      <h2 className="text-lg font-bold text-text-primary pt-4">سجل حركة التحصيلات</h2>
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          {collections?.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد عمليات تحصيل مسجلة بعد.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">تاريخ الحركة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المبلع المُحصل</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">طريقة الدفع</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المرجع البنكي</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">مرتبط بفاتورة (رقم)</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">ملاحظات التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collections?.map((col) => {
                  const doc = Array.isArray(col.document) ? col.document[0] : col.document
                  
                  return (
                    <tr key={col.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{col.received_date}</td>
                      <td className="px-4 py-4 font-bold text-success dir-ltr text-right">
                        {col.received_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-text-primary">
                        {col.payment_method === 'bank_transfer' ? 'حوالة بنكية' :
                         col.payment_method === 'cash' ? 'نقدي' :
                         col.payment_method === 'cheque' ? 'شيك بنكي' : col.payment_method}
                      </td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{col.reference_no || '---'}</td>
                      <td className="px-4 py-4">
                        {doc ? (
                          <Link href={`/projects/${params.id}/owner-billing/${col.owner_billing_document_id}`} className="text-primary hover:underline dir-ltr inline-block">
                            {doc.document_no}
                          </Link>
                        ) : (
                          <span className="text-text-tertiary">تحصيل حر (بدون ارتباط بفاتورة)</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-text-secondary text-xs max-w-xs truncate">{col.notes || '---'}</td>
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
