'use server'

import { createClient } from '@/lib/supabase-server'

export type SearchResultType = 'project' | 'party' | 'purchase_request' | 'supplier_invoice' | 'goods_receipt'

export type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
  status?: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const supabase = createClient()
  const q = `%${query.trim()}%`

  // We will run the queries concurrently
  const [
    projectsRes,
    partiesRes,
    prsRes,
    invoicesRes,
    receiptsRes
  ] = await Promise.all([
    // 1. Projects (name or code)
    supabase
      .from('projects')
      .select('id, project_code, arabic_name')
      .or(`arabic_name.ilike.${q},project_code.ilike.${q}`)
      .limit(5),

    // 2. Parties (name or code)
    supabase
      .from('parties')
      .select('id, party_code, arabic_name, party_type')
      .or(`arabic_name.ilike.${q},party_code.ilike.${q}`)
      .limit(5),

    // 3. Purchase Requests (request_no)
    supabase
      .from('purchase_requests')
      .select('id, request_no, project_id, status, project:project_id(arabic_name)')
      .ilike('request_no', q)
      .limit(5),

    // 4. Supplier Invoices (invoice_no)
    supabase
      .from('supplier_invoices')
      .select('id, invoice_no, project_id, status, supplier:supplier_party_id(arabic_name)')
      .ilike('invoice_no', q)
      .limit(5),

    // 5. Goods Receipts (document_no)
    supabase
      .from('goods_receipts')
      .select('id, document_no, project_id, status, project:project_id(arabic_name)')
      .ilike('document_no', q)
      .limit(5),
  ])

  const results: SearchResult[] = []

  if (projectsRes.data) {
    projectsRes.data.forEach(p => {
      results.push({
        id: p.id,
        type: 'project',
        title: p.arabic_name,
        subtitle: p.project_code || 'بدون كود',
        href: `/projects/${p.id}`
      })
    })
  }

  if (partiesRes.data) {
    partiesRes.data.forEach(p => {
      // Typically parties don't have a single deep-link page unless it's supplier management, 
      // but in core MAF we often link to a directory or just return data.
      // Currently, supplier views exist under /company/purchases/suppliers or similar.
      // Let's rely on a generic /company/directory context or just a fallback for now.
      results.push({
        id: p.id,
        type: 'party',
        title: p.arabic_name,
        subtitle: `${p.party_code || 'بدون كود'} — ${p.party_type === 'supplier' ? 'مورد' : 'مالك/مقاول'}`,
        href: `/company/purchases/suppliers` // fallback URL 
      })
    })
  }

  if (prsRes.data) {
    prsRes.data.forEach(pr => {
      const projName = pr.project && !Array.isArray(pr.project) ? (pr.project as any).arabic_name : ''
      results.push({
        id: pr.id,
        type: 'purchase_request',
        title: `طلب شراء: ${pr.request_no}`,
        subtitle: projName || 'بدون مشروع',
        href: `/projects/${pr.project_id}/procurement/requests/${pr.id}`,
        status: pr.status
      })
    })
  }

  if (invoicesRes.data) {
    invoicesRes.data.forEach(inv => {
      const suppName = inv.supplier && !Array.isArray(inv.supplier) ? (inv.supplier as any).arabic_name : ''
      results.push({
        id: inv.id,
        type: 'supplier_invoice',
        title: `فاتورة رقم: ${inv.invoice_no}`,
        subtitle: suppName || 'بدون مورد',
        href: `/projects/${inv.project_id}/procurement/invoices/${inv.id}`,
        status: inv.status
      })
    })
  }

  if (receiptsRes.data) {
    receiptsRes.data.forEach(gr => {
      const projName = gr.project && !Array.isArray(gr.project) ? (gr.project as any).arabic_name : ''
      results.push({
        id: gr.id,
        type: 'goods_receipt',
        title: `إذن استلام: ${gr.document_no}`,
        subtitle: projName || 'بدون مشروع',
        // In MAF, receipts are generally viewed within GRN module or procurement context
        href: `/projects/${gr.project_id}/warehouse/receipts`, 
        status: gr.status
      })
    })
  }

  return results
}
