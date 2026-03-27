'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createUserAction } from '../actions'

export default function NewUserPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createUserAction(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/company/settings/users')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/company/settings/users"
          className="text-sm text-text-secondary hover:text-primary transition-colors"
        >
          → العودة للمستخدمين
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إضافة مستخدم جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">
          إنشاء حساب جديد وتحديد دوره الأولي. ستتمكن من تعديل الصلاحيات المتقدمة بعد الإنشاء.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="p-6 space-y-6">
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
                className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
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
                className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
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
                className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-background-secondary transition-colors cursor-pointer">
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
        </div>

        <div className="border-t border-border bg-background-secondary px-6 py-4 flex items-center justify-end gap-3">
          <Link
            href="/company/settings/users"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
          </button>
        </div>
      </form>
    </div>
  )
}
