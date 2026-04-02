'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// ─── Cost Centers ───────────────────────────────────────────────────────────────

export async function getCompanyCostCenters() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*')
    .order('cost_center_code')
  if (error) throw new Error(error.message)
  return data ?? []
}

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

  const { data: newCat, error } = await supabase.from('expense_categories').insert({
    company_id: company.id,
    category_code: formData.category_code,
    arabic_name: formData.arabic_name,
    english_name: formData.english_name || null,
    parent_id: formData.parent_id || null,
  }).select('id').single()

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'expense_categories',
    entity_id: newCat.id,
    description: `تم إضافة قسم مصروفات المشتريات: ${formData.arabic_name} (${formData.category_code})`
  })

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

  await writeAuditLog({
    action: 'UPDATE',
    entity_type: 'expense_categories',
    entity_id: id,
    description: `تم تحديث قسم مصروفات المشتريات (${formData.arabic_name}) إلى حالة: ${formData.is_active ? 'فعال' : 'غير فعال'}`
  })

  revalidatePath('/company/purchases/expense-categories')
}

// ─── Company Purchase Invoices ────────────────────────────────────────────────

export async function getCompanyPurchaseInvoices(filters?: {
  status?: string
  invoice_type?: string
  supplier_party_id?: string
  date_from?: string
  date_to?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('company_purchase_invoices')
    .select(`
      *,
      supplier:parties!supplier_party_id(id, arabic_name),
      expense_category:expense_categories(id, arabic_name, category_code),
      cost_center:cost_centers(id, arabic_name, cost_center_code),
      branch:branches(id, arabic_name),
      warehouse:warehouses(id, arabic_name)
    `)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.invoice_type) query = query.eq('invoice_type', filters.invoice_type)
  if (filters?.supplier_party_id) query = query.eq('supplier_party_id', filters.supplier_party_id)
  if (filters?.date_from) query = query.gte('invoice_date', filters.date_from)
  if (filters?.date_to) query = query.lte('invoice_date', filters.date_to)

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
      cost_center:cost_centers(id, arabic_name, cost_center_code),
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
  supplier_party_id?: string | null
  invoice_no: string
  invoice_date: string
  invoice_type: 'general_expense' | 'stock_purchase'
  expense_category_id?: string | null
  cost_center_id?: string | null
  branch_id?: string | null
  warehouse_id?: string | null
  gross_amount: number
  tax_amount: number
  discount_amount: number
  net_amount: number
  attachment_urls?: string[]
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

  if (formData.invoice_type === 'general_expense' && !formData.cost_center_id) {
    throw new Error('مركز التكلفة مطلوب لمصروفات الشركة')
  }

  // Insert header with retry logic for unique constraint (23505)
  let finalInvoiceNo = formData.invoice_no
  let invoice: any = null
  let invErr: any = null
  let retries = 50

  const docType = formData.invoice_type === 'general_expense' ? 'company_expense_invoices' : 'company_purchase_invoices'
  const prefix  = formData.invoice_type === 'general_expense' ? 'EXP' : 'PINV'

  while (retries > 0) {
    const { data: inserted, error } = await supabase
      .from('company_purchase_invoices')
      .insert({
        company_id: company.id,
        supplier_party_id: formData.supplier_party_id || null,
        invoice_no: finalInvoiceNo,
        invoice_date: formData.invoice_date,
        invoice_type: formData.invoice_type,
        expense_category_id: formData.expense_category_id || null,
        cost_center_id: formData.cost_center_id || null,
        branch_id: formData.branch_id || null,
        warehouse_id: formData.warehouse_id || null,
        gross_amount: formData.gross_amount,
        tax_amount: formData.tax_amount,
        discount_amount: formData.discount_amount,
        net_amount: formData.net_amount,
        outstanding_amount: formData.net_amount,
        attachment_urls: formData.attachment_urls || [],
        notes: formData.notes || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error && error.code === '23505') {
      const { data: nextCode } = await supabase.rpc('get_next_document_no', { 
        p_company_id: company.id, 
        p_doc_type: docType, 
        p_prefix: prefix 
      })
      if (nextCode) {
        finalInvoiceNo = nextCode
        retries--
        continue
      }
    }
    
    invoice = inserted
    invErr = error
    break
  }

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

  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'company_purchase_invoices',
    entity_id: invoice.id,
    description: `تم إنشاء الفاتورة / المصروف رقم: ${finalInvoiceNo} (مشتريات الشركة)`
  })

  revalidatePath('/company/purchases')
  return invoice.id
}

