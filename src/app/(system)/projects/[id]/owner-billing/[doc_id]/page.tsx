import Link from 'next/link'
import { getOwnerBillingDetails } from '@/actions/owner_billing'
import StatusActions from './StatusActions'

export default async function OwnerBillingDetail({ params }: { params: { id: string, doc_id: string } }) {
  const doc = await getOwnerBillingDetails(params.doc_id)
  
  if (!doc) {
    return <div className="p-8 text-center text-text-secondary">لم يتم العثور على الفاتورة.</div>
  }

  const ownerName = Array.isArray(doc.owner) ? doc.owner[0]?.arabic_name : doc.owner?.arabic_name
  const projectName = Array.isArray(doc.project) ? doc.project[0]?.arabic_name : doc.project?.arabic_name

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {/* Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <Link href={`/projects/${params.id}/owner-billing`} className="hover:text-primary transition-colors">فواتير المالك</Link>
            <span>←</span>
            <span className="text-text-primary font-medium">{doc.document_no}</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">تفاصيل الفاتورة</h1>
        </div>
        
        {/* Dynamic Status Actions */}
        <StatusActions docId={doc.id} projectId={params.id} currentStatus={doc.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Document Details */}
        <div className="md:col-span-2 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="bg-background-secondary px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold text-text-primary">معلومات المستند</h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
              doc.status === 'approved' ? 'bg-success/10 text-success' : 
              doc.status === 'paid' ? 'bg-purple-100 text-purple-700' :
              doc.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
              'bg-text-tertiary/10 text-text-secondary'
            }`}>
              {doc.status === 'draft' ? 'مسودة' :
               doc.status === 'submitted' ? 'مقدمة لاعتماد' :
               doc.status === 'approved' ? 'معتمدة - قيد التحصيل' :
               doc.status === 'paid' ? 'محصلة بالكامل' :
               doc.status === 'cancelled' ? 'ملغاة' : doc.status}
            </span>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-secondary mb-1">رقم الفاتورة (المرجع)</p>
              <p className="font-medium text-navy dir-ltr text-right">{doc.document_no}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">تاريخ الإصدار</p>
              <p className="font-medium text-text-primary dir-ltr text-right">{doc.billing_date}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">المالك / العميل</p>
              <p className="font-medium text-text-primary">{ownerName || '---'}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">المشروع</p>
              <p className="font-medium text-text-primary">{projectName || '---'}</p>
            </div>
            {doc.notes && (
              <div className="col-span-2">
                <p className="text-sm text-text-secondary mb-1">ملاحظات</p>
                <p className="text-sm text-text-primary bg-background-secondary/50 p-3 rounded-md">{doc.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="bg-background-secondary px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">الخلاصة المالية</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-border pb-3">
              <span className="text-text-secondary">الإجمالي قبل الضريبة</span>
              <span className="font-medium text-navy dir-ltr">{doc.gross_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-border pb-3">
              <span className="text-text-secondary">الضريبة المضافة</span>
              <span className="font-medium text-danger dir-ltr">{doc.tax_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-text-primary text-lg">الصافي المستحق</span>
              <span className="font-bold text-primary text-xl dir-ltr">{doc.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lines Data Table */}
      <h2 className="text-lg font-bold text-text-primary pt-4">بنود المطالبة والأعمال</h2>
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          {doc.lines?.length === 0 ? (
            <div className="py-8 text-center text-text-secondary">لا توجد بنود مدرجة في هذه الفاتورة.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الوصف / البيان</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الكمية</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">فئة الوحدة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الإجمالي (Net)</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doc.lines?.map((line: any) => (
                  <tr key={line.id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-4 py-4 font-medium text-text-primary">{line.line_description}</td>
                    <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{line.quantity?.toLocaleString()}</td>
                    <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{line.unit_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{line.line_net?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 text-text-secondary text-xs">{line.notes || '---'}</td>
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
