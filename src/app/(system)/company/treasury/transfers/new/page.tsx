import { getTreasuryAccounts } from '@/actions/treasury'
import TransferForm from './TransferForm'

export const metadata = {
  title: 'تحويل داخلي | نظام إدارة المقاولات'
}

export default async function NewTransferPage() {
  // Fetch active accounts for the dropdowns
  const allAccounts = await getTreasuryAccounts()
  
  return <TransferForm accounts={allAccounts || []} />
}
