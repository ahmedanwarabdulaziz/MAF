'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

// -------------------------------------------------------------------
// OWNER BILLING DOCUMENTS
// -------------------------------------------------------------------

export async function getProjectBasicInfo(projectId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('projects')
    .select('owner_party_id, project_code')
    .eq('id', projectId)
    .single()
  return data
}

export async function getOwnerBillingDocuments(projectId?: string) {
  const supabase = createAdminClient()
  let query = supabase.from('owner_billing_documents').select(`
    *,
    owner:owner_party_id(arabic_name),
    project:project_id(arabic_name)
  `).order('created_at', { ascending: false })
  
  if (projectId) query = query.eq('project_id', projectId)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getOwnerBillingDetails(docId: string) {
  const supabase = createAdminClient()
  
  const { data: header, error: hErr } = await supabase
    .from('owner_billing_documents')
    .select(`
      *,
      owner:owner_party_id(arabic_name),
      project:project_id(arabic_name, company_id)
    `)
    .eq('id', docId)
    .single()
    
  if (hErr) throw hErr

  const { data: lines, error: lErr } = await supabase
    .from('owner_billing_lines')
    .select(`*`)
    .eq('owner_billing_document_id', docId)
    .order('created_at', { ascending: true })

  if (lErr) throw lErr
  
  return { ...header, lines }
}

// -------------------------------------------------------------------
// CUMULATIVE: find last approved doc + seed lines from it
// -------------------------------------------------------------------

export async function getLastApprovedOwnerBillingDoc(projectId: string, excludeDocId?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('owner_billing_documents')
    .select('id, end_date, start_date')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)

  if (excludeDocId) query = query.neq('id', excludeDocId)

  const { data } = await query
  return data?.[0] || null
}

// Returns lines of previous approved doc as "inherited" lines for the new draft
export async function getPreviousOwnerBillingLines(projectId: string): Promise<any[]> {
  const supabase = createAdminClient()

  // Find last approved doc
  const { data: docs } = await supabase
    .from('owner_billing_documents')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)

  const prevDocId = docs?.[0]?.id
  if (!prevDocId) return []

  const { data: lines } = await supabase
    .from('owner_billing_lines')
    .select('*')
    .eq('owner_billing_document_id', prevDocId)
    .order('created_at', { ascending: true })

  return (lines || []).map(l => ({
    // Carry forward: previous = cumulative from last cert, current = 0
    line_description:     l.line_description,
    override_description: l.override_description || '',
    unit_name:            l.unit_name || '',
    previous_quantity:    Number(l.cumulative_quantity || l.quantity || 0),
    quantity:             0,
    cumulative_quantity:  Number(l.cumulative_quantity || l.quantity || 0),
    unit_price:           Number(l.unit_price || 0),
    is_material_on_site:  l.is_material_on_site || false,
    notes:                '',
    // Mark as inherited so UI can lock delete
    _inherited:           true,
  }))
}

// إجمالي التحصيلات العادية (تُستخدم في حساب "ما سبق صرفه")
export async function getOwnerCollectedAmount(projectId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('owner_collections')
    .select('received_amount')
    .eq('project_id', projectId)

  return (data || []).reduce((s, r) => s + Number(r.received_amount || 0), 0)
}

// إجمالي الدفعات المقدمة فقط (collection_type = 'advance')
// تُستخدم كـ advance_deduction ثابتة في المستخلص
export async function getOwnerAdvanceTotal(projectId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('owner_collections')
    .select('received_amount')
    .eq('project_id', projectId)
    .eq('collection_type', 'advance')

  return (data || []).reduce((s, r) => s + Number(r.received_amount || 0), 0)
}

