'use server'

import { createClient } from '@/lib/supabase-server'
import {
  WorkInboxData,
  WorkInboxItem,
  WorkInboxItemType,
  computeAgeDays,
  derivePriority,
} from '@/lib/work-inbox-types'

// ============================================================
// getWorkInboxData — Wave 1 Aggregation Adapter
// Read-only. No schema changes. No approval logic touched.
// ============================================================

export async function getWorkInboxData(projectId?: string, overrideClient?: any): Promise<WorkInboxData> {
  const supabase = overrideClient ?? createClient()

  // Fetch all Wave 1 + Wave 2 sources in parallel
  const [
    prsResult,
    invoicesResult,
    discrepanciesResult,
    certsResult,
    ownerBillingResult,
    storeIssuesResult,
    pettyExpensesDraftResult,
    pettyExpensesPmResult,
    retentionResult,
    prsApprovedResult,
  ] =
    await Promise.all([
      // 1. Purchase Requests — status = pending_approval
      (() => {
        let q = supabase
          .from('purchase_requests')
          .select('id, request_no, project_id, created_at, required_by_date, project:project_id(arabic_name, project_code)')
          .eq('status', 'pending_approval')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 2. Supplier Invoices — status = pending_receipt
      (() => {
        let q = supabase
          .from('supplier_invoices')
          .select('id, invoice_no, project_id, created_at, net_amount, project:project_id(arabic_name, project_code), supplier:supplier_party_id(arabic_name)')
          .eq('status', 'pending_receipt')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 3. Supplier Invoice Discrepancies — discrepancy_status = pending
      (() => {
        let q = supabase
          .from('supplier_invoices')
          .select('id, invoice_no, project_id, created_at, net_amount, project:project_id(arabic_name, project_code), supplier:supplier_party_id(arabic_name)')
          .eq('discrepancy_status', 'pending')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 4. Subcontractor Certificates — status = pending_approval
      (() => {
        let q = supabase
          .from('subcontractor_certificates')
          .select('id, certificate_no, project_id, created_at, net_amount, project:project_id(arabic_name, project_code), subcontractor:subcontractor_party_id(arabic_name)')
          .eq('status', 'pending_approval')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 5. Owner Billing Documents — status = submitted
      (() => {
        let q = supabase
          .from('owner_billing_documents')
          .select('id, document_no, project_id, created_at, net_amount, project:project_id(arabic_name, project_code)')
          .eq('status', 'submitted')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 6. [Wave 2] Store Issues — status = pending_approval
      (() => {
        let q = supabase
          .from('store_issues')
          .select('id, document_no, project_id, created_at, issue_type, project:project_id(arabic_name, project_code)')
          .eq('status', 'pending_approval')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 7. [Wave 2] Petty Expenses — status = draft (awaiting PM approval)
      (() => {
        let q = supabase
          .from('petty_expenses')
          .select('id, project_id, total_amount, created_at, project:project_id(arabic_name, project_code)')
          .eq('status', 'draft')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 8. [Wave 2] Petty Expenses — status = pm_approved (awaiting GM approval)
      (() => {
        let q = supabase
          .from('petty_expenses')
          .select('id, project_id, total_amount, created_at, project:project_id(arabic_name, project_code)')
          .eq('status', 'pm_approved')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 9. [Wave 2] Retention Releases — status = pending_approval
      (() => {
        let q = supabase
          .from('subcontractor_retention_releases')
          .select('id, project_id, released_amount, created_at, project:project_id(arabic_name, project_code), subcontractor:subcontractor_party_id(arabic_name)')
          .eq('status', 'pending_approval')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),

      // 10. Purchase Requests (Approved & Ready for Invoicing)
      (() => {
        let q = supabase
          .from('purchase_requests')
          .select('id, request_no, project_id, created_at, required_by_date, project:project_id(arabic_name, project_code)')
          .eq('status', 'approved')
        if (projectId) q = q.eq('project_id', projectId)
        return q.order('created_at', { ascending: true })
      })(),
    ])

  const items: WorkInboxItem[] = []

  // ── Adapter: Purchase Requests ──────────────────────────────────────
  for (const pr of prsResult.data ?? []) {
    const project: any = Array.isArray(pr.project) ? pr.project[0] : pr.project
    const ageDays = computeAgeDays(pr.created_at)
    items.push({
      id:          `pr-${pr.id}`,
      type:        'purchase_request',
      sourceId:    pr.id,
      projectId:   pr.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `طلب شراء ${pr.request_no}`,
      subtitle:    project?.arabic_name ?? null,
      statusLabel: 'بانتظار الاعتماد',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   pr.created_at,
      dueAt:       pr.required_by_date ?? null,
      ageDays,
      href:        pr.project_id
                     ? `/projects/${pr.project_id}/procurement/requests?view_pr=${pr.id}&projectId=${pr.project_id}`
                     : `/company/approvals?view_pr=${pr.id}`,
      dialogKey:   'purchase_request',
      badges:      ['طلب شراء'],
    })
  }



  // ── Adapter: Approved Purchase Requests (Ready for Invoicing) ──────
  for (const pr of prsApprovedResult?.data ?? []) {
    const project: any = Array.isArray(pr.project) ? pr.project[0] : pr.project
    const ageDays = computeAgeDays(pr.created_at)
    items.push({
      id:          `pr-billing-${pr.id}`,
      type:        'purchase_request',
      sourceId:    pr.id,
      projectId:   pr.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `طلب شراء ${pr.request_no}`,
      subtitle:    project?.arabic_name ?? null,
      statusLabel: 'جاهز للفوترة',
      actionLabel: 'إنشاء فاتورة',
      createdAt:   pr.created_at,
      dueAt:       pr.required_by_date ?? null,
      ageDays,
      priority:    'high',
      href:        pr.project_id
                     ? `/projects/${pr.project_id}/procurement/requests?view_pr=${pr.id}&projectId=${pr.project_id}`
                     : `/company/approvals?view_pr=${pr.id}`,
      dialogKey:   'purchase_request',
      badges:      ['فوترة طلبات الشراء'],
    })
  }

  // ── Adapter: Supplier Invoices Awaiting Receipt ─────────────────────
  for (const inv of invoicesResult.data ?? []) {
    const project: any  = Array.isArray(inv.project)  ? inv.project[0]  : inv.project
    const supplier: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
    const ageDays = computeAgeDays(inv.created_at)
    items.push({
      id:          `inv-receipt-${inv.id}`,
      type:        'supplier_invoice_receipt',
      sourceId:    inv.id,
      projectId:   inv.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `فاتورة ${inv.invoice_no}`,
      subtitle:    supplier?.arabic_name ?? null,
      amount:      inv.net_amount ? Number(inv.net_amount) : null,
      currency:    'EGP',
      statusLabel: 'بانتظار الاستلام المخزني',
      actionLabel: 'مراجعة واستلام',
      createdAt:   inv.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        inv.project_id
                     ? `/projects/${inv.project_id}/procurement/invoices?view_invoice=${inv.id}&projectId=${inv.project_id}`
                     : `/company/approvals?view_invoice=${inv.id}`,
      dialogKey:   'supplier_invoice',
      badges:      ['فاتورة مورد'],
    })
  }

  // ── Adapter: Supplier Invoice Discrepancies ─────────────────────────
  for (const inv of discrepanciesResult.data ?? []) {
    const project: any  = Array.isArray(inv.project)  ? inv.project[0]  : inv.project
    const supplier: any = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
    const ageDays = computeAgeDays(inv.created_at)
    items.push({
      id:          `inv-disc-${inv.id}`,
      type:        'supplier_invoice_discrepancy',
      sourceId:    inv.id,
      projectId:   inv.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `فجوة كميات — ${inv.invoice_no}`,
      subtitle:    supplier?.arabic_name ?? null,
      amount:      inv.net_amount ? Number(inv.net_amount) : null,
      currency:    'EGP',
      statusLabel: 'فجوة كميات معلقة',
      actionLabel: 'مراجعة الكميات',
      createdAt:   inv.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        inv.project_id
                     ? `/projects/${inv.project_id}/procurement/invoices?view_invoice=${inv.id}&projectId=${inv.project_id}`
                     : `/company/approvals?view_invoice=${inv.id}`,
      dialogKey:   'supplier_invoice',
      badges:      ['فجوة كميات'],
    })
  }

  // ── Adapter: Subcontractor Certificates ────────────────────────────
  for (const cert of certsResult.data ?? []) {
    const project: any       = Array.isArray(cert.project)       ? cert.project[0]       : cert.project
    const subcontractor: any = Array.isArray(cert.subcontractor) ? cert.subcontractor[0] : cert.subcontractor
    const ageDays = computeAgeDays(cert.created_at)
    items.push({
      id:          `cert-${cert.id}`,
      type:        'subcontractor_certificate',
      sourceId:    cert.id,
      projectId:   cert.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `مستخلص ${cert.certificate_no}`,
      subtitle:    subcontractor?.arabic_name ?? null,
      amount:      cert.net_amount ? Number(cert.net_amount) : null,
      currency:    'EGP',
      statusLabel: 'بانتظار الاعتماد',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   cert.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        cert.project_id
                     ? `/projects/${cert.project_id}/certificates`
                     : '/company/critical-actions',
      dialogKey:   'subcontractor_certificate',
      badges:      ['مستخلص'],
    })
  }

  // ── Adapter: Owner Billing Documents ───────────────────────────────
  for (const doc of ownerBillingResult.data ?? []) {
    const project: any = Array.isArray(doc.project) ? doc.project[0] : doc.project
    const ageDays = computeAgeDays(doc.created_at)
    items.push({
      id:          `ob-${doc.id}`,
      type:        'owner_billing',
      sourceId:    doc.id,
      projectId:   doc.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `فاتورة مالك ${doc.document_no}`,
      subtitle:    project?.arabic_name ?? null,
      amount:      doc.net_amount ? Number(doc.net_amount) : null,
      currency:    'EGP',
      statusLabel: 'مُقدَّمة — بانتظار الاعتماد',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   doc.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        doc.project_id
                     ? `/projects/${doc.project_id}/owner-billing`
                     : '/company/critical-actions',
      dialogKey:   'owner_billing',
      badges:      ['فاتورة مالك'],
    })
  }

  // ── Adapter: [Wave 2] Store Issues ─────────────────────────────────
  for (const issue of storeIssuesResult.data ?? []) {
    const project: any = Array.isArray(issue.project) ? issue.project[0] : issue.project
    const ageDays = computeAgeDays(issue.created_at)
    const isInternal = issue.issue_type === 'internal'
    items.push({
      id:          `si-${issue.id}`,
      type:        'store_issue',
      sourceId:    issue.id,
      projectId:   issue.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `إذن صرف ${isInternal ? 'داخلي' : 'مخزني'} ${issue.document_no ?? ''}`.trim(),
      subtitle:    project?.arabic_name ?? null,
      statusLabel: 'بانتظار الاعتماد',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   issue.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        issue.project_id
                     ? `/projects/${issue.project_id}/project_warehouse/issues/${issue.id}`
                     : `/company/main_warehouse/issues/${issue.id}`,
      dialogKey:   'store_issue',
      badges:      ['إذن صرف'],
    })
  }

  // ── Adapter: [Wave 2] Petty Expenses — draft (awaiting PM) ─────────
  for (const exp of pettyExpensesDraftResult.data ?? []) {
    const project: any = Array.isArray(exp.project) ? exp.project[0] : exp.project
    const ageDays = computeAgeDays(exp.created_at)
    items.push({
      id:          `pe-draft-${exp.id}`,
      type:        'petty_expense',
      sourceId:    exp.id,
      projectId:   exp.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `مصروف نثري — بانتظار موافقة م.م`,
      amount:      exp.total_amount ? Number(exp.total_amount) : null,
      currency:    'EGP',
      statusLabel: 'بانتظار موافقة مدير المشروع',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   exp.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        exp.project_id
                     ? `/projects/${exp.project_id}/petty-expenses`
                     : '/company/critical-actions',
      dialogKey:   'petty_expense',
      badges:      ['مصروف نثري', 'بانتظار م.م'],
    })
  }

  // ── Adapter: [Wave 2] Petty Expenses — pm_approved (awaiting GM) ───
  for (const exp of pettyExpensesPmResult.data ?? []) {
    const project: any = Array.isArray(exp.project) ? exp.project[0] : exp.project
    const ageDays = computeAgeDays(exp.created_at)
    items.push({
      id:          `pe-pm-${exp.id}`,
      type:        'petty_expense',
      sourceId:    exp.id,
      projectId:   exp.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `مصروف نثري — بانتظار موافقة م.ع`,
      amount:      exp.total_amount ? Number(exp.total_amount) : null,
      currency:    'EGP',
      statusLabel: 'بانتظار موافقة المدير العام',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   exp.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        exp.project_id
                     ? `/projects/${exp.project_id}/petty-expenses`
                     : '/company/critical-actions',
      dialogKey:   'petty_expense',
      badges:      ['مصروف نثري', 'بانتظار م.ع'],
    })
  }

  // ── Adapter: [Wave 2] Retention Releases ───────────────────────────
  for (const rel of retentionResult.data ?? []) {
    const project: any       = Array.isArray(rel.project)       ? rel.project[0]       : rel.project
    const subcontractor: any = Array.isArray(rel.subcontractor) ? rel.subcontractor[0] : rel.subcontractor
    const ageDays = computeAgeDays(rel.created_at)
    items.push({
      id:          `ret-${rel.id}`,
      type:        'retention_release',
      sourceId:    rel.id,
      projectId:   rel.project_id,
      projectName: project?.arabic_name ?? null,
      projectCode: project?.project_code ?? null,
      title:       `إفراج استقطاع — ${subcontractor?.arabic_name ?? 'مقاول'}`,
      subtitle:    project?.arabic_name ?? null,
      amount:      rel.released_amount ? Number(rel.released_amount) : null,
      currency:    'EGP',
      statusLabel: 'بانتظار الاعتماد',
      actionLabel: 'مراجعة واعتماد',
      createdAt:   rel.created_at,
      ageDays,
      priority:    derivePriority(ageDays),
      href:        '/company/purchases/suppliers',
      dialogKey:   'retention_release',
      badges:      ['إفراج استقطاع'],
    })
  }

  // Sort: critical first, then by ageDays desc
  items.sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, normal: 2 }
    const pDiff = pOrder[a.priority] - pOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return (b.ageDays ?? 0) - (a.ageDays ?? 0)
  })

  // Build counts
  const byType: Partial<Record<WorkInboxItemType, number>> = {}
  let critical = 0, high = 0, normal = 0

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1
    if (item.priority === 'critical') critical++
    else if (item.priority === 'high') high++
    else normal++
  }

  return {
    items,
    counts: { total: items.length, critical, high, normal, byType },
  }
}

// ── Lightweight count-only fetch for top-bar badge ──────────────────
// This runs in a client component with periodic refresh.
// Intentionally lean — no joins, count only.
export async function getWorkInboxCount(projectId?: string): Promise<number> {
  const supabase = createClient()

  const [
    prs, invReceipt, invDisc, certs, ownerBilling,
    storeIssues, pettyDraft, pettyPm, retention,
  ] = await Promise.all([
    (() => { let q = supabase.from('purchase_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('supplier_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending_receipt'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('supplier_invoices').select('id', { count: 'exact', head: true }).eq('discrepancy_status', 'pending'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('subcontractor_certificates').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('owner_billing_documents').select('id', { count: 'exact', head: true }).eq('status', 'submitted'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('store_issues').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('petty_expenses').select('id', { count: 'exact', head: true }).eq('status', 'draft'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('petty_expenses').select('id', { count: 'exact', head: true }).eq('status', 'pm_approved'); if (projectId) q = q.eq('project_id', projectId); return q })(),
    (() => { let q = supabase.from('subcontractor_retention_releases').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'); if (projectId) q = q.eq('project_id', projectId); return q })(),
  ])

  return (
    (prs.count ?? 0) +
    (invReceipt.count ?? 0) +
    (invDisc.count ?? 0) +
    (certs.count ?? 0) +
    (ownerBilling.count ?? 0) +
    (storeIssues.count ?? 0) +
    (pettyDraft.count ?? 0) +
    (pettyPm.count ?? 0) +
    (retention.count ?? 0)
  )
}
