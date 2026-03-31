import { getTreasuryAccounts } from '@/actions/treasury'
import { getProjectPayablesQueue } from '@/actions/payments'
import PaymentWizard from './PaymentWizard'

export const metadata = {
  title: 'إصدار سند دفع | نظام إدارة المقاولات'
}

export default async function NewPaymentVoucherPage({ params }: { params: { id: string } }) {
  // 1. Get Accounts the user is allowed to tap into (We pass project ID to limit site cashboxes to this project, and corporate accounts which have no project_id)
  const allAccounts = await getTreasuryAccounts()
  // An account is valid for this project if it's either corporate (null) or belongs to this exact project.
  const validAccounts = allAccounts?.filter(a => !a.project_id || a.project_id === params.id) || []

  // 2. Get the entire pool of open liabilities for this project
  const queue = await getProjectPayablesQueue(params.id)

  return (
    <PaymentWizard 
      projectId={params.id}
      accounts={validAccounts}
      payablesQueue={queue}
    />
  )
}

