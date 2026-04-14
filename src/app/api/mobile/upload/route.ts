import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth, createMobileClient } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await requireMobileAuth(request)
    const supabase = createMobileClient(session.token)

    const formData = (await request.formData()) as any
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const fileName = `${session.userId}-${timestamp}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`
    const filePath = `mobile-uploads/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('maf-documents')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from('maf-documents')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
