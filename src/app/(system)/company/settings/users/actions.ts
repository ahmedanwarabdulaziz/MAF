'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createUserAction(formData: FormData) {
  await requireSuperAdmin()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string
  const isSuperAdmin = formData.get('is_super_admin') === 'on'

  if (!email || !password || !displayName) {
    return { error: 'يرجى تعبئة جميع الحقول المطلوبة' }
  }

  const adminClient = createAdminClient()
  
  // Create user in Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName }
  })

  if (authError) {
    return { error: authError.message }
  }

  const userId = authData.user.id

  // Delay a bit to let the trigger insert into public.users
  // Alternatively, we can just update the record directly if it's there
  await new Promise(r => setTimeout(r, 500))

  if (isSuperAdmin) {
    const supabase = createClient()
    await supabase
      .from('users')
      .update({ is_super_admin: true })
      .eq('id', userId)
  }

  revalidatePath('/company/settings/users')
  return { success: true, userId }
}

export async function updateUserAction(userId: string, formData: FormData) {
  await requireSuperAdmin()
  const supabase = createClient()

  const displayName = formData.get('display_name') as string
  const isActive = formData.get('is_active') === 'on'
  const isSuperAdmin = formData.get('is_super_admin') === 'on'
  const permissionGroups = formData.getAll('permission_groups') as string[] // array of UUIDs

  if (!displayName) {
    return { error: 'اسم المستخدم مطلوب' }
  }

  // Update public.users
  const { error: userError } = await supabase
    .from('users')
    .update({ 
      display_name: displayName, 
      is_active: isActive, 
      is_super_admin: isSuperAdmin 
    })
    .eq('id', userId)

  if (userError) {
    return { error: userError.message }
  }

  // Update Auth layer if needed (just display name, can skip or sync)
  const adminClient = createAdminClient()
  await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { display_name: displayName }
  })

  // Update permission groups assignments
  // 1. Delete old assignments
  await supabase
    .from('user_permission_group_assignments')
    .delete()
    .eq('user_id', userId)

  // 2. Insert new assignments
  if (permissionGroups.length > 0) {
    const assignments = permissionGroups.map(groupId => ({
      user_id: userId,
      permission_group_id: groupId,
      is_active: true
    }))
    
    const { error: permError } = await supabase
      .from('user_permission_group_assignments')
      .insert(assignments)
      
    if (permError) {
      console.error('Error assigning permissions:', permError)
      return { error: 'حدث خطأ أثناء تعيين الصلاحيات' }
    }
  }

  revalidatePath(`/company/settings/users/${userId}`)
  revalidatePath('/company/settings/users')
  return { success: true }
}
