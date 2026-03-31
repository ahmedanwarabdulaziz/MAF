'use server'

import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { getEffectivePermissions } from '@/lib/permissions'

export async function grantAccessScopeAction(formData: FormData) {
  await requireSuperAdmin()
  const supabase = createClient()

  const userId = formData.get('user_id') as string
  const scopeType = formData.get('scope_type') as string
  const projectId = formData.get('project_id') as string

  if (!userId || !scopeType) {
    return { error: 'يرجى اختيار المستخدم ونوع النطاق' }
  }

  if (scopeType === 'selected_project' && !projectId) {
    return { error: 'يرجى اختيار المشروع' }
  }

  let query = supabase
    .from('user_access_scopes')
    .select('id')
    .eq('user_id', userId)
    .eq('scope_type', scopeType)
    .eq('is_active', true)

  if (scopeType === 'selected_project') {
    query = query.eq('project_id', projectId)
  }

  const { data: existing } = await query.maybeSingle()
  if (existing) {
    return { error: 'هذا النطاق ممنوح مسبقاً لهذا المستخدم وهو نشط' }
  }

  const { error: insertError } = await supabase
    .from('user_access_scopes')
    .insert({
      user_id: userId,
      scope_type: scopeType,
      project_id: scopeType === 'selected_project' ? projectId : null,
      is_active: true
    })

  if (insertError) {
    return { error: 'حدث خطأ أثناء منح النطاق: ' + insertError.message }
  }

  await writeAuditLog({
    action: 'grant_scope',
    entity_type: 'user_access_scope',
    entity_id: userId,
    description: `منح نطاق وصول (${scopeType}) للمستخدم`,
    metadata: { scope_type: scopeType, project_id: projectId ?? null },
  })
  revalidatePath('/company/settings/access-scopes')
  return { success: true }
}

export async function grantBulkScopesAction(
  userId: string,
  roleTemplateId: string,
  scopes: { scope_type: string; project_id?: string }[]
) {
  await requireSuperAdmin()
  const supabase = createClient()

  if (!userId || scopes.length === 0) {
    return { error: 'بيانات غير مكتملة' }
  }

  // Fetch all already-active scopes for this user with this template
  const { data: existing } = await supabase
    .from('user_permission_group_assignments')
    .select('scope_type, project_id, permission_group_id')
    .eq('user_id', userId)

  const existingKeys = new Set(
    (existing ?? []).map(s => `${s.permission_group_id}:${s.scope_type}:${s.project_id ?? ''}`)
  )

  // Filter out duplicates
  const toInsert = scopes
    .filter(s => !existingKeys.has(`${roleTemplateId}:${s.scope_type}:${s.project_id ?? ''}`))
    .map(s => ({
      user_id: userId,
      permission_group_id: roleTemplateId,
      scope_type: s.scope_type,
      project_id: s.project_id ?? null,
      is_active: true,
    }))

  const skipped = scopes.length - toInsert.length

  if (toInsert.length === 0) {
    return { error: 'جميع النطاقات المحددة ممنوحة مسبقاً بهذا القالب الوظيفي', skipped }
  }

  const { error: insertError } = await supabase
    .from('user_permission_group_assignments')
    .insert(toInsert)

  if (insertError) {
    return { error: 'حدث خطأ أثناء المنح: ' + insertError.message }
  }

  // Fetch user name + project names for rich audit log
  const { data: targetUser } = await supabase
    .from('users').select('display_name').eq('id', userId).maybeSingle()

  const projectIds = toInsert.filter(s => s.project_id).map(s => s.project_id!)
  const { data: projectRows } = projectIds.length
    ? await supabase.from('projects').select('id, arabic_name, project_code').in('id', projectIds)
    : { data: [] }
  const projectMap = Object.fromEntries((projectRows ?? []).map(p => [p.id, p]))

  const scopeLines = toInsert.map(s => {
    if (s.scope_type === 'selected_project' && s.project_id) {
      const p = projectMap[s.project_id]
      return `مشروع محدد: ${p ? `${p.arabic_name} (${p.project_code})` : s.project_id}`
    }
    const labels: Record<string, string> = { main_company: 'الشركة الرئيسية', all_projects: 'جميع المشاريع' }
    return labels[s.scope_type] ?? s.scope_type
  })

  await writeAuditLog({
    action: 'grant_scope_bulk',
    entity_type: 'user_permission_group_assignments',
    entity_id: userId,
    description: `تعيين الموظف ${targetUser?.display_name ?? userId} في فريق العمل`,
    metadata: {
      target_user: targetUser?.display_name ?? userId,
      role_template_id: roleTemplateId,
      granted_count: toInsert.length,
      skipped_count: skipped,
      scopes: scopeLines,
    },
  })
  revalidatePath('/company/settings/access-scopes')
  return { success: true, granted: toInsert.length, skipped }
}

