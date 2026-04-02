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
  const supabase = await createClient() // we can skip auth check since this is a server action
  // The correct admin supabase query or standard query if user auth applies. The previous queries use standard fetch functions.
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

  const attachPending = (docs: any[]) => docs.map((doc: any) => ({
    ...doc,
    pending_draft_amount: draftAllocationsMap[doc.id] || 0
  }))

  return {
    party,
    companyInvoices: attachPending(companyInvoices || []),
    projectInvoices: attachPending(projectInvoices || []),
    accounts,
    certificates: attachPending(certificates || []),
    retentionMetrics,
    retentionReleases,
    advanceBalances
  }
}
