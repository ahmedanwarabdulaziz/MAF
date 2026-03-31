'use client'

import { useState } from 'react'
import { approvePettyExpense } from '@/actions/petty_expenses'
import { useRouter } from 'next/navigation'

export function StatusActions({ 
  expenseId, 
  currentStatus, 
  costCenters = [], 
  currentCostCenterId = null 
}: { 
  expenseId: string, 
  currentStatus: string, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  costCenters?: any[], 
  currentCostCenterId?: string | null 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCostCenter, setSelectedCostCenter] = useState(currentCostCenterId || '')

  async function handleAction(action: 'pm_approve' | 'gm_approve' | 'reject' | 'return_to_draft') {
    if (action === 'return_to_draft' && !confirm('هل أنت متأكد من إرجاع المصروف لحالة المسودة وإلغاء الاعتمادات السابقة للتعديل؟')) return;
    
    try {
      setLoading(true)
      setError('')
      await approvePettyExpense(expenseId, action, selectedCostCenter || undefined)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-800 rounded-md bg-red-50 border border-red-200">
          {error}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 items-center">
        {['draft', 'pm_approved'].includes(currentStatus) && costCenters?.length > 0 && (
          <div className="flex items-center gap-2 border bg-gray-50 px-3 rounded-md w-full mb-2">
            <span className="text-xs text-gray-500 min-w-max">يُمكن تعديل مركز التكلفة:</span>
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent border-0 text-sm py-2 focus:ring-0 outline-none text-gray-700 font-medium"
            >
              <option value="">-- احتفظ بالمركز الحالي --</option>
              {costCenters.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.cost_center_code} - {cc.arabic_name}</option>
              ))}
            </select>
          </div>
        )}

        {currentStatus === 'draft' && (
          <>
            <button
              onClick={() => handleAction('pm_approve')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><polyline points="20 6 9 17 4 12"/></svg>
              موافقة مدير المشروع
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              رفض وإلغاء
            </button>
          </>
        )}

        {currentStatus === 'pm_approved' && (
          <>
            <button
              onClick={() => handleAction('gm_approve')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
              اعتماد الإدارة (تأكيد الخصم)
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              رفض وإلغاء
            </button>
            <button
              onClick={() => handleAction('return_to_draft')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-600 shadow-sm transition-colors hover:bg-orange-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              إرجاع كـ مسودة (للتعديل)
            </button>
          </>
        )}

        {['rejected'].includes(currentStatus) && (
          <button
              onClick={() => handleAction('return_to_draft')}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-600 shadow-sm transition-colors hover:bg-orange-50 disabled:opacity-50"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              إرجاع كـ مسودة من جديد
          </button>
        )}

        {['gm_approved', 'reimbursed'].includes(currentStatus) && (
          <div className="text-sm text-green-700 font-semibold w-full py-2 bg-green-50 rounded-md xl text-center border">
            تم إقفال واعتماد دورة هذا المصروف - لا يمكن التعديل
          </div>
        )}
      </div>
    </div>
  )
}
