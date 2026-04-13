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

export async function getNextWorkItemCode(projectId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('project_work_items')
    .select('item_code')
    .eq('project_id', projectId)

  if (!data || data.length === 0) return 'BND-001'

  let maxNum = 0
  for (const row of data) {
    if (row.item_code) {
      const match = row.item_code.match(/\d+/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (num > maxNum) maxNum = num
      }
    }
  }

  const nextNum = maxNum + 1
  return `BND-${nextNum.toString().padStart(3, '0')}`
}

export async function createProjectWorkItem(data: {
  project_id: string,
  company_id: string,
  item_code?: string,
  arabic_description: string,
  english_description?: string,
  default_unit_id?: string,
  owner_price?: number,
  subcontractor_price?: number,
  notes?: string
}) {
  const supabase = createClient()
  const cleanData = {
    ...data,
    item_code: data.item_code || null,
    english_description: data.english_description || null,
    default_unit_id: data.default_unit_id || null,
    owner_price: data.owner_price || 0,
    subcontractor_price: data.subcontractor_price || 0,
    notes: data.notes || null
  }

  const { data: result, error } = await supabase
    .from('project_work_items')
    .insert(cleanData)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'work_item_created',
    entity_type: 'project_work_item',
    entity_id: result.id,
    description: `إضافة بند أعمال جديد للمشروع: ${data.item_code}`,
    metadata: { project_id: data.project_id, item_code: data.item_code },
  })

  revalidatePath(`/projects/${data.project_id}/work-items`)
  return result
}

export async function updateProjectWorkItem(id: string, projectId: string, updates: any) {
  const supabase = createClient()

  // Sanitise nullable fields — never send empty string for UUID columns
  const cleanUpdates = {
    ...updates,
    default_unit_id:       updates.default_unit_id       || null,
    english_description:   updates.english_description   || null,
    notes:                 updates.notes                 || null,
  }

  const { data: result, error } = await supabase
    .from('project_work_items')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'work_item_updated',
    entity_type: 'project_work_item',
    entity_id: id,
    description: `تعديل بند أعمال`,
    metadata: { project_id: projectId },
  })

  // Note: no revalidatePath here — the work-items page is 'use client'
  // and refreshes via fetchItems() callback after each mutation.
  return result
}

export async function deleteProjectWorkItem(id: string, projectId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('project_work_items')
    .delete()
    .eq('id', id)

  if (error) throw error

  await writeAuditLog({
    action: 'work_item_deleted',
    entity_type: 'project_work_item',
    entity_id: id,
    description: `حذف بند أعمال من المشروع`,
    metadata: { project_id: projectId },
  })
  // Note: no revalidatePath — client side calls fetchItems() after delete
}


export async function getOtherProjects(currentProjectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')
    .neq('id', currentProjectId)
    .order('arabic_name', { ascending: true })

  if (error) throw error
  return data
}

export async function importWorkItems(targetProjectId: string, itemIds: string[]) {
  const supabase = createClient()
  
  // 1. Get the original items
  const { data: sourceItems, error: fetchErr } = await supabase
    .from('project_work_items')
    .select('*')
    .in('id', itemIds)

  if (fetchErr) throw fetchErr
  if (!sourceItems || sourceItems.length === 0) return

  // Need company ID from the target project to link them properly
  const { data: project } = await supabase
    .from('projects')
    .select('company_id')
    .eq('id', targetProjectId)
    .single()

  const companyId = project?.company_id

  // 2. Prepare new items, removing IDs, timestamps, and updating project_id
  const newItems = sourceItems.map(item => ({
    project_id: targetProjectId,
    company_id: companyId || item.company_id,
    item_code: item.item_code,
    arabic_description: item.arabic_description,
    english_description: item.english_description,
    default_unit_id: item.default_unit_id,
    owner_price: item.owner_price,
    subcontractor_price: item.subcontractor_price,
    notes: item.notes,
  }))

  // 3. Insert new items
  const { error: insertErr } = await supabase
    .from('project_work_items')
    .insert(newItems)

  if (insertErr) {
    if (insertErr.message.includes('unique')) throw new Error('بعض أكواد البنود موجودة بالفعل في هذا المشروع. يرجى مراجعة وتعديل الأكواد قبل الاستيراد.')
    throw insertErr
  }

  await writeAuditLog({
    action: 'work_items_imported',
    entity_type: 'project_work_item',
    entity_id: targetProjectId,
    description: `تم استيراد ${sourceItems.length} بنود أعمال من مشروع آخر.`,
    metadata: { target_project_id: targetProjectId, items_count: sourceItems.length },
  })

  revalidatePath(`/projects/${targetProjectId}/work-items`)
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

export async function getNextAgreementCode(projectId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('subcontract_agreements')
    .select('agreement_code')
    .eq('project_id', projectId)

  if (!data || data.length === 0) return 'SUB-001'

  let maxNum = 0
  for (const row of data) {
    if (row.agreement_code) {
      const match = row.agreement_code.match(/\d+/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (num > maxNum) maxNum = num
      }
    }
  }

  const nextNum = maxNum + 1
  return `SUB-${nextNum.toString().padStart(3, '0')}`
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

  return { ...agreement, lines: [] }
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
    start_date: data.start_date && data.start_date.trim() ? data.start_date.trim() : null,
    end_date: data.end_date && data.end_date.trim() ? data.end_date.trim() : null,
    notes: data.notes && data.notes.trim() ? data.notes.trim() : null,
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
  const cleanUpdates = {
    ...updates,
  }
  if ('start_date' in cleanUpdates) cleanUpdates.start_date = cleanUpdates.start_date?.trim() || null
  if ('end_date' in cleanUpdates) cleanUpdates.end_date = cleanUpdates.end_date?.trim() || null

  const { data: result, error } = await supabase
    .from('subcontract_agreements')
    .update(cleanUpdates)
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
// Lines actions removed
