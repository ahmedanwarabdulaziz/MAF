import Link from 'next/link'
import { getAllGlobalTransactions } from '@/actions/treasury'
import TxDateFilter from '../[account_id]/TxDateFilter'
import AttachmentsViewer from '@/components/AttachmentsViewer'
import ViewReferenceModal from '../[account_id]/ViewReferenceModal'
import ColumnFilter from '../[account_id]/ColumnFilter'

export const metadata = {
  title: 'كل حركة الخزائن العام | نظام إدارة المقاولات'
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

export default async function TreasuryAllTransactionsPage({
  searchParams,
}: {
  searchParams: { period?: string; date_from?: string; date_to?: string; query?: string; sort?: string; project?: string; counterpart?: string; user?: string; accountId?: string; }
}) {
  const period    = PERIODS.includes(searchParams.period ?? '') ? (searchParams.period ?? 'this_month') : 'this_month'
  const dateRange = getDateRange(period, searchParams.date_from, searchParams.date_to)
  const query     = (searchParams.query || '').trim().toLowerCase()
  const sortBy    = searchParams.sort || 'created_at_desc'
  const filterProject = searchParams.project || null
  const filterCounterpart = searchParams.counterpart || null
  const filterUser = searchParams.user || null
  const filterAccount = searchParams.accountId || null

  const allTransactions = await getAllGlobalTransactions()

  const rawProjects = allTransactions?.map((t: any) => ({ id: t.project_id || 'none', name: t.project?.arabic_name || 'الشركة الرئيسية' })) || []
  const uniqueProjects = Array.from(new Map(rawProjects.map((p: any) => [p.id, { label: p.name, value: p.id }])).values())

  const rawCounterparts = allTransactions?.map((t: any) => t.counterpart_name).filter(Boolean) || []
  const uniqueCounterparts = Array.from(new Set(rawCounterparts)).map((c: any) => ({ label: c, value: c }))

  const rawUsers = allTransactions?.map((t: any) => ({ id: t.created_by, name: t.created_by_user?.display_name })) || []
  const uniqueUsers = Array.from(new Map(rawUsers.filter((u: any) => u.id).map((u: any) => [u.id, { label: u.name || 'System', value: u.id }])).values())

  const rawAccounts = allTransactions?.map((t: any) => ({ id: t.financial_account_id, name: t.financial_account?.arabic_name })) || []
  const uniqueAccounts = Array.from(new Map(rawAccounts.filter((a: any) => a.id).map((a: any) => [a.id, { label: a.name || 'حساب غير معروف', value: a.id }])).values())

  // Filter client-side by date range, search query, column exact matches, and guarantee strict sorting
  const transactions = allTransactions?.filter((tx: any) => {
    // 1. Date Filter (using transaction_date)
    if (dateRange.from && new Date(tx.transaction_date) < new Date(dateRange.from)) return false
    if (dateRange.to   && new Date(tx.transaction_date) > new Date(dateRange.to))   return false
    
    // 2. Text Search Filter (Global)
    if (query) {
      const matchProject     = tx.project?.arabic_name?.toLowerCase().includes(query) || (!tx.project_id && 'الشركة الرئيسية'.includes(query))
      const matchCounterpart = tx.counterpart_name?.toLowerCase().includes(query)
      const matchNotes       = tx.notes?.toLowerCase().includes(query)
      const matchAccount     = tx.financial_account?.arabic_name?.toLowerCase().includes(query)
      if (!matchProject && !matchCounterpart && !matchNotes && !matchAccount) return false
    }

    // 3. Exact Column Filters
    if (filterProject === 'none' && tx.project_id) return false
    if (filterProject && filterProject !== 'none' && tx.project_id !== filterProject) return false
    if (filterCounterpart && tx.counterpart_name !== filterCounterpart) return false
    if (filterUser && tx.created_by !== filterUser) return false
    if (filterAccount && tx.financial_account_id !== filterAccount) return false

    return true
  }).sort((a: any, b: any) => {
    if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount)
    if (sortBy === 'amount_asc')  return Number(a.amount) - Number(b.amount)
    if (sortBy === 'date_desc')   return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    if (sortBy === 'date_asc')    return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    if (sortBy === 'created_at_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    // default: created_at_desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }) ?? []

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
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          الخزينة والحسابات
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-navy font-bold">سجل حركة الخزائن العام</span>
      </div>

      {/* Header Info Box */}
      <div className="rounded-2xl border border-border bg-white shadow-md p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-navy tracking-tight">سجل الحركات المالية الموحد</h1>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1" dir="ltr">GLOBAL TREASURY REGISTRY</p>
          
          <div className="mt-6 flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-100 px-4 py-2">
               <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <span className="text-sm font-bold text-purple-800">يظهر جميع العمليات من مختلف الخزائن والعهد البنكية ومشاريع المنظمة</span>
             </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-border bg-white shadow-md overflow-hidden flex flex-col mt-4">
        <div className="border-b border-border bg-gradient-to-r from-background-secondary/50 to-white px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-navy flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </span>
              سجل الحركات الشامل
            </h2>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-border shadow-sm">
            <div className="px-4 border-l border-border last:border-0 pl-6">
               <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">إجمالي الحركات المعروضة</span>
               <span className="block text-xl font-black text-navy">{transactions.length}</span>
            </div>
            <div className="pr-2">
              <TxDateFilter 
              currentPeriod={period} 
              currentDateFrom={searchParams.date_from} 
              currentDateTo={searchParams.date_to} 
              currentSearch={query}
              currentSort={sortBy}
            />
            </div>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mb-6">
               <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            </div>
            <p className="text-xl font-bold text-navy mb-1">لا توجد حركات في هذه الفترة</p>
            <p className="text-sm text-text-secondary">قم بتغيير نطاق التاريخ للبحث عن حركات وتفاصيل أخرى.</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm text-right whitespace-nowrap">
              <thead className="bg-[#f8fafc] text-slate-500 border-b border-border sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <Link href={`?${new URLSearchParams({...searchParams as any, sort: sortBy === 'date_desc' ? 'date_asc' : 'date_desc'}).toString()}`} className="flex items-center gap-1.5 hover:text-navy transition-colors">
                      تاريخ ووقت الحركة
                      <div className={`flex flex-col -space-y-1 opacity-60 ${sortBy?.includes('date') ? 'opacity-100 text-navy' : ''}`}>
                        <svg className={`w-3 h-3 ${sortBy === 'date_asc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        <svg className={`w-3 h-3 ${sortBy === 'date_desc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </Link>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <Link href={`?${new URLSearchParams({...searchParams as any, sort: sortBy === 'created_at_desc' ? 'created_at_asc' : 'created_at_desc'}).toString()}`} className="flex items-center gap-1.5 hover:text-navy transition-colors">
                      تاريخ ووقت التسجيل
                      <div className={`flex flex-col -space-y-1 opacity-60 ${sortBy?.includes('created_at') ? 'opacity-100 text-navy' : ''}`}>
                        <svg className={`w-3 h-3 ${sortBy === 'created_at_asc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        <svg className={`w-3 h-3 ${sortBy === 'created_at_desc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </Link>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">النوع</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <Link href={`?${new URLSearchParams({...searchParams as any, sort: sortBy === 'amount_desc' ? 'amount_asc' : 'amount_desc'}).toString()}`} className="flex items-center justify-end gap-1.5 hover:text-navy transition-colors">
                      القيمة
                      <div className={`flex flex-col -space-y-1 opacity-60 ${sortBy?.includes('amount') ? 'opacity-100 text-navy' : ''}`}>
                        <svg className={`w-3 h-3 ${sortBy === 'amount_asc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        <svg className={`w-3 h-3 ${sortBy === 'amount_desc' ? 'text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </Link>
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <ColumnFilter title="الحساب" columnKey="accountId" options={uniqueAccounts} currentValue={filterAccount || undefined} />
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <ColumnFilter title="المشروع" columnKey="project" options={uniqueProjects} currentValue={filterProject || undefined} />
                  </th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">المرجع</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <ColumnFilter title="الجهة" columnKey="counterpart" options={uniqueCounterparts} currentValue={filterCounterpart || undefined} />
                  </th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-xs">البيان</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-xs">المرفقات</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right text-xs">
                    <ColumnFilter title="المستخدم" columnKey="user" options={uniqueUsers} currentValue={filterUser || undefined} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {transactions.map((tx: any, idx: number) => (
                  <tr key={tx.id} className="hover:bg-blue-50/30 transition-all duration-200 group">
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-1 text-right" dir="ltr">
                        <span className="font-bold text-navy text-sm tabular-nums w-full text-right">
                          {tx.transaction_date}
                        </span>
                        <span className="text-xs text-slate-500 font-bold tabular-nums w-full text-right">
                          {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-1 text-right" dir="ltr">
                        <span className="font-bold text-navy text-sm tabular-nums w-full text-right">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-slate-500 font-bold tabular-nums w-full text-right">
                          {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className={`font-black text-sm tracking-wide ${
                        tx.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {tx.transaction_type === 'deposit' ? 'إيداع' : 'سحب'}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center justify-end gap-1 font-bold text-[15px] tabular-nums" dir="ltr">
                        <span className={`font-black ${tx.transaction_type === 'deposit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {tx.transaction_type === 'deposit' ? '+' : '-'}
                        </span>
                        <span className={`tracking-tight font-black ${tx.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <Link href={`/company/treasury/${tx.financial_account_id}`} className="font-bold text-primary hover:text-navy underline-offset-4 hover:underline transition-colors flex items-center gap-1.5">
                        <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        {tx.financial_account?.arabic_name || 'حساب غير معروف'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      {tx.project_id ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-sm" title={tx.project?.arabic_name || 'مشروع محذوف'}>
                          <span className="max-w-[110px] truncate">{tx.project?.arabic_name || 'مشروع محذوف'}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          الشركة الرئيسية
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <ViewReferenceModal tx={tx} label={getReferenceLabel(tx)} />
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="font-bold text-navy max-w-[150px] truncate" title={tx.counterpart_name || ''}>
                        {tx.counterpart_name || <span className="text-slate-300 font-medium">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle whitespace-normal min-w-[200px]">
                      <p className="text-[11px] text-slate-600 font-bold leading-relaxed whitespace-pre-wrap break-words" title={tx.notes || ''}>
                        {tx.notes || <span className="text-slate-300">-</span>}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      {tx.attachment_urls && tx.attachment_urls.length > 0 ? (
                        <div className="flex items-center justify-end transform transition-transform group-hover:scale-105">
                          <AttachmentsViewer urls={tx.attachment_urls} />
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-2">
                         <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold">
                           {(tx.created_by_user?.display_name || 'S')[0].toUpperCase()}
                         </div>
                         <span className="text-xs font-bold text-slate-600 truncate max-w-[80px]">
                            {tx.created_by_user?.display_name || 'System'}
                         </span>
                      </div>
                    </td>
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
