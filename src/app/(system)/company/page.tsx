import { getCompanyDashboardMetrics } from '@/actions/dashboards'
import CompanyDashboardClient from '@/components/dashboards/CompanyDashboardClient'

export const metadata = {
  title: 'لوحة التحكم | نظام إدارة المقاولات'
}

export default async function CompanyDashboardPage() {
  const metrics = await getCompanyDashboardMetrics()

  return <CompanyDashboardClient initialMetrics={metrics} />
}
