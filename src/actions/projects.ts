'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

interface CreateProjectInput {
  project_code: string
  arabic_name: string
  english_name?: string | null
  project_onboarding_type: string
  status: string
  owner_party_id?: string | null
  location?: string | null
  start_date?: string | null
  expected_end_date?: string | null
  estimated_contract_value?: number | null
  planned_allocation_amount?: number | null
  notes?: string | null
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string }> {
  const supabase = createClient()

  // Fetch company server-side (no is_active filter — resilient to any state)
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyErr || !company) {
    throw new Error('لا توجد شركة مُسجَّلة في النظام')
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: company.id,
      ...input,
      // english_name is NOT NULL in schema — fallback to arabic_name
      english_name: input.english_name || input.arabic_name,
      migration_status: input.project_onboarding_type === 'existing' ? 'draft' : 'not_required',
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('unique')) throw new Error('رمز المشروع مستخدم بالفعل')
    throw new Error(error.message)
  }

  await writeAuditLog({
    action: 'create_project',
    entity_type: 'project',
    entity_id: data.id,
    description: `تم إنشاء مشروع جديد: ${input.arabic_name} (${input.project_code})`,
    metadata: {
      project_code: input.project_code,
      arabic_name: input.arabic_name,
      english_name: input.english_name || input.arabic_name,
      status: input.status,
      owner_party_id: input.owner_party_id,
      project_onboarding_type: input.project_onboarding_type,
      location: input.location ?? null,
      start_date: input.start_date ?? null,
      expected_end_date: input.expected_end_date ?? null,
      estimated_contract_value: input.estimated_contract_value ?? null,
    },
  })

  revalidatePath('/company/projects', 'page')
  revalidatePath('/company/projects', 'layout')
  return { id: data.id }
}

export async function updateProject(id: string, updates: any) {
  const supabase = createClient()
  
  if (updates.status) {
    if (updates.status === 'archived') {
      updates.status = 'completed' // Avoid constraint error, rely on archived_at
      updates.archived_at = new Date().toISOString()
    } else {
      updates.archived_at = null
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('unique')) throw new Error('رمز المشروع مستخدم بالفعل')
    throw new Error(error.message)
  }

  await writeAuditLog({
    action: 'update_project',
    entity_type: 'project',
    entity_id: id,
    description: `تحديث بيانات المشروع والتخصيصات`,
    metadata: { updates },
  })

  revalidatePath('/company/projects', 'page')
  revalidatePath('/company/projects', 'layout')
  revalidatePath(`/company/projects/${id}`, 'page')
  return { id: data.id }
}

export async function deleteProject(id: string) {
  const supabase = createClient()
  
  // Delete associated warehouse first (will fail if warehouse has movements)
  const { error: whError } = await supabase
    .from('warehouses')
    .delete()
    .eq('project_id', id)

  if (whError && whError.code === '23503') {
    throw new Error('لا يمكن مسح المشروع لأن المستودع التابع له يحتوي على حركات مخزنية. يرجى التخلص من الحركات أو نقلها أولاً.')
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '23503') {
      throw new Error('لا يمكن مسح المشروع لارتباطه بحركات، مستخلصات، فواتير أو أرصده. المشروع يحمل بيانات حالياً ويجب استقراره أو تحويله للأرشيف فقط.')
    }
    throw new Error(error.message)
  }

  await writeAuditLog({
    action: 'delete_project',
    entity_type: 'project',
    entity_id: id,
    description: `مسح المشروع`,
  })

  revalidatePath('/company/projects', 'page')
  revalidatePath('/company/projects', 'layout')
}
export async function getProjectWizardData() {
  const supabase = createClient()
  
  // Fetch active system users
  const { data: users } = await supabase
    .from('users')
    .select(`
      id, display_name, is_super_admin,
      user_access_scopes:user_permission_group_assignments!user_permission_group_assignments_user_id_fkey(scope_type, project_id, permission_group_id)
    `)
    .eq('is_active', true)
    .order('display_name')

  const { data: treasuryPerms } = await supabase
    .from('permission_group_permissions')
    .select('permission_group_id')
    .eq('module_key', 'treasury')
    .eq('is_allowed', true)
  
  const treasuryGroupIds = treasuryPerms?.map(p => p.permission_group_id) || []

  // Fetch company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Fetch active projects that can be linked to a cashbox
  const { data: projects } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  return {
    users: users || [],
    treasuryGroupIds,
    companyId: company?.id || '',
    projects: projects || []
  }
}
