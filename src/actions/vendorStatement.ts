'use server'

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

  return {
    party,
    companyInvoices,
    projectInvoices,
    accounts,
    certificates,
    retentionMetrics,
    retentionReleases,
    advanceBalances
  }
}
