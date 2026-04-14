import { createAdminClient } from './supabase-admin'
import { NextRequest } from 'next/server'

export type MobileSession = {
  userId: string
  isActive: boolean
  isSuperAdmin: boolean
  profile: any
  token: string
}

/**
 * Validates a Bearer token from a mobile app request.
 * Mobile endpoints MUST use this instead of cookie-based auth.
 */
export async function requireMobileAuth(request: NextRequest): Promise<MobileSession> {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.split('Bearer ')[1]
  const supabase = createAdminClient()

  // 1. Validate the JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 2. Fetch the user profile safely
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, is_active, is_super_admin')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  if (profile.is_active === false) {
    throw new Error('Account is inactive')
  }

  return {
    userId: user.id,
    isActive: profile.is_active,
    isSuperAdmin: profile.is_super_admin,
    profile,
    token
  }
}

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a scoped Supabase client manually passing the mobile token.
 * This ensures Row Level Security (RLS) applies correctly without cookies.
 */
export function createMobileClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  )
}

