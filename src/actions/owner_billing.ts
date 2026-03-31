'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

// -------------------------------------------------------------------
// OWNER BILLING DOCUMENTS
// -------------------------------------------------------------------

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
  
  // Fetch source links separately if needed, or join
  const { data: sourceLinks } = await supabase
    .from('owner_billing_source_links')
    .select('*')
    .in('owner_billing_line_id', lines ? lines.map(l => l.id) : [])

  if (lines && sourceLinks) {
    lines.forEach(l => {
      l.source_links = sourceLinks.filter(sl => sl.owner_billing_line_id === l.id)
    })
  }

  return { ...header, lines }
}

export async function createOwnerBillingDocument(payload: {
  project_id: string,
  owner_party_id: string,
  document_no: string,
  billing_date: string,
  start_date: string,
  end_date: string,
  gross_amount: number,
  tax_amount: number,
  net_amount: number,
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
    source_links?: Array<{
      source_type: string,
      source_reference_id: string,
      allocated_quantity: number,
      allocated_cost: number
    }>
  }>
}) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  // 0. Date overlap validation
  if (payload.start_date || payload.end_date) {
    if (payload.start_date > payload.end_date) {
      throw new Error('تاريخ بداية الفاتورة يجب أن يكون قبل أو يساوي تاريخ النهاية')
    }
  }

  // Find the latest valid invoice end date for the project
  const { data: latestDocs } = await supabase
    .from('owner_billing_documents')
    .select('end_date')
    .eq('project_id', payload.project_id)
    .not('end_date', 'is', null)
    .neq('status', 'cancelled')
    .order('end_date', { ascending: false })
    .limit(1)

  if (latestDocs && latestDocs.length > 0 && latestDocs[0].end_date) {
    if (new Date(payload.start_date) <= new Date(latestDocs[0].end_date)) {
      throw new Error(`لا يمكن أن يبدأ تاريخ الفاتورة في ${payload.start_date} أو قبله، لتجنب تداخل التواريخ مع الفاتورة السابقة التي تنتهي في ${latestDocs[0].end_date}.`)
    }
  }

  // 1. Create Header
  const { data: doc, error: docErr } = await supabase
    .from('owner_billing_documents')
    .insert([{
      project_id: payload.project_id,
      company_id: project?.company_id,
      owner_party_id: payload.owner_party_id,
      document_no: payload.document_no || 'تلقائي', // Let the db trigger handle it
      billing_date: payload.billing_date,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: 'draft',
      gross_amount: payload.gross_amount,
      tax_amount: payload.tax_amount,
      net_amount: payload.net_amount,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select()
    .single()

  if (docErr) throw docErr

  // 2. Insert Lines & Source Links
  if (payload.lines && payload.lines.length > 0) {
    for (const line of payload.lines) {
      const { data: insertedLine, error: lineErr } = await supabase
        .from('owner_billing_lines')
        .insert([{
          owner_billing_document_id: doc.id,
          line_description: line.line_description,
          override_description: line.override_description || null,
          previous_quantity: line.previous_quantity || 0,
          quantity: line.quantity,
          cumulative_quantity: line.cumulative_quantity || line.quantity,
          is_material_on_site: line.is_material_on_site || false,
          unit_price: line.unit_price,
          line_gross: line.line_gross,
          line_net: line.line_net,
          notes: line.notes || null
        }])
        .select()
        .single()
        
      if (lineErr) throw lineErr

      if (line.source_links && line.source_links.length > 0) {
        const linksToInsert = line.source_links.map(sl => ({
          owner_billing_line_id: insertedLine.id,
          source_type: sl.source_type,
          source_reference_id: sl.source_reference_id,
          allocated_quantity: sl.allocated_quantity,
          allocated_cost: sl.allocated_cost
        }))
        const { error: linkErr } = await supabase.from('owner_billing_source_links').insert(linksToInsert)
        if (linkErr) throw linkErr
      }
    }
  }

  revalidatePath(`/company/projects/${payload.project_id}`)
  return doc
}

export async function updateOwnerBillingDocument(docId: string, payload: {
  project_id: string,
  owner_party_id: string,
  billing_date: string,
  start_date: string,
  end_date: string,
  gross_amount: number,
  tax_amount: number,
  net_amount: number,
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
    source_links?: Array<{
      source_type: string,
      source_reference_id: string,
      allocated_quantity: number,
      allocated_cost: number
    }>
  }>
}) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = createAdminClient()

  // 0. Verify document is in draft/submitted
  const { data: existingDoc } = await supabase.from('owner_billing_documents').select('status').eq('id', docId).single()
  if (existingDoc?.status === 'approved' || existingDoc?.status === 'paid') {
    throw new Error('لا يمكن تعديل فاتورة تم اعتمادها أو تحصيلها')
  }

  // 0.1 Date overlap validation
  if (payload.start_date || payload.end_date) {
    if (payload.start_date > payload.end_date) {
      throw new Error('تاريخ بداية الفاتورة يجب أن يكون قبل أو يساوي تاريخ النهاية')
    }
  }

  // Find the latest valid invoice end date for the project, excluding this doc
  const { data: latestDocs } = await supabase
    .from('owner_billing_documents')
    .select('end_date')
    .eq('project_id', payload.project_id)
    .neq('id', docId)
    .not('end_date', 'is', null)
    .neq('status', 'cancelled')
    .order('end_date', { ascending: false })
    .limit(1)

  if (latestDocs && latestDocs.length > 0 && latestDocs[0].end_date) {
    if (new Date(payload.start_date) <= new Date(latestDocs[0].end_date)) {
      throw new Error(`لا يمكن أن يبدأ تاريخ الفاتورة في ${payload.start_date} أو قبله، لتجنب تداخل التواريخ مع الفاتورة السابقة التي تنتهي في ${latestDocs[0].end_date}.`)
    }
  }

  // 1. Update Header
  const { data: doc, error: docErr } = await supabase
    .from('owner_billing_documents')
    .update({
      owner_party_id: payload.owner_party_id,
      billing_date: payload.billing_date,
      start_date: payload.start_date,
      end_date: payload.end_date,
      gross_amount: payload.gross_amount,
      tax_amount: payload.tax_amount,
      net_amount: payload.net_amount,
      notes: payload.notes || null
    })
    .eq('id', docId)
    .select()
    .single()

  if (docErr) throw docErr

  // 2. Delete existing lines (cascades to source_links)
  const { error: delErr } = await supabase.from('owner_billing_lines').delete().eq('owner_billing_document_id', docId)
  if (delErr) throw delErr

  // 3. Insert New Lines & Source Links
  if (payload.lines && payload.lines.length > 0) {
    for (const line of payload.lines) {
      const { data: insertedLine, error: lineErr } = await supabase
        .from('owner_billing_lines')
        .insert([{
          owner_billing_document_id: doc.id,
          line_description: line.line_description,
          override_description: line.override_description || null,
          previous_quantity: line.previous_quantity || 0,
          quantity: line.quantity,
          cumulative_quantity: line.cumulative_quantity || line.quantity,
          is_material_on_site: line.is_material_on_site || false,
          unit_price: line.unit_price,
          line_gross: line.line_gross,
          line_net: line.line_net,
          notes: line.notes || null
        }])
        .select()
        .single()
        
      if (lineErr) throw lineErr

      if (line.source_links && line.source_links.length > 0) {
        const linksToInsert = line.source_links.map(sl => ({
          owner_billing_line_id: insertedLine.id,
          source_type: sl.source_type,
          source_reference_id: sl.source_reference_id,
          allocated_quantity: sl.allocated_quantity,
          allocated_cost: sl.allocated_cost
        }))
        const { error: linkErr } = await supabase.from('owner_billing_source_links').insert(linksToInsert)
        if (linkErr) throw linkErr
      }
    }
  }

  revalidatePath(`/company/projects/${payload.project_id}`)
  return doc
}

