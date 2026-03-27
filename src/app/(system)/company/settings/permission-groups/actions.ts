'use server'

import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

export async function createPermissionGroupAction(formData: FormData) {
  await requireSuperAdmin()
  const supabase = createClient()

  const arabicName = formData.get('arabic_name') as string
  const groupKey = formData.get('group_key') as string

  if (!arabicName || !groupKey) {
    return { error: 'يرجى تعبئة الحقول المطلوبة' }
  }

  // Basic validation for group key (lowercase, alphanumeric, underscores)
  if (!/^[a-z0-9_]+$/.test(groupKey)) {
    return { error: 'معرف المجموعة يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط' }
  }

  // Check if unique
  const { data: existing } = await supabase
    .from('permission_groups')
    .select('id')
    .eq('group_key', groupKey)
    .single()

  if (existing) {
    return { error: 'معرف المجموعة موجود مسبقاً' }
  }

  const { data: group, error: insertError } = await supabase
    .from('permission_groups')
    .insert({
      group_name: arabicName, // Usually they use arabic name for group_name too
      arabic_name: arabicName,
      group_key: groupKey,
      is_system_group: false,
      is_active: true
    })
    .select('id')
    .single()

  if (insertError) {
    return { error: 'حدث خطأ أثناء الإنشاء: ' + insertError.message }
  }

  await writeAuditLog({
    action: 'create_permission_group',
    entity_type: 'permission_group',
    entity_id: group.id,
    description: `إنشاء مجموعة صلاحيات جديدة: ${arabicName}`,
    metadata: { group_key: groupKey, arabic_name: arabicName },
  })
  revalidatePath('/company/settings/permission-groups')
  return { success: true, groupId: group.id }
}

export async function updatePermissionGroupMatrixAction(groupId: string, allowedAssignments: string[]) {
  await requireSuperAdmin()
  const supabase = createClient()

  // Verify group is not system
  const { data: group } = await supabase
    .from('permission_groups')
    .select('is_system_group')
    .eq('id', groupId)
    .single()

  if (!group || group.is_system_group) {
    return { error: 'لا يمكن تعديل مجموعات النظام' }
  }

  // Start fresh by unchecking all existing assignments
  // we could just upsert with is_allowed=true for the ones in the array, 
  // and is_allowed=false for others.
  
  // First, set all to false
  await supabase
    .from('permission_group_permissions')
    .update({ is_allowed: false })
    .eq('permission_group_id', groupId)

  if (allowedAssignments.length > 0) {
    const upserts = allowedAssignments.map(val => {
      const [module_key, action_key] = val.split(':')
      return {
        permission_group_id: groupId,
        module_key,
        action_key,
        is_allowed: true,
      }
    })

    const { error: upsertError } = await supabase
      .from('permission_group_permissions')
      .upsert(upserts, { onConflict: 'permission_group_id, module_key, action_key' })

    if (upsertError) {
      return { error: 'خطأ في الحفظ: ' + upsertError.message }
    }
  }

  await writeAuditLog({
    action: 'update_permission_matrix',
    entity_type: 'permission_group',
    entity_id: groupId,
    description: `تعديل مصفوفة صلاحيات المجموعة`,
    metadata: { assigned_count: allowedAssignments.length },
  })
  revalidatePath(`/company/settings/permission-groups/${groupId}`)
  revalidatePath('/company/settings/permission-groups')
  return { success: true }
}

export async function deletePermissionGroupAction(groupId: string) {
  await requireSuperAdmin()
  const supabase = createClient()

  // Block deletion of system groups
  const { data: group } = await supabase
    .from('permission_groups')
    .select('arabic_name, is_system_group')
    .eq('id', groupId)
    .single()

  if (!group) return { error: 'المجموعة غير موجودة' }
  if (group.is_system_group) return { error: 'لا يمكن حذف مجموعات النظام' }

  const { error } = await supabase
    .from('permission_groups')
    .delete()
    .eq('id', groupId)

  if (error) return { error: error.message }

  await writeAuditLog({
    action: 'delete_permission_group',
    entity_type: 'permission_group',
    entity_id: groupId,
    description: `حذف مجموعة صلاحيات: ${group.arabic_name}`,
    metadata: {},
  })

  revalidatePath('/company/settings/permission-groups')
  return { success: true }
}
