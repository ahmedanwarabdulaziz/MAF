import { getWorkInboxData } from '@/actions/work-inbox'
import CriticalActionsClient from './CriticalActionsClient'

export const metadata = { title: 'مركز العمل الموحد | الشركة' }

export default async function CriticalActionsPage() {
  const data = await getWorkInboxData()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <span>⚡</span>
            مركز العمل الموحد
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            جميع البنود التي تتطلب اعتماداً أو مراجعة أو إجراءً فورياً — في مكان واحد.
          </p>
        </div>
        {data.counts.total > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <span className="text-red-600 font-black text-2xl">{data.counts.total}</span>
            <span className="text-xs text-red-700 font-semibold leading-tight">
              بند<br />معلق
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <CriticalActionsClient data={data} />
    </div>
  )
}
