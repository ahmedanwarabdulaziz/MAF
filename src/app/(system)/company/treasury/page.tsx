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
    const typeInfo = ACCOUNT_TYPE_LABELS[acc.account_type] || { label: acc.account_type, icon: '💰' }
    const balance = Number(acc.current_balance || 0)
    const isLow = balance < 1000

    return (
      <Link
        href={`/company/treasury/${acc.financial_account_id}`}
        className="group block w-full text-right overflow-hidden rounded-xl border border-border bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="bg-navy px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <span className="w-fit rounded bg-white/20 px-2.5 py-1 text-xs font-medium text-white shadow-inner flex items-center gap-1.5" dir="rtl">
                <span>{typeInfo.icon}</span>
                {typeInfo.label}
              </span>
              <div className="text-lg font-bold text-white group-hover:text-white/90 transition-colors leading-tight">
                {acc.arabic_name}
              </div>
            </div>
            <span className={`mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${acc.is_active ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-white/10 text-white border border-white/20'}`}>
              {acc.is_active ? 'نشط' : 'معطّل'}
            </span>
          </div>
          {showProjectContext && acc.project && (
            <p className="mt-3 text-xs font-medium text-white/70 flex items-center gap-1.5">
              <span className="opacity-70">🏗️</span> 
              <span className="line-clamp-1 truncate">{acc.project.arabic_name}</span>
            </p>
          )}
        </div>

        <div className="p-4 bg-white border-t border-border flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs font-medium text-text-tertiary">الرصيد الحالي</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-bold dir-ltr ${isLow ? 'text-red-600' : 'text-text-primary'}`}>
                {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              {isLow && balance > 0 && <span className="text-[10px] font-bold text-red-500 uppercase">رصيد منخفض</span>}
              {balance === 0 && <span className="text-[10px] text-text-secondary">لا توجد حركات</span>}
            </div>
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
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden mb-6 max-w-lg">
        <div className="flex flex-col">
          <div className="bg-white p-4 border-b border-border flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/70"></span>
              إجمالي سيولة الشركة المباشرة
            </span>
            <span className="text-sm font-bold text-primary dir-ltr">
              {totalCorpBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white p-4 border-b border-border flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary/70"></span>
              إجمالي عهد وخزائن المشاريع
            </span>
            <span className="text-sm font-bold text-secondary dir-ltr">
              {totalProjBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-background-secondary/50 p-4 flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-navy flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
              إجمالي الأرصدة الكلية للتنظيم
            </span>
            <span className="text-lg font-black text-success-dark dir-ltr">
              {(totalCorpBal + totalProjBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
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

