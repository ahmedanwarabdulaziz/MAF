import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient()

  // 1. Check auth layer
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ authenticated: false, authError: authError?.message })
  }

  // 2. Check public.users profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, is_super_admin, is_active')
    .eq('id', authUser.id)
    .single()

  return NextResponse.json({
    authenticated: true,
    authUser: { id: authUser.id, email: authUser.email },
    profile,
    profileError: profileError?.message ?? null,
  })
}
