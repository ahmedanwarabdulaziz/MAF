'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// Fetch all payment vouchers for a project
export async function getProjectPayments(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId);
  if (!projectId || !isUUID) return [];

  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        paid_amount,
        party:party_id(arabic_name)
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("getProjectPayments Error:", error.message, "projectId:", projectId, "code:", error.code);
    return []
  }
  return data || []
}

// Fetch the "Payables Queue" (Unpaid or Partially Paid Documents)
export async function getProjectPayablesQueue(projectId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(projectId);
  if (!projectId || !isUUID) return { supplier_invoices: [], subcontractor_certificates: [] };

  const supabase = createClient()
  
  // 1. Supplier Invoices
  const { data: supplierInvoices, error: supErr } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_no, invoice_date, net_amount, paid_to_date, status,
      supplier:supplier_party_id(id, arabic_name)
    `)
    .eq('project_id', projectId)
    .in('status', ['posted', 'partially_paid'])

  if (supErr) {
    console.error("getProjectPayablesQueue supErr:", supErr.message, 'code:', supErr.code);
    return { supplier_invoices: [], subcontractor_certificates: [] }
  }

  // 2. Subcontractor Certificates
  const { data: subCertificates, error: subErr } = await supabase
    .from('subcontractor_certificates')
    .select(`
      id, certificate_no, certificate_date, net_amount, paid_to_date, outstanding_amount, status,
      subcontractor_agreement:subcontract_agreement_id(
        subcontractor:subcontractor_party_id(id, arabic_name)
      )
    `)
    .eq('project_id', projectId)
    .in('status', ['approved'])  // certificate_status ENUM: draft|pending_approval|approved|paid_in_full

  if (subErr) {
    console.error("getProjectPayablesQueue subErr:", subErr.message, 'code:', subErr.code);
    return { supplier_invoices: supplierInvoices || [], subcontractor_certificates: [] }
  }

  return {
    supplier_invoices: supplierInvoices || [],
    subcontractor_certificates: subCertificates || []
  }
}

// Execute Payment Voucher Draft (Creates the Voucher, links Party, and Drafts Allocations)
export async function draftPaymentVoucher(payload: {
  project_id: string
  company_id: string
  payment_date: string
  payment_method: string
  financial_account_id: string
  total_amount: number
  receipt_reference_no?: string
  notes?: string
  party_id: string
  allocations: { source_type: string, source_id: string, amount: number }[]
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Let the DB trigger handle sequential numbering
  const voucherNo = 'تلقائي'

  // 1. Create the Voucher
  const { data: voucher, error: vErr } = await supabase
    .from('payment_vouchers')
    .insert([{
      company_id: payload.company_id,
      project_id: payload.project_id,
      voucher_no: voucherNo,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      financial_account_id: payload.financial_account_id,
      total_amount: payload.total_amount,
      direction: 'outflow',
      status: 'draft',
      receipt_reference_no: payload.receipt_reference_no || null,
      notes: payload.notes || null,
      created_by: user?.id
    }])
    .select('id')
    .single()

  if (vErr) throw vErr

  // 2. Link the Party 
  const { data: partyLink, error: pErr } = await supabase
    .from('payment_voucher_parties')
    .insert([{
      payment_voucher_id: voucher.id,
      party_id: payload.party_id,
      paid_amount: payload.total_amount
    }])
    .select('id')
    .single()

  if (pErr) throw pErr

  // 3. Create the Allocations under this party link
  if (payload.allocations.length > 0) {
    const allocPayload = payload.allocations.map(a => ({
      payment_voucher_party_id: partyLink.id,
      source_entity_type: a.source_type,
      source_entity_id: a.source_id,
      allocated_amount: a.amount
    }))

    const { error: aErr } = await supabase.from('payment_allocations').insert(allocPayload)
    if (aErr) throw aErr
  }

  // Auto-post the voucher immediately to complete the flow
  const { error: postErr } = await supabase.rpc('post_payment_voucher', {
    p_voucher_id: voucher.id,
    p_user_id: user?.id
  })
  
  if (postErr) throw postErr

  await writeAuditLog({
    action: 'payment_created',
    entity_type: 'payment_voucher',
    entity_id: voucher.id,
    description: `تسجيل دفعة صرف بمبلغ ${payload.total_amount} — طريقة: ${payload.payment_method}`,
    metadata: { voucher_id: voucher.id, total_amount: payload.total_amount, payment_method: payload.payment_method, party_id: payload.party_id, project_id: payload.project_id, allocations_count: payload.allocations.length },
  })
  
  // Dual log: money was withdrawn from the Cashbox for this Payment Voucher
  await writeAuditLog({
    action: 'funds_withdrawn',
    entity_type: 'financial_account',
    entity_id: payload.financial_account_id,
    description: `صرف مدفوعات نقدية/بنكية بمبلغ ${payload.total_amount}`,
    metadata: { payment_voucher_id: voucher.id, total_amount: payload.total_amount, reference_type: 'payment_voucher' },
  })

  revalidatePath(`/projects/${payload.project_id}/payments`)
  revalidatePath(`/projects/${payload.project_id}/payments/queue`)
  
  return voucher.id
}

// Fetch single payment voucher details including allocations
export async function getPaymentVoucherDetails(voucherId: string) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(voucherId);
  if (!voucherId || !isUUID) throw new Error('Invalid Voucher ID');

  const supabase = createClient()
  
  const { data: voucher, error } = await supabase
    .from('payment_vouchers')
    .select(`
      *,
      financial_account:financial_account_id(arabic_name, currency),
      parties:payment_voucher_parties(
        id,
        paid_amount,
        party:party_id(arabic_name),
        allocations:payment_allocations(
            id,
            allocated_amount,
            source_entity_type,
            source_entity_id
        )
      )
    `)
    .eq('id', voucherId)
    .single()

  if (error) {
    console.error("getPaymentVoucherDetails Error:", error.message);
    throw new Error('Failed to load voucher details');
  }

  // Manually hydrate polymorphic associations
  const partyRecord = Array.isArray(voucher.parties) ? voucher.parties[0] : voucher.parties
  if (partyRecord?.allocations && partyRecord.allocations.length > 0) {
      const spInvoiceIds = partyRecord.allocations.filter((a: any) => a.source_entity_type === 'supplier_invoice').map((a: any) => a.source_entity_id)
      const subCertIds = partyRecord.allocations.filter((a: any) => a.source_entity_type === 'subcontractor_certificate').map((a: any) => a.source_entity_id)

      const [{ data: spInvoices }, { data: subCerts }] = await Promise.all([
          spInvoiceIds.length > 0 ? supabase.from('supplier_invoices').select('id, invoice_no, invoice_date').in('id', spInvoiceIds) : Promise.resolve({ data: [] }),
          subCertIds.length > 0 ? supabase.from('subcontractor_certificates').select('id, certificate_no, certificate_date').in('id', subCertIds) : Promise.resolve({ data: [] })
      ])

      const spInvoiceMap = Object.fromEntries((spInvoices || []).map(i => [i.id, i]))
      const subCertMap = Object.fromEntries((subCerts || []).map(i => [i.id, i]))

      partyRecord.allocations = partyRecord.allocations.map((a: any) => {
          if (a.source_entity_type === 'supplier_invoice' && spInvoiceMap[a.source_entity_id]) {
              return { ...a, supplier_invoices: spInvoiceMap[a.source_entity_id] }
          }
          if (a.source_entity_type === 'subcontractor_certificate' && subCertMap[a.source_entity_id]) {
              return { ...a, subcontractor_certificates: subCertMap[a.source_entity_id] }
          }
          return a
      })
  }

  return voucher;
}