export async function updateCompanyPurchaseInvoice(id: string, formData: {
  supplier_party_id?: string | null
  invoice_no: string
  invoice_date: string
  invoice_type: 'general_expense' | 'stock_purchase'
  expense_category_id?: string | null
  cost_center_id?: string | null
  branch_id?: string | null
  warehouse_id?: string | null
  gross_amount: number
  tax_amount: number
  discount_amount: number
  net_amount: number
  attachment_urls?: string[]
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

  const { data: invCheck } = await supabase
    .from('company_purchase_invoices')
    .select('status')
    .eq('id', id)
    .single()
  
  if (invCheck?.status !== 'draft') throw new Error('لا يمكن تعديل إلا مسودات الفواتير')

  if (formData.invoice_type === 'general_expense' && !formData.cost_center_id) {
    throw new Error('مركز التكلفة مطلوب لمصروفات الشركة')
  }

  const { error: invErr } = await supabase
    .from('company_purchase_invoices')
    .update({
      supplier_party_id: formData.supplier_party_id || null,
      invoice_no: formData.invoice_no,
      invoice_date: formData.invoice_date,
      invoice_type: formData.invoice_type,
      expense_category_id: formData.expense_category_id || null,
      cost_center_id: formData.cost_center_id || null,
      branch_id: formData.branch_id || null,
      warehouse_id: formData.warehouse_id || null,
      gross_amount: formData.gross_amount,
      tax_amount: formData.tax_amount,
      discount_amount: formData.discount_amount,
      net_amount: formData.net_amount,
      outstanding_amount: formData.net_amount,
      attachment_urls: formData.attachment_urls || [],
      notes: formData.notes || null,
    })
    .eq('id', id)

  if (invErr) throw new Error(invErr.message)

  await supabase.from('company_purchase_invoice_lines').delete().eq('invoice_id', id)

  if (formData.lines.length > 0) {
    const { error: linesErr } = await supabase
      .from('company_purchase_invoice_lines')
      .insert(
        formData.lines.map(line => ({
          invoice_id: id,
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

  await writeAuditLog({
    action: 'UPDATE',
    entity_type: 'company_purchase_invoices',
    entity_id: id,
    description: `تم تعديل مسودة الفاتورة / المصروف رقم: ${formData.invoice_no} (مشتريات الشركة)`
  })

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${id}`)
}


export async function postCompanyPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: inv } = await supabase
    .from('company_purchase_invoices')
    .select('invoice_no')
    .eq('id', id)
    .single()

  const { error } = await supabase.rpc('post_company_purchase_invoice', {
    p_invoice_id: id,
    p_user_id: user.id,
  })
  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'APPROVE',
    entity_type: 'company_purchase_invoices',
    entity_id: id,
    description: `تم إعتماد وترحيل الفاتورة / المصروف رقم: ${inv?.invoice_no || ''} (مشتريات الشركة)`
  })

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${id}`)
}

export async function deleteCompanyPurchaseInvoice(id: string) {
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('company_purchase_invoices')
    .select('status, invoice_no')
    .eq('id', id)
    .single()

  if (inv?.status !== 'draft') throw new Error('يمكن حذف فواتير المسودة فقط')

  const { error } = await supabase
    .from('company_purchase_invoices')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'DELETE',
    entity_type: 'company_purchase_invoices',
    entity_id: id,
    description: `تم حذف مسودة الفاتورة / المصروف رقم: ${inv?.invoice_no || ''} (مشتريات الشركة)`
  })

  revalidatePath('/company/purchases')
}

// ─── Company Purchase Returns ───────────────────────────────────────────────────

export async function getCompanyPurchaseReturns(invoiceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_purchase_returns')
    .select(`
      *,
      lines:company_purchase_return_lines(
        *,
        original_line:company_purchase_invoice_lines(
          id, item_id, description, item:items(id, arabic_name)
        )
      )
    `)
    .eq('original_invoice_id', invoiceId)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCompanyPurchaseReturn(formData: {
  original_invoice_id: string
  return_no: string
  return_date: string
  gross_amount: number
  tax_amount: number
  discount_amount: number
  net_amount: number
  notes?: string
  lines: {
    original_line_id: string
    return_quantity: number
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
  const { data: retHead, error: headErr } = await supabase
    .from('company_purchase_returns')
    .insert({
      company_id: company.id,
      original_invoice_id: formData.original_invoice_id,
      return_no: formData.return_no,
      return_date: formData.return_date,
      gross_amount: formData.gross_amount,
      tax_amount: formData.tax_amount,
      discount_amount: formData.discount_amount,
      net_amount: formData.net_amount,
      notes: formData.notes || null,
      created_by: user.id
    })
    .select('id')
    .single()

  if (headErr || !retHead) throw new Error(headErr?.message || 'خطأ في إنشاء مستند المرتجع')

  // Insert lines
  if (formData.lines.length > 0) {
    const { error: linesErr } = await supabase
      .from('company_purchase_return_lines')
      .insert(
        formData.lines.map(line => ({
          return_id: retHead.id,
          original_line_id: line.original_line_id,
          return_quantity: line.return_quantity,
          unit_price: line.unit_price,
          line_gross: line.line_gross,
          line_net: line.line_net
        }))
      )
    if (linesErr) throw new Error(linesErr.message)
  }

  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'company_purchase_invoices',
    entity_id: formData.original_invoice_id,
    description: `تم إنشاء مرتجع مسودة رقم: ${formData.return_no} لفاتورة المشتريات`
  })

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${formData.original_invoice_id}`)
  return retHead.id
}

export async function postCompanyPurchaseReturn(returnId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: retHead } = await supabase
    .from('company_purchase_returns')
    .select('return_no, original_invoice_id')
    .eq('id', returnId)
    .single()

  const { error } = await supabase.rpc('post_company_purchase_return', {
    p_return_id: returnId,
    p_user_id: user.id
  })

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'APPROVE',
    entity_type: 'company_purchase_invoices',
    entity_id: retHead?.original_invoice_id || returnId,
    description: `تم إعتماد وترحيل المرتجع رقم: ${retHead?.return_no || ''}`
  })

  revalidatePath('/company/purchases')
  if (retHead?.original_invoice_id) {
    revalidatePath(`/company/purchases/${retHead.original_invoice_id}`)
  }
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
    .select('id, arabic_name, item_code, primary_unit_id, item_group:item_groups(id, arabic_name), unit:units!primary_unit_id(arabic_name)')
    .eq('is_active', true)
    .order('arabic_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Get item groups for hierarchical display
export async function getItemGroups() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('item_groups')
    .select('id, arabic_name, group_code, parent_group_id')
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
    .select('id, company_id, supplier_party_id, outstanding_amount, status, invoice_no')
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

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'company_purchase_invoices',
    entity_id: invoiceId,
    description: `تم سداد مبلغ ${payload.amount} للفاتورة / المصروف رقم: ${inv.invoice_no} بموجب سند دفع رقم: ${voucherNo} (مشتريات الشركة)`
  })

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/${invoiceId}`)
  revalidatePath('/company/treasury')
}

// Bulk pay a supplier across multiple invoices (oldest first, partial on last)
export async function bulkPaySupplier(supplierPartyId: string, payload: {
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

  const { data: company } = await supabase.from('companies').select('id').single()
  if (!company) throw new Error('لا يوجد شركة')

  // 1. Fetch all unpaid/partially-paid invoices for this supplier, sorted oldest first
  const { data: invoices, error: invErr } = await supabase
    .from('company_purchase_invoices')
    .select('id, invoice_no, outstanding_amount, invoice_date, supplier_party_id, company_id')
    .eq('supplier_party_id', supplierPartyId)
    .in('status', ['posted', 'partially_paid'])
    .gt('outstanding_amount', 0)
    .order('invoice_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (invErr) throw new Error(invErr.message)
  if (!invoices || invoices.length === 0) throw new Error('لا توجد فواتير مستحقة السداد لهذا المورد')

  // 2. Calculate allocation plan
  let remaining = payload.amount
  const allocations: { invoiceId: string; invoiceNo: string; amount: number }[] = []

  for (const inv of invoices) {
    if (remaining <= 0) break
    const toAllocate = Math.min(remaining, Number(inv.outstanding_amount))
    allocations.push({ invoiceId: inv.id, invoiceNo: inv.invoice_no, amount: toAllocate })
    remaining -= toAllocate
  }

  if (allocations.length === 0) throw new Error('لا يمكن توزيع المبلغ على أي فاتورة')

  // 3. Generate voucher number
  const voucherNo = 'PV-BULK-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 4. Create one payment voucher for the whole payment
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: company.id,
      project_id: null,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || `دفعة شاملة للمورد - ${allocations.length} فاتورة`,
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء مستند الدفع')

  // 5. Link supplier party
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: supplierPartyId,
      paid_amount: payload.amount
    }])
    .select('id')
    .single()

  if (pErr || !partyLink) throw new Error(pErr?.message || 'خطأ في ربط المورد بالدفع')

  // 6. Create allocations for each invoice
  const { error: aErr } = await supabase.from('payment_allocations').insert(
    allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type: 'company_purchase_invoice',
      source_entity_id: a.invoiceId,
      allocated_amount: a.amount
    }))
  )

  if (aErr) throw new Error(aErr.message)

  // 7. Post the voucher (updates balances via RPC)
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'payment_vouchers',
    entity_id: voucher.id,
    description: `دفعة شاملة للمورد - سند رقم: ${voucherNo} - إجمالي: ${payload.amount} ج.م موزع على ${allocations.length} فاتورة`
  })

  revalidatePath('/company/purchases')
  revalidatePath(`/company/purchases/suppliers/${supplierPartyId}`)
  revalidatePath('/company/treasury')

  return { voucherNo, allocations }
}