export async function updateOwnerBillingStatus(docId: string, status: 'submitted' | 'approved' | 'paid', projectId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('owner_billing_documents')
    .update({ status })
    .eq('id', docId)

  if (error) throw error
  revalidatePath(`/company/projects/${projectId}`)
}


// -------------------------------------------------------------------
// OWNER COLLECTIONS
// -------------------------------------------------------------------

export async function getLastOwnerBillingEndDate(projectId: string, excludeDocId?: string) {
  const supabase = createAdminClient()
  let query = supabase.from('owner_billing_documents')
    .select('end_date')
    .eq('project_id', projectId)
    .not('end_date', 'is', null)
    .neq('status', 'cancelled')
    .order('end_date', { ascending: false })
    .limit(1)

  if (excludeDocId) {
     query = query.neq('id', excludeDocId)
  }

  const { data, error } = await query
  if (error) return null
  return data?.[0]?.end_date || null
}

// -------------------------------------------------------------------
// OWNER COLLECTIONS
// -------------------------------------------------------------------

export async function getOwnerCollections(projectId?: string) {
  const supabase = createClient()
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
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  const { data: collection, error } = await supabase
    .from('owner_collections')
    .insert([{
      project_id: payload.project_id,
      company_id: project?.company_id,
      owner_billing_document_id: payload.owner_billing_document_id || null,
      owner_party_id: payload.owner_party_id,
      received_amount: payload.received_amount,
      received_date: payload.received_date,
      payment_method: payload.payment_method,
      reference_no: payload.reference_no || null,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select()
    .single()

  if (error) throw error

  revalidatePath(`/company/projects/${payload.project_id}`)
  return collection
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
// BILLABLE ITEMS (SOURCE DOCUMENTS)
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
        owner_price
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
      // Unit cost could be averaged, but we'll deal with it when rendering or let the user decide pricing
    } else {
      grouped.set(line.item_id, { ...line, quantity: Number(line.quantity) })
    }
  })
  
  return Array.from(grouped.values())
}

export async function getBillableMaterialsOnSite(projectId: string) {
  const supabase = createAdminClient()
  // Fetch warehouse ID for project
  const { data: wData } = await supabase.from('warehouses').select('id').eq('project_id', projectId).eq('is_active', true).maybeSingle()
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
      quantity,
      owner_billing_documents!inner (
        project_id,
        status
      )
    `)
    .eq('owner_billing_documents.project_id', projectId)
    .in('owner_billing_documents.status', ['approved', 'paid'])
    
  if (error) throw error
  
  const grouped = new Map()
  data.forEach((line) => {
    // Group by line_description (or override_description if present so tracking matches user's exact wording)
    const key = line.override_description?.trim() || line.line_description?.trim()
    if (key) {
      grouped.set(key, (grouped.get(key) || 0) + Number(line.quantity))
    }
  })
  
  return Object.fromEntries(grouped)
}