// إجمالي آخر مستخلص (النظام تراكمي — آخر فاتورة = الإجمالي الكامل)
export async function getLatestOwnerBillingGross(projectId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('owner_billing_documents')
    .select('gross_amount')
    .eq('project_id', projectId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Number(data?.gross_amount || 0)
}

// -------------------------------------------------------------------
// CREATE (cumulative-aware)
// -------------------------------------------------------------------

export async function createOwnerBillingDocument(payload: {
  project_id: string,
  owner_party_id: string,
  document_no: string,
  billing_date: string,
  start_date?: string,
  end_date: string,
  gross_amount: number,
  tax_amount: number,
  net_amount: number,
  advance_deduction?: number,
  notes?: string,
  lines: Array<{
    line_description: string,
    override_description?: string,
    previous_quantity: number,
    quantity: number,
    cumulative_quantity: number,
    unit_price: number,
    line_gross: number,
    line_net: number,
    is_material_on_site?: boolean,
    notes?: string,
  }>
}) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  // Find previous approved doc for linking
  const prevDoc = await getLastApprovedOwnerBillingDoc(payload.project_id)

  // Determine start_date: from previous doc's end_date+1, or provided
  let startDate = payload.start_date || null
  if (!startDate && prevDoc?.end_date) {
    const d = new Date(prevDoc.end_date)
    d.setDate(d.getDate() + 1)
    startDate = d.toISOString().split('T')[0]
  }

  // 1. Create Header
  const { data: doc, error: docErr } = await supabase
    .from('owner_billing_documents')
    .insert([{
      project_id:      payload.project_id,
      company_id:      project?.company_id,
      owner_party_id:  payload.owner_party_id,
      document_no:     payload.document_no || 'تلقائي',
      billing_date:    payload.billing_date,
      start_date:      startDate,
      end_date:        payload.end_date,
      status:          'draft',
      gross_amount:    payload.gross_amount,
      tax_amount:      payload.tax_amount,
      net_amount:      payload.net_amount,
      notes:           payload.notes || null,
      advance_deduction: payload.advance_deduction || 0,
      previous_doc_id: prevDoc?.id || null,
      created_by:      user?.id,
    }])
    .select()
    .single()

  if (docErr) throw docErr

  // 2. Insert Lines
  if (payload.lines && payload.lines.length > 0) {
    const linesToInsert = payload.lines.map(line => ({
      owner_billing_document_id: doc.id,
      line_description:    line.line_description,
      override_description: line.override_description || null,
      previous_quantity:   line.previous_quantity || 0,
      quantity:            line.quantity,
      cumulative_quantity: line.cumulative_quantity || line.quantity,
      is_material_on_site: line.is_material_on_site || false,
      unit_price:          line.unit_price,
      line_gross:          line.line_gross,
      line_net:            line.line_net,
      notes:               line.notes || null,
    }))

    const { error: lineErr } = await supabase
      .from('owner_billing_lines')
      .insert(linesToInsert)
    if (lineErr) throw lineErr
  }

  revalidatePath(`/projects/${payload.project_id}/owner-billing`)
  return doc
}

// -------------------------------------------------------------------
// UPDATE (cumulative-aware, replaces lines)
// -------------------------------------------------------------------

export async function updateOwnerBillingDocument(docId: string, payload: {
  project_id: string,
  owner_party_id: string,
  billing_date: string,
  end_date: string,
  gross_amount: number,
  tax_amount: number,
  net_amount: number,
  advance_deduction?: number,
  notes?: string,
  lines: Array<{
    line_description: string,
    override_description?: string,
    previous_quantity: number,
    quantity: number,
    cumulative_quantity: number,
    unit_price: number,
    line_gross: number,
    line_net: number,
    is_material_on_site?: boolean,
    notes?: string,
  }>
}) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = createAdminClient()

  const { data: existingDoc } = await supabase
    .from('owner_billing_documents')
    .select('status, start_date')
    .eq('id', docId)
    .single()

  if (existingDoc?.status === 'approved' || existingDoc?.status === 'paid') {
    throw new Error('لا يمكن تعديل فاتورة تم اعتمادها أو تحصيلها')
  }

  // 1. Update Header
  const { data: doc, error: docErr } = await supabase
    .from('owner_billing_documents')
    .update({
      owner_party_id:    payload.owner_party_id,
      billing_date:      payload.billing_date,
      end_date:          payload.end_date,
      gross_amount:      payload.gross_amount,
      tax_amount:        payload.tax_amount,
      net_amount:        payload.net_amount,
      notes:             payload.notes || null,
      advance_deduction: payload.advance_deduction || 0,
    })
    .eq('id', docId)
    .select()
    .single()

  if (docErr) throw docErr

  // 2. Replace lines
  const { error: delErr } = await supabase
    .from('owner_billing_lines')
    .delete()
    .eq('owner_billing_document_id', docId)
  if (delErr) throw delErr

  if (payload.lines && payload.lines.length > 0) {
    const linesToInsert = payload.lines.map(line => ({
      owner_billing_document_id: doc.id,
      line_description:    line.line_description,
      override_description: line.override_description || null,
      previous_quantity:   line.previous_quantity || 0,
      quantity:            line.quantity,
      cumulative_quantity: line.cumulative_quantity || line.quantity,
      is_material_on_site: line.is_material_on_site || false,
      unit_price:          line.unit_price,
      line_gross:          line.line_gross,
      line_net:            line.line_net,
      notes:               line.notes || null,
    }))

    const { error: lineErr } = await supabase
      .from('owner_billing_lines')
      .insert(linesToInsert)
    if (lineErr) throw lineErr
  }

  revalidatePath(`/projects/${payload.project_id}/owner-billing`)
  return doc
}