export async function revokeAccessScopeAction(scopeId: string) {
  await requireSuperAdmin()
  const supabase = createClient()

  // Fetch scope details for rich audit log before revoking
  const { data: scopeRow } = await supabase
    .from('user_permission_group_assignments')
    .select('user_id, scope_type, project_id, permission_group_id')
    .eq('id', scopeId)
    .maybeSingle()

  const { error } = await supabase
    .from('user_permission_group_assignments')
    .update({ is_active: false })
    .eq('id', scopeId)

  if (error) {
    return { error: 'حدث خطأ أثناء إيقاف التعيين' }
  }

  let revokeDesc = 'إلغاء نطاق وصول'
  const meta: Record<string, unknown> = { scope_id: scopeId }
  if (scopeRow) {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', scopeRow.user_id).maybeSingle()
    meta.target_user = u?.display_name ?? scopeRow.user_id
    meta.scope_type = scopeRow.scope_type
    if (scopeRow.project_id) {
      const { data: proj } = await supabase.from('projects').select('arabic_name, project_code').eq('id', scopeRow.project_id).maybeSingle()
      meta.project = proj ? `${proj.arabic_name} (${proj.project_code})` : scopeRow.project_id
    }
    const scopeLabels: Record<string, string> = { main_company: 'الشركة الرئيسية', all_projects: 'جميع المشاريع', selected_project: 'مشروع محدد' }
    revokeDesc = `إلغاء تعيين فريق (${scopeLabels[scopeRow.scope_type] ?? scopeRow.scope_type}) للموظف ${u?.display_name ?? ''}`
  }

  await writeAuditLog({
    action: 'revoke_scope',
    entity_type: 'user_access_scope',
    entity_id: scopeId,
    description: revokeDesc,
    metadata: meta,
  })
  revalidatePath('/company/settings/access-scopes')
  return { success: true }
}

export async function updateAccessScopeAction(
  scopeId: string,
  scopeType: string,
  projectId: string | null
) {
  await requireSuperAdmin()
  const supabase = createClient()

  if (!scopeId || !scopeType) {
    return { error: 'بيانات غير مكتملة' }
  }

  if (scopeType === 'selected_project' && !projectId) {
    return { error: 'يرجى اختيار المشروع' }
  }

  const updateData: Record<string, unknown> = {
    scope_type: scopeType,
    project_id: scopeType === 'selected_project' ? projectId : null,
  }

  const { error } = await supabase
    .from('user_permission_group_assignments')
    .update(updateData)
    .eq('id', scopeId)

  if (error) {
    return { error: 'حدث خطأ أثناء التعديل: ' + error.message }
  }

  // Fetch details for audit log
  const { data: updatedRow } = await supabase
    .from('user_permission_group_assignments')
    .select('user_id')
    .eq('id', scopeId)
    .maybeSingle()

  if (updatedRow) {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', updatedRow.user_id).maybeSingle()
    let projLabel = ''
    if (scopeType === 'selected_project' && projectId) {
      const { data: proj } = await supabase.from('projects').select('arabic_name, project_code').eq('id', projectId).maybeSingle()
      projLabel = proj ? ` - ${proj.arabic_name} (${proj.project_code})` : ''
    }
    const scopeLabels: Record<string, string> = {
      main_company: 'الشركة الرئيسية',
      all_projects: 'جميع المشاريع',
      selected_project: 'مشروع محدد',
      selected_warehouse: 'مخزن محدد',
    }
    await writeAuditLog({
      action: 'update_scope',
      entity_type: 'user_access_scope',
      entity_id: scopeId,
      description: `تعديل نطاق وصول إلى (${scopeLabels[scopeType] ?? scopeType}${projLabel}) للمستخدم ${u?.display_name ?? updatedRow.user_id}`,
      metadata: { scope_type: scopeType, project_id: projectId ?? null },
    })
  }

  revalidatePath('/company/settings/access-scopes')
  return { success: true }
}

