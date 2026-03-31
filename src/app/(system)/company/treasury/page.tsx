import Link from 'next/link'
import { getTreasuryAccounts } from '@/actions/treasury'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import NewTreasuryDialog from './NewTreasuryDialog'
import NewTransferDialog from './NewTransferDialog'

export const metadata = {
  title: 'الخزينة والحسابات البنكية | نظام إدارة المقاولات'
}

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  cashbox:    { label: 'خزينة نقدية',   icon: '💵', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  bank:       { label: 'حساب بنكي',     icon: '🏦', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  deposit:    { label: 'وديعة',         icon: '📥', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  investment: { label: 'شهادة استثمار', icon: '📈', color: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export default async function CorporateTreasuryDashboard() {
  await requirePermission('treasury', 'view')
  const supabase = createClient()
  
  const accounts = await getTreasuryAccounts()

  // Fetch active projects that can be linked to a cashbox
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  
  // Fetch active system users
  const { data: usersData } = await supabase
    .from('users')
    .select(`
      id, display_name, is_super_admin,
      user_access_scopes:user_permission_group_assignments!user_permission_group_assignments_user_id_fkey(scope_type, project_id, permission_group_id)
    `)
    .eq('is_active', true)
    .order('display_name')

  // Identify which permission groups actually have the 'treasury' module allowed
  const { data: treasuryPerms } = await supabase
    .from('permission_group_permissions')
    .select('permission_group_id')
    .eq('module_key', 'treasury')
    .eq('is_allowed', true)
  
  const treasuryGroupIds = treasuryPerms?.map(p => p.permission_group_id) || []

  const corporateAccounts = accounts?.filter(a => !a.project_id) || []
  const projectAccounts = accounts?.filter(a => a.project_id) || []

  // Totals
  const totalCorpBal = corporateAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const totalProjBal = projectAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0)

  const AccountCard = ({ acc, showProjectContext = false }: { acc: any, showProjectContext?: boolean }) => {
    const typeInfo = ACCOUNT_TYPE_LABELS[acc.account_type] || { label: acc.account_type, icon: '💰', color: 'bg-gray-50 text-gray-700 border-gray-200' }
    const balance = Number(acc.current_balance || 0)
    const isLow = balance < 1000

    return (
      <Link
        href={`/company/treasury/${acc.financial_account_id}`}
        className="group flex flex-col justify-between rounded-xl border border-border bg-white shadow-sm hover:border-primary/40 hover:shadow-md transition-all p-4 space-y-3"
      >
        <div>
          {/* Type badge + status */}
          <div className="flex items-start justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${typeInfo.color}`}>
              <span>{typeInfo.icon}</span>
              {typeInfo.label}
            </span>
            <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${acc.is_active ? 'bg-emerald-400' : 'bg-gray-300 shadow-inner'}`} title={acc.is_active ? 'نشط' : 'معطّل'} />
          </div>
          
          <h3 className="mt-2 text-sm font-bold text-navy group-hover:text-primary transition-colors line-clamp-2">
            {acc.arabic_name}
          </h3>
          {showProjectContext && acc.project && (
            <p className="mt-0.5 text-[11px] font-medium text-text-secondary flex items-center gap-1">
              <span className="text-text-primary/40 opacity-70">🏗️</span> 
              <span className="line-clamp-1 truncate">{acc.project.arabic_name}</span>
            </p>
          )}
        </div>

        <div>
          {/* Balance block */}
          <div className={`rounded-lg px-3 py-2 mt-3 ${isLow ? 'bg-red-50/50 border border-red-100' : 'bg-background-secondary'}`}>
            <p className="text-[10px] font-semibold text-text-secondary mb-0.5 uppercase tracking-wide">الرصيد الحالي</p>
            <p className={`text-lg font-black dir-ltr ${isLow ? 'text-red-600' : 'text-navy'}`}>
              {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            {isLow && balance > 0 && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase">رصيد منخفض</p>}
            {balance === 0 && <p className="text-[10px] text-text-secondary mt-1">لا توجد حركات</p>}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>عرض الحركات والكشف</span>
            <span className="group-hover:-translate-x-1 transition-transform opacity-50 group-hover:opacity-100 text-primary">←</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">الخزينة والحسابات البنكية</h1>
          <p className="mt-2 text-sm text-text-secondary">
            متابعة أرصدة الشركة، الخزائن، والتحويلات الداخلية بصلاحيات الإدارة المالية.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NewTransferDialog accounts={accounts || []} />
          <NewTreasuryDialog projects={projectsData || []} users={usersData || []} treasuryGroupIds={treasuryGroupIds} />
        </div>
      </div>

      {/* KPI Cards Combined */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden mb-4 max-w-sm">
        <div className="flex flex-col">
          <div className="bg-white p-3 border-b border-border">
            <p className="text-[11px] font-semibold text-text-secondary">إجمالي سيولة الشركة المباشرة</p>
            <p className="mt-0.5 text-sm font-bold text-primary dir-ltr text-right">
              {totalCorpBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-3 border-b border-border">
            <p className="text-[11px] font-semibold text-text-secondary">إجمالي عهد وخزائن المشاريع</p>
            <p className="mt-0.5 text-sm font-bold text-secondary dir-ltr text-right">
              {totalProjBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-background-secondary/50 p-3">
            <p className="text-xs font-bold text-navy">إجمالي الأرصدة الكلية للتنظيم</p>
            <p className="mt-0.5 text-base font-black text-success-dark dir-ltr text-right">
              {(totalCorpBal + totalProjBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Corporate Accounts */}
      <section className="pt-2">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-navy flex items-center gap-2">
            حسابات الشركة الرئيسية
            <span className="text-xs font-bold text-navy/60 bg-navy/5 px-2.5 py-0.5 rounded-full border border-navy/10">
              {corporateAccounts.length}
            </span>
          </h2>
        </div>
        
        {corporateAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {corporateAccounts.map(acc => (
              <AccountCard key={acc.financial_account_id} acc={acc} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-background-secondary/30 p-12 text-center">
            <div className="text-4xl mb-3 opacity-50">🏢</div>
            <p className="text-base font-semibold text-text-primary">لا توجد حسابات للشركة معرّفة</p>
            <p className="text-sm text-text-secondary mt-1">أضف حساباً بنكياً لمعالجة المدفوعات.</p>
          </div>
        )}
      </section>

      {/* Project Accounts */}
      <section className="pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-5">
           <h2 className="text-lg font-bold text-navy flex items-center gap-2">
            خزائن وحسابات المشاريع
            <span className="text-xs font-bold text-navy/60 bg-navy/5 px-2.5 py-0.5 rounded-full border border-navy/10">
              {projectAccounts.length}
            </span>
          </h2>
        </div>
        
        {projectAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projectAccounts.map(acc => (
              <AccountCard key={acc.financial_account_id} acc={acc} showProjectContext={true} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-background-secondary/30 p-12 text-center">
            <div className="text-4xl mb-3 opacity-50">🏗️</div>
            <p className="text-base font-semibold text-text-primary">لا توجد خزائن مواقع مسجلة</p>
            <p className="text-sm text-text-secondary mt-1">يُمكن إنشاء خزينة لمشروع من صفحة المشروع نفسها.</p>
          </div>
        )}
      </section>

    </div>
  )
}

