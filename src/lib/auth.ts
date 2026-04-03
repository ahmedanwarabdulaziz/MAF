import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getAuthUser, getUserProfile, getSystemUser } from '@/lib/system-context'

// ─── Session helpers ──────────────────────────────────────────

/**
 * @deprecated Use getAuthUser() from system-context instead.
 * Kept for backward compatibility. Uses getUser() (secure) not getSession().
 */
export async function getSession() {
  const supabase = createClient()
  // Use getUser() instead of getSession() to avoid the insecure warning.
  // getSession() reads from cookies without server validation.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Return a session-like object for backward compatibility
  return { user, access_token: '', token_type: 'bearer' } as any
}

export async function getUser() {
  return getUserProfile()
}

/** Redirect to /login if there is no active session */
export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  // Return session-like object for backward compatibility
  return { user } as any
}

// ─── Super Admin helper ───────────────────────────────────────

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single()
  return data?.is_super_admin === true
}

/** Redirect to /company if the current user is not a Super Admin */
export async function requireSuperAdmin() {
  await requireAuth()
  const user = await getUser()
  if (!user?.is_super_admin) {
    redirect('/company')
  }
  return user
}

/**
 * Require a specific permission, redirecting to /company if not granted.
 * Super admins always pass through.
 * PERF-06: uses request-cached getSystemUser() — no extra DB round-trips.
 */
export async function requirePermission(
  moduleKey: string, 
  actionKey: string = 'view',
  context?: { projectId?: string; warehouseId?: string }
) {
  const profile = await getSystemUser()
  if (!profile) redirect('/login')
  if (profile.is_super_admin) return profile

  const supabase = createClient()

  // Check group-based permission
  let query = supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', profile.id)
    .eq('is_active', true)

  if (context?.projectId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_project,project_id.eq.${context.projectId})`)
  } else if (context?.warehouseId) {
    query = query.or(`scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_warehouse,warehouse_id.eq.${context.warehouseId})`)
  } else {
    query = query.in('scope_type', ['main_company', 'all_projects'])
  }

  const { data: groupAssignments } = await query

  if (!groupAssignments?.length) redirect('/company')

  const groupIds = groupAssignments.map(a => a.permission_group_id)
  const { data } = await supabase
    .from('permission_group_permissions')
    .select('id')
    .in('permission_group_id', groupIds)
    .eq('module_key', moduleKey)
    .eq('action_key', actionKey)
    .eq('is_allowed', true)
    .limit(1)

  if (!data?.length) redirect('/company')
  return profile
}

// ─── Server Actions: sign-in / sign-out ───────────────────────

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return { user: data.user }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Check a specific permission, returning boolean instead of redirecting.
 * PERF-06: Uses request-cached getSystemUser() — eliminates 2 fresh DB
 * round-trips per call (auth.getUser + users table), which was the main
 * source of redundancy when pages called hasPermission() 2-3 times.
 */
export async function hasPermission(
  moduleKey: string, 
  actionKey: string = 'view',
  context?: { projectId?: string; warehouseId?: string }
) {
  // PERF-06: getSystemUser() is request-cached — 0 DB cost if layout or
  // requirePermission() already resolved it in this request.
  const profile = await getSystemUser()
  if (!profile) return false
  if (profile.is_super_admin) return true

  const supabase = createClient()
  let query = supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', profile.id)
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

  return !!data?.length
}
