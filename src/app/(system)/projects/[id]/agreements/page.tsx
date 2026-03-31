import Link from 'next/link'
import { getSubcontractAgreements } from '@/actions/agreements'
import NewAgreementDialog from './NewAgreementDialog'

export default async function ProjectAgreementsPage({ params }: { params: { id: string } }) {
  const agreements = await getSubcontractAgreements(params.id)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20'
      case 'draft': return 'bg-text-tertiary/10 text-text-secondary border-text-tertiary/20'
      case 'suspended': return 'bg-warning/10 text-warning-dark border-warning/20'
      case 'closed': return 'bg-danger/10 text-danger border-danger/20'
      default: return 'bg-text-tertiary/10 text-text-secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'ساري'
      case 'draft': return 'مسودة'
      case 'suspended': return 'موقوف'
      case 'closed': return 'مغلق'
      default: return status
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">عقود مقاولي الباطن</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة عقود مقاولي الباطن المرتبطة بهذا المشروع والفئات المتفق عليها.
          </p>
        </div>
        <NewAgreementDialog projectId={params.id} />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {!agreements || agreements.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary bg-background-secondary">
            لا توجد عقود مسجلة لهذا المشروع بعد.
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold text-text-secondary">رقم العقد</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">المقاول</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">تاريخ البدء</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">نسبة التعلية الافتراضية</th>
                <th className="px-6 py-4 font-semibold text-text-secondary">الحالة</th>
                <th className="px-6 py-4 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agreements.map((agreement: any) => (
                <tr key={agreement.id} className="hover:bg-background-secondary transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary" dir="ltr">
                    {agreement.agreement_code}
                  </td>
                  <td className="px-6 py-4 font-semibold text-primary">
                    {agreement.subcontractor?.arabic_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">
                    {agreement.start_date || '-'}
                  </td>
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">
                    {agreement.default_taaliya_type === 'percentage' 
                      ? `${agreement.default_taaliya_value}%` 
                      : `${agreement.default_taaliya_value} خصم ثابت`}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(agreement.status)}`}>
                      {getStatusLabel(agreement.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/projects/${params.id}/agreements/${agreement.id}`}
                      className="text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      عرض وتعديل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
