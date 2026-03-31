import { getPendingApprovals } from '@/actions/procurement'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const data = await getPendingApprovals()
  
  return (
    <div className="space-y-6 pb-24 mx-auto max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">الاعتمادات المعلقة (Pending Approvals)</h1>
        <p className="mt-1 text-sm text-text-secondary">
          مراجعة واعتماد طلبات الشراء وفواتير الموردين لجميع المشاريع.
        </p>
      </div>
      <ApprovalsClient initialData={data} />
    </div>
  )
}
