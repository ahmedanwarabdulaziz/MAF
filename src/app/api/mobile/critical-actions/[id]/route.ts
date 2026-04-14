import { NextRequest, NextResponse } from 'next/server'
import { requireMobileAuth, createMobileClient } from '@/lib/mobile-auth'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireMobileAuth(request)
    const supabase = createMobileClient(session.token)
    
    // Parse the composite ID from the mobile app (e.g., pr-1234, inv-receipt-5678)
    const { id } = params
    const parts = id.split('-')
    const type = parts[0]
    const uuid = parts.slice(1).join('-') // Handle cases where uuid itself has hyphens, or if prefix is multipart like inv-receipt

    let detailData = null
    
    if (id.startsWith('pr-')) {
       // Purchase Request Details
       const targetId = id.replace('pr-billing-', '').replace('pr-', '')
       const { data, error } = await supabase.from('purchase_requests').select('*, lines:purchase_request_lines(*, item:item_id(arabic_name)), project:project_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'purchase_request', header: data, lines: data.lines }

    } else if (id.startsWith('inv-')) {
       const targetId = id.replace('inv-receipt-', '').replace('inv-disc-', '')
       const { data, error } = await supabase.from('supplier_invoices').select('*, lines:supplier_invoice_lines(*, item:item_id(arabic_name)), project:project_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'supplier_invoice', header: data, lines: data.lines }

    } else if (id.startsWith('si-')) {
       const targetId = id.replace('si-', '')
       const { data, error } = await supabase.from('store_issues').select('*, lines:store_issue_lines(*, item:item_id(arabic_name)), project:project_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'store_issue', header: data, lines: data.lines }

    } else if (id.startsWith('cert-')) {
       const targetId = id.replace('cert-', '')
       const { data, error } = await supabase.from('subcontractor_certificates').select('*, lines:subcontractor_certificate_lines(*, work_item:project_work_item_id(arabic_description)), project:project_id(arabic_name), subcontractor:subcontractor_party_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'subcontractor_certificate', header: data, lines: data.lines }

    } else if (id.startsWith('ob-')) {
       const targetId = id.replace('ob-', '')
       const { data, error } = await supabase.from('owner_billing_documents').select('*, lines:owner_billing_lines(*), project:project_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'owner_billing', header: data, lines: data.lines }

    } else if (id.startsWith('pe-')) {
       const targetId = id.replace('pe-draft-', '').replace('pe-pm-', '')
       const { data, error } = await supabase.from('petty_expenses').select('*, project:project_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'petty_expense', header: data, lines: [] }

    } else if (id.startsWith('ret-')) {
       const targetId = id.replace('ret-', '')
       const { data, error } = await supabase.from('subcontractor_retention_releases').select('*, project:project_id(arabic_name), subcontractor:subcontractor_party_id(arabic_name)').eq('id', targetId).single()
       if (error) throw error
       detailData = { type: 'retention_release', header: data, lines: [] }

    } else {
       // Fallback for others
       detailData = { type: 'unknown', message: 'Details not fully implemented for this workflow yet.', rawId: id }
    }

    return NextResponse.json({ data: detailData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireMobileAuth(request)
    const supabaseAdmin = createAdminClient() // use admin for audit logs
    const supabase = createMobileClient(session.token)

    const body = await request.json()
    const { action, attachmentUrls, note } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
    }

    const { id } = params
    
    // Helper to append notes AND attachment fallbacks
    const handleNotesAndOverflow = async (table: string, targetId: string) => {
      let combinedNote = note || ''
      if (attachmentUrls && Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
        // Tables that do NOT have attachment arrays get URLs appended to notes
        const legacyTables = ['subcontractor_certificates', 'store_issues', 'owner_billing_documents', 'subcontractor_retention_releases']
        const isPettyExpenseWithMultiple = table === 'petty_expenses' && attachmentUrls.length > 1

        if (legacyTables.includes(table)) {
           const links = attachmentUrls.map((url: string, i: number) => `- [مرفق الجوال ${i+1}]: ${url}`).join('\n')
           combinedNote = combinedNote ? `${combinedNote}\n\n${links}` : links
        } else if (isPettyExpenseWithMultiple) {
           const overflowLinks = attachmentUrls.slice(1).map((url: string, i: number) => `- [مرفق الجوال الإضافي]: ${url}`).join('\n')
           combinedNote = combinedNote ? `${combinedNote}\n\n${overflowLinks}` : overflowLinks
        }
      }

      if (combinedNote) {
        const { data: currentRecord } = await supabase.from(table).select('notes').eq('id', targetId).single()
        const newNotes = currentRecord?.notes ? `${currentRecord.notes}\n[رسالة الجوال]: ${combinedNote}` : `[رسالة الجوال]: ${combinedNote}`
        await supabase.from(table).update({ notes: newNotes }).eq('id', targetId)
      }
    }

    // ── PURCHASE REQUEST APPROVAL ──
    if (id.startsWith('pr-') && !id.startsWith('pr-billing')) {
      const targetId = id.replace('pr-', '')

      const updatePayload: any = { status: action === 'approve' ? 'approved' : 'draft' }
      if (action === 'approve') {
        updatePayload.approved_by = session.userId
        updatePayload.approved_at = new Date().toISOString()
      }

      if (attachmentUrls && Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
         // Get existing to append safely
         const { data: currentPr } = await supabase.from('purchase_requests').select('attachment_urls').eq('id', targetId).single()
         const existingUrls = currentPr?.attachment_urls || []
         updatePayload.attachment_urls = [...existingUrls, ...attachmentUrls]
      }

      const { error } = await supabase.from('purchase_requests').update(updatePayload).eq('id', targetId).eq('status', 'pending_approval')
      if (error) throw error
      await handleNotesAndOverflow('purchase_requests', targetId)
      
      // Audit
      await writeAuditLog({
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
        entity_type: 'purchase_requests',
        entity_id: targetId,
        description: `تمت مراجعة الجوال: ${action}`,
      })
      
      return NextResponse.json({ success: true })
    }

    // ── STORE ISSUE APPROVAL ──
    if (id.startsWith('si-')) {
       const targetId = id.replace('si-', '')
       const updatePayload: any = { status: action === 'approve' ? 'approved' : 'rejected' }
       if (action === 'approve') {
         updatePayload.approved_by = session.userId
         updatePayload.approved_at = new Date().toISOString()
       }
       const { error } = await supabase.from('store_issues').update(updatePayload).eq('id', targetId).eq('status', 'pending_approval')
       if (error) throw error
       await handleNotesAndOverflow('store_issues', targetId)
       return NextResponse.json({ success: true })
    }

    // ── CERTIFICATE APPROVAL ──
    if (id.startsWith('cert-')) {
       const targetId = id.replace('cert-', '')
       const updatePayload: any = { status: action === 'approve' ? 'approved' : 'draft' }
       if (action === 'approve') {
         updatePayload.approved_by = session.userId
         updatePayload.approved_at = new Date().toISOString()
       }
       const { error } = await supabase.from('subcontractor_certificates').update(updatePayload).eq('id', targetId).in('status', ['draft', 'pending_approval'])
       if (error) throw error
       await handleNotesAndOverflow('subcontractor_certificates', targetId)
       return NextResponse.json({ success: true })
    }

    // ── OWNER BILLING APPROVAL ──
    if (id.startsWith('ob-')) {
       const targetId = id.replace('ob-', '')
       const updatePayload: any = { status: action === 'approve' ? 'approved' : 'draft' }
       if (action === 'approve') {
         updatePayload.approved_by = session.userId
       }
       const { error } = await supabase.from('owner_billing_documents').update(updatePayload).eq('id', targetId).eq('status', 'submitted')
       if (error) throw error
       await handleNotesAndOverflow('owner_billing_documents', targetId)
       return NextResponse.json({ success: true })
    }

    // ── PETTY EXPENSE APPROVAL ──
    if (id.startsWith('pe-draft-')) {
       const targetId = id.replace('pe-draft-', '')
       const updatePayload: any = { status: action === 'approve' ? 'pm_approved' : 'rejected' }
       if (action === 'approve') {
         updatePayload.pm_approved_by = session.userId
         updatePayload.pm_approved_at = new Date().toISOString()
       }
       if (attachmentUrls && Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
         updatePayload.attachment_url = attachmentUrls[0] // Set primary attachment
       }

       const { error } = await supabase.from('petty_expenses').update(updatePayload).eq('id', targetId).eq('status', 'draft')
       if (error) throw error
       await handleNotesAndOverflow('petty_expenses', targetId)
       return NextResponse.json({ success: true })
    }

    // ── RETENTION APPROVAL ──
    if (id.startsWith('ret-')) {
       const targetId = id.replace('ret-', '')
       const updatePayload: any = { status: action === 'approve' ? 'approved' : 'draft' }
       if (action === 'approve') {
         updatePayload.approved_by = session.userId
         updatePayload.approved_at = new Date().toISOString()
       }
       const { error } = await supabase.from('subcontractor_retention_releases').update(updatePayload).eq('id', targetId).eq('status', 'pending_approval')
       if (error) throw error
       await handleNotesAndOverflow('subcontractor_retention_releases', targetId)
       return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action not supported natively yet via Mobile' }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
