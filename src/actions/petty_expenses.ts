'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// -------------------------------------------------------------------
// PETTY EXPENSES (المصروفات النثرية) - REFACTORED TO TREASURY
// -------------------------------------------------------------------

export async function recordPettyExpense(payload: {
  project_id?: string,
  financial_account_id: string,
  expense_group_id: string,
  expense_item_id: string,
  quantity?: number,
  unit_price?: number,
  total_amount: number,
  expense_date: string,
  notes?: string,
  attachment_url?: string,
  cost_center_id?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user?.id).single()
  
  let companyId = profile?.company_id
  let costCenterId = payload.cost_center_id

  if (payload.project_id) {
    const { data: project } = await supabase.from('projects').select('company_id, cost_center_id').eq('id', payload.project_id).single()
    companyId = project?.company_id
    costCenterId = project?.cost_center_id // Force project cost center initially
  }

  if (!costCenterId) {
    throw new Error('بيانات مركز التكلفة مفقودة أو غير محددة.')
  }

  const { data: expense, error } = await supabase
    .from('petty_expenses')
    .insert([{
      company_id: companyId,
      project_id: payload.project_id || null,
      cost_center_id: costCenterId,
      financial_account_id: payload.financial_account_id,
      expense_group_id: payload.expense_group_id,
      expense_item_id: payload.expense_item_id,
      quantity: payload.quantity || 1,
      unit_price: payload.unit_price || 0,
      total_amount: payload.total_amount,
      expense_date: payload.expense_date,
      notes: payload.notes || null,
      attachment_url: payload.attachment_url || null,
      created_by: user?.id,
      status: 'draft'
    }])
    .select()
    .single()

  if (error) throw error
  
  await writeAuditLog({
    action: 'expense_created',
    entity_type: 'petty_expense',
    entity_id: expense.id,
    description: `تسجيل مصروف نثري במبلغ ${payload.total_amount}`,
    metadata: { expense_id: expense.id, total_amount: payload.total_amount, expense_date: payload.expense_date, project_id: payload.project_id },
  })

  // We revalidate the new petty-expenses route
  if (payload.project_id) revalidatePath(`/projects/${payload.project_id}/petty-expenses`)
  return expense
}

export async function approvePettyExpense(
  expenseId: string, 
  action: 'pm_approve' | 'gm_approve' | 'reject' | 'return_to_draft',
  newCostCenterId?: string
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current state
  const { data: expense, error: fetchErr } = await supabase.from('petty_expenses').select('*').eq('id', expenseId).single()
  if (fetchErr) throw fetchErr

  let updates: any = {}

  if (action === 'pm_approve') {
    updates = { status: 'pm_approved', pm_approved_by: user?.id, pm_approved_at: new Date().toISOString() }
  } else if (action === 'reject') {
    updates = { status: 'rejected' }
  } else if (action === 'return_to_draft') {
    updates = { 
        status: 'draft', 
        pm_approved_by: null, 
        pm_approved_at: null,
        gm_approved_by: null,
        gm_approved_at: null 
    }
  } else if (action === 'gm_approve') {
    // GM formally approves it -> We must deduct it from the project cashbox (financial_account) directly
    
    // 1. Get the account info
    const { data: account, error: accErr } = await supabase
      .from('financial_accounts')
      .select('arabic_name')
      .eq('id', expense.financial_account_id)
      .single()
      
    if (accErr) throw new Error("Cashbox account not found.")

    // 2. Insert into financial_transactions
    const { error: txErr } = await supabase.from('financial_transactions').insert([{
      financial_account_id: expense.financial_account_id,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'withdrawal',
      amount: expense.total_amount, // treasury module usually uses positive amounts for withdrawals with a type of 'withdrawal'
      reference_type: 'petty_expense',
      reference_id: expense.id,
      notes: `صرف المصروف النثري المعتمد #${expense.id.slice(0, 8)}`,
      created_by: user?.id
    }])

    if (txErr) {
      throw new Error(`Expense approval failed while deducting from cashbox: ${txErr.message}`)
    }

    updates = { status: 'gm_approved', gm_approved_by: user?.id, gm_approved_at: new Date().toISOString() }
  }

  if ((action === 'pm_approve' || action === 'gm_approve') && newCostCenterId) {
    updates.cost_center_id = newCostCenterId
  }

  const { error: upErr } = await supabase.from('petty_expenses').update(updates).eq('id', expenseId)
  if (upErr) throw upErr

  const actionLabel = action === 'pm_approve' ? 'موافقة مدير المشروع' : action === 'gm_approve' ? 'موافقة المدير العام' : action === 'return_to_draft' ? 'إرجاع كمسودة' : 'رفض'
  await writeAuditLog({
    action: 'expense_approved',
    entity_type: 'petty_expense',
    entity_id: expenseId,
    description: `تحديث حالة مصروف نثري — الإجراء: ${actionLabel}`,
    metadata: { expense_id: expenseId, action, total_amount: expense.total_amount },
  })
  
  // Dual log: if GM approved, money was withdrawn from the Cashbox
  if (action === 'gm_approve') {
    await writeAuditLog({
      action: 'funds_withdrawn',
      entity_type: 'financial_account',
      entity_id: expense.financial_account_id,
      description: `سحب مبلغ ${expense.total_amount} كسداد لمصروف نثري معتمد`,
      metadata: { expense_id: expenseId, total_amount: expense.total_amount, reference_type: 'petty_expense' },
    })
  }
}

