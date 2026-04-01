import { getProjectPayments } from '@/actions/payments'
import PaymentsPageClient from './PaymentsPageClient'

export const metadata = {
  title: 'سجلات الصرف | نظام إدارة المقاولات'
}

export default async function ProjectPaymentsPage({ params }: { params: { id: string } }) {
  const vouchers = await getProjectPayments(params.id)
  return <PaymentsPageClient params={params} vouchers={vouchers} />
}
