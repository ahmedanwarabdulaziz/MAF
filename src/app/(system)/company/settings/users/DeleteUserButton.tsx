'use client'

import { useState, useTransition } from 'react'
import { deleteUserAction } from './actions'

interface Props {
  userId: string
  userName: string
}

export default function DeleteUserButton({ userId, userName }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteUserAction(userId)
        if (result.error) {
          setError(result.error)
        } else {
          setShowConfirm(false)
          window.location.href = '/company/settings/users'
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setShowConfirm(true) }}
        title="حذف"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>

      {showConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => !isPending && setShowConfirm(false)}
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-white shadow-2xl p-6">
              {/* Icon */}
              <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>

              <h3 className="text-center text-lg font-bold text-text-primary mb-2">حذف المستخدم</h3>
              <p className="text-center text-sm text-text-secondary mb-1">
                هل أنت متأكد من حذف المستخدم
              </p>
              <p className="text-center text-sm font-semibold text-text-primary mb-4">
                &quot;{userName}&quot;؟
              </p>
              <p className="text-center text-xs text-text-secondary mb-6">
                هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المستخدم وجميع بياناته بشكل نهائي.
              </p>

              {error && (
                <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center text-xs text-red-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      جاري الحذف...
                    </>
                  ) : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
