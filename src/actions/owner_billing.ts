'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// -------------------------------------------------------------------
// OWNER BILLING DOCUMENTS
// -------------------------------------------------------------------

export async function getOwnerBillingDocuments(projectId?: string) {
  const supabase = createClient()
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
  const supabase = createClient()
  
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
    .select(`
      *,
      unit:unit_id(arabic_name)
    `)
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
  gross_amount: number,
  tax_amount: number,
  net_amount: number,
  notes?: string,
  lines: Array<{
    line_description: string,
    quantity: number,
    unit_price: number,
    line_gross: number,
    line_net: number,
    notes?: string,
    source_links?: Array<{
      source_type: string,
      source_reference_id: string,
      allocated_quantity: number,
      allocated_cost: number
    }>
  }>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()

  // 1. Create Header
  const { data: doc, error: docErr } = await supabase
    .from('owner_billing_documents')
    .insert([{
      project_id: payload.project_id,
      company_id: project?.company_id,
      owner_party_id: payload.owner_party_id,
      document_no: payload.document_no,
      billing_date: payload.billing_date,
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
          quantity: line.quantity,
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
  const supabase = createClient()
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
