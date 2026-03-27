'use client'

import { useState } from 'react'
import { approvePettyExpense } from '@/actions/custody'
import { useRouter } from 'next/navigation'

export function StatusActions({ expenseId, currentStatus }: { expenseId: string, currentStatus: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAction(action: 'pm_approve' | 'gm_approve' | 'reject') {
    try {
      setLoading(true)
      setError('')
      await approvePettyExpense(expenseId, action)
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
      
      <div className="flex flex-wrap gap-2">
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
          </>
        )}

        {['gm_approved', 'reimbursed', 'rejected'].includes(currentStatus) && (
          <div className="text-sm text-muted-foreground w-full py-2 bg-muted/50 rounded-md text-center border">
            تم إقفال دورة اعتمادات هذا المصروف
          </div>
        )}
      </div>
    </div>
  )
}
