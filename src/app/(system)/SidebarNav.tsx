'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getDiscrepancyInvoices } from '@/actions/procurement'

function DiscrepancyBadge({ projectId }: { projectId?: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    getDiscrepancyInvoices(projectId || undefined).then(data => setCount(data?.length || 0)).catch(() => {})
  }, [projectId])

  if (count === 0) return null
  return <span className="mr-auto mr-1 bg-danger text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{count}</span>
}

type Props = {
  isSuperAdmin: boolean
  allowedModules: string[]
  companyName?: string
}

export default function SidebarNav({ isSuperAdmin, allowedModules, companyName }: Props) {
  const params = useParams()
  const pathname = usePathname()
  const projectId = params?.id as string | undefined

  const inProjectContext = !!projectId && !!pathname?.includes('/projects/')

  const isActive = (path: string) => pathname?.startsWith(path)

  const linkBase = 'rounded px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10'
  const linkActive = 'bg-white/15 text-white'
  const linkInactive = 'text-white/75'
  const subLabel = 'mt-2 mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35'
  const sectionLabel = 'mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45'

  // Helper: check if user has access to a module
  // Super admins bypass all checks
  const can = (moduleKey: string) => isSuperAdmin || allowedModules.includes(moduleKey)

  /* ── PROJECT CONTEXT ── show only when inside a project route ── */
  if (inProjectContext) {
    return (
      <nav className="flex flex-col gap-0.5">
        {/* Back to company */}
        <Link
          href="/company/projects"
          className={`${linkBase} ${linkInactive} flex items-center gap-1.5 mb-2`}
        >
          <span className="text-white/50">←</span>
          <span>المشروعات</span>
        </Link>

        <div className={sectionLabel}>سياق المشروع</div>

        {can('dashboard') && (
          <>
            <Link href={`/projects/${projectId}`} className={`${linkBase} ${isActive(`/projects/${projectId}`) && !isActive(`/projects/${projectId}/`) && !isActive(`/projects/${projectId}/costs`) ? linkActive : linkInactive}`}>
              لوحة تحكم المشروع
            </Link>
            <Link href={`/projects/${projectId}/costs`} className={`${linkBase} ${isActive(`/projects/${projectId}/costs`) ? linkActive : linkInactive}`}>
              تتبع التكاليف
            </Link>
          </>
        )}

        {can('project_profile') && (
          <Link href={`/company/projects/${projectId}`} className={`${linkBase} ${isActive(`/company/projects/${projectId}`) ? linkActive : linkInactive}`}>
            بيانات المشروع
          </Link>
        )}

        {can('project_warehouse') && (
          <>
            <div className={subLabel}>مخزن المشروع</div>
            <Link href={`/projects/${projectId}/project_warehouse/stock-balances`} className={`${linkBase} ${isActive(`/projects/${projectId}/project_warehouse/stock-balances`) ? linkActive : linkInactive}`}>
              أرصدة المشروع
            </Link>
            <Link href={`/projects/${projectId}/project_warehouse/issues`} className={`${linkBase} ${isActive(`/projects/${projectId}/project_warehouse/issues`) ? linkActive : linkInactive}`}>
              أذون الصرف
            </Link>
            <Link href={`/projects/${projectId}/project_warehouse/transfers`} className={`${linkBase} ${isActive(`/projects/${projectId}/project_warehouse/transfers`) ? linkActive : linkInactive}`}>
              أذون التحويل
            </Link>
          </>
        )}

        {can('subcontractor_certificates') && (
          <>
            <div className={subLabel}>مقاولو الباطن</div>
            <Link href={`/projects/${projectId}/work-items`} className={`${linkBase} ${isActive(`/projects/${projectId}/work-items`) ? linkActive : linkInactive}`}>
              بنود الأعمال
            </Link>
            <Link href={`/projects/${projectId}/agreements`} className={`${linkBase} ${isActive(`/projects/${projectId}/agreements`) ? linkActive : linkInactive}`}>
              عقود المقاولين
            </Link>
            <Link href={`/projects/${projectId}/certificates`} className={`${linkBase} ${isActive(`/projects/${projectId}/certificates`) ? linkActive : linkInactive}`}>
              المستخلصات
            </Link>
            <Link href={`/projects/${projectId}/subcontractors`} className={`${linkBase} ${isActive(`/projects/${projectId}/subcontractors`) ? linkActive : linkInactive}`}>
              موقف وحسابات المقاولين
            </Link>
          </>
        )}

        {can('supplier_procurement') && (
          <>
            <div className={subLabel}>المشتريات والموردين</div>
            <Link href={`/projects/${projectId}/procurement/requests`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/requests`) ? linkActive : linkInactive}`}>
              طلبات الشراء (PR)
            </Link>
            <Link href={`/projects/${projectId}/procurement/invoices`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/invoices`) ? linkActive : linkInactive}`}>
              فواتير الموردين
            </Link>
            <Link href={`/projects/${projectId}/procurement/discrepancies`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/discrepancies`) ? linkActive : linkInactive} flex items-center justify-between`}>
              <span>فروق الاستلامات</span>
              <DiscrepancyBadge projectId={projectId} />
            </Link>
            <Link href={`/projects/${projectId}/procurement/statements`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/statements`) ? linkActive : linkInactive}`}>
              حسابات الموردين
            </Link>
          </>
        )}

        {can('owner_billing') && (
          <>
            <div className={subLabel}>المالك والتحصيلات</div>
            <Link href={`/projects/${projectId}/owner-billing`} className={`${linkBase} ${isActive(`/projects/${projectId}/owner-billing`) ? linkActive : linkInactive}`}>
              فواتير المالك
            </Link>
            <Link href={`/projects/${projectId}/collections`} className={`${linkBase} ${isActive(`/projects/${projectId}/collections`) ? linkActive : linkInactive}`}>
              التحصيلات
            </Link>
          </>
        )}

        {can('payments') && (
          <>
            <div className={subLabel}>المدفوعات</div>
            <Link href={`/projects/${projectId}/payments`} className={`${linkBase} ${isActive(`/projects/${projectId}/payments`) && !isActive(`/projects/${projectId}/payments/queue`) ? linkActive : linkInactive}`}>
              سجلات الصرف
            </Link>
            <Link href={`/projects/${projectId}/payments/queue`} className={`${linkBase} ${isActive(`/projects/${projectId}/payments/queue`) ? linkActive : linkInactive}`}>
              الاستحقاقات المعلقة
            </Link>
            <Link href={`/projects/${projectId}/treasury`} className={`${linkBase} ${isActive(`/projects/${projectId}/treasury`) ? linkActive : linkInactive}`}>
              خزائن المشروع
            </Link>
          </>
        )}

        {can('employee_custody') && (
          <>
            <div className={subLabel}>المصروفات والنثريات</div>
            <Link href={`/projects/${projectId}/petty-expenses`} className={`${linkBase} ${isActive(`/projects/${projectId}/petty-expenses`) ? linkActive : linkInactive}`}>
              المصروفات النثرية
            </Link>
          </>
        )}
      </nav>
    )
  }

  /* ── COMPANY CONTEXT ── default when no project selected ── */
  return (
    <nav className="flex flex-col gap-0.5">
      <div className={sectionLabel}>سياق الشركة</div>

      {can('dashboard') && (
        <Link href="/company" className={`${linkBase} ${isActive('/company') && !isActive('/company/settings') && !isActive('/company/approvals') ? linkActive : linkInactive}`}>
          لوحة تحكم الشركة
        </Link>
      )}

      {can('projects') && (
        <>
          <Link href="/company/projects" className={`${linkBase} ${isActive('/company/projects') ? linkActive : linkInactive}`}>
            المشروعات
          </Link>
          <Link href="/company/critical-actions" className={`${linkBase} flex items-center justify-between ${isActive('/company/critical-actions') ? linkActive : linkInactive}`}>
            <span>الاعتمادات والملاحظات الهامة</span>
            <span className="bg-amber-500/20 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center">⚡</span>
          </Link>
        </>
      )}

      {can('treasury') && (
        <>
          <div className={subLabel}>الخزانة والتنفيذ</div>
          <Link href="/company/treasury" className={`${linkBase} ${isActive('/company/treasury') && !isActive('/company/treasury/expense-categories') && !isActive('/company/treasury/queue') ? linkActive : linkInactive}`}>
            الخزينة والحسابات
          </Link>
          <Link href="/company/treasury/queue" className={`${linkBase} flex items-center justify-between ${isActive('/company/treasury/queue') ? linkActive : linkInactive}`}>
            <span>تنفيذ المدفوعات (Queue)</span>
            <span className="bg-success/20 text-success-dark text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center">⏳</span>
          </Link>
        </>
      )}

      {can('corporate_expenses') && (
        <Link href="/company/purchases/suppliers" className={`${linkBase} ${isActive('/company/purchases/suppliers') ? linkActive : linkInactive}`}>
          حسابات الموردين
        </Link>
      )}

      {can('corporate_expenses') && (
        <>
          <div className={subLabel}>مشتريات الشركة</div>
          <Link href="/company/purchases" className={`${linkBase} ${isActive('/company/purchases') && !isActive('/company/purchases/expense-categories') && !isActive('/company/purchases/suppliers') && !isActive('/company/purchases/approved-prs') && !isActive('/company/purchases/invoices') && !isActive('/company/purchases/discrepancies') ? linkActive : linkInactive}`}>
            مصروفات ومشتريات ماف للمقاولات
          </Link>
          <Link href="/company/approvals" className={`${linkBase} ${isActive('/company/approvals') ? linkActive : linkInactive}`}>
            اعتمادات طلبات الشراء المعلقة
          </Link>
          <Link href="/company/purchases/approved-prs" className={`${linkBase} ${isActive('/company/purchases/approved-prs') ? linkActive : linkInactive}`}>
            طلبات الشراء المعتمدة
          </Link>
          <Link href="/company/purchases/invoices" className={`${linkBase} ${isActive('/company/purchases/invoices') ? linkActive : linkInactive}`}>
            فواتير الموردين (الشركة الرئيسية)
          </Link>
          <Link href="/company/purchases/discrepancies" className={`${linkBase} flex items-center justify-between ${isActive('/company/purchases/discrepancies') ? linkActive : linkInactive}`}>
            <span>فروق الاستلامات الشاملة</span>
            <DiscrepancyBadge projectId="" />
          </Link>
        </>
      )}

      {(can('consolidated_reports') || can('treasury') || can('main_warehouse')) && (
        <>
          <div className={subLabel}>التقارير</div>
          {can('consolidated_reports') && (
            <Link href="/company/reports" className={`${linkBase} ${isActive('/company/reports') ? linkActive : linkInactive}`}>
              التقارير المجمعة
            </Link>
          )}
          {can('main_warehouse') && (
            <Link href="/company/cost-centers" className={`${linkBase} ${isActive('/company/cost-centers') ? linkActive : linkInactive}`}>
              مراكز التكلفة (Cost Centers)
            </Link>
          )}
        </>
      )}





      {can('main_warehouse') && (
        <>
          <div className={subLabel}>المخزن الرئيسي</div>
          <Link href="/company/main_warehouse/warehouses" className={`${linkBase} ${isActive('/company/main_warehouse/warehouses') ? linkActive : linkInactive}`}>
            المخازن
          </Link>

          <Link href="/company/main_warehouse/stock-balances" className={`${linkBase} ${isActive('/company/main_warehouse/stock-balances') ? linkActive : linkInactive}`}>
            الأرصدة الحالية
          </Link>
          <Link href="/company/main_warehouse/issues" className={`${linkBase} ${isActive('/company/main_warehouse/issues') ? linkActive : linkInactive}`}>
            أذون الصرف
          </Link>
          <Link href="/company/main_warehouse/transfers" className={`${linkBase} ${isActive('/company/main_warehouse/transfers') ? linkActive : linkInactive}`}>
            أذون التحويل
          </Link>
        </>
      )}

      {(can('party_masters') || can('treasury') || can('corporate_expenses') || can('item_master')) && (
        <>
          <div className={subLabel}>البيانات الأساسية (Master Data)</div>
          {can('party_masters') && (
            <Link href="/company/parties" className={`${linkBase} ${isActive('/company/parties') ? linkActive : linkInactive}`}>
              جهات التعامل
            </Link>
          )}
          {can('treasury') && (
            <Link href="/company/treasury/expense-categories" className={`${linkBase} ${isActive('/company/treasury/expense-categories') ? linkActive : linkInactive}`}>
              بنود المصروفات النثرية
            </Link>
          )}
          {can('corporate_expenses') && (
            <Link href="/company/purchases/expense-categories" className={`${linkBase} ${isActive('/company/purchases/expense-categories') ? linkActive : linkInactive}`}>
              أقسام مصروفات {companyName || 'الشركة'}
            </Link>
          )}
          {can('item_master') && (
            <>
              <Link href="/company/main_warehouse/item-groups" className={`${linkBase} ${isActive('/company/main_warehouse/item-groups') ? linkActive : linkInactive}`}>
                مجموعات الأصناف
              </Link>
              <Link href="/company/main_warehouse/items" className={`${linkBase} ${isActive('/company/main_warehouse/items') ? linkActive : linkInactive}`}>
                دليل الأصناف
              </Link>
            </>
          )}
        </>
      )}
    </nav>
  )
}