export async function updateOwnerBillingStatus(docId: string, status: 'submitted' | 'approved' | 'paid', projectId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('owner_billing_documents')
    .update({ status })
    .eq('id', docId)

  if (error) throw error
  revalidatePath(`/projects/${projectId}/owner-billing`)
}

// -------------------------------------------------------------------
// CHECK — هل هناك فاتورة قيد المسودة (منع إنشاء جديدة)
// -------------------------------------------------------------------

export async function getOwnerBillingPendingStatus(projectId: string): Promise<{
  hasPending: boolean
  pendingNo: string | null
  pendingStatus: string | null
}> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('owner_billing_documents')
    .select('id, document_no, status')
    .eq('project_id', projectId)
    .in('status', ['draft', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return { hasPending: true, pendingNo: data[0].document_no, pendingStatus: data[0].status }
  }
  return { hasPending: false, pendingNo: null, pendingStatus: null }
}

// -------------------------------------------------------------------
// LAST END DATE (for display)
// -------------------------------------------------------------------

export async function getLastOwnerBillingEndDate(projectId: string, excludeDocId?: string) {
  const supabase = createAdminClient()
  let query = supabase.from('owner_billing_documents')
    .select('end_date')
    .eq('project_id', projectId)
    .not('end_date', 'is', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)

  if (excludeDocId) query = query.neq('id', excludeDocId)

  const { data, error } = await query
  if (error) return null
  return data?.[0]?.end_date || null
}

// -------------------------------------------------------------------
// OWNER COLLECTIONS
// -------------------------------------------------------------------

