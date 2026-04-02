'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getCompanyDashboardMetrics } from '@/actions/dashboards'

type CompanyMetrics = Awaited<ReturnType<typeof getCompanyDashboardMetrics>>

export default function CompanyDashboardClient({ initialMetrics }: { initialMetrics: CompanyMetrics }) {
  // TanStack Query handles background refetching and client-side caching
  const { data: metrics } = useQuery({
    queryKey: ['companyDashboardMetrics'],
    queryFn: () => getCompanyDashboardMetrics(),
    initialData: initialMetrics,
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-navy">لوحة تحكم الشركة</h1>
        <p className="mt-1 text-sm text-text-secondary">
          مرحباً بك في النظام المركزي لإدارة المقاولات. إليك ملخص الحالة المالية والتشغيلية.
        </p>
      </div>

      {/* Top Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Treasury Card */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
             </div>
             <div>
               <p className="text-sm font-semibold text-text-secondary">نقدية الشركة (البنوك)</p>
             </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600" dir="ltr">
            {metrics.corporate_cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
             <span className="text-xs text-text-secondary">خزائن المشاريع المتوفرة</span>
             <span className="text-xs font-semibold text-text-primary" dir="ltr">{metrics.project_cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Total Liabilities */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
             </div>
             <div>
               <p className="text-sm font-semibold text-text-secondary">إجمالي الالتزامات المستحقة</p>
             </div>
          </div>
          <p className="text-2xl font-bold text-red-600" dir="ltr">
            {metrics.total_liability.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
             <span className="text-xs text-text-secondary line-clamp-1">للموردين: <span className="font-semibold text-text-primary">{metrics.supplier_liability.toLocaleString()}</span></span>
             <span className="text-xs text-text-secondary line-clamp-1 border-r border-border pr-2">للمقاولين: <span className="font-semibold text-text-primary">{metrics.subcontractor_liability.toLocaleString()}</span></span>
          </div>
        </div>

        {/* Active Projects */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
             </div>
             <div>
               <p className="text-sm font-semibold text-text-secondary">المشاريع الجارية</p>
             </div>
          </div>
          <p className="text-3xl font-bold text-blue-600" dir="ltr">
            {metrics.active_projects}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
             <Link href="/company/projects" className="text-xs font-semibold text-primary hover:underline">عرض قائمة المشاريع →</Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-xl border border-border bg-navy p-5 shadow-sm text-white">
          <h3 className="font-semibold mb-4 opacity-80 border-b border-white/10 pb-2">إجراءات سريعة</h3>
          <ul className="space-y-3">
            <li><Link href="/company/treasury/transfers/new" className="text-sm hover:text-secondary flex items-center gap-2 transition-colors"><span>→</span> تحويل داخلي للخزينة</Link></li>
            <li><Link href="/company/reports" className="text-sm hover:text-secondary flex items-center gap-2 transition-colors"><span>→</span> تقارير الموقف التنفيذي (Matrix)</Link></li>
            <li><Link href="/company/parties/new" className="text-sm hover:text-secondary flex items-center gap-2 transition-colors"><span>→</span> تسجيل مورد / مقاول جديد</Link></li>
          </ul>
        </div>

      </div>

      {/* Extended Features Mock for Dashboard V1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
         <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
                <h3 className="font-bold text-navy">التقارير التحليلية المجمعة</h3>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                </div>
                <h4 className="font-bold text-text-primary mb-2">شاشة Matrix المشاريع</h4>
                <p className="text-sm text-text-secondary max-w-sm mb-6">
                    تعرض مقارنة جنباً إلى جنب لجميع مشاريع الشركة: حجم الإيرادات، التكلفة الفعلية والمتبقية في الموازنة، وعجز الموردين الخاص بكل مشروع بشكل منفصل.
                </p>
                <Link href="/company/reports" className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-colors">
                    الانتقال لمركز التقارير
                </Link>
            </div>
         </div>

         <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col h-full">
             <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
                <h3 className="font-bold text-navy">شجرة الحسابات والتدفق النقدي</h3>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-8"/><path d="m16 16-4-4-4 4"/><path d="M12 2v2"/><path d="M12 22v2"/><path d="m19.07 4.93-1.41 1.41"/><path d="m6.34 17.66-1.41 1.41"/><path d="m22 12h-2"/><path d="m4 12H2"/><path d="m19.07 19.07-1.41-1.41"/><path d="m6.34 6.34-1.41-1.41"/></svg>
                </div>
                <h4 className="font-bold text-text-primary mb-2">إدارة الخزينة والسيولة</h4>
                <p className="text-sm text-text-secondary max-w-sm mb-6">
                    التحكم الكامل في حركة الأموال عبر إنشاء تحويلات داخلية بين خزائن المواقع الجارية وحسابات البنوك الرئيسية.
                </p>
                <Link href="/company/treasury" className="px-6 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-background-secondary text-text-primary transition-colors">
                    الخزينة والحسابات
                </Link>
            </div>
         </div>
      </div>

    </div>
  )
}
