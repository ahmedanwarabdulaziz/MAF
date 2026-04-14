'use client'

import Link from 'next/link'
import { WorkInboxItem, PRIORITY_LABELS, TYPE_LABELS } from '@/lib/work-inbox-types'
import { markNotificationAsRead } from '@/actions/notifications'

// Priority styling map
const PRIORITY_STYLES = {
  critical: {
    border:  'border-red-300',
    badge:   'bg-red-100 text-red-700',
    dot:     'bg-red-500',
    glow:    'shadow-red-100',
    age:     'text-red-600 font-semibold',
    ring:    'hover:ring-red-200',
  },
  high: {
    border:  'border-amber-300',
    badge:   'bg-amber-100 text-amber-700',
    dot:     'bg-amber-500',
    glow:    'shadow-amber-50',
    age:     'text-amber-600 font-semibold',
    ring:    'hover:ring-amber-200',
  },
  normal: {
    border:  'border-border',
    badge:   'bg-slate-100 text-slate-600',
    dot:     'bg-slate-400',
    glow:    '',
    age:     'text-text-secondary',
    ring:    'hover:ring-slate-200',
  },
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  item: WorkInboxItem
  onDialogOpen?: (item: WorkInboxItem) => void
}

export default function WorkInboxCard({ item, onDialogOpen }: Props) {
  const style = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES['normal']
  const typeLabel = TYPE_LABELS[item.type] || 'إشعار نظام'
  const isUnread = item.metadata?.is_read === false

  const handleClick = (e: React.MouseEvent) => {
    // If it's a real DB notification from system_notifications (has UUID) and is unread
    if (isUnread && UUID_REGEX.test(item.id)) {
      markNotificationAsRead(item.id).catch(console.error)
    }

    if (item.dialogKey && onDialogOpen) {
      e.preventDefault()
      onDialogOpen(item)
    }
  }

  return (
    <Link
      href={item.href}
      onClick={handleClick}
      className={`
        group relative flex flex-col gap-2 rounded-xl border p-4
        shadow-sm transition-all duration-200 ease-out
        hover:shadow-lg hover:-translate-y-1 hover:ring-2
        active:translate-y-0 active:shadow-sm
        ${style.border} ${style.glow} ${style.ring}
        ${isUnread ? 'bg-blue-50/20' : 'bg-white'}
      `}
      dir="rtl"
    >
      {/* Unread Indicator */}
      {isUnread && (
        <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      )}

      {/* Top row — type badge + priority dot */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot} transition-transform group-hover:scale-125`} />
          <span className="text-[11px] font-semibold text-text-secondary">{typeLabel}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
          {PRIORITY_LABELS[item.priority || 'normal']}
        </span>
      </div>

      {/* Title */}
      <div className={`text-sm font-bold group-hover:text-primary transition-colors leading-snug ${isUnread ? 'text-navy' : 'text-text-primary'}`}>
        {item.title}
      </div>

      {/* Subtitle — party / project name */}
      {item.subtitle && (
        <div className="text-xs text-text-secondary truncate">{item.subtitle}</div>
      )}

      {/* Bottom row — amount + age */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/50 gap-2">
        {item.amount != null ? (
          <span className="text-xs font-bold text-navy shrink-0 truncate max-w-[120px]" dir="ltr">
            {item.amount.toLocaleString('ar-EG')} ج.م
          </span>
        ) : (
          <span className="text-xs text-text-secondary truncate">{item.statusLabel}</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {item.ageDays != null && item.ageDays > 0 && (
            <span className={`text-[11px] ${style.age}`}>
              منذ {item.ageDays} {item.ageDays === 1 ? 'يوم' : 'أيام'}
            </span>
          )}
          <span className="text-[10px] text-text-secondary bg-background-secondary rounded px-1.5 py-0.5 font-medium group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            {item.actionLabel} ←
          </span>
        </div>
      </div>

      {/* Project tag */}
      {item.projectName && (
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[10px] bg-navy/8 text-navy rounded-full px-2 py-0.5 font-medium truncate max-w-[200px]">
            {item.projectCode ? `${item.projectCode} ·` : ''} {item.projectName}
          </span>
        </div>
      )}
    </Link>
  )
}
