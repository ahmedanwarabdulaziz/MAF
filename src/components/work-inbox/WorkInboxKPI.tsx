'use client'

import { useState, useEffect, useRef } from 'react'
import { WorkInboxData } from '@/lib/work-inbox-types'

type Props = {
  counts: WorkInboxData['counts']
}

const KPI_LIST = [
  {
    key:    'total' as const,
    label:  'إجمالي البنود المعلقة',
    icon:   '📋',
    style:  { bg: 'bg-navy/5', border: 'border-navy/15', text: 'text-navy', num: 'text-navy' },
  },
  {
    key:    'critical' as const,
    label:  'حرج (14+ يوم)',
    icon:   '🔴',
    style:  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', num: 'text-red-600' },
  },
  {
    key:    'high' as const,
    label:  'مرتفع (7-13 يوم)',
    icon:   '🟡',
    style:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', num: 'text-amber-600' },
  },
  {
    key:    'normal' as const,
    label:  'عادي (0-6 أيام)',
    icon:   '🟢',
    style:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', num: 'text-emerald-600' },
  },
]

// Simple count-up hook
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === 0) {
      setValue(0)
      return
    }
    const startVal = prevTarget.current
    prevTarget.current = target

    const startTime = performance.now()
    let rafId: number

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (target - startVal) * eased)
      setValue(current)
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])

  return value
}

function KPICard({ kpi, value }: { kpi: typeof KPI_LIST[number], value: number }) {
  const animated = useCountUp(value)

  return (
    <div
      className={`
        flex flex-col gap-1.5 rounded-xl border px-5 py-4
        transition-all duration-300
        hover:shadow-md hover:-translate-y-0.5
        ${kpi.style.bg} ${kpi.style.border}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{kpi.icon}</span>
        <span className={`text-xs font-semibold ${kpi.style.text}`}>{kpi.label}</span>
      </div>
      <div className={`text-3xl font-black ${kpi.style.num} tabular-nums`}>
        {animated}
      </div>
    </div>
  )
}

export default function WorkInboxKPI({ counts }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" dir="rtl">
      {KPI_LIST.map(kpi => (
        <KPICard key={kpi.key} kpi={kpi} value={counts[kpi.key]} />
      ))}
    </div>
  )
}
