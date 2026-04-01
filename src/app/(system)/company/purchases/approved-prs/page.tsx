import Link from 'next/link'
import { getPurchaseRequests } from '@/actions/procurement'
import NewSupplierInvoiceDialog from '../../../projects/[id]/procurement/invoices/NewSupplierInvoiceDialog'

export default async function ApprovedPRsList() {
  // Fetch all PRs globally
  const allPrs = await getPurchaseRequests()
  
  // Filter only those that are 'approved' and ready to be invoiced
  // We exclude 'closed' because closed means they are already invoiced
  const approvedPrs = allPrs?.filter(pr => pr.status === 'approved') || []

  return (
    <div className="space-y-6 pb-24 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">طلبات الشراء المعتمدة (للفوترة)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            مراجعة طلبات الشراء المعتمدة في جميع المشاريع وإمكانية تحويلها إلى فواتير موردين.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm text-right relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-amber-500"></div>
          <p className="text-xs font-semibold text-text-secondary mb-1">طلبات جاهزة للفوترة</p>
          <p className="text-2xl font-bold text-amber-700">{approvedPrs.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="overflow-x-auto hide-scrollbar">
          {approvedPrs.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد طلبات شراء معتمدة بانتظار الفوترة حالياً.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">رقم الطلب (PR)</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المشروع</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">مقدم الطلب</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">تاريخ الطلب</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">مطلوب التوريد قبل</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvedPrs.map((pr) => {
                  const proj: any = Array.isArray(pr.project) ? pr.project[0] : pr.project
                  const req: any = Array.isArray(pr.requester) ? pr.requester[0] : pr.requester

                  return (
                    <tr key={pr.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-navy dir-ltr text-right">{pr.request_no}</td>
                      <td className="px-4 py-4 text-text-primary font-medium">{proj?.arabic_name || 'غير محدد'}</td>
                      <td className="px-4 py-4 text-text-secondary">{req?.display_name || 'غير محدد'}</td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{pr.request_date}</td>
                      <td className="px-4 py-4 text-amber-700 font-medium dir-ltr text-right">{pr.required_by_date || '---'}</td>
                      <td className="px-4 py-4 flex gap-3">
                        <NewSupplierInvoiceDialog
                          projectId={pr.project_id}
                          initialPrId={pr.id}
                          trigger={
                            <button
                              className="rounded bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap"
                            >
                              تحويل إلى فاتورة →
                            </button>
                          }
                        />
                        <Link 
                          href={`?view_pr=${pr.id}&projectId=${pr.project_id}`}
                          className="rounded border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-navy hover:border-navy/40 transition-colors"
                        >
                          عرض تفاصيل
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
