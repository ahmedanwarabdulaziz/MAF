'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOwnerBillingStatus } from '@/actions/owner_billing'

export default function StatusActions({
  docId,
  projectId,
  currentStatus
}: {
  docId: string
  projectId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStatusChange(newStatus: 'submitted' | 'approved' | 'paid') {
    if (!confirm('هل أنت متأكد من تغيير حالة الفاتورة؟')) return
    
    setLoading(true)
    setError(null)
    
    try {
      await updateOwnerBillingStatus(docId, newStatus, projectId)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  if (currentStatus === 'paid' || currentStatus === 'cancelled') return null

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-danger">{error}</span>}
      {loading && <span className="text-sm text-text-secondary">جارٍ التحديث...</span>}
      
      {!loading && currentStatus === 'draft' && (
        <button
          onClick={() => handleStatusChange('submitted')}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
        >
          تقديم (Submit)
        </button>
      )}

      {!loading && currentStatus === 'submitted' && (
        <button
          onClick={() => handleStatusChange('approved')}
          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-success/90 transition-colors"
        >
          اعتماد (Approve)
        </button>
      )}

      {!loading && currentStatus === 'approved' && (
        <button
          onClick={() => handleStatusChange('paid')}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
        >
          تسجيل كمحصلة كاملة (Mark Paid)
        </button>
      )}
    </div>
  )
}
