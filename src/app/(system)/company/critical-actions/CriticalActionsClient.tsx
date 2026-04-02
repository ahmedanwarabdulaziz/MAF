'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WorkInboxData, WorkInboxItem, WorkInboxItemType, WorkInboxPriority, TYPE_LABELS } from '@/lib/work-inbox-types'
import WorkInboxKPI from '@/components/work-inbox/WorkInboxKPI'
import WorkInboxSection from '@/components/work-inbox/WorkInboxSection'

type Props = {
  data: WorkInboxData
}

type FilterState = {
  priority: WorkInboxPriority | 'all'
  type:     WorkInboxItemType | 'all'
}

// Visual sections — map from plan section 9 / WI-04
const VISUAL_SECTIONS: Array<{
  id:        string
  title:     string
  subtitle:  string
  icon:      string
  accentClass: string
  match:     (item: WorkInboxItem) => boolean
}> = [
  {
    id:         'critical',
    title:      'حرج الآن',
    subtitle:   'بنود مؤخرة أكثر من 14 يوماً أو متجاوزة الموعد',
    icon:       '🔴',
    accentClass: 'text-red-700',
    match:      item => item.priority === 'critical',
  },
  {
    id:         'pending_approval',
    title:      'بانتظار اعتماد',
    subtitle:   'طلبات شراء ومستخلصات وفواتير مالك بانتظار توقيع',
    icon:       '⏳',
    accentClass: 'text-amber-700',
    match:      item =>
      item.priority !== 'critical' &&
      ['purchase_request', 'subcontractor_certificate', 'owner_billing', 'retention_release'].includes(item.type),
  },
  {
    id:         'receipt_match',
    title:      'بحاجة إلى استلام أو مطابقة',
    subtitle:   'فواتير موردين تنتظر الاستلام المخزني أو مراجعة الكميات',
    icon:       '📦',
    accentClass: 'text-blue-700',
    match:      item =>
      item.priority !== 'critical' &&
      ['supplier_invoice_receipt', 'supplier_invoice_discrepancy'].includes(item.type),
  },
  {
    id:         'operations',
    title:      'عمليات داخلية بانتظار اعتماد',
    subtitle:   'إذونات صرف مخزن ومصروفات نثرية تنتظر الموافقة',
    icon:       '🏗️',
    accentClass: 'text-purple-700',
    match:      item =>
      item.priority !== 'critical' &&
      ['store_issue', 'petty_expense'].includes(item.type),
  },
]

export default function CriticalActionsClient({ data }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterState>({ priority: 'all', type: 'all' })
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
      setLastRefresh(new Date())
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router])

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    router.refresh()
    // Brief delay to let router.refresh take effect
    setTimeout(() => {
      setRefreshing(false)
      setLastRefresh(new Date())
    }, 800)
  }, [router])

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }, [])

  // Filtered items
  const filtered = useMemo(() => {
    return data.items.filter(item => {
      if (filter.priority !== 'all' && item.priority !== filter.priority) return false
      if (filter.type !== 'all' && item.type !== filter.type) return false
      return true
    })
  }, [data.items, filter])

  // Types present in data for filter dropdown
  const presentTypes = useMemo(() => {
    const types = new Set<WorkInboxItemType>()
    data.items.forEach(i => types.add(i.type))
    return Array.from(types)
  }, [data.items])

  const hasActiveFilter = filter.priority !== 'all' || filter.type !== 'all'

  // Format time
  const formatTime = (d: Date) => d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-8 pb-24" dir="rtl">

      {/* KPI Strip */}
      <WorkInboxKPI counts={data.counts} />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 bg-white rounded-xl border border-border px-5 py-3 shadow-sm">
        <span className="text-sm font-semibold text-text-primary ml-1">تصفية:</span>

        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Priority filter */}
          <select
            value={filter.priority}
            onChange={e => setFilter(f => ({ ...f, priority: e.target.value as FilterState['priority'] }))}
            className="rounded-lg border border-border bg-background-secondary px-3 py-1.5 text-sm outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">— الأولوية: الكل —</option>
            <option value="critical">🔴 حرج</option>
            <option value="high">🟡 مرتفع</option>
            <option value="normal">🟢 عادي</option>
          </select>

          {/* Type filter */}
          <select
            value={filter.type}
            onChange={e => setFilter(f => ({ ...f, type: e.target.value as FilterState['type'] }))}
            className="rounded-lg border border-border bg-background-secondary px-3 py-1.5 text-sm outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">— النوع: الكل —</option>
            {presentTypes.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>

          {hasActiveFilter && (
            <button
              onClick={() => setFilter({ priority: 'all', type: 'all' })}
              className="text-xs text-primary hover:underline font-medium"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        {/* Refresh controls + count summary */}
        <div className="flex items-center gap-3 sm:mr-auto">
          <div className="text-xs text-text-secondary font-medium">
            {filtered.length} من {data.counts.total} بند
          </div>
          <div className="flex items-center gap-2 border-r border-border pr-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs text-text-secondary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
              title="تحديث البيانات"
            >
              <span className={`text-sm ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>
            <span className="text-[10px] text-text-secondary/60">
              {formatTime(lastRefresh)}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Sections */}
      {hasActiveFilter ? (
        // When filtered — flat list under one section
        filtered.length > 0 ? (
          <WorkInboxSection
            title={`نتائج البحث (${filtered.length})`}
            icon="🔍"
            items={filtered}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-navy mb-1">لا توجد نتائج</h3>
            <p className="text-sm text-text-secondary max-w-md mb-4">
              لا توجد بنود تطابق معايير التصفية الحالية.
            </p>
            <button
              onClick={() => setFilter({ priority: 'all', type: 'all' })}
              className="text-sm text-primary font-semibold hover:underline"
            >
              إلغاء التصفية ←
            </button>
          </div>
        )
      ) : (
        // Default — grouped sections
        VISUAL_SECTIONS.map(section => {
          const sectionItems = filtered.filter(section.match)
          const isCollapsed = collapsedSections.has(section.id)
          return (
            <WorkInboxSection
              key={section.id}
              title={section.title}
              subtitle={section.subtitle}
              icon={section.icon}
              items={sectionItems}
              accentClass={section.accentClass}
              collapsed={isCollapsed}
              onToggleCollapse={() => toggleSection(section.id)}
            />
          )
        })
      )}

      {/* All-clear state */}
      {data.counts.total === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-navy mb-2">لا توجد بنود معلقة</h3>
          <p className="text-sm text-text-secondary max-w-md">
            جميع العمليات المرتبطة بك تمت معالجتها. ارجع لاحقاً أو راجع الوحدات المختلفة للتحقق.
          </p>
        </div>
      )}
    </div>
  )
}
