'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPermissionGroupAction } from '../actions'

export default function NewPermissionGroupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createPermissionGroupAction(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.groupId) {
      router.push(`/company/settings/permission-groups/${result.groupId}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/company/settings/permission-groups"
          className="text-sm text-text-secondary hover:text-primary transition-colors"
        >
          → العودة لمجموعات الصلاحيات
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إضافة مجموعة صلاحيات جديدة</h1>
        <p className="mt-1 text-sm text-text-secondary">
          إنشاء مسمى جديد لمجموعة مخصصة. ستقوم بتحديد مصفوفة السماحيات بعد الإنشاء.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="p-6 space-y-6">
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
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              placeholder="مثال: مسؤول العقود المخصصة"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              المعرف البرمجي <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="group_key"
              required
              dir="ltr"
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left font-mono"
              placeholder="custom_contracts_manager"
              pattern="[a-z0-9_]+"
              title="أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط"
            />
            <p className="text-xs text-text-secondary">يستخدم في التعليمات البرمجية. أحرف إنجليزية صغيرة وأرقام_فقط.</p>
          </div>
        </div>

        <div className="border-t border-border bg-background-secondary px-6 py-4 flex items-center justify-end gap-3">
          <Link
            href="/company/settings/permission-groups"
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء والانتقال للمصفوفة'}
          </button>
        </div>
      </form>
    </div>
  )
}
