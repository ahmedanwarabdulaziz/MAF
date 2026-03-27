'use server'

import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

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
  scopes: { scope_type: string; project_id?: string }[]
) {
  await requireSuperAdmin()
  const supabase = createClient()

  if (!userId || scopes.length === 0) {
    return { error: 'بيانات غير مكتملة' }
  }

  // Fetch all already-active scopes for this user
  const { data: existing } = await supabase
    .from('user_access_scopes')
    .select('scope_type, project_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  const existingKeys = new Set(
    (existing ?? []).map(s => `${s.scope_type}:${s.project_id ?? ''}`)
  )

  // Filter out duplicates
  const toInsert = scopes
    .filter(s => !existingKeys.has(`${s.scope_type}:${s.project_id ?? ''}`))
    .map(s => ({
      user_id: userId,
      scope_type: s.scope_type,
      project_id: s.project_id ?? null,
      is_active: true,
    }))

  const skipped = scopes.length - toInsert.length

  if (toInsert.length === 0) {
    return { error: 'جميع النطاقات المحددة ممنوحة مسبقاً لهذا المستخدم', skipped }
  }

  const { error: insertError } = await supabase
    .from('user_access_scopes')
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
    entity_type: 'user_access_scope',
    entity_id: userId,
    description: `منح نطاقات وصول للمستخدم ${targetUser?.display_name ?? userId}`,
    metadata: {
      target_user: targetUser?.display_name ?? userId,
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
    .from('user_access_scopes')
    .select('user_id, scope_type, project_id')
    .eq('id', scopeId)
    .maybeSingle()

  const { error } = await supabase
    .from('user_access_scopes')
    .update({ is_active: false })
    .eq('id', scopeId)

  if (error) {
    return { error: 'حدث خطأ أثناء إيقاف النطاق' }
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
    revokeDesc = `إلغاء نطاق (${scopeLabels[scopeRow.scope_type] ?? scopeRow.scope_type}) للمستخدم ${u?.display_name ?? ''}`
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
