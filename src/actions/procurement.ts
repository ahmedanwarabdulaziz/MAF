'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// -------------------------------------------------------------
// PURCHASE REQUESTS
// -------------------------------------------------------------

export async function getPurchaseRequests(projectId?: string) {
  const supabase = createClient()
  let query = supabase.from('purchase_requests').select(`
    *,
    requester:requested_by(display_name),
    project:project_id(arabic_name)
  `).order('created_at', { ascending: false })
  
  if (projectId) query = query.eq('project_id', projectId)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPurchaseRequestDetails(prId: string) {
  const supabase = createClient()
  
  const { data: header, error: hErr } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      requester:requested_by(display_name),
      project:project_id(arabic_name, company_id)
    `)
    .eq('id', prId)
    .single()
    
  if (hErr) throw hErr

  const { data: lines, error: lErr } = await supabase
    .from('purchase_request_lines')
    .select(`
      *,
      item:item_id(item_code, arabic_name, primary_unit_id, unit:primary_unit_id(arabic_name))
    `)
    .eq('pr_id', prId)
    .order('created_at', { ascending: true })

  if (lErr) throw lErr
  
  return { ...header, lines }
}

export async function createPurchaseRequest(payload: {
  project_id: string,
  request_no: string,
  request_date: string,
  required_by_date?: string,
  notes?: string,
  lines: Array<{
    item_id: string,
    requested_quantity: number,
    estimated_unit_price?: number,
    notes?: string
  }>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  const { data: pr, error: prErr } = await supabase
    .from('purchase_requests')
    .insert([{
      project_id: payload.project_id,
      company_id: project?.company_id,
      request_no: payload.request_no,
      request_date: payload.request_date,
      required_by_date: payload.required_by_date || null,
      notes: payload.notes || null,
      requested_by: user?.id,
      status: 'draft'
    }])
    .select()
    .single()

  if (prErr) throw prErr

  const prLines = payload.lines.map(l => ({
    pr_id: pr.id,
    item_id: l.item_id,
    requested_quantity: l.requested_quantity,
    estimated_unit_price: l.estimated_unit_price || 0,
    notes: l.notes || null
  }))

  const { error: linesErr } = await supabase.from('purchase_request_lines').insert(prLines)
  if (linesErr) throw linesErr

  await writeAuditLog({
    action: 'pr_created',
    entity_type: 'purchase_request',
    entity_id: pr.id,
    description: `إنشاء طلب شراء رقم ${pr.request_no} (${payload.lines.length} بند)`,
    metadata: { request_no: pr.request_no, project_id: payload.project_id, lines_count: payload.lines.length },
  })

  revalidatePath(`/projects/${payload.project_id}/procurement/requests`)
  return pr
}

export async function submitPurchaseRequest(prId: string, projectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('purchase_requests')
    .update({ status: 'pending_approval' })
    .eq('id', prId)
    .eq('status', 'draft')

  if (error) throw error

  await writeAuditLog({
    action: 'pr_submitted',
    entity_type: 'purchase_request',
    entity_id: prId,
    description: 'تقديم طلب شراء للموافقة',
    metadata: { pr_id: prId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/procurement/requests/${prId}`)
}

