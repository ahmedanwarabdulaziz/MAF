'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// 1. BATCHES
export async function getCutoverBatch(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cutover_batches')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw error
  return data
}
export async function createCutoverBatch(data: { company_id: string, project_id: string, cutover_date: string, notes?: string }) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('cutover_batches')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  // Mark project as in_progress
  await supabase
    .from('projects')
    .update({ migration_status: 'in_progress' })
    .eq('id', data.project_id)

  revalidatePath(`/company/projects/${data.project_id}`)
  revalidatePath(`/projects/${data.project_id}/cutover`)
  return result
}

export async function updateCutoverBatchStatus(id: string, projectId: string, status: 'draft' | 'in_review' | 'approved' | 'locked') {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('cutover_batches')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return result
}

// 1.5 FINANCIALS
export async function saveOpeningFinancialBalances(batchId: string, projectId: string, balances: any[]) {
  const supabase = createClient()
  const { error: deleteError } = await supabase.from('cutover_financial_balances').delete().eq('batch_id', batchId)
  if (deleteError) throw deleteError

  if (balances && balances.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_financial_balances')
      .insert(balances.map(b => ({ ...b, batch_id: batchId })))
    if (insertError) throw insertError
  }
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 2. STOCK
export async function saveOpeningStock(batchId: string, projectId: string, stockItems: any[]) {
  const supabase = createClient()
  
  // Clear existing stock for this batch to replace with new snapshot
  const { error: deleteError } = await supabase
    .from('cutover_warehouse_stock')
    .delete()
    .eq('batch_id', batchId)
    
  if (deleteError) throw deleteError

  if (stockItems && stockItems.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_warehouse_stock')
      .insert(stockItems.map(item => ({ ...item, batch_id: batchId })))
      
    if (insertError) throw insertError
  }

  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 3. SUBCONTRACTORS
export async function saveOpeningSubcontractorPositions(batchId: string, projectId: string, positions: any[]) {
  const supabase = createClient()
  const { error: deleteError } = await supabase.from('cutover_subcontractor_positions').delete().eq('batch_id', batchId)
  if (deleteError) throw deleteError

  if (positions && positions.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_subcontractor_positions')
      .insert(positions.map(p => ({ ...p, batch_id: batchId })))
    if (insertError) throw insertError
  }
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 4. SUPPLIERS
export async function saveOpeningSupplierPositions(batchId: string, projectId: string, positions: any[]) {
  const supabase = createClient()
  const { error: deleteError } = await supabase.from('cutover_supplier_positions').delete().eq('batch_id', batchId)
  if (deleteError) throw deleteError

  if (positions && positions.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_supplier_positions')
      .insert(positions.map(p => ({ ...p, batch_id: batchId })))
    if (insertError) throw insertError
  }
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 4.5 OWNER
export async function saveOpeningOwnerPositions(batchId: string, projectId: string, positions: any[]) {
  const supabase = createClient()
  const { error: deleteError } = await supabase.from('cutover_owner_positions').delete().eq('batch_id', batchId)
  if (deleteError) throw deleteError

  if (positions && positions.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_owner_positions')
      .insert(positions.map(p => ({ ...p, batch_id: batchId })))
    if (insertError) throw insertError
  }
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 4.6 CUSTODY
export async function saveOpeningEmployeeCustody(batchId: string, projectId: string, balances: any[]) {
  const supabase = createClient()
  const { error: deleteError } = await supabase.from('cutover_employee_custody').delete().eq('batch_id', batchId)
  if (deleteError) throw deleteError

  if (balances && balances.length > 0) {
    const { error: insertError } = await supabase
      .from('cutover_employee_custody')
      .insert(balances.map(b => ({ ...b, batch_id: batchId })))
    if (insertError) throw insertError
  }
  revalidatePath(`/company/projects/${projectId}/cutover`)
  return true
}

// 5. LOCK LOGIC (RPC)
export async function lockCutoverBatch(batchId: string, projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('lock_cutover_batch', { batch_id: batchId })
  
  if (error) throw error

  revalidatePath(`/company/projects/${projectId}/cutover`)
  return data
}