export async function updatePettyExpense(expenseId: string, payload: {
  financial_account_id: string,
  expense_group_id: string,
  expense_item_id: string,
  total_amount: number,
  expense_date: string,
  notes?: string,
  attachment_url?: string,
  cost_center_id?: string
}) {
  const supabase = createClient()
  
  // Verify state
  const { data: expense, error: fetchErr } = await supabase.from('petty_expenses').select('status, project_id').eq('id', expenseId).single()
  if (fetchErr) throw fetchErr

  if (expense.status !== 'draft' && expense.status !== 'rejected') {
    throw new Error('لا يمكن تعديل مصروف معتمد أو تحت الموافقة.')
  }

  const { data, error } = await supabase
    .from('petty_expenses')
    .update({
      financial_account_id: payload.financial_account_id,
      expense_group_id: payload.expense_group_id,
      expense_item_id: payload.expense_item_id,
      total_amount: payload.total_amount,
      expense_date: payload.expense_date,
      notes: payload.notes || null,
      attachment_url: payload.attachment_url,
      ...(payload.cost_center_id && !expense.project_id ? { cost_center_id: payload.cost_center_id } : {}),
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'expense_updated',
    entity_type: 'petty_expense',
    entity_id: expenseId,
    description: `تعديل مصروف نثري במبلغ ${payload.total_amount}`,
    metadata: { expense_id: expenseId, new_amount: payload.total_amount },
  })

  if (expense.project_id) {
    revalidatePath(`/projects/${expense.project_id}/petty-expenses`)
  }
  return data
}

export async function updatePettyExpenseAttachment(expenseId: string, attachmentUrl: string) {
  const supabase = createClient()
  const { data: expense, error: fetchErr } = await supabase.from('petty_expenses').select('status, project_id').eq('id', expenseId).single()
  if (fetchErr) throw fetchErr

  const { data, error } = await supabase
    .from('petty_expenses')
    .update({ attachment_url: attachmentUrl, updated_at: new Date().toISOString() })
    .eq('id', expenseId)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'expense_attachment_updated',
    entity_type: 'petty_expense',
    entity_id: expenseId,
    description: `تحديث مرفق المصروف النثري`,
    metadata: { expense_id: expenseId, new_attachment: attachmentUrl },
  })

  if (expense.project_id) {
    revalidatePath(`/projects/${expense.project_id}/petty-expenses`)
  }
  return data
}
