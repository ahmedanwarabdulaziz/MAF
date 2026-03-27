'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

export default function SidebarNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
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
        <Link href={`/projects/${projectId}`} className={`${linkBase} ${isActive(`/projects/${projectId}`) && !isActive(`/projects/${projectId}/`) ? linkActive : linkInactive}`}>
          لوحة تحكم المشروع
        </Link>
        <Link href={`/company/projects/${projectId}`} className={`${linkBase} ${isActive(`/company/projects/${projectId}`) ? linkActive : linkInactive}`}>
          بيانات المشروع
        </Link>

        <div className={subLabel}>مخزن المشروع</div>
        <Link href={`/projects/${projectId}/project_warehouse/stock-balances`} className={`${linkBase} ${isActive(`/projects/${projectId}/project_warehouse/stock-balances`) ? linkActive : linkInactive}`}>
          أرصدة المشروع
        </Link>
        <Link href={`/projects/${projectId}/project_warehouse/transfers`} className={`${linkBase} ${isActive(`/projects/${projectId}/project_warehouse/transfers`) ? linkActive : linkInactive}`}>
          أذون التحويل
        </Link>

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

        <div className={subLabel}>المشتريات والموردين</div>
        <Link href={`/projects/${projectId}/procurement/requests`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/requests`) ? linkActive : linkInactive}`}>
          طلبات الشراء (PR)
        </Link>
        <Link href={`/projects/${projectId}/procurement/invoices`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/invoices`) ? linkActive : linkInactive}`}>
          فواتير الموردين
        </Link>
        <Link href={`/projects/${projectId}/procurement/statements`} className={`${linkBase} ${isActive(`/projects/${projectId}/procurement/statements`) ? linkActive : linkInactive}`}>
          حسابات الموردين
        </Link>

        <div className={subLabel}>المالك والتحصيلات</div>
        <Link href={`/projects/${projectId}/owner-billing`} className={`${linkBase} ${isActive(`/projects/${projectId}/owner-billing`) ? linkActive : linkInactive}`}>
          فواتير المالك
        </Link>
        <Link href={`/projects/${projectId}/collections`} className={`${linkBase} ${isActive(`/projects/${projectId}/collections`) ? linkActive : linkInactive}`}>
          التحصيلات
        </Link>

        <div className={subLabel}>المدفوعات</div>
        <Link href={`/projects/${projectId}/payments`} className={`${linkBase} ${isActive(`/projects/${projectId}/payments`) ? linkActive : linkInactive}`}>
          سجلات الصرف
        </Link>
        <Link href={`/projects/${projectId}/payments/queue`} className={`${linkBase} ${isActive(`/projects/${projectId}/payments/queue`) ? linkActive : linkInactive}`}>
          الاستحقاقات المعلقة
        </Link>

        <div className={subLabel}>العهد والمصروفات</div>
        <Link href={`/projects/${projectId}/custody`} className={`${linkBase} ${isActive(`/projects/${projectId}/custody`) ? linkActive : linkInactive}`}>
          أرصدة العهد
        </Link>
        <Link href={`/projects/${projectId}/custody/expenses`} className={`${linkBase} ${isActive(`/projects/${projectId}/custody/expenses`) ? linkActive : linkInactive}`}>
          المصروفات النثرية
        </Link>
      </nav>
    )
  }

  /* ── COMPANY CONTEXT ── default when no project selected ── */
  return (
    <nav className="flex flex-col gap-0.5">
      <div className={sectionLabel}>سياق الشركة</div>
      <Link href="/company" className={`${linkBase} ${isActive('/company') && !isActive('/company/settings') ? linkActive : linkInactive}`}>
        لوحة تحكم الشركة
      </Link>
      <Link href="/company/reports" className={`${linkBase} ${isActive('/company/reports') ? linkActive : linkInactive}`}>
        التقارير المجمعة
      </Link>
      <Link href="/company/projects" className={`${linkBase} ${isActive('/company/projects') ? linkActive : linkInactive}`}>
        المشروعات
      </Link>
      <Link href="/company/parties" className={`${linkBase} ${isActive('/company/parties') ? linkActive : linkInactive}`}>
        الأطراف
      </Link>
      <Link href="/company/treasury" className={`${linkBase} ${isActive('/company/treasury') ? linkActive : linkInactive}`}>
        الخزينة والحسابات
      </Link>

      <div className={subLabel}>مشتريات الشركة</div>
      <Link href="/company/purchases" className={`${linkBase} ${isActive('/company/purchases') && !isActive('/company/purchases/expense-categories') && !isActive('/company/purchases/suppliers') ? linkActive : linkInactive}`}>
        قائمة المشتريات الرئيسية
      </Link>
      <Link href="/company/purchases/suppliers" className={`${linkBase} ${isActive('/company/purchases/suppliers') ? linkActive : linkInactive}`}>
        حسابات الموردين
      </Link>
      <Link href="/company/purchases/expense-categories" className={`${linkBase} ${isActive('/company/purchases/expense-categories') ? linkActive : linkInactive}`}>
        أقسام المصروفات
      </Link>

      <div className={subLabel}>المخزن الرئيسي</div>
      <Link href="/company/main_warehouse/warehouses" className={`${linkBase} ${isActive('/company/main_warehouse/warehouses') ? linkActive : linkInactive}`}>
        المخازن
      </Link>
      <Link href="/company/main_warehouse/item-groups" className={`${linkBase} ${isActive('/company/main_warehouse/item-groups') ? linkActive : linkInactive}`}>
        مجموعات الأصناف
      </Link>
      <Link href="/company/main_warehouse/items" className={`${linkBase} ${isActive('/company/main_warehouse/items') ? linkActive : linkInactive}`}>
        دليل الأصناف
      </Link>
      <Link href="/company/main_warehouse/stock-balances" className={`${linkBase} ${isActive('/company/main_warehouse/stock-balances') ? linkActive : linkInactive}`}>
        الأرصدة الحالية
      </Link>
      <Link href="/company/main_warehouse/transfers" className={`${linkBase} ${isActive('/company/main_warehouse/transfers') ? linkActive : linkInactive}`}>
        أذون التحويل
      </Link>
    </nav>
  )
}
