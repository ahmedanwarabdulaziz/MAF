import Link from 'next/link'
import { getProjectPayablesQueue } from '@/actions/payments'

export const metadata = {
  title: 'استحقاقات الدفع المعلقة | نظام إدارة المقاولات'
}

export default async function ProjectPayablesQueuePage({ params }: { params: { id: string } }) {
  const { supplier_invoices, subcontractor_certificates } = await getProjectPayablesQueue(params.id)

  const calcOutstandingSup = (inv: any) => Number(inv.net_amount) - Number(inv.paid_to_date || 0)
  const calcOutstandingSub = (cert: any) => Number(cert.outstanding_amount || 0)

  // Total Outstanding Liabilities
  const totalSub = subcontractor_certificates.reduce((acc, curr) => acc + calcOutstandingSub(curr), 0)
  const totalSup = supplier_invoices.reduce((acc, curr) => acc + calcOutstandingSup(curr), 0)

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/payments`} className="hover:text-primary">لوحة المدفوعات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">الاستحقاقات المعلقة</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الاستحقاقات المعلقة (قيد الدفع)</h1>
          <p className="mt-1 text-sm text-text-secondary">
            مستخلصات المقاولين وفواتير الموردين المعتمدة والتي لم يتم سدادها بالكامل.
          </p>
        </div>
        <div>
           <Link
            href={`/projects/${params.id}/payments/new`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            + تسجيل دفعة جديدة
          </Link>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-white border border-border shadow-sm rounded-lg p-5 flex-1 min-w-[250px]">
           <p className="text-xs font-bold text-text-secondary uppercase mb-1">إجمالي التزامات مقاولي الباطن</p>
           <p className="text-3xl font-bold text-navy" dir="ltr">{totalSub.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
           <p className="text-xs text-text-secondary mt-1">{subcontractor_certificates.length} مستخلص معلق</p>
        </div>
        <div className="bg-white border border-border shadow-sm rounded-lg p-5 flex-1 min-w-[250px]">
           <p className="text-xs font-bold text-text-secondary uppercase mb-1">إجمالي التزامات الموردين</p>
           <p className="text-3xl font-bold text-secondary" dir="ltr">{totalSup.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
           <p className="text-xs text-text-secondary mt-1">{supplier_invoices.length} فاتورة معلقة</p>
        </div>
      </div>

      {/* Subcontractor Certificates Queue */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-background-secondary/50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between">
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                مستخلصات مقاولي الباطن المعتمدة
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{subcontractor_certificates.length}</span>
            </h2>
        </div>
        
        {subcontractor_certificates.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">لا توجد مستخلصات مقاولين مستحقة الدفع.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المقاول</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">رقم المستخلص</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">تاريخ الاعتماد</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">الصافي الكلي</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المدفوعات السابقة</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المبلغ المستحق للدفع</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subcontractor_certificates.map((cert: any) => (
                  <tr key={cert.id} className="hover:bg-background-secondary transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">
                        {cert.subcontractor_agreement?.subcontractor?.arabic_name || 'مجهول'}
                    </td>
                    <td className="px-6 py-4 font-medium text-text-primary" dir="ltr">
                        {cert.certificate_no}
                    </td>
                    <td className="px-6 py-4 text-text-secondary" dir="ltr">
                        {cert.certificate_date}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium" dir="ltr">
                        {Number(cert.net_amount).toLocaleString()} EGP
                    </td>
                    <td className="px-6 py-4 text-text-secondary" dir="ltr">
                        {Number(cert.paid_to_date || 0).toLocaleString()} EGP
                    </td>
                    <td className="px-6 py-4 font-bold text-danger" dir="ltr">
                        {calcOutstandingSub(cert).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            cert.status === 'partially_paid' ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'
                        }`}>
                            {cert.status === 'partially_paid' ? 'مدفوع جزئياً' : 'معتمد (قيد الدفع)'}
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Invoices Queue */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-background-secondary/50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between">
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                فواتير الموردين المعتمدة
                <span className="bg-secondary/10 text-secondary text-xs font-bold px-2 py-0.5 rounded-full">{supplier_invoices.length}</span>
            </h2>
        </div>
        
        {supplier_invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">لا توجد فواتير موردين مستحقة الدفع.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المورد</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">رقم الفاتورة</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">تاريخ الفاتورة</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">الصافي الكلي</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المدفوعات السابقة</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المبلغ المستحق للدفع</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplier_invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-background-secondary transition-colors">
                    <td className="px-6 py-4 font-bold text-secondary">
                        {inv.supplier?.arabic_name || 'مجهول'}
                    </td>
                    <td className="px-6 py-4 font-medium text-text-primary" dir="ltr">
                        {inv.invoice_no}
                    </td>
                    <td className="px-6 py-4 text-text-secondary" dir="ltr">
                        {inv.invoice_date}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium" dir="ltr">
                        {Number(inv.net_amount).toLocaleString()} EGP
                    </td>
                    <td className="px-6 py-4 text-text-secondary" dir="ltr">
                        {Number(inv.paid_to_date || 0).toLocaleString()} EGP
                    </td>
                    <td className="px-6 py-4 font-bold text-danger" dir="ltr">
                        {calcOutstandingSup(inv).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            inv.status === 'partially_paid' ? 'bg-amber-100 text-amber-800' : 'bg-secondary/10 text-secondary'
                        }`}>
                            {inv.status === 'partially_paid' ? 'مدفوع جزئياً' : 'مرحّلة (قيد الدفع)'}
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
