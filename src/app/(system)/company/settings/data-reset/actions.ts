'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Super admin guard
async function assertSuperAdmin() {
  const userClient = createClient()
  const { data: { session } } = await userClient.auth.getSession()
  const user = session?.user
  if (!user) throw new Error('غير مصرح')
  
  const { data: profile, error } = await userClient.from('users').select('is_super_admin').eq('id', user.id).single()
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
  await supabase.from('employee_custody_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError()
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
