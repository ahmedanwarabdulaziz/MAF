'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

export async function getMainCompanyId() {
  const supabase = createAdminClient()
  // Try to find MAIN short_code, or fallback to the first active company
  const { data } = await supabase.from('companies').select('id').eq('short_code', 'MAIN').maybeSingle()
  if (data?.id) return data.id
  
  const { data: firstActive } = await supabase.from('companies').select('id').eq('is_active', true).limit(1).single()
  return firstActive?.id
}

// ITEM GROUPS
export async function createItemGroup(data: any) {
  const supabase = createClient()
  
  if (!data.company_id) {
    data.company_id = await getMainCompanyId()
    if (!data.company_id) throw new Error("لم يتم العثور على أي شركة نشطة لربط مجموعة الأصناف بها.")
  }

  const { data: result, error } = await supabase
    .from('item_groups')
    .insert(data)
    .select()
    .single()

  if (error) {
    let msg = error.message
    if (error.code === '23502') {
      msg = `Missing required field (NOT NULL violation). Details: ${JSON.stringify(error)}`
    }
    console.error('createItemGroup DB Error:', error)
    throw new Error(msg)
  }

  await writeAuditLog({
    action: 'item_group_created',
    entity_type: 'item_group',
    entity_id: result.id,
    description: `إضافة مجموعة أصناف: ${data.arabic_name}`,
    metadata: { group_code: data.group_code, arabic_name: data.arabic_name }
  })

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

  await writeAuditLog({
    action: 'item_group_updated',
    entity_type: 'item_group',
    entity_id: id,
    description: `تعديل مجموعة أصناف: ${result.arabic_name}`,
    metadata: { group_code: result.group_code, arabic_name: result.arabic_name, is_active: result.is_active }
  })

  revalidatePath('/company/main_warehouse/item-groups')
  return result
}

export async function deleteItemGroup(id: string) {
  const supabase = createClient()
  
  // Fetch subgroups
  const { data: subGroups } = await supabase.from('item_groups').select('id').eq('parent_group_id', id)
  const groupIds = [id, ...(subGroups?.map(g => g.id) || [])]
  
  // Check and delete items if any
  const { data: items } = await supabase.from('items').select('id').in('item_group_id', groupIds)
  const itemIds = items?.map(i => i.id) || []
  
  if (itemIds.length > 0) {
    const { error: itemsError } = await supabase.from('items').delete().in('id', itemIds)
    if (itemsError) {
      if (itemsError.code === '23503') {
        throw new Error('لا يمكن مسح المجموعة لأن أحد أصنافها أو مجموعاتها الفرعية موجود بالفعل في المشتريات أو الجداول الأخرى.')
      }
      throw new Error(itemsError.message)
    }
  }

  // Delete sub-groups if any
  if (subGroups && subGroups.length > 0) {
    const { error: subError } = await supabase.from('item_groups').delete().in('id', subGroups.map(g => g.id))
    if (subError) throw new Error(subError.message)
  }

  // Delete the main group
  const { error: groupError } = await supabase.from('item_groups').delete().eq('id', id)
  if (groupError) {
    if (groupError.code === '23503') throw new Error('لا يمكن مسح المجموعة لارتباطها بجداول أخرى.')
    throw new Error(groupError.message)
  }

  await writeAuditLog({
    action: 'item_group_deleted',
    entity_type: 'item_group',
    entity_id: id,
    description: `مسح مجموعة أصناف`
  })

  revalidatePath('/company/main_warehouse/item-groups')
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

  await writeAuditLog({
    action: 'item_created',
    entity_type: 'item',
    entity_id: result.id,
    description: `إضافة صنف جديد: ${data.arabic_name ?? data.item_code ?? result.id}`,
    metadata: { item_code: data.item_code, arabic_name: data.arabic_name },
  })

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

export async function deleteItem(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('items').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      throw new Error('لا يمكن مسح الصنف لأنه موجود بالفعل في المشتريات أو جداول أخرى داخل النظام.')
    }
    throw new Error(error.message)
  }

  await writeAuditLog({
    action: 'item_deleted',
    entity_type: 'item',
    entity_id: id,
    description: `مسح صنف`
  })

  revalidatePath('/company/main_warehouse/items')
  revalidatePath('/company/main_warehouse/item-groups')
}

