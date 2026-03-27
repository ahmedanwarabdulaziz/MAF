import Link from 'next/link'
import { getProjectDashboardMetrics } from '@/actions/dashboards'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'لوحة تحكم المشروع | نظام إدارة المقاولات'
}

export default async function ProjectDashboard({ params }: { params: { id: string } }) {
  // 1. Get Project Basic details
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('arabic_name, project_code')
    .eq('id', params.id)
    .single()
  
  if (!project) notFound()

  // 2. Fetch Live Aggregate Metrics
  const metrics = await getProjectDashboardMetrics(params.id)

  const costVariance = metrics.budget - metrics.incurred_material_cost

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-secondary font-mono tracking-wider">
            [{project.project_code}]
          </p>
          <h1 className="text-3xl font-bold text-navy">لوحة تحكم مشروع: {project.arabic_name}</h1>
        </div>
        <div className="flex gap-3">
          <Link 
            href={`/projects/${params.id}/collections`}
            className="rounded-md border border-primary text-primary px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary/5 transition-colors"
          >
            تسجيل تحصيل
          </Link>
          <Link 
             href={`/projects/${params.id}/payments/new`}
             className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90"
          >
            إصدار سند دفع
          </Link>
        </div>
      </div>
      
      {/* Top Main Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Site Treasury */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">السيولة المتاحة بالموقع</span>
            <p className="mt-3 text-sm text-text-secondary">إجمالي أرصدة خزائن المشروع المتوفرة للمصروفات النثرية والدفعات المباشرة</p>
          </div>
          <p className="text-3xl font-bold text-navy" dir="ltr">
            {metrics.site_cashbox.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>

        {/* Master Budget */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">الموازنة التقديرية (بالمقايسة)</span>
            <p className="mt-3 text-sm text-text-secondary">التكلفة التقديرية الإجمالية المعتمدة للمشروع</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600" dir="ltr">
            {metrics.budget.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>

        {/* Open Receivables */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">مستحقات على المالك لم تحصل</span>
            <p className="mt-3 text-sm text-text-secondary">إجمالي فواتير ومستخلصات المالك المعتمدة والمتبقي تحصيلها</p>
          </div>
          <p className="text-3xl font-bold text-amber-600" dir="ltr">
            {metrics.total_receivable.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>
      </div>

      {/* Detail Breakdown View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Cost breakdown */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
               <h3 className="font-bold text-navy">التكاليف والالتزامات المطالب بها</h3>
            </div>
            <div className="p-6 flex-1 space-y-6">
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-text-secondary">مستحقات مقاولي الباطن (غير مسددة)</span>
                        <span className="font-bold text-navy" dir="ltr">{metrics.subcontractor_liability.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</span>
                    </div>
                    <div className="w-full bg-background-secondary rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: Math.min(100, (metrics.subcontractor_liability / Math.max(1, metrics.budget)) * 100) + '%' }}></div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-text-secondary">فواتير توريدات (غير مسددة)</span>
                        <span className="font-bold text-navy" dir="ltr">{metrics.supplier_liability.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</span>
                    </div>
                    <div className="w-full bg-background-secondary rounded-full h-2">
                        <div className="bg-secondary h-2 rounded-full" style={{ width: Math.min(100, (metrics.supplier_liability / Math.max(1, metrics.budget)) * 100) + '%' }}></div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border border-dashed">
                     <div className="flex justify-between items-center bg-danger/5 rounded-lg p-3">
                        <span className="text-sm font-bold text-danger">إجمالي الالتزامات الواجب سدادها</span>
                        <span className="font-bold text-danger" dir="ltr">
                            {(metrics.subcontractor_liability + metrics.supplier_liability).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
                        </span>
                    </div>
                </div>
            </div>
          </div>

          {/* Variance breakdown */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
               <h3 className="font-bold text-navy">موقف الإيرادات الفعلي والتكلفة المثبتة</h3>
            </div>
            <div className="p-6 flex-1 space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-text-tertiary"></div>
                        <span className="text-sm font-medium text-text-primary">إجمالي فواتير المالك المصدرة</span>
                    </div>
                    <span className="font-bold text-navy" dir="ltr">{metrics.total_billed.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</span>
                </div>

                 <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success"></div>
                        <span className="text-sm font-medium text-text-primary">ما تم سداده وتحصيله من المالك</span>
                    </div>
                    <span className="font-bold text-success-dark" dir="ltr">{metrics.total_collected.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</span>
                </div>

                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-danger"></div>
                        <span className="text-sm font-medium text-text-primary">تكلفة التوريدات المثبتة فعلياً (بفواتير)</span>
                    </div>
                    <span className="font-bold text-danger" dir="ltr">{metrics.incurred_material_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP</span>
                </div>

                <div className="pt-2">
                    <div className="flex justify-between items-center rounded-lg p-3 bg-background-secondary/50 border border-border">
                        <span className="text-sm font-bold text-text-secondary">وفر الموازنة / الهامش المبسط للمواد</span>
                        <span className={`font-bold ${costVariance > 0 ? 'text-success-dark' : 'text-danger'}`} dir="ltr">
                            {costVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
                        </span>
                    </div>
                </div>
            </div>
          </div>
      </div>

    </div>
  )
}
