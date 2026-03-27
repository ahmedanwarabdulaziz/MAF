'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// ====== PROJECT WORK ITEMS ====== //

export async function getProjectWorkItems(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('project_work_items')
    .select(`
      *,
      units:default_unit_id(arabic_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createProjectWorkItem(data: {
  project_id: string,
  company_id: string,
  item_code?: string,
  arabic_description: string,
  english_description?: string,
  default_unit_id?: string,
  notes?: string
}) {
  const supabase = createClient()
  const cleanData = {
    ...data,
    item_code: data.item_code || null,
    english_description: data.english_description || null,
    default_unit_id: data.default_unit_id || null,
    notes: data.notes || null
  }

  const { data: result, error } = await supabase
    .from('project_work_items')
    .insert(cleanData)
    .select()
    .single()

  if (error) throw error
  revalidatePath(`/projects/${data.project_id}/work-items`)
  return result
}

export async function updateProjectWorkItem(id: string, projectId: string, updates: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('project_work_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath(`/projects/${projectId}/work-items`)
  return result
}

export async function deleteProjectWorkItem(id: string, projectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('project_work_items')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath(`/projects/${projectId}/work-items`)
}


// ====== SUBCONTRACT AGREEMENTS ====== //

export async function getSubcontractAgreements(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subcontract_agreements')
    .select(`
      *,
      subcontractor:subcontractor_party_id(arabic_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getSubcontractAgreement(id: string) {
  const supabase = createClient()
  const { data: agreement, error } = await supabase
    .from('subcontract_agreements')
    .select(`
      *,
      subcontractor:subcontractor_party_id(arabic_name),
      project:project_id(arabic_name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  // fetch lines separately for easier mapping
  const { data: lines, error: lineError } = await supabase
    .from('subcontract_agreement_lines')
    .select(`
      *,
      work_item:work_item_id(arabic_description, item_code),
      unit:unit_id(arabic_name)
    `)
    .eq('subcontract_agreement_id', id)
    .order('created_at', { ascending: true })

  if (lineError) throw lineError

  return { ...agreement, lines: lines || [] }
}

export async function createSubcontractAgreement(data: {
  project_id: string,
  company_id: string,
  subcontractor_party_id: string,
  agreement_code: string,
  status?: string,
  default_taaliya_type?: string,
  default_taaliya_value?: number,
  start_date?: string,
  end_date?: string,
  notes?: string
}) {
  const supabase = createClient()
  
  const cleanData = {
    ...data,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    notes: data.notes || null,
  }

  const { data: result, error } = await supabase
    .from('subcontract_agreements')
    .insert(cleanData)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'agreement_created',
    entity_type: 'subcontract_agreement',
    entity_id: result.id,
    description: `إنشاء عقد مقاول باطن رقم ${data.agreement_code}`,
    metadata: { agreement_code: data.agreement_code, project_id: data.project_id, subcontractor_party_id: data.subcontractor_party_id },
  })

  revalidatePath(`/projects/${data.project_id}/agreements`)
  return result
}

export async function updateSubcontractAgreement(id: string, projectId: string, updates: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('subcontract_agreements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'agreement_updated',
    entity_type: 'subcontract_agreement',
    entity_id: id,
    description: 'تعديل بيانات عقد مقاول باطن',
    metadata: { agreement_id: id, project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/agreements`)
  revalidatePath(`/projects/${projectId}/agreements/${id}`)
  return result
}


// ====== SUBCONTRACT AGREEMENT LINES ====== //

export async function saveSubcontractAgreementLines(agreementId: string, projectId: string, lines: any[]) {
  const supabase = createClient()
  
  // Wipe existing lines and insert new to behave like a standard update
  // Actually, better to just delete all and insert because lines might be added/removed
  const { error: delError } = await supabase
    .from('subcontract_agreement_lines')
    .delete()
    .eq('subcontract_agreement_id', agreementId)
    
  if (delError) throw delError

  if (lines.length > 0) {
    const cleanLines = lines.map(line => ({
      subcontract_agreement_id: agreementId,
      work_item_id: line.work_item_id,
      unit_id: line.unit_id,
      agreed_rate: line.agreed_rate || 0,
      taaliya_type: line.taaliya_type || null,
      taaliya_value: line.taaliya_value || null,
      owner_billable_default: line.owner_billable_default !== false,
      estimated_quantity: line.estimated_quantity || null,
      notes: line.notes || null
    }))

    const { error: insError } = await supabase
      .from('subcontract_agreement_lines')
      .insert(cleanLines)

    if (insError) throw insError
  }

  revalidatePath(`/projects/${projectId}/agreements/${agreementId}`)
}
