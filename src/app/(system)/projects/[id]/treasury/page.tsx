import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getTreasuryAccounts } from '@/actions/treasury'
import { notFound } from 'next/navigation'

export const metadata = { title: 'خزائن المشروع' }

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  cashbox: { label: 'خزينة نقدية', icon: '💵', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  bank:    { label: 'حساب بنكي',   icon: '🏦', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  deposit: { label: 'وديعة',       icon: '📥', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export default async function ProjectTreasuryPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('arabic_name, project_code')
    .eq('id', params.id)
    .single()

  if (!project) notFound()

  const accounts = await getTreasuryAccounts(params.id)
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">خزائن وحسابات المشروع</h1>
          <p className="text-sm text-text-secondary mt-1">
            إدارة خزائن ومصادر التمويل النقدي لمشروع
            <span className="font-semibold text-primary mr-1">{project.arabic_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${params.id}/treasury/transfers`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            تحويل بين الخزائن
          </Link>
          <Link
            href={`/projects/${params.id}/treasury/new`}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            + خزينة جديدة
          </Link>
        </div>
      </div>

      {/* Total balance summary */}
      {accounts.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-primary/70 font-medium">إجمالي النقد المتاح في خزائن المشروع</p>
            <p className="mt-2 text-3xl font-black text-primary dir-ltr">
              {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
            </p>
          </div>
          <div className="text-4xl opacity-30">🏛️</div>
        </div>
      )}

      {/* Accounts grid */}
      {accounts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-background-secondary/50 py-16 text-center">
          <div className="text-5xl mb-4">🏦</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">لا توجد خزائن لهذا المشروع</h3>
          <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
            أنشئ خزينة نقدية أو حساباً بنكياً مخصصاً لهذا المشروع لتتمكن من صرف الدفعات وتتبع التدفق النقدي.
          </p>
          <Link
            href={`/projects/${params.id}/treasury/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            + إنشاء خزينة المشروع
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc: any) => {
            const typeInfo = ACCOUNT_TYPE_LABELS[acc.account_type] || { label: acc.account_type, icon: '💰', color: 'bg-gray-50 text-gray-700 border-gray-200' }
            const balance = Number(acc.current_balance || 0)
            const isLow = balance < 1000
            return (
              <Link
                key={acc.financial_account_id}
                href={`/company/treasury/${acc.financial_account_id}`}
                className="group block rounded-xl border border-border bg-white shadow-sm hover:border-primary/30 hover:shadow-md transition-all p-5 space-y-4"
              >
                {/* Type badge + name */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${typeInfo.color}`}>
                      <span>{typeInfo.icon}</span>
                      {typeInfo.label}
                    </span>
                    <h3 className="mt-2 text-base font-bold text-text-primary group-hover:text-primary transition-colors">
                      {acc.arabic_name}
                    </h3>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${acc.is_active ? 'bg-emerald-400' : 'bg-gray-300'}`} title={acc.is_active ? 'نشط' : 'معطّل'} />
                </div>

                {/* Balance */}
                <div className={`rounded-lg px-4 py-3 ${isLow ? 'bg-red-50 border border-red-200' : 'bg-background-secondary'}`}>
                  <p className="text-xs text-text-secondary mb-1">الرصيد الحالي</p>
                  <p className={`text-xl font-black dir-ltr ${isLow ? 'text-red-600' : 'text-text-primary'}`}>
                    {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                  </p>
                  {isLow && balance > 0 && (
                    <p className="text-xs text-red-500 mt-1">⚠️ رصيد منخفض</p>
                  )}
                  {balance === 0 && (
                    <p className="text-xs text-text-secondary mt-1">لا توجد حركات مسجلة بعد</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>عرض الحركات والكشف</span>
                  <span className="group-hover:translate-x-[-4px] transition-transform">←</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Tip */}
      {accounts.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 flex gap-2">
          <span className="shrink-0">💡</span>
          <span>
            لصرف دفعة من هذه الخزائن، اذهب إلى <strong>سندات الصرف</strong>. لإيداع مبالغ في الخزينة، افتح الحساب واختر "إيداع يدوي".
          </span>
        </div>
      )}
    </div>
  )
}
