import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth } from '@/lib/mobile-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const session = await requireMobileAuth(request)
    const body = await request.json()

    const { token, platform, appVersion, buildNumber } = body
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Using admin client to safely upsert against the mobile_push_tokens table
    const { error } = await supabase.from('mobile_push_tokens').upsert({
      user_id: session.userId,
      token,
      platform: platform || 'unknown',
      app_version: appVersion,
      build_number: buildNumber,
      last_seen_at: new Date().toISOString(),
      is_active: true
    }, {
      onConflict: 'user_id, token'
    })

    if (error) {
       // Since the table might not exist yet during scaffold, we don't hard-crash.
       // The SQL migration will be provided next.
       console.error('Push token upsert error:', error)
       if (error.code === '42P01') {
         return NextResponse.json({ success: true, warning: 'Table mobile_push_tokens does not exist yet' })
       }
       throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Account is inactive') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
