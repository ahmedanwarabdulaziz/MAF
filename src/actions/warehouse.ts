'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function getMainCompanyId() {
  const supabase = createClient()
  const { data } = await supabase.from('companies').select('id').eq('short_code', 'MAIN').single()
  return data?.id
}

// ITEM GROUPS
export async function createItemGroup(data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('item_groups')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/item-groups')
  return result
}

export async function updateItemGroup(id: string, data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('item_groups')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/item-groups')
  return result
}

// UNITS
export async function createUnit(data: { company_id: string; arabic_name: string; english_name?: string }) {
  const supabase = createClient()

  // Auto-generate unit_code (e.g. UNIT-001)
  const { count } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
  const unit_code = `UNIT-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: result, error } = await supabase
    .from('units')
    .insert({ ...data, unit_code, is_active: true })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/items/new')
  return result as { id: string; arabic_name: string }
}

// ITEMS
export async function createItem(data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('items')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/items')
  return result
}

export async function updateItem(id: string, data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('items')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/items')
  return result
}

// WAREHOUSES
export async function createWarehouse(data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('warehouses')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/warehouses')
  return result
}

export async function updateWarehouse(id: string, data: any) {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .from('warehouses')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/company/main_warehouse/warehouses')
  return result
}

// TRANSFERS
export async function createWarehouseTransfer(data: {
  header: any;
  lines: any[];
}) {
  const supabase = createClient()
  
  // 1. Create header
  const { data: headerResult, error: headerError } = await supabase
    .from('warehouse_transfers')
    .insert(data.header)
    .select()
    .single()

  if (headerError) throw headerError

  // 2. Create lines
  const linesToInsert = data.lines.map(line => ({
    ...line,
    warehouse_transfer_id: headerResult.id,
  }))

  const { error: linesError } = await supabase
    .from('warehouse_transfer_lines')
    .insert(linesToInsert)

  if (linesError) {
    // Ideally rollback or call an RPC, but we'll just throw for now.
    throw linesError
  }

  revalidatePath('/company/main_warehouse/transfers')
  revalidatePath('/projects/[projectId]/project_warehouse/transfers')
  return headerResult
}
