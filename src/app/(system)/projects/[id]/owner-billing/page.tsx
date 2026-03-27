import Link from 'next/link'
import { getOwnerBillingDocuments } from '@/actions/owner_billing'

export default async function OwnerBillingList({ params }: { params: { id: string } }) {
  const documents = await getOwnerBillingDocuments(params.id)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">فواتير ومستخلصات المالك</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة الفواتير المصدرة للمالك وحالتها المالية.
          </p>
        </div>
        <Link 
          href={`/projects/${params.id}/owner-billing/new`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          + فاتورة جديدة
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          {documents?.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد فواتير مصدرة للمالك بعد.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary"># رقم المستند</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">التاريخ</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المالك / العميل</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجمالي الفاتورة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الصافي المطلوب</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الحالة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents?.map((doc) => {
                  const ownerName = Array.isArray(doc.owner) ? doc.owner[0]?.arabic_name : doc.owner?.arabic_name
                  
                  return (
                    <tr key={doc.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{doc.document_no}</td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{doc.billing_date}</td>
                      <td className="px-4 py-4 text-text-primary">{ownerName || '---'}</td>
                      <td className="px-4 py-4 text-text-primary font-medium">
                        {doc.gross_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-navy font-bold">
                        {doc.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          doc.status === 'approved' ? 'bg-success/10 text-success' : 
                          doc.status === 'paid' ? 'bg-purple-100 text-purple-700' :
                          doc.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                          'bg-text-tertiary/10 text-text-secondary'
                        }`}>
                          {doc.status === 'draft' ? 'مسودة' :
                           doc.status === 'submitted' ? 'مقدمة' :
                           doc.status === 'approved' ? 'معتمدة' :
                           doc.status === 'paid' ? 'محصلة' :
                           doc.status === 'cancelled' ? 'ملغاة' : doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link 
                          href={`/projects/${params.id}/owner-billing/${doc.id}`}
                          className="text-primary hover:text-navy text-sm font-medium"
                        >
                          عرض وتفاصيل
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
