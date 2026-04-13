'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteParty } from '@/actions/parties'

interface Props {
  partyId: string
  partyName: string
}

export default function DeletePartyButton({ partyId, partyName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deleteParty(partyId)
    setLoading(false)
    if (result.success) {
      setOpen(false)
      router.refresh()
    } else {
      setError(result.error ?? 'حدث خطأ غير متوقع')
    }
  }

  return (
    <>
      {/* Trash icon trigger */}
      <button
        onClick={() => { setError(null); setOpen(true) }}
        title="حذف"
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-secondary hover:border-danger hover:text-danger hover:bg-danger/5 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-danger/5 px-6 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-text-primary">تأكيد الحذف</h2>
                <p className="text-xs text-text-secondary mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-text-primary">
                هل أنت متأكد من حذف جهة التعامل{' '}
                <span className="font-semibold text-text-primary">&quot;{partyName}&quot;</span>؟
              </p>
              <p className="text-xs text-text-secondary rounded-lg bg-background-secondary px-3 py-2">
                سيتم التحقق من عدم ارتباط هذه الجهة بأي بيانات قبل الحذف. إذا كانت مرتبطة بعقود أو فواتير أو مدفوعات، سيتم رفض الحذف تلقائياً.
              </p>

              {/* Error display */}
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger whitespace-pre-line">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-background-secondary px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text-secondary hover:bg-background transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg bg-danger px-5 py-2 text-sm font-semibold text-white hover:bg-danger/90 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    جارٍ التحقق...
                  </>
                ) : (
                  'حذف نهائي'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
