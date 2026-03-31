import { getCompanyPurchaseInvoices } from '../../actions'
import { getSupplierInvoices } from '@/actions/procurement'
import { getParty } from '@/lib/projects'
import { getTreasuryAccounts } from '@/actions/treasury'
import { getSupplierCertificates } from '@/actions/certificates'
import { getRetentionMetrics, getRetentionReleases } from '@/actions/retention'
import { notFound } from 'next/navigation'
import VendorStatementClient from './vendor-statement-client'

export const metadata = { title: 'كشف حساب المورد | الشركة' }

export default async function VendorStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const [party, companyInvoices, projectInvoices, accounts, certificates, retentionMetrics, retentionReleases] = await Promise.all([
    getParty(id),
    getCompanyPurchaseInvoices({ supplier_party_id: id }),
    getSupplierInvoices(undefined, id),
    getTreasuryAccounts(),
    getSupplierCertificates(id),
    getRetentionMetrics(id),
    getRetentionReleases(id)
  ])

  if (!party) notFound()

  return (
    <VendorStatementClient 
      party={party} 
      companyInvoices={companyInvoices}
      projectInvoices={projectInvoices}
      certificates={certificates}
      retentionMetrics={retentionMetrics}
      retentionReleases={retentionReleases}
      accounts={accounts} 
    />
  )
}
