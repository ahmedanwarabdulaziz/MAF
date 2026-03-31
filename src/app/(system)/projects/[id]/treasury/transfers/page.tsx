import { getTreasuryAccounts } from '@/actions/treasury'
import TransferForm from '@/app/(system)/company/treasury/transfers/new/TransferForm'

export const metadata = { title: 'تحويل داخلي | خزينة المشروع' }

export default async function ProjectTransferPage({ params }: { params: { id: string } }) {
  // Fetch active accounts for the dropdowns
  const allAccounts = await getTreasuryAccounts()
  
  // We don't filter the selection list to just the project because it's completely
  // normal to transfer money from the corporate main bank to the project cashbox,
  // or return surplus from the project cashbox back to corporate.
  return <TransferForm accounts={allAccounts || []} returnPath={`/projects/${params.id}/treasury`} />
}
