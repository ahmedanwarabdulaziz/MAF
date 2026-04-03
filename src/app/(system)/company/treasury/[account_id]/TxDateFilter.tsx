'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DatePicker from '@/components/DatePicker'

const PERIODS = [
  { value: 'this_month', label: 'هذا الشهر' },
  { value: 'last_90',    label: 'آخر 90 يوم' },
  { value: 'this_year',  label: 'هذا العام' },
  { value: 'all',        label: 'الكل' },
  { value: 'custom',     label: 'نطاق مخصص' },
]

interface Props {
  currentPeriod: string
  currentDateFrom?: string
  currentDateTo?: string
  currentSearch?: string
  currentSort?: string
}

export default function TxDateFilter({ currentPeriod, currentDateFrom, currentDateTo, currentSearch, currentSort }: Props) {
  const [dateFrom, setDateFrom] = useState(currentDateFrom ?? '')
  const [dateTo, setDateTo]     = useState(currentDateTo ?? '')
  const [query, setQuery]       = useState(currentSearch ?? '')
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v.trim() === '') params.delete(k)
      else params.set(k, v)
    })
    router.push(`?${params.toString()}`)
  }

  const setPeriod = (p: string) => {
    if (p === 'custom') {
      updateParams({ period: 'custom' })
    } else {
      updateParams({ period: p, date_from: null, date_to: null })
    }
  }

  const applyCustom = () => {
    updateParams({ period: 'custom', date_from: dateFrom || null, date_to: dateTo || null })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ query })
  }

  const hasActiveFilters = 
    searchParams.has('query') || 
    searchParams.has('project') || 
    searchParams.has('user') || 
    searchParams.has('counterpart') || 
    currentPeriod !== 'this_month' || 
    searchParams.has('sort')

  const clearAllFilters = () => {
    setQuery('')
    router.push('?')
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Period pills */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition-all ${
                currentPeriod === p.value
                  ? 'bg-navy text-white shadow-sm ring-2 ring-navy/20'
                  : 'bg-slate-100 text-slate-500 hover:bg-navy/10 hover:text-navy border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search and Sort Toolbar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full xl:w-auto">
           <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
             <input 
               type="text" 
               placeholder="بحث بالمشروع، الجهة، أو البيان..." 
               value={query}
               onChange={e => setQuery(e.target.value)}
               className="w-full pl-4 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-slate-400 font-medium transition-all"
             />
             <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                 <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
               </svg>
             </div>
             {query && (
               <button type="button" onClick={() => { setQuery(''); updateParams({ query: null }); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
               </button>
             )}
           </form>

           {hasActiveFilters && (
             <button 
               type="button" 
               onClick={clearAllFilters}
               className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors whitespace-nowrap border border-rose-100"
               title="حذف جميع التصفية"
             >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
               مسح الفلاتر
             </button>
           )}
        </div>
      </div>

      {/* Custom range */}
      {currentPeriod === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">من تاريخ (حركة)</label>
            <DatePicker name="_date_from" value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">إلى تاريخ (حركة)</label>
            <DatePicker name="_date_to" value={dateTo} onChange={setDateTo} />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            تطبيق النطاق
          </button>
        </div>
      )}
    </div>
  )
}
