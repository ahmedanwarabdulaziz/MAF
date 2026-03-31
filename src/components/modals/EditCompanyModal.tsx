'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanyAction } from '@/app/(system)/company/settings/company/actions'

interface Props {
  isOpen: boolean
  onClose: () => void
  company: any
}

export default function EditCompanyModal({ isOpen, onClose, company }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('id', company?.id)
    
    const result = await updateCompanyAction(formData)

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
      
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border">
        {/* Header (Navy Blue) */}
        <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">تعديل بيانات الشركة</h2>
            <p className="mt-1 text-sm text-white/80">
              تحديث البيانات والمعلومات الأساسية الخاصة بالكيان القانوني
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
          <form id="edit-company-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-text-primary">
                  اسم الشركة (بالعربية) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="arabic_name"
                  defaultValue={company?.arabic_name ?? ''}
                  required
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">اسم الشركة (بالإنجليزية)</label>
                <input
                  type="text"
                  name="english_name"
                  defaultValue={company?.english_name ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">الرمز المختصر</label>
                <input
                  type="text"
                  name="short_code"
                  defaultValue={company?.short_code ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">الرقم الضريبي</label>
                <input
                  type="text"
                  name="tax_number"
                  defaultValue={company?.tax_number ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">السجل التجاري</label>
                <input
                  type="text"
                  name="commercial_reg"
                  defaultValue={company?.commercial_reg ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">الدولة</label>
                <input
                  type="text"
                  name="country"
                  defaultValue={company?.country ?? ''}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">المدينة</label>
                <input
                  type="text"
                  name="city"
                  defaultValue={company?.city ?? ''}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-text-primary">العنوان التفصيلي</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={company?.address ?? ''}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">رقم الهاتف</label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={company?.phone ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={company?.email ?? ''}
                  dir="ltr"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors text-left"
                />
              </div>
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
            form="edit-company-form"
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  )
}
