import { getPaginatedPurchaseRequests } from '@/actions/procurement'
import NewPurchaseRequestDialog from './NewPurchaseRequestDialog'
import PurchaseRequestRowActions from './PurchaseRequestRowActions'
import { hasPermission } from '@/lib/auth'
import Pagination from '@/components/Pagination'

export default async function PurchaseRequestsList({ params, searchParams }: { params: { id: string }, searchParams: { page?: string } }) {
  const currentPage = searchParams.page ? parseInt(searchParams.page) : 1
  const response = await getPaginatedPurchaseRequests(currentPage, 15, params.id)
  const canApprove = await hasPermission('supplier_procurement', 'review')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">طلبات الشراء (Purchase Requests)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة طلبات توفير المواد واعتمادها للمشروع.
          </p>
        </div>
        <NewPurchaseRequestDialog projectId={params.id} />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto hide-scrollbar">
          {response.data.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد طلبات شراء مسجلة بعد.</div>
          ) : (
            <>
              <table className="w-full text-right text-sm">
                <thead className="bg-background-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-text-secondary"># رقم الطلب</th>
                    <th className="px-4 py-4 font-semibold text-text-secondary">تاريخ الطلب</th>
                    <th className="px-4 py-4 font-semibold text-text-secondary">مطلوب التوريد قبل</th>
                    <th className="px-4 py-4 font-semibold text-text-secondary">مُقدم الطلب</th>
                    <th className="px-4 py-4 font-semibold text-text-secondary">الحالة</th>
                    <th className="px-4 py-4 font-semibold text-text-secondary">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {response.data.map((pr) => {
                    const req: any = Array.isArray(pr.requester) ? pr.requester[0] : pr.requester
                    return (
                      <tr key={pr.id} className="hover:bg-background-secondary/50 transition-colors">
                        <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{pr.request_no}</td>
                        <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{pr.request_date}</td>
                        <td className="px-4 py-4 text-amber-700 dir-ltr text-right">{pr.required_by_date || '---'}</td>
                        <td className="px-4 py-4 text-text-primary">{req?.display_name || 'غير محدد'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            pr.status === 'approved' ? 'bg-success/10 text-success' : 
                            pr.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                            pr.status === 'closed' ? 'bg-purple-100 text-purple-700' :
                            'bg-text-tertiary/10 text-text-secondary'
                          }`}>
                            {pr.status === 'draft' ? 'مسودة' :
                             pr.status === 'pending_approval' ? 'بانتظار الاعتماد' :
                             pr.status === 'approved' ? 'معتمد' :
                             pr.status === 'closed' ? 'مغلق (تم الشراء)' : pr.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <PurchaseRequestRowActions pr={pr} projectId={params.id} canApprove={canApprove} />
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