// WAREHOUSES
export async function createWarehouse(data: any) {
  const supabase = createClient()

  if (!data.warehouse_code || data.warehouse_code === 'تلقائي' || data.warehouse_code.startsWith('WH-')) {
    let codeAssigned = false
    let retries = 50 // fast forward through up to 50 legacy manually-inserted numbers

    while (retries > 0) {
      const { data: nextCode, error: seqErr } = await supabase.rpc('get_next_document_no', { 
        p_company_id: data.company_id, 
        p_doc_type: 'warehouses', 
        p_prefix: 'WH' 
      })

      if (seqErr || !nextCode) {
        throw new Error('Failed to generate warehouse sequence number.')
      }

      // Verify it doesn't already exist from old manual entries
      const { data: existing } = await supabase
        .from('warehouses')
        .select('id')
        .eq('company_id', data.company_id)
        .eq('warehouse_code', nextCode)
        .maybeSingle()

      if (!existing) {
        data.warehouse_code = nextCode
        codeAssigned = true
        break
      }
      retries--
    }

    if (!codeAssigned) {
      throw new Error('تعذر إيجاد كود تسلسلي متاح للمخزن.')
    }
  }

  const { data: result, error } = await supabase
    .from('warehouses')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  await writeAuditLog({
    action: 'CREATE',
    entity_type: 'warehouses',
    entity_id: result.id,
    description: `إضافة مخزن جديد: ${data.warehouse_code} - ${data.arabic_name}`
  })

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

  await writeAuditLog({
    action: 'UPDATE',
    entity_type: 'warehouses',
    entity_id: id,
    description: `تعديل بيانات المخزن: ${result.warehouse_code} - ${result.arabic_name}`
  })

  revalidatePath('/company/main_warehouse/warehouses')
  return result
}

export async function deleteWarehouse(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('warehouses').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      throw new Error('لا يمكن مسح المخزن لارتباطه بأرصدة مخزنية أو حركات أخرى. يجب استنزاف/حذف الأرصدة المرتبطة به أولاً.')
    }
    throw new Error(error.message)
  }

  await writeAuditLog({
    action: 'DELETE',
    entity_type: 'warehouses',
    entity_id: id,
    description: `مسح مخزن`
  })

  revalidatePath('/company/main_warehouse/warehouses')
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

  await writeAuditLog({
    action: 'warehouse_transfer_created',
    entity_type: 'warehouse_transfer',
    entity_id: headerResult.id,
    description: `إنشاء إذن تحويل مخزني (${data.lines.length} صنف)`,
    metadata: { transfer_id: headerResult.id, lines_count: data.lines.length },
  })

  revalidatePath('/company/main_warehouse/transfers')
  revalidatePath('/projects/[projectId]/project_warehouse/transfers')
  return headerResult
}

// DISPATCH TRANSFER (Step 1)
export async function dispatchTransfer(transferId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

  // Execute the RPC for dispatching
  const { data, error } = await supabase
    .rpc('dispatch_warehouse_transfer', {
      p_transfer_id: transferId
    })
    .single()

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; error?: string; message?: string }
  if (!result.ok) throw new Error(result.error ?? 'فشل صرف الإذن')

  await writeAuditLog({
    action: 'warehouse_transfer_dispatched',
    entity_type: 'warehouse_transfer',
    entity_id: transferId,
    description: `صرف إذن تحويل (بضاعة في الطريق)`,
    metadata: { transfer_id: transferId }
  })

  revalidatePath('/company/main_warehouse/transfers')
  revalidatePath('/projects/[projectId]/project_warehouse/transfers')
  return result
}

// RECEIVE TRANSFER (Step 2)
export async function receiveTransfer(transferId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

  // Execute the RPC for receiving
  const { data, error } = await supabase
    .rpc('receive_warehouse_transfer', {
      p_transfer_id: transferId
    })
    .single()

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; error?: string; message?: string }
  if (!result.ok) throw new Error(result.error ?? 'فشل استلام الإذن')

  await writeAuditLog({
    action: 'warehouse_transfer_received',
    entity_type: 'warehouse_transfer',
    entity_id: transferId,
    description: `استلام إذن تحويل وإضافته للأرصدة`,
    metadata: { transfer_id: transferId }
  })

  revalidatePath('/company/main_warehouse/transfers')
  revalidatePath('/projects/[projectId]/project_warehouse/transfers')
  return result
}

// STOCK BALANCE SUMMARY
export async function getWarehouseStock(warehouseId: string) {
  if (!warehouseId) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stock_balances')
    .select(`
      id, quantity_on_hand, total_value, weighted_avg_cost, last_movement_at,
      item:items(item_code, arabic_name)
    `)
    .eq('warehouse_id', warehouseId)
    .gt('quantity_on_hand', 0)
    .order('last_movement_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching stock:', error)
  }
  return data || []
}

// SINGLE STOCK BALANCE
export async function getAvailableStock(warehouseId: string, itemId: string) {
  if (!warehouseId || !itemId) return 0
  const supabase = createClient()
  const { data } = await supabase
    .from('stock_balances')
    .select('quantity_on_hand')
    .eq('warehouse_id', warehouseId)
    .eq('item_id', itemId)
    .maybeSingle()
  return data?.quantity_on_hand || 0
}
