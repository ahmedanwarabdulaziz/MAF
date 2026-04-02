import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
// PERF-00: dev-only timing (no-op in production)
const isDev = process.env.NODE_ENV !== 'production'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  // PERF-00: measure auth latency in dev
  const _perfStart = isDev ? Date.now() : 0
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (isDev) {
    const ms = Date.now() - _perfStart
    const icon = ms > 300 ? '🔴' : ms > 150 ? '🟡' : '🟢'
    console.log(`[PERF] ${icon} middleware:auth.getUser — ${ms}ms (${request.nextUrl.pathname})`)
  }

  const pathname = request.nextUrl.pathname

  // Public paths that don't need auth
  const isPublic =
    pathname.startsWith('/login') ||
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth')

  if (!isPublic && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // If logged in and trying to access /login, redirect to /company
  if (pathname.startsWith('/login') && user) {
    const companyUrl = request.nextUrl.clone()
    companyUrl.pathname = '/company'
    return NextResponse.redirect(companyUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