export async function approvePurchaseRequest(prId: string, projectId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('purchase_requests')
    .update({ 
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', prId)
    .eq('status', 'pending_approval')

  if (error) throw error

  await writeAuditLog({
    action: 'pr_approved',
    entity_type: 'purchase_request',
    entity_id: prId,
    description: 'اعتماد طلب شراء',
    metadata: { pr_id: prId, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/procurement/requests/${prId}`)
}


// -------------------------------------------------------------
// SUPPLIER INVOICES & RECEIPT
// -------------------------------------------------------------

export async function getSupplierInvoices(projectId?: string, supplierPartyId?: string) {
  const supabase = createClient()
  let query = supabase.from('supplier_invoices').select(`
    *,
    supplier:supplier_party_id(arabic_name),
    project:project_id(arabic_name)
  `).order('created_at', { ascending: false })
  
  if (projectId) query = query.eq('project_id', projectId)
  if (supplierPartyId) query = query.eq('supplier_party_id', supplierPartyId)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getInvoiceDetails(invoiceId: string) {
  const supabase = createClient()
  
  const { data: header, error: hErr } = await supabase
    .from('supplier_invoices')
    .select(`
      *,
      supplier:supplier_party_id(arabic_name),
      project:project_id(arabic_name, company_id)
    `)
    .eq('id', invoiceId)
    .single()
    
  if (hErr) throw hErr

  const { data: lines, error: lErr } = await supabase
    .from('supplier_invoice_lines')
    .select(`
      *,
      item:item_id(item_code, arabic_name, primary_unit_id, unit:primary_unit_id(arabic_name))
    `)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })

  if (lErr) throw lErr
  
  // also get confirmations
  const { data: confirmations } = await supabase
    .from('invoice_receipt_confirmations')
    .select('*')
    .eq('supplier_invoice_id', invoiceId)
    .single()

  return { ...header, lines, receipt_confirmation: confirmations || null }
}

export async function convertPrToInvoice(prId: string, supplierPartyId: string, invoiceNo: string, invoiceDate: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // 1. Get PR
  const { data: pr, error: prErr } = await supabase.from('purchase_requests').select('*').eq('id', prId).single()
  if (prErr) throw prErr

  // 2. Get PR Lines
  const { data: prLines } = await supabase.from('purchase_request_lines').select('*').eq('pr_id', prId)
  
  // 3. Create Draft Invoice
  let gross = 0
  prLines?.forEach(l => {
    gross += (l.requested_quantity * (l.estimated_unit_price || 0))
  })

  const { data: invoice, error: invErr } = await supabase
    .from('supplier_invoices')
    .insert([{
      project_id: pr.project_id,
      company_id: pr.company_id,
      supplier_party_id: supplierPartyId,
      pr_id: pr.id,
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
      status: 'draft',
      gross_amount: gross,
      net_amount: gross,
      outstanding_amount: gross,
      created_by: user?.id
    }])
    .select()
    .single()
    
  if (invErr) throw invErr

  // 4. Create Invoice Lines
  const invLines = prLines?.map(l => ({
    invoice_id: invoice.id,
    pr_line_id: l.id,
    item_id: l.item_id,
    invoiced_quantity: l.requested_quantity,
    unit_price: l.estimated_unit_price || 0,
    line_gross: l.requested_quantity * (l.estimated_unit_price || 0),
    line_net: l.requested_quantity * (l.estimated_unit_price || 0)
  }))

  if (invLines && invLines.length > 0) {
    const { error: linesErr } = await supabase.from('supplier_invoice_lines').insert(invLines)
    if (linesErr) throw linesErr
  }
  
  // Update PR status
  await supabase.from('purchase_requests').update({ status: 'closed' }).eq('id', prId)

  await writeAuditLog({
    action: 'invoice_created',
    entity_type: 'supplier_invoice',
    entity_id: invoice.id,
    description: `إنشاء فاتورة مورد رقم ${invoiceNo} من طلب شراء`,
    metadata: { invoice_no: invoiceNo, pr_id: prId, supplier_party_id: supplierPartyId, project_id: pr.project_id },
  })

  revalidatePath(`/projects/${pr.project_id}/procurement/invoices`)
  return invoice
}

export async function saveInvoiceLines(invoiceId: string, projectId: string, payload: {
  gross_amount: number,
  tax_amount: number,
  discount_amount: number,
  net_amount: number,
  lines: Array<{
    id?: string,
    item_id: string,
    invoiced_quantity: number,
    unit_price: number,
    line_gross: number,
    line_net: number,
    notes?: string
  }>
}) {
  const supabase = createClient()
  
  const { data: existing } = await supabase.from('supplier_invoices').select('paid_to_date').eq('id', invoiceId).single()
  const paid = Number(existing?.paid_to_date || 0)

  await supabase.from('supplier_invoices').update({
    gross_amount: payload.gross_amount,
    tax_amount: payload.tax_amount,
    discount_amount: payload.discount_amount,
    net_amount: payload.net_amount,
    outstanding_amount: payload.net_amount - paid
  }).eq('id', invoiceId)

  // Upsert lines (in this simplified version, we just delete and recreate to save logic)
  await supabase.from('supplier_invoice_lines').delete().eq('invoice_id', invoiceId)
  
  const insertLines = payload.lines.map(l => ({
    invoice_id: invoiceId,
    item_id: l.item_id,
    invoiced_quantity: l.invoiced_quantity,
    unit_price: l.unit_price,
    line_gross: l.line_gross,
    line_net: l.line_net,
    notes: l.notes || null
  }))

  await supabase.from('supplier_invoice_lines').insert(insertLines)

  await writeAuditLog({
    action: 'invoice_updated',
    entity_type: 'supplier_invoice',
    entity_id: invoiceId,
    description: `تعديل بنود الفاتورة — الإجمالي: ${payload.gross_amount} — الصافي: ${payload.net_amount}`,
    metadata: { invoice_id: invoiceId, project_id: projectId, gross_amount: payload.gross_amount, net_amount: payload.net_amount },
  })

  revalidatePath(`/projects/${projectId}/procurement/invoices/${invoiceId}`)
}

export async function submitInvoiceForReceipt(invoiceId: string, projectId: string, warehouseId: string) {
  const supabase = createClient()
  
  // 1. Mark invoice as pending receipt
  await supabase.from('supplier_invoices').update({ status: 'pending_receipt' }).eq('id', invoiceId)
  
  // 2. Create the confirmation routing document
  await supabase.from('invoice_receipt_confirmations').upsert({
    supplier_invoice_id: invoiceId,
    warehouse_id: warehouseId,
    warehouse_manager_status: 'pending',
    pm_status: 'pending'
  })

  await writeAuditLog({
    action: 'invoice_submitted_for_receipt',
    entity_type: 'supplier_invoice',
    entity_id: invoiceId,
    description: 'إرسال الفاتورة للاستلام المخزني',
    metadata: { invoice_id: invoiceId, project_id: projectId, warehouse_id: warehouseId },
  })

  revalidatePath(`/projects/${projectId}/procurement/invoices/${invoiceId}`)
}

export async function confirmReceipt(invoiceId: string, projectId: string, roleType: 'warehouse_manager' | 'pm') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: conf } = await supabase.from('invoice_receipt_confirmations').select('*').eq('supplier_invoice_id', invoiceId).single()
  if (!conf) throw new Error('Confirmation document not found.')

  if (roleType === 'warehouse_manager') {
    await supabase.from('invoice_receipt_confirmations').update({ warehouse_manager_status: 'approved' }).eq('id', conf.id)
  } else {
    await supabase.from('invoice_receipt_confirmations').update({ pm_status: 'approved' }).eq('id', conf.id)
  }

  // Record audit signature
  await supabase.from('invoice_receipt_confirmation_users').insert({
    confirmation_id: conf.id,
    user_id: user?.id,
    role_type: roleType,
    action_taken: 'approved'
  })

  // Check if both approved
  const { data: freshConf, error: fCErr } = await supabase.from('invoice_receipt_confirmations').select('*').eq('id', conf.id).single()
  if (fCErr || !freshConf) throw new Error('Refresh confirmation document error: ' + fCErr?.message)
  
  if (freshConf.warehouse_manager_status === 'approved' && freshConf.pm_status === 'approved') {
    await triggerFinalReceiptPost(invoiceId, freshConf.id, freshConf.warehouse_id)
  }

  await writeAuditLog({
    action: 'receipt_confirmed',
    entity_type: 'supplier_invoice',
    entity_id: invoiceId,
    description: `تأكيد استلام بضاعة — الدور: ${roleType === 'warehouse_manager' ? 'مدير المخزن' : 'مدير المشروع'}`,
    metadata: { invoice_id: invoiceId, project_id: projectId, role_type: roleType },
  })

  revalidatePath(`/projects/${projectId}/procurement/invoices/${invoiceId}`)
}

async function triggerFinalReceiptPost(invoiceId: string, confirmationId: string, warehouseId: string) {
  const supabase = createClient()
  
  // Update invoice status
  await supabase.from('supplier_invoices').update({ status: 'posted' }).eq('id', invoiceId)
  await supabase.from('invoice_receipt_confirmations').update({ confirmed_at: new Date().toISOString() }).eq('id', confirmationId)

  // Normally we would insert into stock_movements here to physically update the warehouse
  // That requires fetching lines and building movement lines.
  const { data: invoice } = await supabase.from('supplier_invoices').select('*').eq('id', invoiceId).single()
  const { data: lines } = await supabase.from('supplier_invoice_lines').select('*, item:item_id(primary_unit_id)').eq('invoice_id', invoiceId)

  const { data: movement, error: mErr } = await supabase.from('goods_receipts').insert({
    company_id: invoice.company_id,
    project_id: invoice.project_id,
    warehouse_id: warehouseId,
    supplier_party_id: invoice.supplier_party_id,
    document_no: 'GRN-' + invoice.invoice_no,
    receipt_date: new Date().toISOString().split('T')[0],
    supplier_invoice_ref: invoice.id,
    status: 'confirmed',
    created_by: invoice.created_by || null,
    confirmed_by: invoice.created_by || null,
    confirmed_at: new Date().toISOString()
  }).select().single()

  if (mErr || !movement) {
    throw new Error('فشل إنشاء إذن الاستلام المخزني: ' + (mErr?.message || 'المستند غير موجود'))
  }

  const smLines = lines?.map(l => ({
    goods_receipt_id: movement.id,
    item_id: l.item_id,
    unit_id: l.item?.primary_unit_id || l.item_id,
    quantity: l.invoiced_quantity,
    unit_cost: l.unit_price
  }))

  if (smLines && smLines.length > 0) {
    const { error: linesErr } = await supabase.from('goods_receipt_lines').insert(smLines)
    if (linesErr) throw new Error('فشل تسجيل أصناف الاستلام: ' + linesErr.message)
  }
}