export async function toggleAccessScopeAction(scopeId: string, activate: boolean) {
  await requireSuperAdmin()
  const supabase = createClient()

  const { data: scopeRow } = await supabase
    .from('user_permission_group_assignments')
    .select('user_id, scope_type')
    .eq('id', scopeId)
    .maybeSingle()

  const { error } = await supabase
    .from('user_permission_group_assignments')
    .update({ is_active: activate })
    .eq('id', scopeId)

  if (error) return { error: 'Failed to update scope: ' + error.message }

  if (scopeRow) {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', scopeRow.user_id).maybeSingle()
    const scopeLabels: Record<string, string> = {
      main_company: 'الشركة الرئيسية', all_projects: 'جميع المشاريع', selected_project: 'مشروع محدد',
    }
    await writeAuditLog({
      action: activate ? 'activate_scope' : 'deactivate_scope',
      entity_type: 'user_access_scope',
      entity_id: scopeId,
      description: `${activate ? 'تفعيل' : 'تعطيل'} نطاق (${scopeLabels[scopeRow.scope_type] ?? scopeRow.scope_type}) للمستخدم ${u?.display_name ?? scopeRow.user_id}`,
      metadata: { scope_type: scopeRow.scope_type, is_active: activate },
    })
  }

  revalidatePath('/company/settings/access-scopes')
  return { success: true }
}

export async function deleteAccessScopeAction(scopeId: string) {
  await requireSuperAdmin()
  const supabase = createClient()

  const { data: scopeRow } = await supabase
    .from('user_permission_group_assignments')
    .select('user_id, scope_type, project_id')
    .eq('id', scopeId)
    .maybeSingle()

  const { error } = await supabase
    .from('user_permission_group_assignments')
    .delete()
    .eq('id', scopeId)

  if (error) return { error: 'Failed to delete scope: ' + error.message }

  if (scopeRow) {
    const { data: u } = await supabase.from('users').select('display_name').eq('id', scopeRow.user_id).maybeSingle()
    const scopeLabels: Record<string, string> = {
      main_company: 'الشركة الرئيسية', all_projects: 'جميع المشاريع', selected_project: 'مشروع محدد',
    }
    await writeAuditLog({
      action: 'delete_scope',
      entity_type: 'user_access_scope',
      entity_id: scopeId,
      description: `حذف نطاق (${scopeLabels[scopeRow.scope_type] ?? scopeRow.scope_type}) للمستخدم ${u?.display_name ?? scopeRow.user_id}`,
      metadata: { scope_type: scopeRow.scope_type, project_id: scopeRow.project_id ?? null },
    })
  }

  revalidatePath('/company/settings/access-scopes')
  return { success: true }
}

export async function fetchUserPermissionsMatrix(userId: string, projectId?: string) {
  await requireSuperAdmin()
  const supabase = createClient()
  const context = projectId ? { projectId } : undefined
  const perms = await getEffectivePermissions(userId, context)

  if (perms.length === 0) return []

  const { data: registry } = await supabase
    .from('permissions')
    .select('module_key, module_name_ar, action_key, action_name_ar')

  const registryMap = new Map<string, { mAr: string; aAr: string }>()
  for (const r of registry ?? []) {
    registryMap.set(`${r.module_key}:${r.action_key}`, { mAr: r.module_name_ar, aAr: r.action_name_ar })
  }

  // Group by module
  const moduleMap = new Map<string, { label: string; actions: { key: string; label: string }[] }>()

  for (const p of perms) {
    const info = registryMap.get(`${p.module_key}:${p.action_key}`) || { mAr: p.module_key, aAr: p.action_key }
    if (!moduleMap.has(p.module_key)) {
      moduleMap.set(p.module_key, { label: info.mAr, actions: [] })
    }
    moduleMap.get(p.module_key)!.actions.push({ key: p.action_key, label: info.aAr })
  }

  return Array.from(moduleMap.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    actions: val.actions
  })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))
}
