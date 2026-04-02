'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getWorkInboxData } from '@/actions/work-inbox'
import { WorkInboxItem, WorkInboxData, TYPE_LABELS, PRIORITY_LABELS } from '@/lib/work-inbox-types'

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  normal:   'bg-emerald-400',
}

const PRIORITY_BG: Record<string, string> = {
  critical: 'bg-red-50 border-red-200',
  high:     'bg-amber-50 border-amber-200',
  normal:   'bg-emerald-50 border-emerald-200',
}

type Props = {
  projectId: string
}

export default function ProjectWorkInbox({ projectId }: Props) {
  const [data, setData]       = useState<WorkInboxData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await getWorkInboxData(projectId)
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId])

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden" dir="rtl">
        <div className="px-6 py-4 border-b border-border bg-background-secondary/50 flex items-center gap-2">
          <div className="h-4 w-32 bg-background-secondary rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg bg-background-secondary animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // No data or empty
  if (!data || data.counts.total === 0) {
    return (
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden" dir="rtl">
        <div className="px-6 py-4 border-b border-border bg-background-secondary/50">
          <h3 className="font-bold text-navy flex items-center gap-2 text-sm">
            <span>⚡</span> إجراءات المشروع المعلقة
          </h3>
        </div>
        <div className="py-8 text-center text-sm text-text-secondary">
          <div className="text-2xl mb-1">✅</div>
          لا توجد بنود معلقة لهذا المشروع
        </div>
      </div>
    )
  }

  const topItems = data.items.slice(0, 5)

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-background-secondary/50 flex items-center justify-between">
        <h3 className="font-bold text-navy flex items-center gap-2 text-sm">
          <span>⚡</span> إجراءات المشروع المعلقة
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {data.counts.total}
          </span>
        </h3>
        <Link
          href="/company/critical-actions"
          className="text-xs font-semibold text-primary hover:underline"
        >
          عرض الكل ←
        </Link>
      </div>

      {/* Mini KPI strip */}
      <div className="flex gap-2 px-4 py-3 border-b border-border/50 bg-white">
        {data.counts.critical > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">
            🔴 {data.counts.critical} حرج
          </span>
        )}
        {data.counts.high > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
            🟡 {data.counts.high} مرتفع
          </span>
        )}
        {data.counts.normal > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
            🟢 {data.counts.normal} عادي
          </span>
        )}
      </div>

      {/* Items list */}
      <div className="divide-y divide-border/60">
        {topItems.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 px-5 py-3 hover:bg-background-secondary/60 transition-colors group"
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority]}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors">
                {item.title}
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5 flex items-center gap-1.5">
                <span>{TYPE_LABELS[item.type]}</span>
                {item.ageDays != null && item.ageDays > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>منذ {item.ageDays} {item.ageDays === 1 ? 'يوم' : 'أيام'}</span>
                  </>
                )}
              </div>
            </div>
            {item.amount != null && (
              <span className="text-[11px] font-bold text-navy shrink-0" dir="ltr">
                {item.amount.toLocaleString('ar-EG')} ج.م
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Footer — if more items exist */}
      {data.counts.total > 5 && (
        <div className="border-t border-border px-4 py-2.5 bg-background-secondary/30 text-center">
          <Link
            href="/company/critical-actions"
            className="text-xs font-semibold text-primary hover:underline"
          >
            +{data.counts.total - 5} بنود أخرى — عرض الكل
          </Link>
        </div>
      )}
    </div>
  )
}
