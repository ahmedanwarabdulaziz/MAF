'use server'

import { createClient } from '@/lib/supabase-server'
import { getCompanyPurchaseInvoices, getVendorAdvanceBalances } from '@/app/(system)/company/purchases/actions'
import { getSupplierInvoices } from './procurement'
import { getParty } from '@/lib/projects'
import { getTreasuryAccounts } from './treasury'
import { getSupplierCertificates } from './certificates'
import { getRetentionMetrics, getRetentionReleases } from './retention'

export async function fetchVendorStatementData(partyId: string) {
  const [
    party, 
    companyInvoices, 
    projectInvoices, 
    accounts, 
    certificates, 
    retentionMetrics, 
    retentionReleases, 
    advanceBalances
  ] = await Promise.all([
    getParty(partyId),
    getCompanyPurchaseInvoices({ supplier_party_id: partyId }),
    getSupplierInvoices(undefined, partyId),
    getTreasuryAccounts(),
    getSupplierCertificates(partyId),
    getRetentionMetrics(partyId),
    getRetentionReleases(partyId),
    getVendorAdvanceBalances(partyId)
  ])

  if (!party) {
    throw new Error('المورد/المقاول غير موجود')
  }

  // Fetch Pending Draft Allocations
  let draftAllocationsMap: Record<string, number> = {}
  const supabase = await createClient()
  const { data: draftVouchers } = await supabase.from('payment_vouchers').select('id').eq('status', 'draft')
  
  if (draftVouchers && draftVouchers.length > 0) {
    const draftVoucherIds = draftVouchers.map((v: any) => v.id)
    const { data: draftParties } = await supabase.from('payment_voucher_parties').select('id').in('payment_voucher_id', draftVoucherIds).eq('party_id', partyId)
    
    if (draftParties && draftParties.length > 0) {
      const partyIds = draftParties.map((p: any) => p.id)
      const { data: allocs } = await supabase.from('payment_allocations').select('source_entity_id, allocated_amount').in('payment_voucher_party_id', partyIds)
      if (allocs) {
        allocs.forEach((a: any) => {
          draftAllocationsMap[a.source_entity_id] = (draftAllocationsMap[a.source_entity_id] || 0) + Number(a.allocated_amount || 0)
        })
      }
    }
  }

  // ── Compute received_value per project invoice (3-way matching) ──
  // received_value = sum of (received_quantity * unit_price) per invoice line
  // If received_quantity is null (not yet confirmed), fall back to invoiced_quantity
  let receivedValueMap: Record<string, number> = {}
  const allProjectInvoiceIds = (projectInvoices || []).map((i: any) => i.id)
  if (allProjectInvoiceIds.length > 0) {
    const { data: invLines } = await supabase
      .from('supplier_invoice_lines')
      .select('invoice_id, invoiced_quantity, received_quantity, unit_price')
      .in('invoice_id', allProjectInvoiceIds)
    
    if (invLines) {
      invLines.forEach((l: any) => {
        const rQty = (l.received_quantity !== null && l.received_quantity !== undefined)
          ? Number(l.received_quantity)
          : Number(l.invoiced_quantity)
        const val = rQty * Number(l.unit_price || 0)
        receivedValueMap[l.invoice_id] = (receivedValueMap[l.invoice_id] || 0) + val
      })
    }
  }

  const attachPending = (docs: any[], includeReceived = false) => docs.map((doc: any) => ({
    ...doc,
    pending_draft_amount: draftAllocationsMap[doc.id] || 0,
    ...(includeReceived ? { received_value: receivedValueMap[doc.id] ?? null } : {})
  }))

  return {
    party,
    companyInvoices: attachPending(companyInvoices || []),
    projectInvoices: attachPending(projectInvoices || [], true),
    accounts,
    certificates: attachPending(certificates || []),
    retentionMetrics,
    retentionReleases,
    advanceBalances
  }
}
