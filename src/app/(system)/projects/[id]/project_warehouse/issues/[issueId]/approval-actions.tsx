'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveStoreIssue, rejectStoreIssue, cancelStoreIssue } from '@/actions/store-issues'

interface Props {
  issueId: string
  projectId: string
  canApprovePM: boolean
  canApproveWM: boolean
  canCancel: boolean
}

export default function IssueApprovalActions({
  issueId,
  projectId,
  canApprovePM,
  canApproveWM,
  canCancel,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [rejectRole, setRejectRole] = useState<'pm' | 'warehouse_manager'>('pm')
  const [reason, setReason] = useState('')

  async function handleApprove(role: 'pm' | 'warehouse_manager') {
    setLoading(true)
    setError('')
    try {
      await approveStoreIssue(issueId, role, projectId)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError('يرجى إدخال سبب الرفض')
      return
    }
    setLoading(true)
    setError('')
    try {
      await rejectStoreIssue(issueId, rejectRole, projectId, reason)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!confirm('هل أنت متأكد من إلغاء إذن الصرف؟')) return
    setLoading(true)
    setError('')
    try {
      await cancelStoreIssue(issueId, projectId, 'إلغاء يدوي')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {canApprovePM && (
          <button
            onClick={() => handleApprove('pm')}
            disabled={loading}
            className="rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            ✓ موافقة مدير المشروع
          </button>
        )}
        {canApproveWM && (
          <button
            onClick={() => handleApprove('warehouse_manager')}
            disabled={loading}
            className="rounded-lg bg-success px-5 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            ✓ موافقة أمين المخزن
          </button>
        )}
        {(canApprovePM || canApproveWM) && (
          <button
            onClick={() => {
              setRejectRole(canApprovePM ? 'pm' : 'warehouse_manager')
              setShowReject(!showReject)
            }}
            disabled={loading}
            className="rounded-lg border border-danger px-5 py-2 text-sm font-semibold text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
          >
            ✗ رفض
          </button>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
          >
            إلغاء الإذن
          </button>
        )}
      </div>

      {showReject && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary">سبب الرفض *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="اكتب سبب الرفض..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger"
          />
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={loading}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
            >
              تأكيد الرفض
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
