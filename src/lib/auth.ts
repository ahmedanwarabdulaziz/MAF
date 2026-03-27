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
