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

export default function TxDateFilter({ currentPeriod, currentDateFrom, currentDateTo }: Props) {
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
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      {/* Period pills */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentPeriod === p.value
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-primary/10 hover:text-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {currentPeriod === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">من تاريخ</label>
            <DatePicker name="_date_from" value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">إلى تاريخ</label>
            <DatePicker name="_date_to" value={dateTo} onChange={setDateTo} />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            تطبيق
          </button>
        </div>
      )}
    </div>
  )
}
