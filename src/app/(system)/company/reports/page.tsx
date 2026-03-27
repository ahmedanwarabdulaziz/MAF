import Link from 'next/link'
import { getConsolidatedProjectsReport } from '@/actions/dashboards'

export const metadata = {
  title: 'التقارير التحليلية | نظام إدارة المقاولات'
}

export default async function ConsolidatedReportsPage() {
  const projectsReport = await getConsolidatedProjectsReport()

  // Calc Company Totals
  const totals = projectsReport.reduce((acc, curr) => {
      acc.budget += curr.budget
      acc.billed += curr.billed
      acc.collected += curr.collected
      acc.cost += curr.cost
      acc.variance += curr.variance
      acc.subLiability += curr.subLiability
      acc.supLiability += curr.supLiability
      return acc
  }, { budget: 0, billed: 0, collected: 0, cost: 0, variance: 0, subLiability: 0, supLiability: 0 })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">مركز التقارير التحليلية للشركة</h1>
          <p className="mt-1 text-sm text-text-secondary">
             التحليل المالي المجمع ومقارنة موازنات كافة المشاريع.
          </p>
        </div>
        <div>
           <button className="rounded-md bg-white border border-border px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-background-secondary transition-colors">
            تصدير إلى إكسيل (Excel)
           </button>
        </div>
      </div>

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
             <p className="text-sm font-semibold text-text-secondary mb-2 whitespace-nowrap">إجمالي موازنات المشاريع</p>
             <p className="text-xl font-bold text-navy" dir="ltr">{totals.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
             <p className="text-sm font-semibold text-text-secondary mb-2 whitespace-nowrap">إجمالي التكلفة المتكبدة (موردين + باطن)</p>
             <p className="text-xl font-bold text-danger" dir="ltr">{totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
             <p className="text-sm font-semibold text-text-secondary mb-2 whitespace-nowrap">إجمالي المطالبات المفتوحة (دائنون)</p>
             <p className="text-xl font-bold text-amber-600" dir="ltr">{(totals.subLiability + totals.supLiability).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
             <p className="text-sm font-semibold text-text-secondary mb-2 whitespace-nowrap">الوفر الإجمالي / هامش التكلفة الجزئي</p>
             <p className={`text-xl font-bold ${totals.variance > 0 ? 'text-success-dark' : 'text-danger'}`} dir="ltr">{totals.variance.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</p>
        </div>
      </div>

      {/* Project Matrix Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
         <div className="border-b border-border bg-background-secondary px-6 py-4">
            <h2 className="text-lg font-bold text-navy">لوحة مقارنة المشاريع (Matrix)</h2>
            <p className="text-xs text-text-secondary mt-1">توضح موقف كل مشروع منفرداً من حيث الموازنة والتكاليف والموقف المالي للمالك والمقاولين.</p>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
                <thead className="bg-background-secondary border-b border-border">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-text-secondary sticky right-0 bg-background-secondary shadow-[-1px_0_0_rgba(0,0,0,0.1)]">المشروع</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary">الموازنة التقديرية</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary">التكلفة (موردين + مقاولين)</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary">انحراف التكلفة (الوفر)</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary">تم فوترته للمالك</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary">مقبوضات مالك</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary text-danger">مستحقات مقاولين (غير مسددة)</th>
                        <th className="px-6 py-4 font-semibold text-text-secondary text-danger">مستحقات موردين (غير مسددة)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {projectsReport.map(report => (
                        <tr key={report.id} className="hover:bg-background-secondary/50">
                            <td className="px-6 py-4 font-bold text-primary sticky right-0 bg-white/90 shadow-[-1px_0_0_rgba(0,0,0,0.1)] whitespace-nowrap">
                                <Link href={`/projects/${report.id}`} className="hover:underline">{report.name}</Link>
                            </td>
                            <td className="px-6 py-4 text-text-primary" dir="ltr">{report.budget.toLocaleString()}</td>
                            <td className="px-6 py-4 font-semibold text-danger" dir="ltr">{report.cost.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold" dir="ltr">
                                <span className={report.variance > 0 ? 'text-success-dark' : 'text-danger'}>
                                    {report.variance > 0 ? '+' : ''}{report.variance.toLocaleString()}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-text-primary bg-background-secondary/20" dir="ltr">{report.billed.toLocaleString()}</td>
                            <td className="px-6 py-4 text-success-dark font-medium bg-background-secondary/20" dir="ltr">{report.collected.toLocaleString()}</td>
                            <td className="px-6 py-4 text-danger bg-danger/5" dir="ltr">{report.subLiability.toLocaleString()}</td>
                            <td className="px-6 py-4 text-danger bg-danger/5" dir="ltr">{report.supLiability.toLocaleString()}</td>
                        </tr>
                    ))}
                    {projectsReport.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-8 text-center text-text-secondary">لا توجد مشاريع مضافة حالياً.</td>
                        </tr>
                    )}
                </tbody>
                {projectsReport.length > 0 && (
                    <tfoot className="bg-navy border-t border-navy">
                        <tr>
                            <td className="px-6 py-4 font-bold text-white sticky right-0 bg-navy shadow-[-1px_0_0_rgba(0,0,0,0.2)]">الإجمالي العام</td>
                            <td className="px-6 py-4 font-bold text-white" dir="ltr">{totals.budget.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-white" dir="ltr">{totals.cost.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-white" dir="ltr">{totals.variance.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-white" dir="ltr">{totals.billed.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-white" dir="ltr">{totals.collected.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-[#ff9999]" dir="ltr">{totals.subLiability.toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-[#ff9999]" dir="ltr">{totals.supLiability.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
      </div>

    </div>
  )
}
