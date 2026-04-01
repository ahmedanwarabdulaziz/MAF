'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { hasPermission } from '@/lib/auth'

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
  
  const can_approve = await hasPermission('supplier_procurement', 'review')
  return { ...header, lines, can_approve }
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

export async function updatePurchaseRequest(prId: string, payload: {
  project_id: string,
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
  
  // Update header
  const { error: headerErr } = await supabase
    .from('purchase_requests')
    .update({
      request_date: payload.request_date,
      required_by_date: payload.required_by_date || null,
      notes: payload.notes || null,
    })
    .eq('id', prId)
    .eq('status', 'draft') // Only allow editing if it's still a draft

  if (headerErr) throw headerErr

  // Ditch old lines and recreate
  const { error: delErr } = await supabase.from('purchase_request_lines').delete().eq('pr_id', prId)
  if (delErr) throw delErr

  const prLines = payload.lines.map(l => ({
    pr_id: prId,
    item_id: l.item_id,
    requested_quantity: l.requested_quantity,
    estimated_unit_price: l.estimated_unit_price || 0,
    notes: l.notes || null
  }))

  const { error: linesErr } = await supabase.from('purchase_request_lines').insert(prLines)
  if (linesErr) throw linesErr

  await writeAuditLog({
    action: 'pr_updated',
    entity_type: 'purchase_request',
    entity_id: prId,
    description: `تعديل بنود طلب الشراء (${payload.lines.length} بند)`,
    metadata: { pr_id: prId, project_id: payload.project_id, lines_count: payload.lines.length },
  })

  revalidatePath(`/projects/${payload.project_id}/procurement/requests`)
  revalidatePath(`/projects/${payload.project_id}/procurement/requests/${prId}`)
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
  const canApprove = await hasPermission('supplier_procurement', 'review')
  if (!canApprove) throw new Error('ليس لديك صلاحية لاعتماد طلب الشراء')

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

  const can_pm_approve = await hasPermission('supplier_procurement', 'review')
  const can_wh_approve = await hasPermission('project_warehouse', 'review')
  return { ...header, lines, receipt_confirmation: confirmations || null, can_approve: can_pm_approve, can_wh_approve, can_pm_approve }
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

export async function confirmReceipt(
  invoiceId: string, 
  projectId: string, 
  roleType: 'warehouse_manager' | 'pm',
  receivedLines?: { id: string; received_quantity: number }[]
) {
  if (roleType === 'pm') {
    const canApprove = await hasPermission('supplier_procurement', 'review')
    if (!canApprove) throw new Error('ليس لديك صلاحية لاعتماد ومطابقة الفواتير')
  } else if (roleType === 'warehouse_manager') {
    const canApproveWH = await hasPermission('project_warehouse', 'review')
    if (!canApproveWH) throw new Error('ليس لديك صلاحية لاستلام الفواتير مخزنياً')
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client for writes — some confirmation tables have restrictive RLS
  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  if (roleType === 'warehouse_manager' && receivedLines && receivedLines.length > 0) {
    for (const l of receivedLines) {
      await admin.from('supplier_invoice_lines')
                 .update({ received_quantity: l.received_quantity })
                 .eq('id', l.id)
    }
  }

  const { data: conf } = await admin.from('invoice_receipt_confirmations').select('*').eq('supplier_invoice_id', invoiceId).single()
  if (!conf) throw new Error('Confirmation document not found.')

  if (roleType === 'warehouse_manager') {
    const { error: upErr } = await admin.from('invoice_receipt_confirmations').update({ warehouse_manager_status: 'approved' }).eq('id', conf.id)
    if (upErr) console.error('[GRN] Failed to update warehouse_manager_status:', upErr.message)
  } else {
    const { error: upErr } = await admin.from('invoice_receipt_confirmations').update({ pm_status: 'approved' }).eq('id', conf.id)
    if (upErr) console.error('[GRN] Failed to update pm_status:', upErr.message)
  }

  // Record audit signature
  const { error: sigErr } = await admin.from('invoice_receipt_confirmation_users').insert({
    confirmation_id: conf.id,
    user_id: user?.id,
    role_type: roleType,
    action_taken: 'approved'
  })
  if (sigErr) console.error('[GRN] Failed to insert confirmation signature:', sigErr.message)

  // Check if both approved
  const { data: freshConf, error: fCErr } = await admin.from('invoice_receipt_confirmations').select('*').eq('id', conf.id).single()
  if (fCErr || !freshConf) throw new Error('Refresh confirmation document error: ' + fCErr?.message)
  
  console.log('[GRN] confirmReceipt — wh_status:', freshConf.warehouse_manager_status, 'pm_status:', freshConf.pm_status)

  if (freshConf.warehouse_manager_status === 'approved' && freshConf.pm_status === 'approved') {
    console.log('[GRN] Both approved — triggering final receipt post for invoice', invoiceId)
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
  // Use admin (service_role) client for ALL writes — RLS restricts these tables to super_admin only
  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()
  
  const { data: lines, error: linesErr } = await admin.from('supplier_invoice_lines').select('*, item:item_id(primary_unit_id)').eq('invoice_id', invoiceId)
  if (linesErr) console.error('[GRN] Failed to fetch invoice lines:', linesErr.message)

  let has_discrepancy = false
  if (lines) {
    for (const l of lines) {
       // if we haven't modified it yet (legacy data), treat received = invoiced
       const rQty = l.received_quantity !== undefined && l.received_quantity !== null ? Number(l.received_quantity) : Number(l.invoiced_quantity)
       if (rQty < Number(l.invoiced_quantity)) {
         has_discrepancy = true
         break
       }
    }
  }

  // Update invoice status and discrepancy tracking
  const { error: invUpErr } = await admin.from('supplier_invoices').update({ 
    status: 'posted',
    has_discrepancy,
    discrepancy_status: has_discrepancy ? 'pending' : 'none'
  }).eq('id', invoiceId)
  if (invUpErr) console.error('[GRN] Failed to update invoice status:', invUpErr.message)

  const { error: confUpErr } = await admin.from('invoice_receipt_confirmations').update({ confirmed_at: new Date().toISOString() }).eq('id', confirmationId)
  if (confUpErr) console.error('[GRN] Failed to update confirmation:', confUpErr.message)

  const { data: invoice, error: invErr } = await admin.from('supplier_invoices').select('*').eq('id', invoiceId).single()
  if (invErr || !invoice) {
    console.error('[GRN] Failed to fetch invoice:', invErr?.message)
    throw new Error('فشل قراءة بيانات الفاتورة: ' + (invErr?.message || 'غير موجودة'))
  }

  const { data: movement, error: mErr } = await admin.from('goods_receipts').insert({
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
    console.error('[GRN] Failed to create goods_receipt:', mErr?.message)
    throw new Error('فشل إنشاء إذن الاستلام المخزني: ' + (mErr?.message || 'المستند غير موجود'))
  }

  console.log('[GRN] Created goods_receipt:', movement.id, movement.document_no)

  const smLines = lines?.map(l => {
    const rQty = l.received_quantity !== undefined && l.received_quantity !== null ? Number(l.received_quantity) : Number(l.invoiced_quantity)
    return {
      goods_receipt_id: movement.id,
      item_id: l.item_id,
      unit_id: l.item?.primary_unit_id || l.item_id,
      quantity: rQty > 0 ? rQty : 0,
      unit_cost: l.unit_price
    }
  }).filter(l => l.quantity > 0)

  if (smLines && smLines.length > 0) {
    const { error: grlErr } = await admin.from('goods_receipt_lines').insert(smLines)
    if (grlErr) {
      console.error('[GRN] Failed to insert goods_receipt_lines:', grlErr.message)
      throw new Error('فشل تسجيل أصناف الاستلام: ' + grlErr.message)
    }
    console.log('[GRN] Inserted', smLines.length, 'goods_receipt_lines')
  }

  // ── Update stock_balances + stock_ledger for each line ──
  if (lines && lines.length > 0) {
    for (const line of lines) {
      const item = Array.isArray(line.item) ? line.item[0] : line.item
      const unitId = item?.primary_unit_id || line.item_id
      const qty = line.received_quantity !== undefined && line.received_quantity !== null ? Number(line.received_quantity) : Number(line.invoiced_quantity)
      const unitPrice = Number(line.unit_price) || 0
      const lineValue = qty * unitPrice

      if (qty <= 0) continue

      // 1. Get current running totals for stock_ledger running columns
      const { data: currentBalance } = await admin
        .from('stock_balances')
        .select('quantity_on_hand, total_value')
        .eq('warehouse_id', warehouseId)
        .eq('item_id', line.item_id)
        .maybeSingle()

      const prevQty = Number(currentBalance?.quantity_on_hand || 0)
      const prevVal = Number(currentBalance?.total_value || 0)
      const newRunningQty = prevQty + qty
      const newRunningVal = prevVal + lineValue

      // 2. Insert stock_ledger entry (append-only audit trail)
      const { error: slErr } = await admin.from('stock_ledger').insert({
        warehouse_id: warehouseId,
        item_id: line.item_id,
        unit_id: unitId,
        project_id: invoice.project_id,
        movement_type: 'in',
        document_type: 'goods_receipt',
        document_id: movement.id,
        document_line_id: line.id,
        document_no: movement.document_no,
        qty_in: qty,
        qty_out: 0,
        unit_cost: unitPrice,
        total_value: lineValue,
        running_qty: newRunningQty,
        running_value: newRunningVal,
        movement_date: new Date().toISOString().split('T')[0],
        notes: `استلام بضاعة — فاتورة مورد ${invoice.invoice_no}`,
        created_by: invoice.created_by || null,
      })
      if (slErr) console.error('[GRN] Failed to insert stock_ledger for item', line.item_id, ':', slErr.message)
      else console.log('[GRN] stock_ledger entry created for item', line.item_id)

      // 3. Upsert stock_balances (weighted average cost)
      const { error: sbErr } = await admin.from('stock_balances').upsert({
        warehouse_id: warehouseId,
        item_id: line.item_id,
        quantity_on_hand: newRunningQty,
        total_value: newRunningVal,
        weighted_avg_cost: newRunningQty > 0 ? newRunningVal / newRunningQty : 0,
        last_movement_at: new Date().toISOString(),
      }, { onConflict: 'warehouse_id,item_id' })
    }
  }
}

export async function receiveAdditionalQuantity(invoiceId: string, projectId: string, newReceiptLines: {id: string, new_quantity: number}[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  const { data: invoice } = await admin.from('supplier_invoices').select('*').eq('id', invoiceId).single()
  if (!invoice) throw new Error('Invoice not found')

  const { data: confirmations } = await admin.from('invoice_receipt_confirmations').select('*').eq('supplier_invoice_id', invoiceId).limit(1)
  const warehouseId = confirmations?.[0]?.warehouse_id
  if (!warehouseId) throw new Error('No assigned warehouse for this invoice')

  const { data: lines } = await admin.from('supplier_invoice_lines').select('*, item:item_id(primary_unit_id)').eq('invoice_id', invoiceId)
  if (!lines) throw new Error('No lines found')

  let has_discrepancy = false
  const updates: any[] = [] 
  const validReceiptLines: any[] = [] 

  // Format: GRN-INV-123456
  const timestamp = Date.now().toString().slice(-4)
  const docNo = `GRN-${invoice.invoice_no}-${timestamp}`

  for (const l of lines) {
    const input = newReceiptLines.find(x => x.id === l.id)
    const extraQty = input ? Number(input.new_quantity) : 0
    if (extraQty < 0) throw new Error('Cannot receive negative quantity')
    
    // Check previous received quantity
    const previouslyReceived = l.received_quantity !== undefined && l.received_quantity !== null ? Number(l.received_quantity) : Number(l.invoiced_quantity)
    const newTotalReceived = previouslyReceived + extraQty
    
    if (newTotalReceived > Number(l.invoiced_quantity)) {
      throw new Error(`Total received quantity exceeds invoiced quantity for line ${l.id}`)
    }

    if (extraQty > 0) {
      validReceiptLines.push({
        lineRef: l,
        qty: extraQty
      })
      updates.push({
        id: l.id,
        received_quantity: newTotalReceived
      })
    }

    if (newTotalReceived < Number(l.invoiced_quantity)) {
      has_discrepancy = true
    }
  }

  if (validReceiptLines.length === 0) {
    throw new Error('لم يتم إدخال كميات جديدة للاستلام')
  }

  // Update lines
  for (const up of updates) {
    await admin.from('supplier_invoice_lines').update({ received_quantity: up.received_quantity }).eq('id', up.id)
  }

  // Update invoice status
  await admin.from('supplier_invoices').update({ 
    has_discrepancy,
    discrepancy_status: has_discrepancy ? 'pending' : 'resolved'
  }).eq('id', invoiceId)

  // Insert GRN header
  const { data: movement, error: mErr } = await admin.from('goods_receipts').insert({
    company_id: invoice.company_id,
    project_id: invoice.project_id,
    warehouse_id: warehouseId,
    supplier_party_id: invoice.supplier_party_id,
    document_no: docNo,
    receipt_date: new Date().toISOString().split('T')[0],
    supplier_invoice_ref: invoice.id,
    status: 'confirmed',
    created_by: user?.id,
    confirmed_by: user?.id,
    confirmed_at: new Date().toISOString()
  }).select().single()

  if (mErr || !movement) {
    throw new Error('فشل إنشاء إذن الاستلام الإضافي: ' + mErr?.message)
  }

  // Insert GRN lines
  const smLines = validReceiptLines.map(v => ({
    goods_receipt_id: movement.id,
    item_id: v.lineRef.item_id,
    unit_id: v.lineRef.item?.primary_unit_id || v.lineRef.item_id,
    quantity: v.qty,
    unit_cost: v.lineRef.unit_price
  }))
  await admin.from('goods_receipt_lines').insert(smLines)

  // Update Stock Ledger & Balances
  for (const v of validReceiptLines) {
    const l = v.lineRef
    const qty = v.qty
    const unitPrice = Number(l.unit_price) || 0
    const lineValue = qty * unitPrice

    const { data: currentBalance } = await admin
      .from('stock_balances')
      .select('quantity_on_hand, total_value')
      .eq('warehouse_id', warehouseId)
      .eq('item_id', l.item_id)
      .maybeSingle()

    const prevQty = Number(currentBalance?.quantity_on_hand || 0)
    const prevVal = Number(currentBalance?.total_value || 0)
    const newRunningQty = prevQty + qty
    const newRunningVal = prevVal + lineValue

    await admin.from('stock_ledger').insert({
      warehouse_id: warehouseId,
      item_id: l.item_id,
      unit_id: l.item?.primary_unit_id || l.item_id,
      project_id: invoice.project_id,
      movement_type: 'in',
      document_type: 'goods_receipt',
      document_id: movement.id,
      document_line_id: l.id,
      document_no: docNo,
      qty_in: qty,
      qty_out: 0,
      unit_cost: unitPrice,
      total_value: lineValue,
      running_qty: newRunningQty,
      running_value: newRunningVal,
      movement_date: new Date().toISOString().split('T')[0],
      notes: `استلام جزئي إضافي — فاتورة مورد ${invoice.invoice_no}`,
      created_by: user?.id,
    })

    await admin.from('stock_balances').upsert({
      warehouse_id: warehouseId,
      item_id: l.item_id,
      quantity_on_hand: newRunningQty,
      total_value: newRunningVal,
      weighted_avg_cost: newRunningQty > 0 ? newRunningVal / newRunningQty : 0,
      last_movement_at: new Date().toISOString(),
    }, { onConflict: 'warehouse_id,item_id' })
  }

  await writeAuditLog({
    action: 'partial_receipt',
    entity_type: 'supplier_invoices',
    entity_id: invoiceId,
    description: 'تم استلام كمية إضافية (مرحلي) بقيمة: ' + validReceiptLines.map(v => v.qty).join(','),
    metadata: {
      project_id: invoice.project_id,
      company_id: invoice.company_id
    }
  })

  revalidatePath(`/projects/${invoice.project_id}/procurement/invoices/${invoiceId}`)
  revalidatePath(`/projects/${invoice.project_id}/procurement/invoices`)
  revalidatePath(`/projects/${invoice.project_id}/procurement/discrepancies`)
}

export async function getPendingApprovals() {
  const supabase = createClient();
  
  const { data: prs } = await supabase.from('purchase_requests')
    .select(`*, requester:requested_by(display_name), project:project_id(id, arabic_name)`)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
    
  const { data: invs } = await supabase.from('supplier_invoices')
    .select(`*, supplier:supplier_party_id(arabic_name), project:project_id(id, arabic_name)`)
    .eq('status', 'pending_receipt')
    .order('created_at', { ascending: false });
    
  const { data: discrepancies } = await supabase.from('supplier_invoices')
    .select(`id, invoice_no, project:project_id(id, arabic_name)`)
    .eq('discrepancy_status', 'pending')

  return { 
    prs: prs || [], 
    invoices: invs || [],
    discrepanciesCount: discrepancies?.length || 0
  };
}

export async function getDiscrepancyInvoices(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.from('supplier_invoices')
    .select(`
      *,
      supplier:supplier_party_id(arabic_name),
      project:project_id(arabic_name, company_id),
      supplier_invoice_lines(
        invoiced_quantity,
        received_quantity,
        unit_price
      )
    `)
    .eq('project_id', projectId)
    .eq('discrepancy_status', 'pending')
    .order('invoice_date', { ascending: false })
    
  if (error) throw error
  return data
}


// -------------------------------------------------------------
// SUPPLIER RETURNS
// -------------------------------------------------------------

export async function getSupplierReturns(invoiceId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplier_return_invoices')
    .select(`
      *,
      lines:supplier_return_invoice_lines(
        *,
        original_line:supplier_invoice_lines(
          id, item_id, item:items(id, arabic_name),
          invoiced_quantity, unit_price
        )
      ),
      warehouse:warehouse_id(arabic_name)
    `)
    .eq('original_invoice_id', invoiceId)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createSupplierReturn(formData: {
  project_id: string
  company_id: string
  warehouse_id: string
  supplier_party_id: string
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
    item_id: string
    return_quantity: number
    unit_price: number
    line_gross: number
    line_net: number
  }[]
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  // Insert header
  const { data: retHead, error: headErr } = await supabase
    .from('supplier_return_invoices')
    .insert({
      project_id: formData.project_id,
      company_id: formData.company_id,
      warehouse_id: formData.warehouse_id,
      supplier_party_id: formData.supplier_party_id,
      original_invoice_id: formData.original_invoice_id,
      return_no: formData.return_no,
      return_date: formData.return_date,
      gross_amount: formData.gross_amount,
      tax_amount: formData.tax_amount,
      discount_amount: formData.discount_amount,
      net_amount: formData.net_amount,
      notes: formData.notes || null,
      created_by: user.id,
      status: 'draft'
    })
    .select('id')
    .single()

  if (headErr || !retHead) throw new Error(headErr?.message || 'خطأ في إنشاء مستند المرتجع')

  // Insert lines
  if (formData.lines.length > 0) {
    const { error: linesErr } = await supabase
      .from('supplier_return_invoice_lines')
      .insert(
        formData.lines.map(line => ({
          return_id: retHead.id,
          original_line_id: line.original_line_id,
          item_id: line.item_id,
          returned_quantity: line.return_quantity,
          unit_price: line.unit_price,
          line_gross: line.line_gross,
          line_net: line.line_net
        }))
      )
    if (linesErr) throw new Error(linesErr.message)
  }

  await writeAuditLog({
    action: 'supplier_return_created',
    entity_type: 'supplier_return_invoice',
    entity_id: retHead.id,
    description: `تم إنشاء إشعار مرتجع مورد برقم: ${formData.return_no}`,
    metadata: { return_no: formData.return_no, project_id: formData.project_id }
  })

  revalidatePath(`/projects/${formData.project_id}/procurement/invoices/${formData.original_invoice_id}`)
  return retHead.id
}

export async function postSupplierReturn(returnId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  // Use admin client for writes because of RPC and stock ledger RLS
  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  const { data: retHead } = await admin
    .from('supplier_return_invoices')
    .select('return_no, original_invoice_id, project_id')
    .eq('id', returnId)
    .single()

  if (!retHead) throw new Error('مستند المرتجع غير موجود')

  const { error } = await admin.rpc('post_supplier_return', {
    p_return_id: returnId,
    p_user_id: user.id
  })

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'supplier_return_posted',
    entity_type: 'supplier_return_invoice',
    entity_id: returnId,
    description: `تم إعتماد وترحيل مرتجع المورد رقم: ${retHead.return_no}`,
    metadata: { return_id: returnId, return_no: retHead.return_no, project_id: retHead.project_id }
  })

  revalidatePath(`/projects/${retHead.project_id}/procurement/invoices/${retHead.original_invoice_id}`)
}

export async function deleteSupplierReturn(returnId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  // Use admin client for deletes to bypass strict RLS if needed, or normal client if RLS allows.
  const { createAdminClient } = await import('@/lib/supabase-admin')
  const admin = createAdminClient()

  // Verify it's a draft
  const { data: retHead } = await admin
    .from('supplier_return_invoices')
    .select('return_no, original_invoice_id, project_id, status')
    .eq('id', returnId)
    .single()

  if (!retHead) throw new Error('مستند المرتجع غير موجود')
  if (retHead.status !== 'draft') throw new Error('لا يمكن حذف مرتجع معتمد')

  // Delete lines first (or relies on ON DELETE CASCADE)
  await admin.from('supplier_return_invoice_lines').delete().eq('return_id', returnId)
  
  // Delete header
  const { error } = await admin.from('supplier_return_invoices').delete().eq('id', returnId)
  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'supplier_return_deleted',
    entity_type: 'supplier_return_invoice',
    entity_id: returnId,
    description: `تم حذف مرتجع مورد (مسودة) رقم: ${retHead.return_no}`,
    metadata: { return_id: returnId, return_no: retHead.return_no, project_id: retHead.project_id }
  })

  revalidatePath(`/projects/${retHead.project_id}/procurement/invoices/${retHead.original_invoice_id}`)
}

// Auto-resolve a discrepancy by creating & posting a debit note
export async function resolveInvoiceDiscrepancy(invoiceId: string) {
  const admin = (await import('@/lib/supabase-admin')).createAdminClient()
  
  // 1. Fetch invoice and lines
  const { data: inv } = await admin.from('supplier_invoices').select('*').eq('id', invoiceId).single()
  if (!inv) throw new Error('Invoice not found')
  if (inv.discrepancy_status !== 'pending') throw new Error('لا توجد فروق معلقة للتسوية على هذه الفاتورة')
  
  const { data: lines } = await admin.from('supplier_invoice_lines').select('*').eq('invoice_id', invoiceId)
  
  const returnLines = []
  let totalGross = 0
  
  // 2. Calculate discrepancies
  if (lines) {
    for (const l of lines) {
      const invQty = Number(l.invoiced_quantity || 0)
      const recQty = l.received_quantity !== null && l.received_quantity !== undefined ? Number(l.received_quantity) : invQty
      const diff = invQty - recQty
      if (diff > 0) {
        const uPrice = Number(l.unit_price || 0)
        const lgross = diff * uPrice
        totalGross += lgross
        returnLines.push({
          original_line_id: l.id,
          item_id: l.item_id,
          return_quantity: diff,
          unit_price: uPrice,
          line_gross: lgross,
          line_net: lgross
        })
      }
    }
  }

  if (returnLines.length === 0) {
    // No actual difference, just mark resolved
    await admin.from('supplier_invoices').update({ discrepancy_status: 'resolved' }).eq('id', invoiceId)
    revalidatePath(`/projects/${inv.project_id}/procurement/discrepancies`)
    return
  }

  // 3. Create return via existing function (using server user context doesn't work well through admin, so we manually insert)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: retHead, error: headErr } = await admin
    .from('supplier_return_invoices')
    .insert({
      project_id: inv.project_id,
      company_id: inv.company_id,
      warehouse_id: (await admin.from('invoice_receipt_confirmations').select('warehouse_id').eq('supplier_invoice_id', inv.id).single()).data?.warehouse_id,
      supplier_party_id: inv.supplier_party_id,
      original_invoice_id: inv.id,
      return_no: 'DN-' + inv.invoice_no,
      return_date: new Date().toISOString().split('T')[0],
      gross_amount: totalGross,
      tax_amount: 0,
      discount_amount: 0,
      net_amount: totalGross,
      notes: 'إشعار خصم آلي (تسوية فروق استلام المعلى بالفاتورة)',
      created_by: user?.id,
      status: 'draft'
    })
    .select('id')
    .single()

  if (headErr) throw new Error('خطأ في إنشاء المرتجع: ' + headErr.message)

  const { error: linesErr } = await admin.from('supplier_return_invoice_lines').insert(
    returnLines.map(rl => ({
      return_id: retHead.id,
      original_line_id: rl.original_line_id,
      item_id: rl.item_id,
      returned_quantity: rl.return_quantity,
      unit_price: rl.unit_price,
      line_gross: rl.line_gross,
      line_net: rl.line_net
    }))
  )
  if (linesErr) throw new Error('خطأ في بنود المرتجع: ' + linesErr.message)

  // 4. Update parent invoice financial impact instead of calling `post_supplier_return`
  // This is required because the missing items never entered the warehouse in the first place,
  // so deducting them from warehouse stock via post_supplier_return would fail.
  for (const rl of returnLines) {
    const l = lines?.find((x: any) => x.id === rl.original_line_id)
    if (l) {
      const prevReturned = Number(l.returned_quantity || 0)
      await admin.from('supplier_invoice_lines')
        .update({ returned_quantity: prevReturned + Number(rl.return_quantity) })
        .eq('id', rl.original_line_id)
    }
  }

  const newReturnAmt = Number(inv.returned_amount || 0) + totalGross
  const newOutAmt = Number(inv.outstanding_amount || 0) - totalGross
  
  await admin.from('supplier_invoices')
    .update({ 
      returned_amount: newReturnAmt, 
      outstanding_amount: newOutAmt,
      discrepancy_status: 'resolved'
    })
    .eq('id', invoiceId)

  await admin.from('supplier_return_invoices')
    .update({ status: 'posted' })
    .eq('id', retHead.id)

  await writeAuditLog({
    action: 'discrepancy_resolved',
    entity_type: 'supplier_invoice',
    entity_id: invoiceId,
    description: `تسوية الفروق آلياً وإنشاء إشعار خصم رقم DN-${inv.invoice_no}`,
    metadata: { invoice_id: invoiceId, return_id: retHead.id, return_amount: totalGross }
  })

  revalidatePath(`/projects/${inv.project_id}/procurement/discrepancies`)
  revalidatePath(`/projects/${inv.project_id}/procurement/invoices/${invoiceId}`)
}

export async function bulkPaySupplierInvoices(supplierPartyId: string, projectId: string, payload: {
  financial_account_id: string
  payment_method: string
  payment_date: string
  amount: number
  receipt_reference_no?: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: project } = await supabase.from('projects').select('company_id').eq('id', projectId).single()
  if (!project) throw new Error('لا يوجد مشروع')

  // 1. Fetch all unpaid/partially-paid invoices for this supplier in this project, sorted oldest first
  const { data: invoices, error: invErr } = await supabase
    .from('supplier_invoices')
    .select('id, invoice_no, outstanding_amount, invoice_date, supplier_party_id, company_id')
    .eq('supplier_party_id', supplierPartyId)
    .eq('project_id', projectId)
    .in('status', ['posted', 'partially_paid'])
    .gt('outstanding_amount', 0)
    .order('invoice_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (invErr) throw new Error(invErr.message)
  if (!invoices || invoices.length === 0) throw new Error('لا توجد فواتير مستحقة السداد لهذا المورد في هذا المشروع')

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

  // 3. Generate random voucher number
  const voucherNo = 'PV-BULK-' + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 4. Create one payment voucher for the whole payment
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: project.company_id,
      project_id: projectId,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || `دفعة شاملة للمورد - ${allocations.length} فاتورة بالمشروع`,
      created_by: user.id
    }])
    .select('id')
    .single()

  if (vErr || !voucher) throw new Error(vErr?.message || 'خطأ في إنشاء مستند الدفع')

  // 5. Link Party
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

  // 6. Create allocations
  const { error: aErr } = await supabase.from('payment_allocations').insert(
    allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type: 'supplier_invoice',
      source_entity_id: a.invoiceId,
      allocated_amount: a.amount
    }))
  )

  if (aErr) throw new Error(aErr.message)

  // 7. Post the voucher (commits updates via RPC)
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user.id
  })

  if (postErr) throw new Error(postErr.message)

  await writeAuditLog({
    action: 'PAYMENT',
    entity_type: 'payment_vouchers',
    entity_id: voucher.id,
    description: `دفعة شاملة للمورد بالمشروع - سند رقم: ${voucherNo} - إجمالي: ${payload.amount} ج.م موزع على ${allocations.length} فاتورة`
  })

  revalidatePath(`/projects/${projectId}/procurement/invoices`)
  revalidatePath(`/company/purchases/suppliers/${supplierPartyId}`)

  return { voucherNo, allocations }
}
