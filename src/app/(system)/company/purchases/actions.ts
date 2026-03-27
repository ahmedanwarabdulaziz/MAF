'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// ─── Expense Categories ───────────────────────────────────────────────────────

export async function getExpenseCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('category_code')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createExpenseCategory(formData: {
  category_code: string
  arabic_name: string
  english_name?: string
  parent_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .single()
  if (!company) throw new Error('لا يوجد شركة')

  const { error } = await supabase.from('expense_categories').insert({
    company_id: company.id,
    category_code: formData.category_code,
    arabic_name: formData.arabic_name,
    english_name: formData.english_name || null,
    parent_id: formData.parent_id || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/company/purchases/expense-categories')
}

export async function updateExpenseCategory(id: string, formData: {
  arabic_name: string
  english_name?: string
  parent_id?: string | null
  is_active: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('expense_categories')
    .update({
      arabic_name: formData.arabic_name,
      english_name: formData.english_name || null,
      parent_id: formData.parent_id || null,
      is_active: formData.is_active,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/company/purchases/expense-categories')
}

// ─── Company Purchase Invoices ────────────────────────────────────────────────

export async function getCompanyPurchaseInvoices(filters?: {
  status?: string
  invoice_type?: string
  supplier_party_id?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('company_purchase_invoices')
    .select(`
      *,
      supplier:parties!supplier_party_id(id, arabic_name),
      expense_category:expense_categories(id, arabic_name, category_code),
      branch:branches(id, arabic_name),
      warehouse:warehouses(id, arabic_name)
    `)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.invoice_type) query = query.eq('invoice_type', filters.invoice_type)
  if (filters?.supplier_party_id) query = query.eq('supplier_party_id', filters.supplier_party_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCompanyPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_purchase_invoices')
    .select(`
      *,
      supplier:parties!supplier_party_id(id, arabic_name),
      expense_category:expense_categories(id, arabic_name, category_code),
      branch:branches(id, arabic_name),
      warehouse:warehouses(id, arabic_name),
      lines:company_purchase_invoice_lines(
        *,
        item:items(id, arabic_name, item_code),
        line_category:expense_categories(id, arabic_name)
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function createCompanyPurchaseInvoice(formData: {
  supplier_party_id: string
  invoice_no: string
  invoice_date: string
  invoice_type: 'general_expense' | 'stock_purchase'
  expense_category_id?: string | null
  branch_id?: string | null
  warehouse_id?: string | null
  gross_amount: number
  tax_amount: number
  discount_amount: number
  net_amount: number
  notes?: string
  lines: {
    item_id?: string | null
    description: string
    expense_category_id?: string | null
    quantity: number
    unit_price: number
    line_gross: number
    line_net: number
  }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .single()
  if (!company) throw new Error('لا يوجد شركة')

  // Insert header
  const { data: invoice, error: invErr } = await supabase
    .from('company_purchase_invoices')
    .insert({
      company_id: company.id,
      supplier_party_id: formData.supplier_party_id,
      invoice_no: formData.invoice_no,
      invoice_date: formData.invoice_date,
      invoice_type: formData.invoice_type,
      expense_category_id: formData.expense_category_id || null,
      branch_id: formData.branch_id || null,
      warehouse_id: formData.warehouse_id || null,
      gross_amount: formData.gross_amount,
      tax_amount: formData.tax_amount,
      discount_amount: formData.discount_amount,
      net_amount: formData.net_amount,
      outstanding_amount: formData.net_amount,
      notes: formData.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invErr || !invoice) throw new Error(invErr?.message ?? 'خطأ في إنشاء الفاتورة')

  // Insert lines
  if (formData.lines.length > 0) {
    const { error: linesErr } = await supabase
      .from('company_purchase_invoice_lines')
      .insert(
        formData.lines.map(line => ({
          invoice_id: invoice.id,
          item_id: line.item_id || null,
          description: line.description,
          expense_category_id: line.expense_category_id || null,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_gross: line.line_gross,
          line_net: line.line_net,
        }))
      )
    if (linesErr) throw new Error(linesErr.message)
  }

  revalidatePath('/company/purchases')
  return invoice.id
}

export async function postCompanyPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { error } = await supabase.rpc('post_company_purchase_invoice', {
    p_invoice_id: id,
    p_user_id: user.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${id}`)
}

export async function deleteCompanyPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('company_purchase_invoices')
    .select('status')
    .eq('id', id)
    .single()

  if (inv?.status !== 'draft') throw new Error('يمكن حذف فواتير المسودة فقط')

  const { error } = await supabase
    .from('company_purchase_invoices')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/company/purchases')
}

// Get suppliers (parties of type supplier)
export async function getSupplierParties() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parties')
    .select('id, arabic_name, party_roles!inner(role_type)')
    .eq('party_roles.role_type', 'supplier')
    .eq('is_active', true)
    .order('arabic_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Get company branches
export async function getCompanyBranches() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branches')
    .select('id, arabic_name')
    .eq('is_active', true)
    .order('arabic_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Get all active warehouses available
export async function getMainWarehouses() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, arabic_name, warehouse_code')
    .eq('is_active', true)
    .order('arabic_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Get items for stock purchase lines
export async function getItems() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, arabic_name, item_code, primary_unit_id, unit:units!primary_unit_id(arabic_name)')
    .eq('is_active', true)
    .order('arabic_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Pay a company purchase invoice
export async function payCompanyInvoice(invoiceId: string, payload: {
  financial_account_id: string
  payment_method: string
  payment_date: string
  amount: number
  receipt_reference_no?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  // 1. Fetch invoice to ensure it is posted & has outstanding
  const { data: inv, error: invErr } = await supabase
    .from('company_purchase_invoices')
    .select('id, company_id, supplier_party_id, outstanding_amount, status')
    .eq('id', invoiceId)
    .single()

  if (invErr || !inv) throw new Error('الفاتورة غير موجودة')
  if (!['posted', 'partially_paid'].includes(inv.status)) {
    throw new Error('لا يمكن سداد فاتورة غير مُرحّلة')
  }
  if (payload.amount > inv.outstanding_amount) {
    throw new Error(`المبلغ المدخل (${payload.amount}) أكبر من المتبقي (${inv.outstanding_amount})`)
  }

  // 2. Generate random voucher number
  const voucherNo = 'PV-CMP-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 3. Create Voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: inv.company_id,
      project_id: null,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || 'سداد فاتورة مشتريات شركة',
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء مستند الدفع')

  // 4. Link Party
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: inv.supplier_party_id,
      paid_amount: payload.amount
    }])
    .select('id')
    .single()

  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المورد بالدفع')

  // 5. Create Allocation
  const { error: aErr } = await supabase.from('payment_allocations').insert([{
    payment_voucher_party_id: partyLink.id,
    source_entity_type: 'company_purchase_invoice',
    source_entity_id: inv.id,
    allocated_amount: payload.amount
  }])

  if (aErr) throw new Error(aErr.message)

  // 6. Execute RPC to commit
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${invoiceId}`)
  revalidatePath('/company/treasury')
}

// Get global supplier balances summary (Company + Projects)
export async function getGlobalSupplierBalances() {
  const supabase = await createClient()
  
  const [companyRes, projectsRes, pRes] = await Promise.all([
    supabase.from('company_supplier_balances_view').select('*'),
    supabase.from('supplier_account_summaries_view').select('*'),
    supabase.from('projects').select('id, arabic_name')
  ])

  if (companyRes.error) throw new Error(companyRes.error.message)
  if (projectsRes.error) throw new Error(projectsRes.error.message)

  const pMap: Record<string, string> = {}
  pRes.data?.forEach(p => pMap[p.id] = p.arabic_name)

  const rawScopes: any[] = []

  // 1. Process Company Invoices
  companyRes.data.forEach(row => {
    rawScopes.push({
      supplier_party_id: row.supplier_party_id,
      supplier_name: row.supplier_name,
      scope: 'الشركة الرئيسية',
      total_gross: Number(row.total_gross || 0),
      total_tax: Number(row.total_tax || 0),
      total_discount: Number(row.total_discount || 0),
      total_net: Number(row.total_net || 0),
      total_paid: Number(row.total_paid || 0),
      total_outstanding: Number(row.total_outstanding || 0),
    })
  })

  // 2. Process Project Invoices
  projectsRes.data.forEach(row => {
    const pName = pMap[row.project_id] || 'مشروع غير معروف'
    rawScopes.push({
      supplier_party_id: row.supplier_party_id,
      supplier_name: row.supplier_name || 'غير معروف',
      scope: pName,
      total_gross: Number(row.total_invoiced_gross || 0),
      total_tax: Number(row.total_invoiced_tax || 0),
      total_discount: Number(row.total_discount || 0),
      total_net: Number(row.total_invoiced_net || 0),
      total_paid: Number(row.total_paid || 0),
      total_outstanding: Number(row.total_outstanding || 0),
    })
  })

  return rawScopes
}
