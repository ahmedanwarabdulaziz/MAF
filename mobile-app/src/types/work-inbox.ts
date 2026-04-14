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
