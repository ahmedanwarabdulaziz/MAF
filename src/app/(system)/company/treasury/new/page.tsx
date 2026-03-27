'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createFinancialAccount } from '@/actions/treasury'

const ACCOUNT_TYPES = [
  { value: 'cashbox',    label: 'خزينة نقدية' },
  { value: 'bank',       label: 'حساب بنكي' },
  { value: 'deposit',    label: 'وديعة بنكية' },
  { value: 'investment', label: 'شهادة استثمار' },
]

export default function NewTreasuryAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    arabic_name: '',
    english_name: '',
    account_type: 'cashbox',
    currency: 'EGP',
    opening_balance: '',
    bank_name: '',
    account_number: '',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await createFinancialAccount({
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        account_type: form.account_type,
        currency: form.currency,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : undefined,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        notes: form.notes.trim() || null,
      })
      router.push('/company/treasury')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  const isBankType = form.account_type === 'bank' || form.account_type === 'deposit' || form.account_type === 'investment'

  return (
    <div className="max-w-xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary transition-colors">الخزينة والحسابات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">حساب جديد</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">إضافة حساب جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">سجّل خزينة نقدية أو حساباً بنكياً جديداً</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Account type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">نوع الحساب <span className="text-danger">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('account_type', t.value)}
                className={`rounded-lg border-2 px-3 py-2.5 text-sm text-right transition-colors ${
                  form.account_type === t.value
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border bg-background-secondary text-text-primary hover:border-primary/40'
                }`}
              >
                {t.label}
              </button>
            ))}
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
            placeholder="الخزينة الرئيسية"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
          <input
            value={form.english_name}
            onChange={e => set('english_name', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
            placeholder="Main Cashbox"
            dir="ltr"
          />
        </div>

        {/* Bank details — only for bank/deposit/investment */}
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
                placeholder="1234567890"
              />
            </div>
          </div>
        )}

        {/* Currency & Opening balance */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">العملة</label>
            <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-3 py-2.5 text-sm text-text-primary" dir="ltr">
              EGP — جنيه مصري
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الرصيد الافتتاحي</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.opening_balance}
              onChange={e => set('opening_balance', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              placeholder="0.00"
              dir="ltr"
            />
          </div>
        </div>

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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/company/treasury" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جارٍ الحفظ...' : 'إضافة الحساب'}
          </button>
        </div>
      </form>
    </div>
  )
}
