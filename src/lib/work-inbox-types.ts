// ============================================================
// Work Inbox — Shared DTO & Helpers
// WI-00: Contract frozen. Do NOT add fields without WI-00 review.
// ============================================================

export type WorkInboxItemType =
  | 'purchase_request'
  | 'supplier_invoice_receipt'
  | 'supplier_invoice_discrepancy'
  | 'subcontractor_certificate'
  | 'owner_billing'
  | 'store_issue'
  | 'petty_expense'
  | 'retention_release'
  | 'cutover_batch'

export type WorkInboxPriority = 'critical' | 'high' | 'normal'

export type WorkInboxItem = {
  id: string
  type: WorkInboxItemType
  sourceId: string
  projectId?: string | null
  projectName?: string | null
  projectCode?: string | null
  companyId?: string | null
  title: string
  subtitle?: string | null
  amount?: number | null
  currency?: string | null
  statusLabel: string
  actionLabel: string
  createdAt?: string | null
  dueAt?: string | null
  ageDays?: number | null
  priority: WorkInboxPriority
  href: string
  dialogKey?:
    | 'purchase_request'
    | 'supplier_invoice'
    | 'subcontractor_certificate'
    | 'owner_billing'
    | 'store_issue'
    | 'petty_expense'
    | 'retention_release'
    | 'cutover_batch'
    | null
  badges?: string[]
  metadata?: {
    is_read?: boolean
    [key: string]: unknown
  }
}

export type WorkInboxData = {
  items: WorkInboxItem[]
  counts: {
    total: number
    critical: number
    high: number
    normal: number
    byType: Partial<Record<WorkInboxItemType, number>>
  }
}

// ── Priority Rules (WI-00 / Section 9.1) ─────────────────────────────
// normal: 0–6 days | high: 7–13 days | critical: 14+ days
// Promotion: if dueAt exists and is overdue → promote one level (cap: critical)
// amount does NOT affect priority in V1
export function computeAgeDays(createdAt: string | null | undefined): number {
  if (!createdAt) return 0
  const diffMs = Date.now() - new Date(createdAt).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function derivePriority(
  ageDays: number,
  dueAt?: string | null
): WorkInboxPriority {
  let base: WorkInboxPriority = 'normal'
  if (ageDays >= 14) base = 'critical'
  else if (ageDays >= 7) base = 'high'

  // Promotion rule
  if (dueAt) {
    const overdue = new Date(dueAt) < new Date()
    if (overdue && base === 'normal') base = 'high'
    else if (overdue && base === 'high') base = 'critical'
    // 'critical' stays critical
  }

  return base
}

// ── Labels ────────────────────────────────────────────────────────────
export const TYPE_LABELS: Record<WorkInboxItemType, string> = {
  purchase_request:              'طلب شراء',
  supplier_invoice_receipt:      'فاتورة مورد — بانتظار استلام',
  supplier_invoice_discrepancy:  'فاتورة مورد — فجوة كميات',
  subcontractor_certificate:     'مستخلص مقاول باطن',
  owner_billing:                 'فاتورة مالك',
  store_issue:                   'إذن صرف مخزن',
  petty_expense:                 'مصروف نثري',
  retention_release:             'إفراج استقطاع',
  cutover_batch:                 'دفعة إقفال',
}

export const PRIORITY_LABELS: Record<WorkInboxPriority, string> = {
  critical: 'حرج',
  high:     'مرتفع',
  normal:   'عادي',
}
