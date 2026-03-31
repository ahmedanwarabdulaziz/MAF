import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

// ─── Session helpers ──────────────────────────────────────────

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = createClient()
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return profile ?? null
}

/** Redirect to /login if there is no active session */
export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
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
  console.log('[DEBUG] requireSuperAdmin -> user:', user?.email, 'is_super_admin:', user?.is_super_admin)
  if (!user?.is_super_admin) {
    console.log('[DEBUG] redirecting to /company because not super admin')
    redirect('/company')
  }
  return user
}

/**
 * Require a specific permission, redirecting to /company if not granted.
 * Super admins always pass through.
 */
export async function requirePermission(
  moduleKey: string, 
  actionKey: string = 'view',
  context?: { projectId?: string; warehouseId?: string }
) {
  const session = await requireAuth()
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, is_super_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_super_admin) return profile

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
    // Global context requires global scopes
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
 */
export async function hasPermission(
  moduleKey: string, 
  actionKey: string = 'view',
  context?: { projectId?: string; warehouseId?: string }
) {
  const session = await getSession()
  if (!session) return false
  
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, is_super_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile) return false
  if (profile.is_super_admin) return true

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
    // Global context requires global scopes
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

  console.log(`[DEBUG hasPermission] User ${profile.id} checking ${moduleKey}.${actionKey} -> groups: ${groupIds.length}, found: ${!!data?.length}`)
  return !!data?.length
}
