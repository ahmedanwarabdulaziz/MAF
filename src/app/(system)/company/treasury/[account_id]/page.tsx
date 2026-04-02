import Link from 'next/link'
import { getAccountDetails, getAccountTransactions } from '@/actions/treasury'
import { notFound } from 'next/navigation'
import TxDateFilter from './TxDateFilter'
import AttachmentsViewer from '@/components/AttachmentsViewer'

export const metadata = {
  title: 'حصة الخزينة | نظام إدارة المقاولات'
}

const PERIODS = ['this_month', 'last_90', 'this_year', 'all', 'custom']

function parseDateInput(val: string | undefined): Date | null {
  if (!val) return null
  const dmyMatch = val.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`)
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function getDateRange(period: string, dateFrom?: string, dateTo?: string): { from?: string; to?: string } {
  const now = new Date()
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'last_90') {
    const start = new Date(now); start.setDate(start.getDate() - 90)
    return { from: start.toISOString() }
  }
  if (period === 'this_year') {
    return { from: new Date(now.getFullYear(), 0, 1).toISOString() }
  }
  if (period === 'custom') {
    const fromD = parseDateInput(dateFrom)
    const toD   = parseDateInput(dateTo)
    if (toD) toD.setHours(23, 59, 59)
    return { from: fromD?.toISOString(), to: toD?.toISOString() }
  }
  return {}
}

export default async function TreasuryAccountDetailPage({
  params,
  searchParams,
}: {
  params: { account_id: string }
  searchParams: { period?: string; date_from?: string; date_to?: string }
}) {
  const account = await getAccountDetails(params.account_id)
  if (!account) notFound()

  const period    = PERIODS.includes(searchParams.period ?? '') ? (searchParams.period ?? 'this_month') : 'this_month'
  const dateRange = getDateRange(period, searchParams.date_from, searchParams.date_to)

  const allTransactions = await getAccountTransactions(params.account_id)

  // Filter client-side by date range
  const transactions = allTransactions?.filter((tx: any) => {
    const txDate = new Date(tx.transaction_date)
    if (dateRange.from && txDate < new Date(dateRange.from)) return false
    if (dateRange.to   && txDate > new Date(dateRange.to))   return false
    return true
  }) ?? []

  const accountTypeMap: Record<string, string> = {
    bank: 'حساب بنكي', cashbox: 'خزينة مستقلة',
    deposit: 'وديعة آجل', certificate: 'شهادة استثمار'
  }

  const getReferenceLabel = (tx: any) => {
    switch (tx.reference_type) {
      case 'payment_voucher':   return 'سند صرف رقم ' + (tx.reference_id?.split('-')[0].toUpperCase() || 'مجهول')
      case 'owner_collection':  return 'تحصيل مالك'
      case 'transfer_in':       return 'تحويل وارد'
      case 'transfer_out':      return 'تحويل صادر'
      case 'manual_adjustment': return 'تسوية جردية'
      case 'opening_balance':   return 'رصيد افتتاحي'
      default:                  return tx.reference_type
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary">الخزينة والحسابات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{account.arabic_name}</span>
      </div>

      {/* Header Info Box */}
      <div className="rounded-xl border border-border bg-white shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">{account.arabic_name}</h1>
          <p className="mt-1 text-sm text-text-secondary" dir="ltr">{account.english_name || '-'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-background-secondary px-3 py-1 text-xs font-medium text-text-secondary">
              {accountTypeMap[account.account_type] || account.account_type}
            </span>
            {account.project_id && (
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                يتبع مشروع: {(account as any).project?.arabic_name}
              </span>
            )}
            {!account.project_id && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">حساب مركزي للشركة</span>
            )}
            {!account.is_active && (
              <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">مغلق</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            {!account.project_id && (
              <Link
                href={`/company/treasury/${params.account_id}/deposit`}
                className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors"
              >
                + إيداع
              </Link>
            )}
            <Link
              href={`/company/treasury/${params.account_id}/edit`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary hover:text-primary transition-colors"
            >
              ✏️ تعديل
            </Link>
          </div>
          <div className="text-left bg-background-secondary/50 rounded-lg p-6 border border-border min-w-[250px]">
            <p className="text-sm font-medium text-text-secondary mb-1">الرصيد الدفتري الحالي</p>
            <p className={`text-3xl font-bold ${Number(account.current_balance) < 0 ? 'text-danger' : 'text-success-dark'}`} dir="ltr">
              {Number(account.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg">{account.currency}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-background-secondary px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">العمليات والحركات المالية</h2>
            <span className="text-xs text-text-secondary">{transactions.length} حركة</span>
          </div>
          <TxDateFilter
            currentPeriod={period}
            currentDateFrom={searchParams.date_from}
            currentDateTo={searchParams.date_to}
          />
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">لا توجد حركات في هذه الفترة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-background-secondary text-text-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-right">تاريخ الحركة</th>
                  <th className="px-6 py-4 font-semibold text-right">النوع</th>
                  <th className="px-6 py-4 font-semibold text-right">القيمة ({account.currency})</th>
                  <th className="px-6 py-4 font-semibold text-right">المستند المرجعي</th>
                  <th className="px-6 py-4 font-semibold text-right">الجهة / المستفيد</th>
                  {!account.project_id && (
                    <th className="px-6 py-4 font-semibold text-right">المشروع</th>
                  )}
                  <th className="px-3 py-4 font-semibold text-right" colSpan={2}>البيان / ملاحظات</th>
                  <th className="px-6 py-4 font-semibold text-right">بواسطة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-background-secondary/50 transition-colors">
                    <td className="px-6 py-4 text-text-secondary" dir="ltr">{tx.transaction_date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tx.transaction_type === 'deposit' ? 'bg-success/10 text-success-dark' : 'bg-danger/10 text-danger'
                      }`}>
                        {tx.transaction_type === 'deposit' ? 'إيداع / وارد' : 'سحب / صادر'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold" dir="ltr">
                      <span className={tx.transaction_type === 'deposit' ? 'text-success-dark' : 'text-danger'}>
                        {tx.transaction_type === 'deposit' ? '+' : '-'}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-primary font-medium w-40">{getReferenceLabel(tx)}</td>
                    <td className="px-6 py-4 font-medium text-navy min-w-[140px] max-w-[200px] leading-relaxed">
                      {tx.counterpart_name || '-'}
                    </td>
                    
                    {!account.project_id && (
                      <td className="px-6 py-4 min-w-[150px]">
                        {tx.project_id ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-navy/5 text-navy text-xs font-semibold">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
                            {tx.project?.arabic_name || 'مشروع محذوف'}
                          </span>
                        ) : (
                          <span className="text-text-secondary text-xs">-</span>
                        )}
                      </td>
                    )}

                    <td className="px-3 py-4 text-text-primary whitespace-normal break-words leading-relaxed max-w-[280px]">
                      {tx.notes || '-'}
                    </td>
                    <td className="px-3 py-4 text-left">
                      {tx.attachment_urls && tx.attachment_urls.length > 0 && (
                        <div className="-ml-2">
                          <AttachmentsViewer urls={tx.attachment_urls} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary whitespace-nowrap">{tx.created_by_user?.display_name || 'System'}</td>
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
