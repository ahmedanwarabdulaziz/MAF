import { getCompanyPurchaseInvoice } from '../actions'
import { getTreasuryAccounts } from '@/actions/treasury'
import { notFound } from 'next/navigation'
import InvoiceDetailClient from './invoice-detail-client'

export default async function CompanyInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let invoice
  let accounts = []
  try {
    invoice = await getCompanyPurchaseInvoice(id)
    accounts = await getTreasuryAccounts()
  } catch {
    notFound()
  }
  if (!invoice) notFound()
  return <InvoiceDetailClient invoice={invoice} accounts={accounts} />
}
