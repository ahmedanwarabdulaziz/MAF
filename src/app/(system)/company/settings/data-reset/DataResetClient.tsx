'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  getDbStats,
  getDocumentsByType,
  updateDocumentNumber,
  deleteDocumentById,
  deleteProjectPayments,
  deleteOwnerBilling,
  deleteSubcontractorCertificates,
  deleteSubcontractAgreements,
  deleteWorkItems,
  deleteSupplierInvoices,
  deletePurchaseRequests,
  deleteCompanyPurchases,
  deleteStockLedger,
  deleteStoreIssues,
  deletePettyExpenses,
  deleteFinancialAccounts,
  deleteProjects,
  deleteParties,
  deleteWarehousesAndItems,
  deleteExpenseCategories,
  deletePettyExpenseGroups,
  deleteAuditLogs,
  deleteDocumentSequences,
  deleteUsersExceptAdmin,
  DocType,
  DocumentRow,
  DbStatRow,
} from './actions'

// Static action map — keyed by TABLE_CONFIG entry key
const ACTION_MAP: Record<string, () => Promise<void>> = {
  payments:             deleteProjectPayments,
  owner_billing:        deleteOwnerBilling,
  certificates:         deleteSubcontractorCertificates,
  agreements:           deleteSubcontractAgreements,
  work_items:           deleteWorkItems,
  supplier_invoices:    deleteSupplierInvoices,
  purchase_requests:    deletePurchaseRequests,
  company_purchases:    deleteCompanyPurchases,
  stock_ledger:         deleteStockLedger,
  store_issues:         deleteStoreIssues,
  petty_expenses:       deletePettyExpenses,
  financial_accounts:   deleteFinancialAccounts,
  projects:             deleteProjects,
  parties:              deleteParties,
  warehouses_and_items: deleteWarehousesAndItems,
  expense_categories:   deleteExpenseCategories,
  petty_expense_groups: deletePettyExpenseGroups,
  audit_logs:           deleteAuditLogs,
  doc_sequences:        deleteDocumentSequences,
  users:                deleteUsersExceptAdmin,
}


