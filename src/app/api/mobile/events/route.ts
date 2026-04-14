import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth, createMobileClient } from '@/lib/mobile-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await requireMobileAuth(request)
    const payload = await request.json()

    const { action_type, entity_type, entity_id, location, device_context, metadata } = payload

    if (!action_type) {
      return NextResponse.json({ error: 'action_type is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const event = {
      user_id: session.user.id,
      action_type,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      device_context: device_context || null,
      metadata: metadata || null
    }

    const { error } = await adminClient
      .from('mobile_events')
      .insert(event)

    if (error) {
      console.error('Failed to insert mobile event:', error)
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }

    return NextResponse.json({ success: true, recordedAt: new Date().toISOString() })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Account is inactive') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
