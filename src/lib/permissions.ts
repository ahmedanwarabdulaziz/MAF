import { createClient } from '@/lib/supabase-server'
import { getUserProfile } from '@/lib/system-context'

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
export async function getEffectivePermissions(userId: string, context?: { projectId?: string; warehouseId?: string, includeAllScopes?: boolean }): Promise<EffectivePermission[]> {
  const supabase = createClient()

  // PERF-03: Use cached profile instead of a fresh DB query for is_super_admin.
  const profile = await getUserProfile()
  if (profile?.is_super_admin) {
    // Super admin gets all defined permissions
    const { data } = await supabase.from('permissions').select('module_key, action_key')
    return (data ?? []) as EffectivePermission[]
  }

  // Load active group assignments for this user
  let query = supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (context?.includeAllScopes) {
    // No additional filtering on scope_type, we get everything
  } else if (context?.projectId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_project,project_id.eq.${context.projectId})`)
  } else if (context?.warehouseId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_warehouse,warehouse_id.eq.${context.warehouseId})`)
  } else {
    // Global context requires global scopes
    query = query.in('scope_type', ['main_company', 'all_projects'])
  }

  const { data: groupAssignments } = await query

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
  actionKey: string,
  context?: { projectId?: string; warehouseId?: string }
): Promise<boolean> {
  const supabase = createClient()

  // PERF-03: Use cached profile instead of a fresh DB query for is_super_admin.
  const profile = await getUserProfile()
  if (profile?.is_super_admin) return true

  // Check via group assignments
  let query = supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (context?.projectId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_project,project_id.eq.${context.projectId})`)
  } else if (context?.warehouseId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_warehouse,warehouse_id.eq.${context.warehouseId})`)
  } else {
    query = query.in('scope_type', ['main_company', 'all_projects'])
  }

  const { data: groupAssignments } = await query

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
  // Use user_permission_group_assignments since that is our new single source of truth for scops and roles
  const { data } = await supabase
    .from('user_permission_group_assignments')
    .select('scope_type, project_id, warehouse_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  // Needs deduplication as a user might have multiple roles on the same project
  const uniqueScopes = new Map<string, UserScope>()
  for (const s of (data ?? [])) {
    const key = `${s.scope_type}-${s.project_id}-${s.warehouse_id}`
    if (!uniqueScopes.has(key)) {
      uniqueScopes.set(key, s as UserScope)
    }
  }

  return Array.from(uniqueScopes.values())
}

/**
 * Returns a Set of module_keys the user is allowed to access.
 * Super Admins get all modules. Regular users get only assigned modules.
 * Use this for fast sidebar/nav filtering.
 */
export async function getEffectiveModuleKeys(userId: string, context?: { projectId?: string; warehouseId?: string; includeAllScopes?: boolean }): Promise<Set<string>> {
  const perms = await getEffectivePermissions(userId, context)
  return new Set(perms.map(p => p.module_key))
}

/**
 * Check if a user has access to a specific project (based on scope).
 */
export async function hasProjectScope(userId: string, projectId: string): Promise<boolean> {
  const supabase = createClient()

  // PERF-03: Use cached profile instead of a fresh DB query for is_super_admin.
  const profile = await getUserProfile()
  if (profile?.is_super_admin) return true

  const { data } = await supabase
    .from('user_permission_group_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_project,project_id.eq.${projectId})`)
    .limit(1)

  return (data?.length ?? 0) > 0
}
