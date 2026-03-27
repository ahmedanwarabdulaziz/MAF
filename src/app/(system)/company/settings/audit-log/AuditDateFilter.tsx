'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from '@/components/DatePicker'

interface Props {
  currentAction?: string
  currentUserId?: string
  currentPeriod: string
  currentDateFrom?: string
  currentDateTo?: string
}

export default function AuditDateFilter({
  currentAction,
  currentUserId,
  currentPeriod,
  currentDateFrom,
  currentDateTo,
}: Props) {
  const [dateFrom, setDateFrom] = useState(currentDateFrom ?? '')
  const [dateTo, setDateTo] = useState(currentDateTo ?? '')
  const router = useRouter()

  const apply = () => {
    const params = new URLSearchParams()
    if (currentAction)  params.set('action', currentAction)
    if (currentUserId)  params.set('user_id', currentUserId)
    params.set('period', 'custom')
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to', dateTo)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-white">
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
        onClick={apply}
        className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        تطبيق
      </button>
    </div>
  )
}
