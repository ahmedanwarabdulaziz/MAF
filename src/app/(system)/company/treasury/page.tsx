import Link from 'next/link'
import { getTreasuryAccounts } from '@/actions/treasury'
import { requirePermission } from '@/lib/auth'

export const metadata = {
  title: 'الخزينة والحسابات البنكية | نظام إدارة المقاولات'
}

export default async function CorporateTreasuryDashboard() {
  await requirePermission('treasury', 'view')
  const accounts = await getTreasuryAccounts()

  const corporateAccounts = accounts?.filter(a => !a.project_id) || []
  const projectAccounts = accounts?.filter(a => a.project_id) || []

  // Totals
  const totalCorpBal = corporateAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const totalProjBal = projectAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0)

  const AccountCard = ({ acc }: { acc: any }) => (
    <Link 
      href={`/company/treasury/${acc.financial_account_id}`}
      className="group block rounded-xl border border-border bg-white shadow-sm transition-all hover:border-primary/50 hover:shadow-md h-full flex flex-col justify-between p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-navy group-hover:text-primary transition-colors">
              {acc.arabic_name}
            </h3>
            {!acc.is_active && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">مغلق</span>
            )}
          </div>
          <p className="text-xs text-text-secondary" dir="ltr">{acc.english_name || '-'}</p>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          acc.account_type === 'bank' ? 'bg-blue-100 text-blue-700' : 
          acc.account_type === 'cashbox' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {acc.account_type === 'bank' ? 'حساب بنكي' : 
           acc.account_type === 'cashbox' ? 'خزينة' : 
           acc.account_type === 'deposit' ? 'وديعة' : 'شهادة استثمار'}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border flex items-end justify-between">
        <span className="text-sm text-text-secondary">الرصيد الحالي</span>
        <span className={`text-xl font-bold ${Number(acc.current_balance) < 0 ? 'text-danger' : 'text-success-dark'}`} dir="ltr">
          {Number(acc.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.currency}
        </span>
      </div>
    </Link>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الخزينة والحسابات البنكية</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة أرصدة الشركة، الخزائن، والتحويلات الداخلية
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/company/treasury/transfers/new"
            className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-colors"
          >
            ← تحويل داخلي
          </Link>
          <Link
            href="/company/treasury/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 transition-colors"
          >
            + حساب جديد
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-text-secondary">إجمالي سيولة الشركة المباشرة</p>
          <p className="mt-2 text-3xl font-bold text-navy" dir="ltr">
            {totalCorpBal.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
           <p className="text-sm font-medium text-text-secondary">إجمالي عهد وخزائن المشاريع</p>
          <p className="mt-2 text-3xl font-bold text-secondary" dir="ltr">
            {totalProjBal.toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
           <p className="text-sm font-medium text-text-secondary">إجمالي الأرصدة الكلية</p>
          <p className="mt-2 text-3xl font-bold text-success-dark" dir="ltr">
            {(totalCorpBal + totalProjBal).toLocaleString(undefined, { minimumFractionDigits: 2 })} EGP
          </p>
        </div>
      </div>

      {/* Corporate Accounts */}
      <section>
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          حسابات الشركة الرئيسية
          <span className="text-sm font-normal text-text-secondary bg-background-secondary px-2 py-0.5 rounded-full">
            {corporateAccounts.length}
          </span>
        </h2>
        {corporateAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {corporateAccounts.map(acc => (
              <AccountCard key={acc.financial_account_id} acc={acc} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
            لا توجد حسابات رئيسية مسجلة.
          </div>
        )}
      </section>

      {/* Project Accounts */}
      <section>
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          خزائن المشاريع
          <span className="text-sm font-normal text-text-secondary bg-background-secondary px-2 py-0.5 rounded-full">
            {projectAccounts.length}
          </span>
        </h2>
        {projectAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projectAccounts.map(acc => (
              <AccountCard key={acc.financial_account_id} acc={acc} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
            لا توجد خزائن مشاريع مسجلة.
          </div>
        )}
      </section>

    </div>
  )
}
