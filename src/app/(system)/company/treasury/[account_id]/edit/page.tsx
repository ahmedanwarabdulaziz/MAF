'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getAccountDetails, updateFinancialAccount } from '@/actions/treasury'

export default function EditTreasuryAccountPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.account_id as string

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<any>(null)
  const [form, setForm] = useState({
    arabic_name: '',
    english_name: '',
    bank_name: '',
    account_number: '',
    notes: '',
    is_active: true,
  })

  useEffect(() => {
    setLoading(true)
    getAccountDetails(accountId).then(acc => {
      if (!acc) return
      setAccount(acc)
      // Parse bank details back out of notes
      const notes = acc.notes || ''
      const bankMatch = notes.match(/البنك: ([^|]+)/)
      const accMatch = notes.match(/رقم الحساب: ([^|]+)/)
      const notesClean = notes
        .replace(/البنك: [^|]+\|?\s*/g, '')
        .replace(/رقم الحساب: [^|]+\|?\s*/g, '')
        .trim()

      setForm({
        arabic_name: acc.arabic_name || '',
        english_name: acc.english_name || '',
        bank_name: bankMatch?.[1]?.trim() || '',
        account_number: accMatch?.[1]?.trim() || '',
        notes: notesClean,
        is_active: acc.is_active ?? true,
      })
      setLoading(false)
    })
  }, [accountId])

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateFinancialAccount(accountId, {
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      })
      router.push(`/company/treasury/${accountId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setSaving(false)
    }
  }

  const isBankType = account?.account_type === 'bank' || account?.account_type === 'deposit' || account?.account_type === 'investment'

  if (loading) {
    return <div className="text-sm text-text-secondary">جارٍ التحميل...</div>
  }

  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary transition-colors">الخزينة والحسابات</Link>
        <span>←</span>
        <Link href={`/company/treasury/${accountId}`} className="hover:text-primary transition-colors">{account?.arabic_name}</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">تعديل</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">تعديل بيانات الحساب</h1>
        <p className="mt-1 text-sm text-text-secondary">تحديث معلومات الخزينة أو الحساب البنكي</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Account type - read only */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">نوع الحساب</label>
          <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-3 py-2.5 text-sm text-text-secondary">
            {({ cashbox: 'خزينة نقدية', bank: 'حساب بنكي', deposit: 'وديعة بنكية', investment: 'شهادة استثمار' } as Record<string, string>)[account?.account_type] || account?.account_type}
          </div>
        </div>

        {/* Names */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">اسم الحساب بالعربية <span className="text-danger">*</span></label>
          <input
            required
            value={form.arabic_name}
            onChange={e => set('arabic_name', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
          <input
            value={form.english_name}
            onChange={e => set('english_name', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
            dir="ltr"
          />
        </div>

        {/* Bank details */}
        {isBankType && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">اسم البنك</label>
              <input
                value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                placeholder="البنك الأهلي المصري"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">رقم الحساب</label>
              <input
                value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                dir="ltr"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">ملاحظات <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white resize-none"
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
          <input
            id="is_active"
            type="checkbox"
            checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-text-primary cursor-pointer">
            الحساب نشط
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/company/treasury/${accountId}`} className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </div>
  )
}
