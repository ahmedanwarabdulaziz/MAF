'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
}

export default function LedgerFilterBar({ currentPeriod, currentDateFrom, currentDateTo }: Props) {
  const [dateFrom, setDateFrom] = useState(currentDateFrom ?? '')
  const [dateTo, setDateTo]     = useState(currentDateTo ?? '')
  const router = useRouter()

  const setPeriod = (p: string) => {
    router.push(`?period=${p}`)
  }

  const applyCustom = () => {
    const params = new URLSearchParams()
    params.set('period', 'custom')
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to', dateTo)
    // Keep URL base intact, just change query params
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-3 mb-6 bg-white p-4 rounded-xl border shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">تصفية التقرير الزمني</h3>
      </div>
      {/* Period pills */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors border ${
              currentPeriod === p.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-500 border-transparent hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {currentPeriod === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">من تاريخ</label>
            <DatePicker name="_date_from" value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">إلى تاريخ</label>
            <DatePicker name="_date_to" value={dateTo} onChange={setDateTo} />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            تطبيق الفلتر
          </button>
        </div>
      )}
    </div>
  )
}
