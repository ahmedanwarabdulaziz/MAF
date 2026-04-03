'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
// PERF-03: drawer uses getWorkInboxData directly — getUserNotifications was running
// getWorkInboxData (10 queries) + system_notifications + merge/re-sort.
// The drawer is a quick-access preview that doesn't need persisted read-state.
import { getWorkInboxData } from '@/actions/work-inbox'
import { WorkInboxItem, WorkInboxPriority, TYPE_LABELS } from '@/lib/work-inbox-types'
import { useRouter } from 'next/navigation'

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  normal:   'bg-emerald-400',
}

// Groups for drawer display

const PRIORITY_ORDER: WorkInboxPriority[] = ['critical', 'high', 'normal']

const PRIORITY_DIVIDER_LABELS: Record<WorkInboxPriority, string> = {
  critical: '🔴 حرج',
  high:     '🟡 مرتفع',
  normal:   '🟢 عادي',
}

type Props = {
  onClose: () => void
}

export default function WorkInboxDrawer({ onClose }: Props) {
  const router = useRouter()
  const [items, setItems]     = useState<WorkInboxItem[] | null>(null)
  const [total, setTotal]     = useState(0)
  const [counts, setCounts]   = useState<Record<WorkInboxPriority, number>>({ critical: 0, high: 0, normal: 0 })
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false) // for slide-in animation
  const drawerRef             = useRef<HTMLDivElement>(null)

  // Lazy-load drawer contents only when opened
  const load = useCallback(async () => {
    try {
      // PERF-03: direct call — no system_notifications merge overhead
      const data = await getWorkInboxData()
      setItems(data.items.slice(0, 12)) // top 12 by priority
      setTotal(data.counts.total)
      setCounts({
        critical: data.counts.critical,
        high: data.counts.high,
        normal: data.counts.normal,
      })
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Slide-in animation trigger
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  // Escape key support
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = document.getElementById('inbox-topbar-button')
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        btn && !btn.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // PERF-03: dynamic inbox items have no persisted read-state — navigate to full view
    onClose()
    router.push('/company/critical-actions')
  }

  const handleItemClick = (_item: WorkInboxItem) => {
    // PERF-03: dynamic inbox items don't track read-state — just close and navigate
    onClose()
  }

  // Group items by priority for display
  const groupedItems = items
    ? PRIORITY_ORDER.map(p => ({
        priority: p,
        label: PRIORITY_DIVIDER_LABELS[p],
        items: items.filter(i => i.priority === p),
      })).filter(g => g.items.length > 0)
    : []

  // Priority summary string for header
  const prioritySummary = [
    counts.critical > 0 ? `${counts.critical} حرج` : null,
    counts.high > 0 ? `${counts.high} مرتفع` : null,
    counts.normal > 0 ? `${counts.normal} عادي` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      ref={drawerRef}
      className={`
        absolute left-4 top-14 z-50 w-80 rounded-2xl border border-border bg-white shadow-2xl overflow-hidden
        transition-all duration-200 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
      dir="rtl"
      role="dialog"
      aria-label="مركز العمل"
    >
      {/* Drawer Header */}
      <div className="flex flex-col bg-navy px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">⚡ إشعارات وإجراءات</span>
            {total > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {total}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-lg leading-none transition-colors"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
        {/* Priority summary */}
        {!loading && (
          <div className="flex items-center justify-between mt-1.5">
             <div className="text-[10px] text-white/60 font-medium">
               {total > 0 ? prioritySummary : ''}
             </div>
             {total > 0 && (
                <button onClick={handleMarkAllAsRead} className="text-[10px] text-primary-light hover:text-white transition-colors underline decoration-primary-light/30 underline-offset-2">
                  تحديد الكل كمقروء ✓
                </button>
             )}
          </div>
        )}
      </div>

      {/* Drawer Body */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 rounded-lg bg-background-secondary animate-pulse" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-secondary">
            <div className="text-3xl mb-2">✅</div>
            لا توجد بنود معلقة
          </div>
        ) : (
          <div>
            {groupedItems.map((group, gi) => (
              <div key={group.priority}>
                {/* Priority group header */}
                <div className="sticky top-0 px-4 py-1.5 bg-background-secondary/80 backdrop-blur-sm border-b border-border/40 text-[10px] font-bold text-text-secondary">
                  {group.label}
                </div>
                {/* Items in group */}
                <div className="divide-y divide-border/40">
                  {group.items.map(item => {
                    const isUnread = item.metadata?.is_read === false
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => handleItemClick(item)}
                        className={`group relative flex items-start gap-3 px-4 py-3 transition-colors ${isUnread ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-background-secondary/60'}`}
                      >
                         {/* Unread Indicator */}
                        {isUnread && (
                          <span className="absolute left-3 top-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}

                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority]}`} />
                        <div className="flex-1 min-w-0 pr-1">
                          <div className={`text-sm leading-snug truncate ${isUnread ? 'font-bold text-navy group-hover:text-primary' : 'font-semibold text-text-primary group-hover:text-primary'}`}>
                            {item.title}
                          </div>
                          <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                            <span>{TYPE_LABELS[item.type]}</span>
                            {item.projectCode && (
                              <>
                                <span className="text-border">·</span>
                                <span className="font-mono">{item.projectCode}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {item.ageDays != null && item.ageDays > 0 && (
                          <span className="text-[10px] text-text-secondary shrink-0 mt-1">
                            {item.ageDays}د
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 bg-background-secondary/40">
        <Link
          href="/company/critical-actions"
          onClick={onClose}
          className="block text-center text-sm font-semibold text-primary hover:underline"
        >
          عرض الكل ({total} بند) ←
        </Link>
      </div>
    </div>
  )
}
