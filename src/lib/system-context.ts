import { cache } from 'react'
import { createClient } from '@/lib/supabase-server'

/**
 * system-context.ts — PERF-02: Request-scoped cached data loaders.
 *
 * Uses React `cache()` to deduplicate identical DB calls within a single
 * server request. If `getAuthUser` is called 5 times in the same request,
 * the Supabase round-trip happens only once.
 *
 * IMPORTANT: React cache() is request-scoped — it never persists across
 * requests or users. Safe to use for auth and permission-sensitive data.
 */

// ─── Auth user (cached per request) ───────────────────────────────────────────
// Replaces repeated supabase.auth.getUser() calls in layout + server actions.

export const getAuthUser = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
})

// ─── User profile (cached per request) ────────────────────────────────────────
// Replaces the users table query in layout, auth.ts getUser(), requirePermission(), hasPermission()

export const getUserProfile = cache(async () => {
  const authUser = await getAuthUser()
  if (!authUser) return null

  const supabase = createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('id, display_name, is_super_admin, is_active, email')
    .eq('id', authUser.id)
    .single()

  return profile ?? null
})

// ─── Combined system user (auth + profile in one call) ────────────────────────
// Drop-in replacement for the layout's getSystemUser() pattern.

export const getSystemUser = cache(async () => {
  const profile = await getUserProfile()
  return profile  // null if not authenticated
})
