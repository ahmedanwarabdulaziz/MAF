'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { peekNextDocumentNo } from '@/actions/sequences'

// ─────────────────────────────────────────────────────────────
// Create a store issue (returns draft → pending_approval)
// ─────────────────────────────────────────────────────────────
export async function createStoreIssue(data: {
  header: {
    company_id: string
    warehouse_id: string
    project_id?: string | null
    issue_date: string
    issued_to_user_id?: string | null
    cost_center_id?: string | null
    issue_type?: 'project' | 'internal'
    notes?: string | null
  }
  lines: {
    item_id: string
    unit_id: string
    quantity: number
  }[]
}) {
  const supabase = createClient()

  const headerPayload = {
    ...data.header,
    issue_type: data.header.issue_type ?? 'project',
    document_no: 'تلقائي',
    status: 'pending_approval',
  }

  const { data: header, error: headerError } = await supabase
    .from('store_issues')
    .insert(headerPayload)
    .select()
    .single()

  if (headerError) throw new Error(headerError.message)

  const linesPayload = data.lines.map(l => ({
    store_issue_id: header.id,
    item_id: l.item_id,
    unit_id: l.unit_id,
    quantity: l.quantity,
    unit_cost: 0,
  }))

  const { error: linesError } = await supabase
    .from('store_issue_lines')
    .insert(linesPayload)

  if (linesError) throw new Error(linesError.message)

  await writeAuditLog({
    action: 'store_issue_created',
    entity_type: 'store_issue',
    entity_id: header.id,
    description: `إنشاء إذن صرف ${data.header.issue_type === 'internal' ? 'داخلي' : 'مخزني'} ${header.document_no} (${data.lines.length} صنف)`,
    metadata: { document_no: header.document_no, lines_count: data.lines.length, issue_type: data.header.issue_type },
  })

  revalidatePath(`/projects/${data.header.project_id}/project_warehouse/issues`)
  revalidatePath('/company/main_warehouse/issues')
  return header
}

// ─────────────────────────────────────────────────────────────
// Approve a store issue (role: 'pm' | 'warehouse_manager')
// ─────────────────────────────────────────────────────────────
export async function approveStoreIssue(
  issueId: string,
  roleType: 'pm' | 'warehouse_manager',
  projectId: string | null,
  notes?: string
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('approve_store_issue', {
      p_issue_id: issueId,
      p_role_type: roleType,
      p_notes: notes ?? null,
    })
    .single()

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; error?: string; message?: string }
  if (!result.ok) throw new Error(result.error ?? 'فشلت الموافقة')

  await writeAuditLog({
    action: 'store_issue_approved',
    entity_type: 'store_issue',
    entity_id: issueId,
    description: `موافقة ${roleType === 'pm' ? 'مدير المشروع' : 'أمين المخزن'} على إذن الصرف`,
    metadata: { issue_id: issueId, role: roleType },
  })

  if (projectId) {
    revalidatePath(`/projects/${projectId}/project_warehouse/issues`)
    revalidatePath(`/projects/${projectId}/project_warehouse/issues/${issueId}`)
  }
  revalidatePath('/company/main_warehouse/issues')
  revalidatePath(`/company/main_warehouse/issues/${issueId}`)
  return result
}

// ─────────────────────────────────────────────────────────────
// Reject a store issue
// ─────────────────────────────────────────────────────────────
export async function rejectStoreIssue(
  issueId: string,
  roleType: 'pm' | 'warehouse_manager',
  projectId: string | null,
  reason?: string
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('reject_store_issue', {
      p_issue_id: issueId,
      p_role_type: roleType,
      p_reason: reason ?? null,
    })
    .single()

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; error?: string; message?: string }
  if (!result.ok) throw new Error(result.error ?? 'فشل الرفض')

  await writeAuditLog({
    action: 'store_issue_rejected',
    entity_type: 'store_issue',
    entity_id: issueId,
    description: `رفض إذن الصرف من قِبَل ${roleType === 'pm' ? 'مدير المشروع' : 'أمين المخزن'}`,
    metadata: { issue_id: issueId, role: roleType, reason },
  })

  if (projectId) {
    revalidatePath(`/projects/${projectId}/project_warehouse/issues`)
    revalidatePath(`/projects/${projectId}/project_warehouse/issues/${issueId}`)
  }
  revalidatePath('/company/main_warehouse/issues')
  return result
}

