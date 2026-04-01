import Link from 'next/link'
import { getCertificatesList } from '@/actions/certificates'
import { getSubcontractAgreements } from '@/actions/agreements'
import CreateCertificateModal from './CreateCertificateModal'
import ViewCertificateDialog from './ViewCertificateDialog'

export default async function CertificatesPage({ params }: { params: { id: string } }) {
  const [certificates, agreements] = await Promise.all([
    getCertificatesList(params.id),
    getSubcontractAgreements(params.id)
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مستخلصات مقاولي الباطن</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة مستخلصات الأعمال المنجزة والتعليات والحساب الختامي.
          </p>
        </div>
        <CreateCertificateModal projectId={params.id} agreements={agreements || []} />
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          {certificates?.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-text-secondary">لم يتم إصدار أي مستخلصات في هذا المشروع حتى الآن.</p>
              <div className="mt-4 flex justify-center">
                <CreateCertificateModal projectId={params.id} agreements={agreements || []} />
              </div>
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary">رقم المستخلص</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">تاريخ الإصدار</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">مقاول الباطن</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">رقم العقد</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الإجمالي (Gross)</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الصافي (Net)</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الحالة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {certificates?.map((cert) => {
                  const subc: any = Array.isArray(cert.subcontractor) ? cert.subcontractor[0] : cert.subcontractor
                  const aggr: any = Array.isArray(cert.agreement) ? cert.agreement[0] : cert.agreement

                  return (
                    <tr key={cert.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{cert.certificate_no}</td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{cert.certificate_date}</td>
                      <td className="px-4 py-4 text-text-primary font-medium">{subc?.arabic_name || 'غير معروف'}</td>
                      <td className="px-4 py-4 text-text-secondary">{aggr?.agreement_code || '---'}</td>
                      <td className="px-4 py-4 font-semibold text-navy dir-ltr text-right">
                        {Number(cert.gross_amount).toLocaleString('en-US')} ج.م
                      </td>
                      <td className="px-4 py-4 font-bold text-success dir-ltr text-right">
                        {Number(cert.net_amount).toLocaleString('en-US')} ج.م
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          cert.status === 'approved' ? 'bg-success/10 text-success' : 
                          cert.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                          cert.status === 'paid_in_full' ? 'bg-purple-100 text-purple-700' :
                          'bg-text-tertiary/10 text-text-secondary'
                        }`}>
                          {cert.status === 'draft' ? 'مسودة' :
                           cert.status === 'pending_approval' ? 'بانتظار الاعتماد' :
                           cert.status === 'approved' ? 'معتمد' :
                           cert.status === 'paid_in_full' ? 'مغلق (مدفوع)' : cert.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ViewCertificateDialog 
                          certId={cert.id}
                          projectId={params.id}
                          status={cert.status}
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
