import { createClient } from '@/lib/supabase-server'

export interface EffectivePermission {
  module_key: string
  action_key: string
}

export interface UserScope {
  scope_type: 'main_company' | 'all_projects' | 'selected_project' | 'selected_warehouse'
  project_id: string | null
  warehouse_id: string | null
}

// ─── Core resolution ──────────────────────────────────────────

/**
 * Returns the full set of allowed (module, action) pairs for a user.
 * Super Admins bypass the permission table — they get everything.
 */
export async function getEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
  const supabase = createClient()

  // Check super admin first
  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_super_admin) {
    // Super admin gets all defined permissions
    const { data } = await supabase.from('permissions').select('module_key, action_key')
    return (data ?? []) as EffectivePermission[]
  }

  // Load active group assignments for this user
  const { data: groupAssignments } = await supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!groupAssignments?.length) return []

  const groupIds = groupAssignments.map(a => a.permission_group_id)

  // Load all allowed permissions for those groups (union)
  const { data: groupPerms } = await supabase
    .from('permission_group_permissions')
    .select('module_key, action_key')
    .in('permission_group_id', groupIds)
    .eq('is_allowed', true)

  // Deduplicate
  const seen = new Set<string>()
  const result: EffectivePermission[] = []
  for (const p of (groupPerms ?? [])) {
    const key = `${p.module_key}:${p.action_key}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(p as EffectivePermission)
    }
  }
  return result
}

/**
 * Check if a user has a specific permission.
 */
export async function hasPermission(
  userId: string,
  moduleKey: string,
  actionKey: string
): Promise<boolean> {
  const supabase = createClient()

  // Super admin bypasses
  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single()
  if (profile?.is_super_admin) return true

  // Check via group assignments
  const { data: groupAssignments } = await supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!groupAssignments?.length) return false

  const groupIds = groupAssignments.map(a => a.permission_group_id)

  const { data } = await supabase
    .from('permission_group_permissions')
    .select('id')
    .in('permission_group_id', groupIds)
    .eq('module_key', moduleKey)
    .eq('action_key', actionKey)
    .eq('is_allowed', true)
    .limit(1)

  return (data?.length ?? 0) > 0
}

/**
 * Returns all active access scopes for a user.
 */
export async function getUserScopes(userId: string): Promise<UserScope[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_access_scopes')
    .select('scope_type, project_id, warehouse_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  return (data ?? []) as UserScope[]
}

/**
 * Returns a Set of module_keys the user is allowed to access.
 * Super Admins get all modules. Regular users get only assigned modules.
 * Use this for fast sidebar/nav filtering.
 */
export async function getEffectiveModuleKeys(userId: string): Promise<Set<string>> {
  const perms = await getEffectivePermissions(userId)
  return new Set(perms.map(p => p.module_key))
}

/**
 * Check if a user has access to a specific project (based on scope).
 */
export async function hasProjectScope(userId: string, projectId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single()
  if (profile?.is_super_admin) return true

  const { data } = await supabase
    .from('user_access_scopes')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`scope_type.eq.all_projects,and(scope_type.eq.selected_project,project_id.eq.${projectId})`)
    .limit(1)

  return (data?.length ?? 0) > 0
}
