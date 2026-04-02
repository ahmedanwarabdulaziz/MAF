'use client'

import { WorkInboxItem } from '@/lib/work-inbox-types'
import WorkInboxCard from './WorkInboxCard'

type Props = {
  title: string
  subtitle?: string
  icon: string
  items: WorkInboxItem[]
  emptyLabel?: string
  onDialogOpen?: (item: WorkInboxItem) => void
  accentClass?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function WorkInboxSection({
  title,
  subtitle,
  icon,
  items,
  emptyLabel,
  onDialogOpen,
  accentClass = 'text-navy',
  collapsed = false,
  onToggleCollapse,
}: Props) {
  if (items.length === 0 && !emptyLabel) return null

  return (
    <section dir="rtl">
      {/* Section header */}
      <div
        className={`flex items-center gap-3 mb-4 ${onToggleCollapse ? 'cursor-pointer select-none group' : ''}`}
        onClick={onToggleCollapse}
        role={onToggleCollapse ? 'button' : undefined}
        aria-expanded={onToggleCollapse ? !collapsed : undefined}
      >
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <h2 className={`text-base font-bold ${accentClass} leading-tight flex items-center gap-2`}>
            {title}
            {items.length > 0 && (
              <span className="text-xs font-semibold bg-navy/10 text-navy rounded-full px-2 py-0.5">
                {items.length}
              </span>
            )}
          </h2>
          {subtitle && !collapsed && (
            <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        {/* Collapse toggle icon */}
        {onToggleCollapse && items.length > 0 && (
          <span
            className={`text-text-secondary/40 group-hover:text-text-secondary transition-all duration-200 text-lg ${collapsed ? '' : 'rotate-180'}`}
          >
            ▾
          </span>
        )}
      </div>

      {/* Grid of cards — with collapse animation */}
      {!collapsed && (
        <>
          {items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map(item => (
                <WorkInboxCard
                  key={item.id}
                  item={item}
                  onDialogOpen={onDialogOpen}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-white px-6 py-8 text-center text-sm text-text-secondary">
              {emptyLabel}
            </div>
          )}
        </>
      )}
    </section>
  )
}
