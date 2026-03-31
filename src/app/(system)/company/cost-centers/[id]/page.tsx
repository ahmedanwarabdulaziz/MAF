import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCostCenterLedger } from '@/actions/cost_center_reports'
import LedgerFilterBar from './LedgerFilterBar'
import { formatDate } from '@/lib/format'

export const metadata = {
  title: 'كشف حساب مركز התكلفة | نظام إدارة المقاولات'
}

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
    if (toD) toD.setHours(23, 59, 59, 999)
    return { from: fromD?.toISOString(), to: toD?.toISOString() }
  }
  return {}
}

const TYPE_LABELS: Record<string, { label: string, color: string }> = {
  petty_expense:    { label: 'مصروف نثري', color: 'bg-orange-100 text-orange-700' },
  purchase_invoice: { label: 'فاتورة مشتريات', color: 'bg-blue-100 text-blue-700' },
  store_issue:      { label: 'إذن صرف داخلي', color: 'bg-purple-100 text-purple-700' },
}

export default async function CostCenterLedgerPage({ params, searchParams }: { params: { id: string }, searchParams: { period?: string; date_from?: string; date_to?: string } }) {
  const supabase = createClient()
  
  const { data: costCenter } = await supabase
    .from('cost_centers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!costCenter) {
    notFound()
  }

  const period = ['this_month', 'last_90', 'this_year', 'all', 'custom'].includes(searchParams.period ?? '') 
    ? (searchParams.period ?? 'all') 
    : 'all'
    
  const dateRange = getDateRange(period, searchParams.date_from, searchParams.date_to)

  const { entries, kpis } = await getCostCenterLedger(costCenter.id, {
    date_from: dateRange.from,
    date_to: dateRange.to
  })

  const formatEGP = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <div className="p-6 space-y-6" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center space-x-4 space-x-reverse mb-2">
        <Link
          href={`/company/cost-centers`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-gray-100 h-9 w-9 text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">كشف حساب: {costCenter.arabic_name}</h1>
          <p className="text-sm text-gray-500 mt-1">كود المركز: {costCenter.cost_center_code}</p>
        </div>
      </div>

      {/* Filter */}
      <LedgerFilterBar 
        currentPeriod={period}
        currentDateFrom={searchParams.date_from}
        currentDateTo={searchParams.date_to}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
            <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي مشتريات (فواتير)</p>
            <p className="text-2xl font-bold text-gray-900" dir="ltr">
                <span className="text-sm text-gray-400 font-normal mr-1">EGP</span> 
                {formatEGP(kpis.total_purchases)}
            </p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-orange-500"></div>
            <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي مصروفات نثرية</p>
            <p className="text-2xl font-bold text-gray-900" dir="ltr">
                <span className="text-sm text-gray-400 font-normal mr-1">EGP</span> 
                {formatEGP(kpis.total_petty)}
            </p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>
            <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي صرف مخزني داخلي</p>
            <p className="text-2xl font-bold text-gray-900" dir="ltr">
                <span className="text-sm text-gray-400 font-normal mr-1">EGP</span> 
                {formatEGP(kpis.total_issues)}
            </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-green-500"></div>
            <p className="text-xs text-gray-400 font-semibold mb-1">إجمالي تكاليف المركز كاملة</p>
            <p className="text-3xl font-black text-white" dir="ltr">
                <span className="text-sm text-gray-500 font-normal mr-1">EGP</span> 
                {formatEGP(kpis.total_all)}
            </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-6">
        {entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 mx-auto mb-3 opacity-50"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p className="text-lg font-semibold">لا يوجد حركات مالية</p>
            <p className="text-sm mt-1">لم يتم تسجيل أي مصاريف أو مشتريات على هذا التبويب في هذه الفترة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-5 py-4 font-semibold w-32">التاريخ</th>
                  <th className="px-5 py-4 font-semibold">المستند</th>
                  <th className="px-5 py-4 font-semibold">النوع</th>
                  <th className="px-5 py-4 font-semibold">البيان</th>
                  <th className="px-5 py-4 font-semibold">الجهة / المدخل</th>
                  <th className="px-5 py-4 font-semibold text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => {
                  const typeInfo = TYPE_LABELS[entry.source] || { label: entry.source, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={`${entry.id}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900 font-mono text-xs">
                        {entry.document_no}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-700 max-w-xs truncate" title={entry.description}>
                        {entry.description}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {entry.party_name}
                      </td>
                      <td className="px-5 py-4 text-left font-bold text-gray-900" dir="ltr">
                        {formatEGP(entry.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
