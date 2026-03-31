'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserAction } from '@/app/(system)/company/settings/users/actions'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function NewUserModal({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createUserAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      // Success
      setLoading(false)
      onClose()
      router.refresh()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">إضافة مستخدم جديد</h2>
            <p className="mt-1 text-sm text-white/80">
              إنشاء حساب جديد وتحديد دوره الأولي. 
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
          <form id="new-user-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-text-primary">
                  الاسم بالكامل <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="display_name"
                  required
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                  placeholder="مثال: أحمد محمد"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  البريد الإلكتروني <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  كلمة المرور المؤقتة <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-white hover:bg-background-secondary transition-colors cursor-pointer">
                <input 
                  type="checkbox" 
                  name="is_super_admin" 
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 bg-white"
                />
                <div>
                  <div className="text-sm font-bold text-text-primary">مدير نظام (Super Admin)</div>
                  <div className="text-xs text-text-secondary mt-0.5">يمنح هذا الخيار المستخدم تحكماً كاملاً في كل أجزاء النظام. استخدمه بحذر.</div>
                </div>
              </label>
            </div>
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
            form="new-user-form"
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
          </button>
        </div>
      </div>
    </div>
  )
}
