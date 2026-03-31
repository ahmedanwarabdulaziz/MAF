'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

// 1. Get entire taxonomy
export async function getExpenseCategories() {
  const supabase = createClient()
  
  // Get all active groups
  const { data: groups, error: groupsErr } = await supabase
    .from('expense_groups')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (groupsErr) throw new Error("Failed to fetch expense groups: " + groupsErr.message)

  // Get all active items
  const { data: items, error: itemsErr } = await supabase
    .from('expense_items')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (itemsErr) throw new Error("Failed to fetch expense items: " + itemsErr.message)

  return { groups: groups || [], items: items || [] }
}

// 2. Create a new Expense Group
export async function createExpenseGroup(payload: { arabic_name: string, group_code: string }) {
  await requirePermission('corporate_expenses', 'view') // Secure server action

  const supabase = createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Resolve company_id server-side
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const companyId = company?.id

  if (!companyId) throw new Error("Company ID not found.")

  const { data, error } = await adminClient
    .from('expense_groups')
    .insert([{
      company_id: companyId,
      arabic_name: payload.arabic_name,
      group_code: payload.group_code,
      is_active: true
    }])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error("كود المجموعة مستخدم مسبقاً في هذه الشركة.")
    throw error
  }
  
  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'expense_groups',
    entity_id: data.id,
    description: `تم إضافة مجموعة مصروفات: ${payload.arabic_name} (${payload.group_code})`
  })

  revalidatePath('/company/treasury/expense-categories')
  return data
}

// 3. Create a new Expense Item
export async function createExpenseItem(payload: { expense_group_id: string, arabic_name: string, item_code: string }) {
  await requirePermission('corporate_expenses', 'view')

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('expense_items')
    .insert([{
      expense_group_id: payload.expense_group_id,
      arabic_name: payload.arabic_name,
      item_code: payload.item_code,
      is_active: true
    }])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error("كود البند مستخدم مسبقاً في هذه المجموعة.")
    throw error
  }
  
  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'expense_items',
    entity_id: data.id,
    description: `تم إضافة بند مصروفات: ${payload.arabic_name} (${payload.item_code})`
  })

  revalidatePath('/company/treasury/expense-categories')
  return data
}

// 4. Toggle active status (deactivate instead of delete)
export async function toggleExpenseCategoryStatus(type: 'group' | 'item', id: string, isActive: boolean) {
  await requirePermission('corporate_expenses', 'view')
  
  const adminClient = createAdminClient()
  const table = type === 'group' ? 'expense_groups' : 'expense_items'

  const { error } = await adminClient
    .from(table)
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw error

  await writeAuditLog({
    action: 'UPDATE',
    entity_type: table,
    entity_id: id,
    description: `تم تغيير حالة ${type === 'group' ? 'مجموعة' : 'بند'} المصروفات إلى: ${isActive ? 'فعال' : 'غير فعال'}`
  })

  revalidatePath('/company/treasury/expense-categories')
}