// ─────────────────────────────────────────────────────────────
// Cancel a store issue (only draft or pending_approval)
// ─────────────────────────────────────────────────────────────
export async function cancelStoreIssue(issueId: string, projectId: string | null, reason?: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('store_issues')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .in('status', ['draft', 'pending_approval'])

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'store_issue_cancelled',
    entity_type: 'store_issue',
    entity_id: issueId,
    description: 'إلغاء إذن الصرف المخزني',
    metadata: { issue_id: issueId, reason },
  })

  if (projectId) revalidatePath(`/projects/${projectId}/project_warehouse/issues`)
  revalidatePath('/company/main_warehouse/issues')
}

// ─────────────────────────────────────────────────────────────
// Fetch stock balance for items in a given warehouse
// ─────────────────────────────────────────────────────────────
export async function getWarehouseStockBalances(warehouseId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('stock_balances')
    .select(`
      item_id,
      quantity_on_hand,
      total_value,
      weighted_avg_cost,
      item:item_id (
        id, item_code, arabic_name, english_name,
        primary_unit:primary_unit_id ( id, arabic_name )
      )
    `)
    .eq('warehouse_id', warehouseId)
    .gt('quantity_on_hand', 0)
    .order('item_id')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─────────────────────────────────────────────────────────────
// Peek next ISU document number
// ─────────────────────────────────────────────────────────────
export async function peekNextIssueNo(companyId: string) {
  return peekNextDocumentNo(companyId, 'store_issues', 'ISU')
}

// ─────────────────────────────────────────────────────────────
// Cost Centers CRUD
// ─────────────────────────────────────────────────────────────
export async function getCostCenters() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*, parent:parent_center_id(id, arabic_name, cost_center_code)')
    .eq('is_active', true)
    .order('cost_center_code')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllCostCenters() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*, parent:parent_center_id(id, arabic_name, cost_center_code)')
    .order('cost_center_code')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCostCenter(formData: {
  arabic_name: string
  english_name?: string
  center_type: 'company' | 'department'
  parent_center_id?: string | null
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح')

  const { data: company } = await supabase.from('companies').select('id').single()
  if (!company) throw new Error('لا يوجد شركة')

  // Auto-generate code: CC-001, CC-002 ...
  const { count } = await supabase
    .from('cost_centers')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
  const nextNum = String((count ?? 0) + 1).padStart(3, '0')
  const autoCode = `CC-${nextNum}`

  const { data: cc, error } = await supabase
    .from('cost_centers')
    .insert({
      company_id: company.id,
      cost_center_code: autoCode,
      arabic_name: formData.arabic_name,
      english_name: formData.english_name || formData.arabic_name,
      center_type: formData.center_type,
      parent_center_id: formData.parent_center_id || null,
      notes: formData.notes || null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'cost_centers',
    entity_id: cc.id,
    description: `تم إنشاء مركز تكلفة: ${formData.arabic_name} (${autoCode})`,
  })

  revalidatePath('/company/cost-centers')
}

export async function getStoreIssueDetails(issueId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('store_issues')
    .select(`
      id, document_no, issue_date, status, notes, issue_type,
      pm_status, wm_status, rejection_reason,
      pm_approved_at, wm_approved_at, confirmed_at,
      approved_by_pm:approved_by_pm ( display_name ),
      approved_by_wm:approved_by_wm ( display_name ),
      warehouse:warehouse_id ( arabic_name ),
      project:project_id ( arabic_name ),
      cost_center:cost_center_id ( cost_center_code, arabic_name ),
      lines:store_issue_lines (
        id, quantity, unit_cost, total_cost,
        item:item_id ( item_code, arabic_name ),
        unit:unit_id ( arabic_name )
      )
    `)
    .eq('id', issueId)
    .single()

  if (error) throw new Error(error.message)
  return data
}
export async function updateCostCenter(id: string, formData: {
  arabic_name: string
  english_name?: string
  center_type: 'company' | 'department'
  parent_center_id?: string | null
  is_active: boolean
  notes?: string
}) {
  const supabase = createClient()

  const { error } = await supabase
    .from('cost_centers')
    .update({
      arabic_name: formData.arabic_name,
      english_name: formData.english_name || formData.arabic_name,
      center_type: formData.center_type,
      parent_center_id: formData.parent_center_id || null,
      is_active: formData.is_active,
      notes: formData.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'UPDATE',
    entity_type: 'cost_centers',
    entity_id: id,
    description: `تم تحديث مركز التكلفة: ${formData.arabic_name}`,
  })

  revalidatePath('/company/cost-centers')
}

