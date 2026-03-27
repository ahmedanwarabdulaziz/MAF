'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

export async function getTreasuryAccounts(projectId?: string) {
  const supabase = createClient()
  let query = supabase.from('financial_account_balances_view').select(`
    *,
    project:projects(arabic_name)
  `)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query.order('account_type', { ascending: true })
  
  if (error) throw error
  return data
}

export async function getAccountTransactions(accountId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_transactions')
    .select(`
      *,
      created_by_user:users(display_name)
    `)
    .eq('financial_account_id', accountId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getAccountDetails(accountId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_account_balances_view')
    .select(`*, project:projects(arabic_name)`)
    .eq('financial_account_id', accountId)
    .single()

  if (error) throw error
  return data
}

export async function transferFunds(payload: {
  from_account_id: string
  to_account_id: string
  amount: number
  transfer_date: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify accounts
  const { data: fromAcc } = await supabase.from('financial_accounts').select('id').eq('id', payload.from_account_id).single()
  const { data: toAcc } = await supabase.from('financial_accounts').select('id').eq('id', payload.to_account_id).single()

  if (!fromAcc || !toAcc) throw new Error('Invalid accounts selected')
  if (fromAcc.id === toAcc.id) throw new Error('Cannot transfer to the same account')

  // Create Withdrawal on From
  const { error: wErr } = await supabase.from('financial_transactions').insert([{
    financial_account_id: payload.from_account_id,
    transaction_date: payload.transfer_date,
    transaction_type: 'withdrawal',
    amount: payload.amount,
    reference_type: 'transfer_out',
    reference_id: payload.to_account_id, // We log the destination ID as the reference
    notes: payload.notes || 'تحويل داخلي صادر',
    created_by: user?.id
  }])
  if (wErr) throw wErr

  // Create Deposit on To
  const { error: dErr } = await supabase.from('financial_transactions').insert([{
    financial_account_id: payload.to_account_id,
    transaction_date: payload.transfer_date,
    transaction_type: 'deposit',
    amount: payload.amount,
    reference_type: 'transfer_in',
    reference_id: payload.from_account_id, // We log the source ID as the reference
    notes: payload.notes || 'تحويل داخلي وارد',
    created_by: user?.id
  }])
  if (dErr) throw dErr

  await writeAuditLog({
    action: 'funds_transferred',
    entity_type: 'financial_account',
    entity_id: payload.from_account_id,
    description: `تحويل مبلغ ${payload.amount} بين حسابين`,
    metadata: { from_account_id: payload.from_account_id, to_account_id: payload.to_account_id, amount: payload.amount, transfer_date: payload.transfer_date },
  })

  revalidatePath('/company/treasury')
}

export async function updateFinancialAccount(id: string, input: {
  arabic_name: string
  english_name?: string | null
  bank_name?: string | null
  account_number?: string | null
  notes?: string | null
  is_active?: boolean
}) {
  const supabase = createClient()

  // Merge bank details into notes
  const noteParts = []
  if (input.bank_name) noteParts.push(`البنك: ${input.bank_name}`)
  if (input.account_number) noteParts.push(`رقم الحساب: ${input.account_number}`)
  if (input.notes) noteParts.push(input.notes)

  const { error } = await supabase
    .from('financial_accounts')
    .update({
      arabic_name: input.arabic_name,
      english_name: input.english_name || input.arabic_name,
      notes: noteParts.join(' | ') || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'account_updated',
    entity_type: 'financial_account',
    entity_id: id,
    description: `تعديل بيانات الحساب: ${input.arabic_name}`,
    metadata: { account_id: id, arabic_name: input.arabic_name },
  })

  revalidatePath('/company/treasury')
}

export async function createFinancialAccount(input: {
  arabic_name: string
  english_name?: string | null
  account_type: string
  currency: string
  opening_balance?: number
  bank_name?: string | null
  account_number?: string | null
  notes?: string | null
  project_id?: string | null
}) {
  const supabase = createClient()

  // Resolve company_id server-side
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!company) throw new Error('لا توجد شركة مُسجَّلة في النظام')

  // Bank details stored in notes since schema has no dedicated columns
  const noteParts = []
  if (input.bank_name) noteParts.push(`البنك: ${input.bank_name}`)
  if (input.account_number) noteParts.push(`رقم الحساب: ${input.account_number}`)
  if (input.notes) noteParts.push(input.notes)

  const { data, error } = await supabase
    .from('financial_accounts')
    .insert({
      company_id: company.id,
      arabic_name: input.arabic_name,
      english_name: input.english_name || input.arabic_name,
      account_type: input.account_type,
      currency: input.currency || 'EGP',
      notes: noteParts.join(' | ') || null,
      project_id: input.project_id || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Insert opening balance as an initial deposit transaction if provided
  if (input.opening_balance && input.opening_balance > 0) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error: txErr } = await supabase.from('financial_transactions').insert({
      financial_account_id: data.id,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'deposit',
      amount: input.opening_balance,
      reference_type: 'opening_balance',
      notes: 'رصيد افتتاحي',
      created_by: user?.id,
    })
    if (txErr) throw new Error(txErr.message)
  }

  await writeAuditLog({
    action: 'account_created',
    entity_type: 'financial_account',
    entity_id: data.id,
    description: `إنشاء حساب مالي جديد: ${input.arabic_name} (${input.account_type})`,
    metadata: { account_id: data.id, arabic_name: input.arabic_name, account_type: input.account_type, currency: input.currency, opening_balance: input.opening_balance },
  })

  revalidatePath('/company/treasury')
  return { id: data.id }
}

export async function depositFunds(payload: {
  account_id: string
  amount: number
  transaction_date: string
  notes?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('financial_transactions').insert({
    financial_account_id: payload.account_id,
    transaction_date: payload.transaction_date,
    transaction_type: 'deposit',
    amount: payload.amount,
    reference_type: 'manual_adjustment',
    notes: payload.notes || '\u0625\u064a\u062f\u0627\u0639 \u064a\u062f\u0648\u064a',
    created_by: user?.id,
  })

  if (error) throw new Error(error.message)

  await writeAuditLog({
    action: 'manual_deposit',
    entity_type: 'financial_account',
    entity_id: payload.account_id,
    description: `إيداع يدوي بمبلغ ${payload.amount}`,
    metadata: { account_id: payload.account_id, amount: payload.amount, transaction_date: payload.transaction_date, notes: payload.notes },
  })

  revalidatePath('/company/treasury')
}
