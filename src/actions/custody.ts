'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// -------------------------------------------------------------------
// CUSTODY ACCOUNTS (العهد)
// -------------------------------------------------------------------

export async function createCustodyAccount(payload: {
  project_id?: string,
  employee_user_id: string,
  account_type: 'permanent' | 'temporary',
  allowed_negative_limit?: number,
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Grab company based on project or fallback to active session
  let companyId: string | undefined
  if (payload.project_id) {
    const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()
    companyId = project?.company_id
  } else {
    // Attempt lookup from users table or some session mapping. We'll use a dummy/active company hook 
    // Usually handled by the DB function `auth.get_user_company_id()`, but we want to be explicit.
    // For now, if no project, this should only happen if allowed at corporate level.
  }

  // To keep it simple, call the insert and let the server defaults or RLS populate company_id if omitted,
  // or explicitly fetch the user's current active company profile (via auth trigger defaults or similar).
  
  // Actually, we must provide company_id. Let's look it up via the user's profile:
  const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user?.id).single()

  const { data: account, error } = await supabase
    .from('employee_custody_accounts')
    .insert([{
      company_id: payload.project_id ? companyId : profile?.company_id,
      project_id: payload.project_id || null,
      employee_user_id: payload.employee_user_id,
      account_type: payload.account_type,
      allowed_negative_limit: payload.allowed_negative_limit || 0.00,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select()
    .single()

  if (error) throw error
  if (payload.project_id) revalidatePath(`/projects/${payload.project_id}`)
  return account
}

export async function fundCustodyAccount(payload: {
  employee_custody_account_id: string,
  amount: number,
  transaction_date: string,
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: transaction, error } = await supabase
    .from('employee_custody_transactions')
    .insert([{
      employee_custody_account_id: payload.employee_custody_account_id,
      transaction_date: payload.transaction_date,
      transaction_type: 'funding',
      amount: payload.amount,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select()
    .single()

  if (error) throw error
  return transaction
}


// -------------------------------------------------------------------
// PETTY EXPENSES (المصروفات النثرية)
// -------------------------------------------------------------------

export async function recordPettyExpense(payload: {
  project_id?: string,
  employee_custody_account_id: string,
  expense_group_id: string,
  expense_item_id: string,
  quantity?: number,
  unit_price?: number,
  total_amount: number,
  expense_date: string,
  notes?: string,
  attachment_url?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user?.id).single()
  
  let companyId = profile?.company_id
  if (payload.project_id) {
    const { data: project } = await supabase.from('projects').select('company_id').eq('id', payload.project_id).single()
    companyId = project?.company_id
  }

  const { data: expense, error } = await supabase
    .from('petty_expenses')
    .insert([{
      company_id: companyId,
      project_id: payload.project_id || null,
      employee_custody_account_id: payload.employee_custody_account_id,
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
    description: `تسجيل مصروف نثري بمبلغ ${payload.total_amount}`,
    metadata: { expense_id: expense.id, total_amount: payload.total_amount, expense_date: payload.expense_date, project_id: payload.project_id },
  })

  if (payload.project_id) revalidatePath(`/projects/${payload.project_id}`)
  return expense
}

export async function approvePettyExpense(expenseId: string, action: 'pm_approve' | 'gm_approve' | 'reject') {
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
  } else if (action === 'gm_approve') {
    // Only GM dictates funding deployment from the custody ledger usually, 
    // or we deduct the custody immediately upon record. The business rule says:
    // "If an employee has permission... the employee may register an expense... but only within the configured limit."
    // It's best if the *approval* deducts the ledger, or the *drafting* locks the funds.
    // If drafting locked the funds, the user gets immediate feedback. Let's make GM approval officially deduct it for now.
    
    // In many corporate flows, the actual transaction hits the ledger at `gm_approved` because it's officially an expense.
    // However, to enforce negative balance AT INPUT TIME (Draft), we might need to change it so that `recordPettyExpense`
    // creates the transaction directly, OR we enforce the logic manually.
    
    // For now, let's inject the negative transaction when GM formally approves it.
    const { error: txErr } = await supabase.from('employee_custody_transactions').insert([{
      employee_custody_account_id: expense.employee_custody_account_id,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'expense',
      amount: -Math.abs(expense.total_amount), // Force negative deduction
      reference_type: 'petty_expense',
      reference_id: expense.id,
      notes: `Expense Approval for ID: ${expense.id}`,
      created_by: user?.id
    }])

    if (txErr) {
      // The DB trigger `check_custody_negative_limit` might throw here if it pushes them over the limit!
      throw new Error(`Expense approval failed. The employee custody balance does not support this exact deduction amount. DB returned: ${txErr.message}`)
    }

    updates = { status: 'gm_approved', gm_approved_by: user?.id, gm_approved_at: new Date().toISOString() }
  }

  const { error: upErr } = await supabase.from('petty_expenses').update(updates).eq('id', expenseId)
  if (upErr) throw upErr

  const actionLabel = action === 'pm_approve' ? 'موافقة مدير المشروع' : action === 'gm_approve' ? 'موافقة المدير العام' : 'رفض'
  await writeAuditLog({
    action: 'expense_approved',
    entity_type: 'petty_expense',
    entity_id: expenseId,
    description: `تحديث حالة مصروف نثري — الإجراء: ${actionLabel}`,
    metadata: { expense_id: expenseId, action, total_amount: expense.total_amount },
  })
}

// -------------------------------------------------------------------
// VIEWS & QUERIES
// -------------------------------------------------------------------

export async function getCustodyBalances(projectId?: string) {
  const supabase = createClient()
  let query = supabase.from('employee_custody_balances_view').select('*')

  if (projectId) query = query.eq('project_id', projectId)

  const { data: balances, error } = await query
  if (error) throw error

  // Manually fetch and attach employees to avoid PostgREST view mapping errors
  const { data: users } = await supabase.from('users').select('id, email, display_name')
  
  return balances?.map((b: any) => {
    const user = users?.find(u => u.id === b.employee_user_id)
    return {
      ...b,
      employee: user || null
    }
  }) || []
}
