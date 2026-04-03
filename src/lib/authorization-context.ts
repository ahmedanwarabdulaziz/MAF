import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { getSystemUser } from '@/lib/system-context'

/**
 * authorization-context.ts — PERF-06
 *
 * THE PROBLEM (before this file):
 *   Each hasPermission() call in auth.ts ran 2 fresh DB queries:
 *     1. supabase.auth.getUser()         — not cached
 *     2. users table lookup              — not cached
 *   Plus the permission-check queries:
 *     3. user_permission_group_assignments
 *     4. permission_group_permissions
 *
 *   A page with 3 × hasPermission() = 12 DB round-trips just for auth/permissions.
 *   A page with requirePermission() + 3 × hasPermission() = 16 round-trips.
 *
 * THE FIX:
 *   getAuthorizationContext() fetches group IDs + all allowed permissions ONCE
 *   per request (React cache deduplication), then can() / require() resolve
 *   entirely in memory from the pre-fetched permission set.
 *
 *   Same page with 3 × hasPermission() = 2 DB queries (groups + perms) + memory lookups.
 *
 * SAFETY:
 *   - React cache() is request-scoped — never persists across users or requests.
 *   - Super admins are handled before any DB query (profile is already cached).
 *   - No cross-request caching. Auth guards remain server-enforced.
 */

export interface AuthorizationContext {
  userId: string
  isSuperAdmin: boolean
  /** In-memory permission check — no DB query */
  can(moduleKey: string, actionKey: string): boolean
  /** In-memory permission check + redirect to /company if denied */
  require(moduleKey: string, actionKey: string): void
}

// Inner loader: fetches group assignments and resolves the full permission set.
// This is what we cache per-request.
const _buildContext = cache(async (
  contextKey: string, // e.g. 'global' | 'project:UUID' | 'warehouse:UUID'
  projectId?: string,
  warehouseId?: string,
): Promise<AuthorizationContext | null> => {
  const profile = await getSystemUser()
  if (!profile) return null

  // Super admins bypass all DB queries — they have everything.
  if (profile.is_super_admin) {
    return {
      userId: profile.id,
      isSuperAdmin: true,
      can: () => true,
      require: () => { /* always allowed */ },
    }
  }

  const supabase = createClient()

  // Step 1: Fetch group assignments (one query, filtered by scope context).
  let query = supabase
    .from('user_permission_group_assignments')
    .select('permission_group_id')
    .eq('user_id', profile.id)
    .eq('is_active', true)

  if (projectId) {
    query = query.or(
      `scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_project,project_id.eq.${projectId})`
    )
  } else if (warehouseId) {
    query = query.or(
      `scope_type.in.(all_projects,main_company),and(scope_type.eq.selected_warehouse,warehouse_id.eq.${warehouseId})`
    )
  } else {
    query = query.in('scope_type', ['main_company', 'all_projects'])
  }

  const { data: groupAssignments } = await query
  const groupIds = (groupAssignments ?? []).map(a => a.permission_group_id)

  if (!groupIds.length) {
    // No group assignments — no permissions at all.
    return {
      userId: profile.id,
      isSuperAdmin: false,
      can: () => false,
      require: (moduleKey, actionKey) => {
        console.warn(`[authz] require(${moduleKey}, ${actionKey}) denied — no group assignments`)
        redirect('/company')
      },
    }
  }

  // Step 2: Fetch ALL allowed permissions for those groups in one query.
  const { data: groupPerms } = await supabase
    .from('permission_group_permissions')
    .select('module_key, action_key')
    .in('permission_group_id', groupIds)
    .eq('is_allowed', true)

  // Build an in-memory Set for O(1) lookups.
  const permSet = new Set(
    (groupPerms ?? []).map(p => `${p.module_key}:${p.action_key}`)
  )

  return {
    userId: profile.id,
    isSuperAdmin: false,
    can(moduleKey: string, actionKey: string): boolean {
      return permSet.has(`${moduleKey}:${actionKey}`)
    },
    require(moduleKey: string, actionKey: string): void {
      if (!permSet.has(`${moduleKey}:${actionKey}`)) {
        redirect('/company')
      }
    },
  }
})

/**
 * Get a request-scoped authorization context.
 *
 * Fetches group assignments + full permission set ONCE per unique context
 * (global / project / warehouse). Subsequent calls with the same context
 * are served from React's request cache with zero DB queries.
 *
 * Usage:
 *   const authz = await getAuthorizationContext()
 *   authz.require('project_warehouse', 'view')           // redirect if denied
 *   const canEdit = authz.can('project_warehouse', 'edit') // boolean
 *
 *   // Project-scoped:
 *   const authz = await getAuthorizationContext({ projectId: params.id })
 */
export async function getAuthorizationContext(context?: {
  projectId?: string
  warehouseId?: string
}): Promise<AuthorizationContext> {
  // Build a stable cache key so the same scope context hits the same cache slot.
  const key = context?.projectId
    ? `project:${context.projectId}`
    : context?.warehouseId
    ? `warehouse:${context.warehouseId}`
    : 'global'

  const ctx = await _buildContext(key, context?.projectId, context?.warehouseId)

  if (!ctx) {
    // Not authenticated — redirect to login.
    redirect('/login')
  }

  return ctx
}
