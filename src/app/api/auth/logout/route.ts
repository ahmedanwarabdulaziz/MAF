import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // We use service role anon key here since we just need to sign out
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Clear the auth cookie by creating a response that redirects
  const response = NextResponse.redirect(new URL('/login', request.url))

  // Clear all supabase auth cookies
  const cookieNames = request.cookies.getAll().map(c => c.name)
  for (const name of cookieNames) {
    if (name.includes('supabase') || name.includes('sb-')) {
      response.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