// Get global supplier balances summary (Company + Projects)
export async function getGlobalSupplierBalances() {
  const supabase = await createClient()
  
  const [companyRes, projectsRes, pRes, discRes] = await Promise.all([
    supabase.from('company_purchase_invoices').select(`
      supplier_party_id,
      gross_amount,
      tax_amount,
      discount_amount,
      net_amount,
      paid_to_date,
      outstanding_amount,
      supplier:parties!supplier_party_id(id, arabic_name)
    `).in('status', ['posted', 'partially_paid', 'paid']),
    supabase.from('supplier_account_summaries_view').select('*'),
    supabase.from('projects').select('id, arabic_name'),
    supabase.from('supplier_invoices').select('supplier_party_id').eq('discrepancy_status', 'pending')
  ])

  if (companyRes.error) throw new Error(companyRes.error.message)
  if (projectsRes.error) throw new Error(projectsRes.error.message)
  
  const suppliersWithDisc = new Set(discRes?.data?.map(x => x.supplier_party_id) || [])
  console.log("=== DEBUG SUPPLIER BALANCES ===");
  console.log("Company invoices aggregated:", companyRes.data?.length);
  console.log("Projects invoices aggregated:", projectsRes.data?.length);

  const pMap: Record<string, string> = {}
  pRes.data?.forEach(p => pMap[p.id] = p.arabic_name)

  const rawScopes: any[] = []

  // 1. Process Company Invoices (Manual Grouping)
  const compMap: Record<string, any> = {}
  companyRes.data?.forEach(row => {
    const sId = row.supplier_party_id
    if (!compMap[sId]) {
      compMap[sId] = {
        supplier_party_id: sId,
        supplier_name: (row.supplier as any)?.arabic_name || 'غير معروف',
        scope: 'الشركة الرئيسية',
        total_gross: 0, total_tax: 0, total_discount: 0, total_net: 0, total_paid: 0, total_outstanding: 0, advance_balance: 0, total_return: 0,
        has_pending_discrepancies: suppliersWithDisc.has(sId)
      }
    }
    compMap[sId].total_gross += Number(row.gross_amount || 0)
    compMap[sId].total_tax += Number(row.tax_amount || 0)
    compMap[sId].total_discount += Number(row.discount_amount || 0)
    compMap[sId].total_net += Number(row.net_amount || 0)
    compMap[sId].total_paid += Number(row.paid_to_date || 0)
    compMap[sId].total_outstanding += Number(row.outstanding_amount || 0)
  })

  Object.values(compMap).forEach(val => rawScopes.push(val))

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
      advance_balance: 0,
      total_return: Number(row.total_returned_net || 0),
      has_pending_discrepancies: suppliersWithDisc.has(row.supplier_party_id)
    })
  })

  // 3. Process Subcontractor Certificates
  const { data: certs } = await supabase
    .from('subcontractor_certificates')
    .select(`
      project_id,
      subcontract_agreement_id,
      subcontractor_party_id,
      gross_amount,
      taaliya_amount,
      other_deductions_amount,
      net_amount,
      paid_to_date,
      outstanding_amount,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .in('status', ['approved', 'paid_in_full'])
    .order('created_at', { ascending: false })

  const { data: voucherParties } = await supabase
    .from('payment_voucher_parties')
    .select(`
      party_id,
      paid_amount,
      voucher:payment_voucher_id(project_id, status)
    `)

  const partyVoucherPayments = new Map<string, number>()
  if (voucherParties) {
    for (const pvp of voucherParties) {
      const v: any = Array.isArray(pvp.voucher) ? pvp.voucher[0] : pvp.voucher
      if (v?.status === 'posted' && v?.project_id) {
        const key = `${v.project_id}_${pvp.party_id}`
        const existing = partyVoucherPayments.get(key) || 0
        partyVoucherPayments.set(key, existing + Number(pvp.paid_amount || 0))
      }
    }
  }

  const subAggregated = new Map<string, any>()
  const latestCertsByAgreement = new Map<string, any>()
  
  if (certs) {
    for (const c of certs) {
      if (!latestCertsByAgreement.has(c.subcontract_agreement_id)) {
        latestCertsByAgreement.set(c.subcontract_agreement_id, c)
      }
    }
  }

  if (latestCertsByAgreement.size > 0) {
    for (const c of latestCertsByAgreement.values()) {
      const pId = c.subcontractor_party_id
      const projId = c.project_id
      const key = `${projId}_${pId}`
      
      if (!subAggregated.has(key)) {
        const subInfo: any = Array.isArray(c.subcontractor) ? c.subcontractor[0] : c.subcontractor
        const projName = pMap[projId] || 'مشروع غير معروف'
        subAggregated.set(key, {
          supplier_party_id: pId,
          supplier_name: subInfo?.arabic_name || 'مقاول غير معروف',
          scope: `${projName} (مقاولي الباطن)`,
          total_gross: 0,
          total_tax: 0, // certificates don't use tax directly like invoices here
          total_discount: 0,
          total_net: 0,
          total_paid: 0,
          total_return: 0,
          total_outstanding: 0,
          advance_balance: 0,
          has_pending_discrepancies: suppliersWithDisc.has(pId)
        })
      }
      
      const current = subAggregated.get(key)
      // For certificates, gross - deductions = net
      current.total_gross += Number(c.gross_amount)
      current.total_discount += (Number(c.taaliya_amount) + Number(c.other_deductions_amount))
      current.total_net += Number(c.net_amount)
      current.total_paid += Number(c.paid_to_date)
      current.total_outstanding += Number(c.outstanding_amount)
    }
  }

  // Handle voucher payments overriding if cert paid is 0
  for (const [key, row] of subAggregated.entries()) {
    const voucherTotal = partyVoucherPayments.get(key) || 0
    if (row.total_paid === 0 && voucherTotal > 0) {
      row.total_paid = voucherTotal
      row.total_outstanding = Math.max(0, row.total_net - voucherTotal)
    }
    rawScopes.push(row)
  }

  // 4. Process Advance Payments (so parties with only advances show up)
  const adminSupabase = createAdminClient()
  const { data: advanceBals, error: adErr } = await adminSupabase
    .from('party_advance_balances')
    .select('project_id, party_id, party_type, balance_remaining, party:party_id(arabic_name)')
    .gt('balance_remaining', 0)

  if (adErr) {
    throw new Error('Advance query error: ' + adErr.message)
  }

  if (advanceBals) {
    for (const adv of advanceBals) {
      const pName = adv.project_id ? (pMap[adv.project_id] || 'مشروع غير معروف') : 'الشركة الرئيسية'
      const partyObj: any = Array.isArray(adv.party) ? adv.party[0] : adv.party
      const keyScope = adv.party_type === 'contractor' ? `${pName} (مقاولي الباطن)` : pName

      rawScopes.push({
        supplier_party_id: adv.party_id,
        supplier_name: partyObj?.arabic_name || 'غير معروف',
        scope: keyScope,
        total_gross: 0,
        total_tax: 0,
        total_discount: 0,
        total_net: 0,
        total_paid: 0,
        total_return: 0,
        total_outstanding: 0,
        advance_balance: Number(adv.balance_remaining),
        has_pending_discrepancies: suppliersWithDisc.has(adv.party_id)
      })
    }
  }

  return rawScopes
}

// ─── Vendor Advance Balances ───────────────────────────────────────────────────

export async function getVendorAdvanceBalances(partyId: string) {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('party_advance_balances')
    .select('*, project:project_id(arabic_name)')
    .eq('party_id', partyId)
    .gt('balance_remaining', 0)
    .order('updated_at', { ascending: false })
  
  if (error) {
    console.error('getVendorAdvanceBalances error:', error)
    return []
  }
  return data || []
}
