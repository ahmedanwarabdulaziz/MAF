'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Super admin guard
async function assertSuperAdmin() {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('غير مصرح')
  
  const { data: profile } = await userClient.from('users').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('هذه العملية محظورة — للمديرين العامين فقط')

  const { createAdminClient } = await import('@/lib/supabase-admin')
  return createAdminClient()
}

// ── Individual dataset delete actions ──────────────────────────────

export async function deleteProjectPayments() {
  const supabase = await assertSuperAdmin()
  await supabase.from('payment_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('payment_voucher_parties').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('financial_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('payment_vouchers').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  // Reset certificate paid amounts
  await supabase.from('subcontractor_certificates').update({ paid_to_date: 0, outstanding_amount: 0 }).neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('supplier_invoices').update({ paid_to_date: 0, status: 'posted' }).in('status', ['partially_paid', 'paid']).throwOnError()
  revalidatePath('/projects')
  revalidatePath('/company/treasury')
}

export async function deleteSubcontractorCertificates() {
  const supabase = await assertSuperAdmin()
  await supabase.from('payment_allocations').delete().eq('source_entity_type', 'subcontractor_certificate').throwOnError()
  await supabase.from('subcontractor_certificate_deductions').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('subcontractor_certificate_allowances').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('subcontractor_certificate_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('subcontractor_certificates').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteSubcontractAgreements() {
  const supabase = await assertSuperAdmin()
  // Must delete certificates first
  await deleteSubcontractorCertificates()
  await supabase.from('subcontract_agreements').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteSupplierInvoices() {
  const supabase = await assertSuperAdmin()
  // Delete return invoices first (FK: supplier_return_invoices.original_invoice_id → supplier_invoices)
  await supabase.from('supplier_return_invoice_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('supplier_return_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  // Delete receipt confirmations (FK: invoice_receipt_confirmations.supplier_invoice_id → supplier_invoices)
  await supabase.from('invoice_receipt_confirmation_users').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('invoice_receipt_confirmations').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  // Now safe to delete payment allocations, lines, and invoices
  await supabase.from('payment_allocations').delete().eq('source_entity_type', 'supplier_invoice').throwOnError()
  await supabase.from('supplier_invoice_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('supplier_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deletePurchaseRequests() {
  const supabase = await assertSuperAdmin()
  await supabase.from('purchase_request_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('purchase_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteOwnerBilling() {
  const supabase = await assertSuperAdmin()
  await supabase.from('owner_billing_certificates').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteStoreIssues() {
  const supabase = await assertSuperAdmin()
  await supabase.from('store_issue_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('store_issues').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteStockLedger() {
  const supabase = await assertSuperAdmin()
  
  await supabase.from('goods_receipt_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('goods_receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  
  await supabase.from('store_return_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('store_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  
  await supabase.from('warehouse_transfer_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('warehouse_transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  
  await supabase.from('stock_adjustment_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('stock_adjustments').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()

  await supabase.from('stock_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('stock_balances').delete().neq('warehouse_id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/main_warehouse')
  revalidatePath('/projects')
}

export async function deletePettyExpenses() {
  const supabase = await assertSuperAdmin()
  await supabase.from('petty_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteWorkItems() {
  const supabase = await assertSuperAdmin()
  // Must cascade: certificates → agreements → work items
  await deleteSubcontractAgreements()
  await supabase.from('project_work_items').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/projects')
}

export async function deleteProjects() {
  const supabase = await assertSuperAdmin()
  await supabase.from('project_parties').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await supabase.from('warehouses').delete().not('project_id', 'is', null).throwOnError()
  await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/projects')
}

export async function deleteAuditLogs() {
  const supabase = await assertSuperAdmin()
  await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings/audit-log')
}

export async function deleteDocumentSequences() {
  const supabase = await assertSuperAdmin()
  await supabase.from('document_sequences').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings')
}

export async function deleteFinancialAccounts() {
  const admin = await assertSuperAdmin()
  await deleteProjectPayments()
  await deletePettyExpenses()
  await admin.from('financial_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/treasury')
  revalidatePath('/projects')
}

export async function deleteUsersExceptAdmin() {
  const admin = await assertSuperAdmin()
  await admin.from('user_permission_group_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('user_access_scopes').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('users').delete().eq('is_super_admin', false).throwOnError()
  revalidatePath('/company/settings/users')
}

export async function deleteParties() {
  const admin = await assertSuperAdmin()
  await admin.from('project_parties').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('party_contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('party_role_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('party_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('parties').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings/parties')
}

export async function deletePettyExpenseGroups() {
  const admin = await assertSuperAdmin()
  await admin.from('expense_items').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('expense_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings')
}

export async function deleteCompanyPurchases() {
  const admin = await assertSuperAdmin()
  await admin.from('payment_allocations').delete().eq('source_entity_type', 'company_purchase_invoice').throwOnError()
  await admin.from('company_purchase_invoice_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('company_purchase_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/purchases')
}

export async function deleteExpenseCategories() {
  const admin = await assertSuperAdmin()
  await admin.from('expense_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings')
}

export async function deleteWarehousesAndItems() {
  const admin = await assertSuperAdmin()
  await admin.from('warehouses').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  await admin.from('item_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
  revalidatePath('/company/settings/items')
  revalidatePath('/company/settings/warehouses')
}

export async function getResetObjectCounts(): Promise<Record<string, number>> {
  const admin = await assertSuperAdmin()

  async function getCount(tableName: string, filter?: (q: any) => any) {
    let q = admin.from(tableName).select('id', { count: 'exact', head: true })
    if (filter) q = filter(q)
    const { count } = await q
    return count || 0
  }

  const keys = [
    { key: 'audit_logs', tbl: 'audit_logs' },
    { key: 'doc_sequences', tbl: 'document_sequences' },
    { key: 'payments', tbl: 'payment_vouchers' },
    { key: 'financial_accounts', tbl: 'financial_accounts' },
    { key: 'petty_expenses', tbl: 'petty_expenses' },
    { key: 'owner_billing', tbl: 'owner_billing_certificates' },
    { key: 'purchase_requests', tbl: 'purchase_requests' },
    { key: 'supplier_invoices', tbl: 'supplier_invoices' },
    { key: 'store_issues', tbl: 'store_issues' },
    { key: 'stock_ledger', tbl: 'stock_ledger' },
    { key: 'certificates', tbl: 'subcontractor_certificates' },
    { key: 'agreements', tbl: 'subcontract_agreements' },
    { key: 'work_items', tbl: 'project_work_items' },
    { key: 'projects', tbl: 'projects' },
    { key: 'company_purchases', tbl: 'company_purchase_invoices' },
    { key: 'expense_categories', tbl: 'expense_categories' },
    { key: 'parties', tbl: 'parties' },
    { key: 'petty_expense_groups', tbl: 'expense_groups' },
    { key: 'warehouses_and_items', tbl: 'items' },
  ]

  const results = await Promise.all([
    ...keys.map(k => getCount(k.tbl)),
    getCount('users', q => q.eq('is_super_admin', false))
  ])

  const counts: Record<string, number> = {}
  keys.forEach((k, i) => {
    counts[k.key] = results[i]
  })
  counts['users'] = results[results.length - 1]

  return counts
}

// ── Document Number Management ──────────────────────────────────────

export type DocType =
  | 'supplier_invoices'
  | 'purchase_requests'
  | 'payment_vouchers'
  | 'company_purchase_invoices'
  | 'subcontractor_certificates'
  | 'owner_billing'

export type DocumentRow = {
  id: string
  doc_no: string
  doc_date: string
  status: string
  party_name: string | null
  project_name: string | null
}

const DOC_TYPE_CONFIG: Record<DocType, {
  table: string
  numberCol: string
  dateCol: string
  select: string
  projectCol: string | null
  hasProject: boolean
}> = {
  supplier_invoices: {
    table: 'supplier_invoices',
    numberCol: 'invoice_no',
    dateCol: 'invoice_date',
    select: 'id, invoice_no, invoice_date, status, parties(arabic_name), projects(arabic_name)',
    projectCol: 'project_id',
    hasProject: true,
  },
  purchase_requests: {
    table: 'purchase_requests',
    numberCol: 'request_no',
    dateCol: 'request_date',
    select: 'id, request_no, request_date, status, projects(arabic_name)',
    projectCol: 'project_id',
    hasProject: true,
  },
  payment_vouchers: {
    table: 'payment_vouchers',
    numberCol: 'voucher_no',
    dateCol: 'payment_date',
    select: 'id, voucher_no, payment_date, status, projects(arabic_name)',
    projectCol: 'project_id',
    hasProject: true,
  },
  company_purchase_invoices: {
    table: 'company_purchase_invoices',
    numberCol: 'invoice_no',
    dateCol: 'invoice_date',
    select: 'id, invoice_no, invoice_date, status, parties(arabic_name)',
    projectCol: null,
    hasProject: false,
  },
  subcontractor_certificates: {
    table: 'subcontractor_certificates',
    numberCol: 'certificate_no',
    dateCol: 'certificate_date',
    select: 'id, certificate_no, certificate_date, status, parties(arabic_name), projects(arabic_name)',
    projectCol: 'project_id',
    hasProject: true,
  },
  owner_billing: {
    table: 'owner_billing_documents',
    numberCol: 'document_no',
    dateCol: 'billing_date',
    select: 'id, document_no, billing_date, status, parties(arabic_name), projects(arabic_name)',
    projectCol: 'project_id',
    hasProject: true,
  },
}

export async function getDocumentsByType(
  docType: DocType,
  projectId?: string
): Promise<DocumentRow[]> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]

  let query = admin.from(cfg.table).select(cfg.select).order(cfg.dateCol, { ascending: true })
  if (projectId && cfg.hasProject && cfg.projectCol) {
    query = query.eq(cfg.projectCol, projectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data || []).map((row: any) => ({
    id: row.id,
    doc_no: row[cfg.numberCol] || '',
    doc_date: row[cfg.dateCol] || '',
    status: row.status || '',
    party_name: row.parties?.arabic_name || null,
    project_name: row.projects?.arabic_name || null,
  }))
}

export async function updateDocumentNumber(
  docType: DocType,
  id: string,
  newNumber: string
): Promise<void> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]
  if (!newNumber.trim()) throw new Error('الرقم لا يمكن أن يكون فارغاً')

  const { error } = await admin
    .from(cfg.table)
    .update({ [cfg.numberCol]: newNumber.trim() })
    .eq('id', id)
  
  if (error) throw new Error(error.message)
  revalidatePath('/company/settings/data-reset')
}

export async function deleteDocumentById(
  docType: DocType,
  id: string
): Promise<void> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]

  // Delete child lines first for document types that have them
  const childLineMap: Partial<Record<DocType, string>> = {
    supplier_invoices: 'supplier_invoice_lines',
    purchase_requests: 'purchase_request_lines',
    subcontractor_certificates: 'subcontractor_certificate_lines',
    owner_billing: 'owner_billing_lines',
  }
  const childTable = childLineMap[docType]
  if (childTable) {
    const childFkMap: Partial<Record<DocType, string>> = {
      supplier_invoices: 'invoice_id',
      purchase_requests: 'pr_id',
      subcontractor_certificates: 'certificate_id',
      owner_billing: 'owner_billing_document_id',
    }
    const fk = childFkMap[docType]!
    await admin.from(childTable).delete().eq(fk, id).throwOnError()
  }

  const { error } = await admin.from(cfg.table).delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/company/settings/data-reset')
}

export async function bulkUpdateDocumentNumbers(
  docType: DocType,
  updates: { id: string; newNumber: string }[]
): Promise<{ updated: number; errors: string[] }> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]
  
  let updated = 0
  const errors: string[] = []

  for (const upd of updates) {
    if (!upd.newNumber.trim()) {
      errors.push(`ID ${upd.id}: الرقم فارغ`)
      continue
    }
    const { error } = await admin
      .from(cfg.table)
      .update({ [cfg.numberCol]: upd.newNumber.trim() })
      .eq('id', upd.id)
    
    if (error) {
      errors.push(`${upd.newNumber}: ${error.message}`)
    } else {
      updated++
    }
  }

  revalidatePath('/company/settings/data-reset')
  return { updated, errors }
}

// ── Re-sequencing ──────────────────────────────────────────────────

export async function resequenceDocuments(
  docType: DocType,
  prefix: string,
  startFrom: number,
  projectId?: string
): Promise<{ updated: number; preview: { id: string; oldNo: string; newNo: string }[] }> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]

  let query = admin.from(cfg.table).select(`id, ${cfg.numberCol}, ${cfg.dateCol}`).order(cfg.dateCol, { ascending: true })
  if (projectId && cfg.hasProject && cfg.projectCol) {
    query = query.eq(cfg.projectCol, projectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data || []
  const preview: { id: string; oldNo: string; newNo: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any
    const newNo = `${prefix}${String(startFrom + i).padStart(4, '0')}`
    preview.push({ id: row.id, oldNo: row[cfg.numberCol], newNo })
  }

  // Apply updates
  let updated = 0
  for (const p of preview) {
    const { error: updErr } = await admin
      .from(cfg.table)
      .update({ [cfg.numberCol]: p.newNo })
      .eq('id', p.id)
    if (!updErr) updated++
  }

  revalidatePath('/company/settings/data-reset')
  return { updated, preview }
}

export async function previewResequence(
  docType: DocType,
  prefix: string,
  startFrom: number,
  projectId?: string
): Promise<{ id: string; oldNo: string; newNo: string }[]> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]

  let query = admin.from(cfg.table).select(`id, ${cfg.numberCol}, ${cfg.dateCol}`).order(cfg.dateCol, { ascending: true })
  if (projectId && cfg.hasProject && cfg.projectCol) {
    query = query.eq(cfg.projectCol, projectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data || []).map((row: any, i: number) => ({
    id: row.id,
    oldNo: row[cfg.numberCol] || '',
    newNo: `${prefix}${String(startFrom + i).padStart(4, '0')}`,
  }))
}

// ── Quick Clean ────────────────────────────────────────────────────

export async function deleteDraftDocuments(docType: DocType): Promise<{ deleted: number }> {
  const admin = await assertSuperAdmin()
  const cfg = DOC_TYPE_CONFIG[docType]

  const { count, error } = await admin
    .from(cfg.table)
    .delete({ count: 'exact' })
    .eq('status', 'draft')
  
  if (error) throw new Error(error.message)
  revalidatePath('/company/settings/data-reset')
  return { deleted: count || 0 }
}

export async function deleteOldAuditLogs(olderThanDays: number): Promise<{ deleted: number }> {
  const admin = await assertSuperAdmin()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const { count, error } = await admin
    .from('audit_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffDate.toISOString())
  
  if (error) throw new Error(error.message)
  revalidatePath('/company/settings/audit-log')
  return { deleted: count || 0 }
}

// ── Projects list (for scope filter) ───────────────────────────────

export async function getProjectsList(): Promise<{ id: string; arabic_name: string }[]> {
  const admin = await assertSuperAdmin()
  const { data, error } = await admin
    .from('projects')
    .select('id, arabic_name')
    .order('arabic_name')
  
  if (error) throw new Error(error.message)
  return data || []
}

// ── CSV Export ─────────────────────────────────────────────────────

export async function exportDocumentsCSV(
  docType: DocType,
  projectId?: string
): Promise<string> {
  const rows = await getDocumentsByType(docType, projectId)
  
  const headers = ['الرقم', 'التاريخ', 'الحالة', 'الجهة', 'المشروع']
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.doc_no}"`,
      `"${r.doc_date}"`,
      `"${r.status}"`,
      `"${r.party_name || ''}"`,
      `"${r.project_name || ''}"`,
    ].join(','))
  ]
  
  return lines.join('\n')
}

// ── DB Stats ────────────────────────────────────────────────────────

export type DbStatRow = { label: string; table: string; count: number }

export async function getDbStats(): Promise<DbStatRow[]> {
  const admin = await assertSuperAdmin()

  const tables = [
    { label: 'المشاريع', table: 'projects' },
    { label: 'فواتير الموردين', table: 'supplier_invoices' },
    { label: 'طلبات الشراء', table: 'purchase_requests' },
    { label: 'سندات الصرف', table: 'payment_vouchers' },
    { label: 'مشتريات الشركة', table: 'company_purchase_invoices' },
    { label: 'مستخلصات مقاولو الباطن', table: 'subcontractor_certificates' },
    { label: 'عقود مقاولو الباطن', table: 'subcontract_agreements' },
    { label: 'فواتير المالك', table: 'owner_billing_documents' },
    { label: 'بنود الأعمال', table: 'project_work_items' },
    { label: 'أذون الصرف', table: 'store_issues' },
    { label: 'حركات المخزن', table: 'stock_ledger' },
    { label: 'أرصدة المخزن', table: 'stock_balances' },
    { label: 'المصروفات النثرية', table: 'petty_expenses' },
    { label: 'الحسابات المالية', table: 'financial_accounts' },
    { label: 'الحركات المالية', table: 'financial_transactions' },
    { label: 'جهات التعامل', table: 'parties' },
    { label: 'المستخدمون', table: 'users' },
    { label: 'سجل النشاط', table: 'audit_logs' },
    { label: 'المخازن', table: 'warehouses' },
    { label: 'الأصناف', table: 'items' },
  ]

  const counts = await Promise.all(
    tables.map(async t => {
      const { count } = await admin.from(t.table).select('id', { count: 'exact', head: true })
      return { ...t, count: count || 0 }
    })
  )

  return counts
}