export async function getOwnerCollections(projectId?: string) {
  const supabase = createAdminClient()          // admin — bypass RLS
  let query = supabase.from('owner_collections').select(`
    *,
    owner:owner_party_id(arabic_name),
    project:project_id(arabic_name),
    document:owner_billing_document_id(document_no)
  `).order('created_at', { ascending: false })
  
  if (projectId) query = query.eq('project_id', projectId)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function recordOwnerCollection(payload: {
  project_id: string,
  owner_billing_document_id?: string,
  owner_party_id: string,
  received_amount: number,
  received_date: string,
  payment_method: string,
  reference_no?: string,
  treasury_id?: string,
  collection_type?: 'regular' | 'advance',
  notes?: string,
  attachments?: string[]
}) {
  // نجيب الـ user من الـ client العادي (اللي بيحمل JWT)
  const { data: { user } } = await createClient().auth.getUser()
  const supabase = createAdminClient()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  const { data: collection, error } = await supabase
    .from('owner_collections')
    .insert([{
      project_id:                  payload.project_id,
      company_id:                  project?.company_id,
      owner_billing_document_id:   payload.owner_billing_document_id || null,
      owner_party_id:              payload.owner_party_id,
      received_amount:             payload.received_amount,
      received_date:               payload.received_date,
      payment_method:              payload.payment_method,
      reference_no:                payload.reference_no || null,
      financial_account_id:        payload.treasury_id || null,
      collection_type:             payload.collection_type || 'regular',
      notes:                       payload.notes || null,
      attachments:                 payload.attachments || [],
      created_by:                  user?.id,
    }])
    .select()
    .single()

  if (error) throw error

  // ―― تحديث رصيد الحساب المالي (financial_transactions) ――
  // الخزينة لا تُحدَّث إلا عبر تسجيل حركة في financial_transactions
  if (payload.treasury_id) {
    const txNote = payload.collection_type === 'advance'
      ? `دفعة مقدمة من المالك${payload.notes ? ' ― ' + payload.notes : ''}`
      : `تحصيل من المالك${payload.reference_no ? ' #' + payload.reference_no : ''}${payload.notes ? ' ― ' + payload.notes : ''}`

    const { error: txErr } = await supabase
      .from('financial_transactions')
      .insert({
        financial_account_id: payload.treasury_id,
        transaction_date:     payload.received_date,
        transaction_type:     'deposit',
        amount:               payload.received_amount,
        reference_type:       payload.collection_type === 'advance' ? 'owner_advance' : 'owner_collection',
        reference_id:         collection?.id || null,
        notes:                txNote,
        created_by:           user?.id,
      })

    if (txErr) {
      // لا نوقف العملية كلها بسبب فشل الخزينة — نسجل الخطأ فقط
      console.error('Failed to record treasury transaction:', txErr.message)
    }
  }

  revalidatePath(`/projects/${payload.project_id}/owner-billing`)
  revalidatePath(`/projects/${payload.project_id}/collections`)
  revalidatePath('/company/treasury')
  return collection
}

// قائمة الحسابات المالية المتاحة (خزائن / بنوك) للشركة المرتبطة بالمشروع
export async function getTreasuriesForProject(projectId: string) {
  const supabase = createAdminClient()

  // Get company_id from project
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .single()

  if (!project?.company_id) return []

  // Query financial_accounts — company-level or project-level accounts that are active
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, arabic_name, account_type')
    .eq('company_id', project.company_id)
    .eq('is_active', true)
    .order('account_type')
    .order('arabic_name')

  if (error) { console.error('getTreasuriesForProject:', error); return [] }
  return (data || []).map(a => ({
    id:      a.id,
    name:    a.arabic_name,
    type:    a.account_type,
  }))
}

// -------------------------------------------------------------------
// RECEIVABLES VIEW
// -------------------------------------------------------------------

export async function getOwnerReceivables(projectId?: string) {
  const supabase = createClient()
  let query = supabase.from('owner_receivables_view').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  
  const { data, error } = await query
  if (error) throw error
  return data
}

// -------------------------------------------------------------------
// BILLABLE ITEMS (SOURCE DOCUMENTS) — unchanged
// -------------------------------------------------------------------

export async function getBillableSubcontractorItems(projectId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('subcontractor_certificate_lines')
    .select(`
      id,
      cumulative_quantity,
      project_work_item_id,
      agreed_rate,
      project_work_items (
        item_code,
        arabic_description,
        owner_price,
        units:default_unit_id ( arabic_name )
      ),
      subcontractor_certificates!inner (
        project_id,
        status
      )
    `)
    .eq('subcontractor_certificates.project_id', projectId)
    .in('subcontractor_certificates.status', ['approved', 'paid_in_full'])
    .order('created_at', { ascending: false })
    
  if (error) throw error
  
  // Keep latest line per work item
  const latestByWorkItem = new Map()
  data.forEach((line) => {
    if (!latestByWorkItem.has(line.project_work_item_id)) {
      latestByWorkItem.set(line.project_work_item_id, line)
    }
  })
  
  return Array.from(latestByWorkItem.values())
}

export async function getBillableStoreIssues(projectId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('store_issue_lines')
    .select(`
      id,
      item_id,
      quantity,
      unit_cost,
      items (
        item_code,
        arabic_name
      ),
      store_issues!inner (
        project_id,
        status
      )
    `)
    .eq('store_issues.project_id', projectId)
    .eq('store_issues.status', 'confirmed')
    
  if (error) throw error
  
  const grouped = new Map()
  data.forEach((line) => {
    const existing = grouped.get(line.item_id)
    if (existing) {
      existing.quantity = Number(existing.quantity) + Number(line.quantity)
    } else {
      grouped.set(line.item_id, { ...line, quantity: Number(line.quantity) })
    }
  })
  
  return Array.from(grouped.values())
}

export async function getBillableMaterialsOnSite(projectId: string) {
  const supabase = createAdminClient()
  const { data: wData } = await supabase
    .from('warehouses')
    .select('id')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()
  if (!wData) return []

  const { data, error } = await supabase
    .from('stock_balances')
    .select(`
      item_id,
      quantity_on_hand,
      weighted_avg_cost,
      item:items (
        item_code,
        arabic_name
      )
    `)
    .eq('warehouse_id', wData.id)
    .gt('quantity_on_hand', 0)
    
  if (error) throw error
  return data || []
}

export async function getPreviousBilledQuantities(projectId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_billing_lines')
    .select(`
      line_description,
      override_description,
      cumulative_quantity,
      owner_billing_documents!inner (
        project_id,
        status
      )
    `)
    .eq('owner_billing_documents.project_id', projectId)
    .in('owner_billing_documents.status', ['approved', 'paid'])
    
  if (error) throw error
  
  // For each description, track the HIGHEST cumulative_quantity (last approved value)
  const maxByDesc = new Map<string, number>()
  data.forEach((line) => {
    const key = line.override_description?.trim() || line.line_description?.trim()
    if (key) {
      const current = maxByDesc.get(key) || 0
      maxByDesc.set(key, Math.max(current, Number(line.cumulative_quantity || 0)))
    }
  })
  
  return Object.fromEntries(maxByDesc)
}
