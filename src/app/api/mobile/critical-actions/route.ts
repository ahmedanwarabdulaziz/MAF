import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth, createMobileClient } from '@/lib/mobile-auth'
import { getWorkInboxData } from '@/actions/work-inbox'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireMobileAuth(request)
    const mobileClient = createMobileClient(session.token)

    // The getWorkInboxData adapter runs all the aggregations perfectly.
    // By passing mobileClient, all sub-queries inherit the bearer token and RLS acts securely.
    const inboxData = await getWorkInboxData(undefined, mobileClient)

    return NextResponse.json({
      data: inboxData,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Account is inactive') {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
