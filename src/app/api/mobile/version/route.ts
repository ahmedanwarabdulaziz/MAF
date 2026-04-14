import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    // We optionally require auth to check version, or make it public.
    // Usually version checks happen before login, so making it public is safer.
    // The mobile client needs to know if it requires a force upgrade.
    
    const versionConfig = {
      apiVersion: '1.0.0',
      minimumSupportedAppVersion: '1.0.0',
      latestApkVersion: '1.0.0',
      updateMessage: 'A new version of MAF Mobile is available.',
      serverTime: new Date().toISOString()
    }

    return NextResponse.json(versionConfig)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
