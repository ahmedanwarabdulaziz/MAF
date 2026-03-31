'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPermissionGroupAction } from '@/app/(system)/company/settings/permission-groups/actions'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function NewPermissionGroupModal({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [groupKey, setGroupKey] = useState('')

  useEffect(() => {
    if (isOpen) {
      setGroupKey(`group_${Math.random().toString(36).substring(2, 8)}`)
    } else {
      setGroupKey('')
      setError(null)
    }
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createPermissionGroupAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.groupId) {
      // Success, navigate to permissions editor matrix
      setLoading(false)
      onClose()
      router.push(`/company/settings/permission-groups/${result.groupId}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border">
        {/* Header (Navy Blue to match sidepanel) */}
        <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">إضافة قالب صلاحيات جديد</h2>
            <p className="mt-1 text-sm text-white/80">
              إنشاء مسمى جديد لمجموعة مخصصة. ستقوم بتحديد مصفوفة السماحيات بعد الإنشاء.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
          <form id="new-permission-group-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                الاسم (بالعربي) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="arabic_name"
                required
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                placeholder="مثال: مسؤول العقود المخصصة"
              />
            </div>

            <input type="hidden" name="group_key" value={groupKey} />
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-white px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </button>
          <button
            form="new-permission-group-form"
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء والانتقال للمصفوفة'}
          </button>
        </div>
      </div>
    </div>
  )
}