// ─── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function TrashIcon({ size = 4 }: { size?: number }) {
  return (
    <svg className={`h-${size} w-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Table Configuration ────────────────────────────────────────────────────

type TableEntry = {
  key: string
  labelAr: string
  dbTable: string
  docType?: DocType
  dependsOn?: string[]   // label names of tables that must be cleared first
  deleteFn?: string      // name of the server action function (for display)
}

const TABLE_CONFIG: TableEntry[] = [
  // Payments first — highest dependency
  {
    key: 'payments',
    labelAr: 'سندات الصرف',
    dbTable: 'payment_vouchers',
    docType: 'payment_vouchers',
    dependsOn: [],
  },
  // Owner billing
  {
    key: 'owner_billing',
    labelAr: 'فواتير المالك',
    dbTable: 'owner_billing_documents',
    docType: 'owner_billing',
    dependsOn: ['سندات الصرف'],
  },
  // Subcontractor flow
  {
    key: 'certificates',
    labelAr: 'مستخلصات مقاولو الباطن',
    dbTable: 'subcontractor_certificates',
    docType: 'subcontractor_certificates',
    dependsOn: ['سندات الصرف'],
  },
  {
    key: 'agreements',
    labelAr: 'عقود مقاولو الباطن',
    dbTable: 'subcontract_agreements',
    dependsOn: ['مستخلصات مقاولو الباطن'],
  },
  {
    key: 'work_items',
    labelAr: 'بنود الأعمال',
    dbTable: 'project_work_items',
    dependsOn: ['عقود مقاولو الباطن'],
  },
  // Purchasing
  {
    key: 'supplier_invoices',
    labelAr: 'فواتير الموردين',
    dbTable: 'supplier_invoices',
    docType: 'supplier_invoices',
    dependsOn: ['سندات الصرف'],
  },
  {
    key: 'purchase_requests',
    labelAr: 'طلبات الشراء',
    dbTable: 'purchase_requests',
    docType: 'purchase_requests',
    dependsOn: ['فواتير الموردين'],
  },
  // Company purchases
  {
    key: 'company_purchases',
    labelAr: 'مشتريات الشركة',
    dbTable: 'company_purchase_invoices',
    docType: 'company_purchase_invoices',
    dependsOn: ['سندات الصرف'],
  },
  // Warehouse
  {
    key: 'stock_ledger',
    labelAr: 'حركات المخزن',
    dbTable: 'stock_ledger',
    dependsOn: [],
  },
  {
    key: 'store_issues',
    labelAr: 'أذون الصرف',
    dbTable: 'store_issues',
    dependsOn: ['حركات المخزن'],
  },
  // Misc
  {
    key: 'petty_expenses',
    labelAr: 'المصروفات النثرية',
    dbTable: 'petty_expenses',
    dependsOn: [],
  },
  {
    key: 'financial_accounts',
    labelAr: 'الحسابات المالية',
    dbTable: 'financial_accounts',
    dependsOn: ['سندات الصرف', 'المصروفات النثرية'],
  },
  {
    key: 'projects',
    labelAr: 'المشاريع',
    dbTable: 'projects',
    dependsOn: ['بنود الأعمال', 'أذون الصرف', 'مستخلصات مقاولو الباطن'],
  },
  {
    key: 'parties',
    labelAr: 'جهات التعامل',
    dbTable: 'parties',
    dependsOn: ['فواتير الموردين', 'مستخلصات مقاولو الباطن'],
  },
  {
    key: 'warehouses_and_items',
    labelAr: 'المخازن والأصناف',
    dbTable: 'items',
    dependsOn: ['حركات المخزن'],
  },
  {
    key: 'expense_categories',
    labelAr: 'فئات المصروفات',
    dbTable: 'expense_categories',
    dependsOn: ['مشتريات الشركة'],
  },
  {
    key: 'petty_expense_groups',
    labelAr: 'مجموعات المصروفات النثرية',
    dbTable: 'expense_groups',
    dependsOn: ['المصروفات النثرية'],
  },
  {
    key: 'audit_logs',
    labelAr: 'سجل النشاط',
    dbTable: 'audit_logs',
    dependsOn: [],
  },
  {
    key: 'doc_sequences',
    labelAr: 'تسلسل المستندات',
    dbTable: 'document_sequences',
    dependsOn: [],
  },
  {
    key: 'users',
    labelAr: 'المستخدمون',
    dbTable: 'users',
    dependsOn: ['جهات التعامل', 'المشاريع'],
  },
]

function statusLabel(status: string): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    draft:    { text: 'مسودة',    cls: 'bg-gray-100 text-gray-600' },
    posted:   { text: 'مُرحَّل',  cls: 'bg-blue-100 text-blue-700' },
    approved: { text: 'معتمد',    cls: 'bg-green-100 text-green-700' },
    paid:     { text: 'مدفوع',    cls: 'bg-emerald-100 text-emerald-700' },
    partially_paid: { text: 'مدفوع جزئياً', cls: 'bg-yellow-100 text-yellow-700' },
    cancelled: { text: 'ملغى',   cls: 'bg-red-100 text-red-700' },
    pending:  { text: 'قيد الانتظار', cls: 'bg-orange-100 text-orange-700' },
  }
  return map[status] ?? { text: status, cls: 'bg-gray-100 text-gray-500' }
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({
  open, title, message, onConfirm, onCancel, danger = true,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-border p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`flex-shrink-0 rounded-full p-2 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
            {danger ? (
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Number Inline ─────────────────────────────────────────────────────

function EditCell({
  row, docType, onDone,
}: {
  row: DocumentRow
  docType: DocType
  onDone: () => void
}) {
  const [val, setVal] = useState(row.doc_no)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (val === row.doc_no) { onDone(); return }
    setSaving(true)
    setErr(null)
    try {
      await updateDocumentNumber(docType, row.id, val)
      onDone()
    } catch (e: any) {
      setErr(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        autoFocus
        dir="ltr"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onDone() }}
        className="flex-1 min-w-0 rounded border border-primary px-2 py-1 text-sm font-mono outline-none focus:ring-1 focus:ring-primary/30"
      />
      {err && <span className="text-xs text-red-500">{err}</span>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
      >
        {saving ? <SpinnerIcon /> : null}
        حفظ
      </button>
      <button
        onClick={onDone}
        className="rounded border border-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-background-secondary"
      >
        إلغاء
      </button>
    </div>
  )
}

// ─── Table Row Panel ────────────────────────────────────────────────────────

function TableRowPanel({
  entry, count, onDeleteAll, labelToKey,
}: {
  entry: TableEntry
  count: number
  onDeleteAll: (entry: TableEntry) => void
  labelToKey: Record<string, string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<DocumentRow | null>(null)
  const [deletingRow, setDeletingRow] = useState(false)

  const loadRows = useCallback(async () => {
    if (!entry.docType) return
    setLoadingRows(true)
    try {
      const data = await getDocumentsByType(entry.docType)
      setRows(data)
    } finally {
      setLoadingRows(false)
    }
  }, [entry.docType])

  useEffect(() => {
    if (open && entry.docType && rows.length === 0) {
      loadRows()
    }
  }, [open, entry.docType, rows.length, loadRows])

  const hasDeps = entry.dependsOn && entry.dependsOn.length > 0
  const hasDocType = !!entry.docType
  const isEmpty = count === 0

  // Delete single row
  async function handleDeleteRow(row: DocumentRow) {
    setToDelete(row)
  }

  async function confirmDeleteRow() {
    if (!toDelete || !entry.docType) return
    setDeletingRow(true)
    setDeletingId(toDelete.id)
    try {
      await deleteDocumentById(entry.docType, toDelete.id)
      setRows(prev => prev.filter(r => r.id !== toDelete.id))
      router.refresh()
    } catch (e: any) {
      // Surface error briefly — TODO: show toast
      console.error(e.message)
    } finally {
      setDeletingRow(false)
      setDeletingId(null)
      setToDelete(null)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={!!toDelete}
        danger
        title="حذف السجل"
        message={`هل أنت متأكد من حذف "${toDelete?.doc_no}"؟ لا يمكن التراجع.`}
        onConfirm={confirmDeleteRow}
        onCancel={() => setToDelete(null)}
      />

      <div id={`table-panel-${entry.key}`} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setOpen(o => !o)}
        >
          <span className="text-text-secondary">
            <ChevronIcon open={open} />
          </span>

          {/* Table name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary text-sm">{entry.labelAr}</span>
              <code className="text-xs text-text-secondary bg-background-secondary rounded px-1.5 py-0.5 font-mono">
                {entry.dbTable}
              </code>
            </div>

            {/* Dependency badges */}
            {hasDeps && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-xs text-text-secondary flex items-center gap-0.5">
                  <LinkIcon /> يتطلب حذف:
                </span>
                {entry.dependsOn!.map(dep => {
                  const targetKey = labelToKey[dep]
                  return (
                    <button
                      key={dep}
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        if (!targetKey) return
                        const el = document.getElementById(`table-panel-${targetKey}`)
                        if (!el) return
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        // Flash highlight
                        el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2')
                        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 1800)
                      }}
                      className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                      </svg>
                      {dep}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Record count */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
              isEmpty
                ? 'bg-gray-100 text-gray-400'
                : 'bg-primary/10 text-primary'
            }`}>
              {count.toLocaleString('ar')} سجل
            </span>

            {/* Delete all */}
            {!isEmpty && (
              <button
                onClick={e => { e.stopPropagation(); onDeleteAll(entry) }}
                title="حذف الكل"
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                <TrashIcon size={3} />
                حذف الكل
              </button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {open && (
          <div className="border-t border-border">
            {!hasDocType ? (
              <div className="px-6 py-5 text-sm text-text-secondary text-center bg-background-secondary/30">
                <div className="inline-flex flex-col items-center gap-1">
                  <svg className="h-8 w-8 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>عرض السجلات غير متاح لهذا الجدول — استخدم "حذف الكل" لمسح البيانات</span>
                </div>
              </div>
            ) : loadingRows ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
                <SpinnerIcon />
                <span>جاري التحميل...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-6 text-center text-sm text-text-secondary">لا توجد سجلات</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir="rtl">
                  <thead className="bg-background-secondary/60">
                    <tr>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-secondary">رقم المستند</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-secondary">التاريخ</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-secondary">الحالة</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-secondary">الجهة</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-text-secondary">المشروع</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(row => {
                      const { text: stText, cls: stCls } = statusLabel(row.status)
                      const isEditing = editingId === row.id
                      return (
                        <tr key={row.id} className="hover:bg-background-secondary/30 transition-colors">
                          <td className="px-4 py-2.5">
                            {isEditing && entry.docType ? (
                              <EditCell
                                row={row}
                                docType={entry.docType}
                                onDone={() => { setEditingId(null); loadRows() }}
                              />
                            ) : (
                              <span className="font-mono text-sm text-text-primary">{row.doc_no}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary text-xs whitespace-nowrap">
                            {row.doc_date ? new Date(row.doc_date).toLocaleDateString('ar-EG') : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stCls}`}>
                              {stText}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary text-xs">{row.party_name || '—'}</td>
                          <td className="px-4 py-2.5 text-text-secondary text-xs">{row.project_name || '—'}</td>
                          <td className="px-4 py-2.5">
                            {!isEditing && (
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => setEditingId(row.id)}
                                  title="تعديل الرقم"
                                  className="rounded-lg p-1.5 text-text-secondary hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  onClick={() => handleDeleteRow(row)}
                                  disabled={deletingId === row.id}
                                  title="حذف السجل"
                                  className="rounded-lg p-1.5 text-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                                >
                                  {deletingId === row.id ? <SpinnerIcon /> : <TrashIcon />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-border bg-background-secondary/30 flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    {rows.length} سجل معروض
                  </span>
                  <button
                    onClick={loadRows}
                    className="text-xs text-primary hover:underline"
                  >
                    تحديث
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Cascade Confirm Dialog ─────────────────────────────────────────────────

type CascadeDialogProps = {
  open: boolean
  target: TableEntry | null
  blockers: { key: string; labelAr: string; count: number }[]
  onDeleteOnly: () => void
  onCascade: () => void
  onCancel: () => void
}

function CascadeConfirmDialog({
  open, target, blockers, onDeleteOnly, onCascade, onCancel,
}: CascadeDialogProps) {
  if (!open || !target) return null
  const hasblockers = blockers.length > 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-white/20 p-2">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">حذف بيانات: {target.labelAr}</h3>
            <p className="text-xs text-red-100 mt-0.5">{target.dbTable}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {hasblockers ? (
            <>
              <p className="text-sm text-text-primary">
                لا يمكن حذف <strong>{target.labelAr}</strong> لأن الجداول التالية لا تزال تحتوي على بيانات مرتبطة:
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                {blockers.map(b => (
                  <div key={b.key} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-900">{b.labelAr}</span>
                    <span className="text-xs font-bold bg-amber-200 text-amber-800 rounded-full px-2 py-0.5">
                      {b.count.toLocaleString('ar')} سجل
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-secondary">
                يمكنك حذف هذه الجداول أولاً ثم العودة، أو اختيار "حذف الكل معاً" لحذفها جميعاً بالتسلسل الصحيح.
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              سيتم حذف <strong>جميع سجلات</strong> "{target.labelAr}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </p>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 flex flex-col gap-2">
          {hasblockers && (
            <button
              onClick={onCascade}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              حذف الكل معاً (التبعيات + الجدول)
            </button>
          )}
          <button
            onClick={onDeleteOnly}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              hasblockers
                ? 'border border-border text-text-secondary hover:bg-background-secondary'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {hasblockers ? 'حذف هذا الجدول فقط (قد يفشل)' : `حذف ${target.labelAr} نهائياً`}
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Deleting overlay ───────────────────────────────────────────────────────

function DeletingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-8 shadow-2xl">
        <SpinnerIcon />
        <span className="text-sm font-medium text-text-primary">جاري حذف: {label}</span>
        <span className="text-xs text-text-secondary">لا تُغلق الصفحة...</span>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DataResetClient() {
  const router = useRouter()
  const [stats, setStats] = useState<DbStatRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<TableEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingLabel, setDeletingLabel] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await getDbStats()
      setStats(data)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  function getCount(dbTable: string): number {
    return stats.find(s => s.table === dbTable)?.count ?? 0
  }

  // Maps Arabic label → entry key for clickable dependency tags
  const labelToKey = useMemo(
    () => Object.fromEntries(TABLE_CONFIG.map(e => [e.labelAr, e.key])),
    []
  )

  // Which dependencies of deleteTarget still have data?
  const blockers = useMemo(() => {
    if (!deleteTarget?.dependsOn?.length) return []
    return deleteTarget.dependsOn
      .map(label => {
        const key = labelToKey[label]
        const entry = TABLE_CONFIG.find(e => e.key === key)
        if (!entry) return null
        const count = getCount(entry.dbTable)
        return count > 0 ? { key, labelAr: entry.labelAr, count } : null
      })
      .filter(Boolean) as { key: string; labelAr: string; count: number }[]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget, stats])

  function handleDeleteAll(entry: TableEntry) {
    setDeleteTarget(entry)
    setDeleteError(null)
    setDeleteSuccess(null)
  }

  async function runDelete(key: string, label: string) {
    const fn = ACTION_MAP[key]
    if (!fn) throw new Error(`لا يوجد إجراء حذف للجدول: ${key}`)
    setDeletingLabel(label)
    await fn()
  }

  // Delete only the target table (may fail if deps still have data — user chose this)
  async function handleDeleteOnly() {
    if (!deleteTarget) return
    setDeleteTarget(null)
    setDeleting(true)
    setDeleteError(null)
    try {
      await runDelete(deleteTarget.key, deleteTarget.labelAr)
      setDeleteSuccess(`✓ تم حذف "${deleteTarget.labelAr}" بنجاح`)
      await loadStats()
      router.refresh()
    } catch (e: any) {
      setDeleteError(e.message || 'حدث خطأ أثناء الحذف')
    } finally {
      setDeleting(false)
      setDeletingLabel('')
    }
  }

  // Delete all blockers first (in proper order by TABLE_CONFIG), then the target
  async function handleCascadeDelete() {
    if (!deleteTarget) return
    setDeleteTarget(null)
    setDeleting(true)
    setDeleteError(null)

    // Collect all keys to delete in the correct TABLE_CONFIG order
    // We need to cascade: for each blocker also check its own deps
    const toDeleteKeys: string[] = []

    function collectDeps(key: string) {
      const entry = TABLE_CONFIG.find(e => e.key === key)
      if (!entry) return
      for (const depLabel of entry.dependsOn ?? []) {
        const depKey = labelToKey[depLabel]
        if (depKey && !toDeleteKeys.includes(depKey)) {
          collectDeps(depKey) // recurse
          if (!toDeleteKeys.includes(depKey)) toDeleteKeys.push(depKey)
        }
      }
    }

    collectDeps(deleteTarget.key)
    toDeleteKeys.push(deleteTarget.key)

    // Execute in collected order — skip keys with 0 records to avoid wasted calls
    try {
      for (const key of toDeleteKeys) {
        const entry = TABLE_CONFIG.find(e => e.key === key)!
        const count = getCount(entry.dbTable)
        if (count === 0) continue
        await runDelete(key, entry.labelAr)
      }
      setDeleteSuccess(`✓ تم حذف "${deleteTarget.labelAr}" وجميع التبعيات بنجاح`)
      await loadStats()
      router.refresh()
    } catch (e: any) {
      setDeleteError(e.message || 'حدث خطأ أثناء الحذف')
    } finally {
      setDeleting(false)
      setDeletingLabel('')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Cascade-aware confirm dialog */}
      <CascadeConfirmDialog
        open={!!deleteTarget}
        target={deleteTarget}
        blockers={blockers}
        onDeleteOnly={handleDeleteOnly}
        onCascade={handleCascadeDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {deleting && <DeletingOverlay label={deletingLabel} />}

      {/* Feedback banners */}
      {deleteError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="mr-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {deleteSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-start gap-2">
          <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{deleteSuccess}</span>
          <button onClick={() => setDeleteSuccess(null)} className="mr-auto text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {loadingStats ? 'جاري تحميل الإحصائيات...' : `${stats.reduce((a, b) => a + b.count, 0).toLocaleString('ar')} إجمالي السجلات`}
        </p>
        <button
          onClick={loadStats}
          disabled={loadingStats}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
        >
          {loadingStats ? <SpinnerIcon /> : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          تحديث
        </button>
      </div>

      {/* Warning notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">تنبيه مهم</p>
          <p className="text-xs text-amber-700 mt-0.5">
            عمليات الحذف نهائية ولا يمكن التراجع عنها. عند وجود تبعيات يظهر خيار "حذف الكل معاً" لحذفها بالتسلسل الصحيح تلقائياً.
          </p>
        </div>
      </div>

      {/* Table list */}
      <div className="space-y-2">
        {TABLE_CONFIG.map(entry => (
          <TableRowPanel
            key={entry.key}
            entry={entry}
            count={getCount(entry.dbTable)}
            onDeleteAll={handleDeleteAll}
            labelToKey={labelToKey}
          />
        ))}
      </div>
    </div>
  )
}

