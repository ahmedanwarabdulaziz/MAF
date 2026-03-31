'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createFinancialAccount } from '@/actions/treasury'

const ACCOUNT_TYPES = [
  { value: 'cashbox', label: 'خزينة نقدية', icon: '💵', desc: 'نقد في الموقع أو المكتب' },
  { value: 'bank',    label: 'حساب بنكي',   icon: '🏦', desc: 'حساب جاري في بنك' },
]

export default function NewProjectAccountForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    arabic_name: '',
    english_name: '',
    account_type: 'cashbox',
    opening_balance: '',
    bank_name: '',
    account_number: '',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createFinancialAccount({
          arabic_name: form.arabic_name.trim(),
          english_name: form.english_name.trim() || null,
          account_type: form.account_type,
          currency: 'EGP',
          opening_balance: form.opening_balance ? Number(form.opening_balance) : undefined,
          bank_name: form.bank_name.trim() || null,
          account_number: form.account_number.trim() || null,
          notes: form.notes.trim() || null,
          project_id: projectId,
        })
        router.push(`/projects/${projectId}/treasury`)
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء الحفظ')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {/* Account type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-text-primary">نوع الحساب <span className="text-danger">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {ACCOUNT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('account_type', t.value)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-right transition-all ${
                form.account_type === t.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background-secondary hover:border-primary/30'
              }`}
            >
              <span className="text-2xl shrink-0">{t.icon}</span>
              <div>
                <div className={`text-sm font-semibold ${form.account_type === t.value ? 'text-primary' : 'text-text-primary'}`}>
                  {t.label}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Arabic name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-text-primary">اسم الخزينة / الحساب <span className="text-danger">*</span></label>
        <input
          required
          value={form.arabic_name}
          onChange={e => set('arabic_name', e.target.value)}
          className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
          placeholder={form.account_type === 'cashbox' ? 'خزينة موقع المشروع' : 'حساب المشروع — البنك الأهلي'}
        />
      </div>

      {/* Bank details */}
      {form.account_type === 'bank' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-primary">اسم البنك</label>
            <input
              value={form.bank_name}
              onChange={e => set('bank_name', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              placeholder="البنك الأهلي المصري"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-primary">رقم الحساب</label>
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

      {/* Opening balance */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-text-primary">
          الرصيد الافتتاحي
          <span className="text-text-secondary font-normal text-xs mr-2">(اختياري — المبلغ المحوَّل لهذه الخزينة)</span>
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.opening_balance}
            onChange={e => set('opening_balance', e.target.value)}
            className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
            placeholder="0.00"
            dir="ltr"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-secondary">ج.م</span>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-text-primary">ملاحظات <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white resize-none"
          placeholder="أي ملاحظات إضافية عن الخزينة..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <Link
          href={`/projects/${projectId}/treasury`}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
        >
          إلغاء
        </Link>
        <button
          type="submit"
          disabled={isPending || !form.arabic_name.trim()}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'جارٍ الإنشاء...' : '+ إنشاء الخزينة'}
        </button>
      </div>
    </form>
  )
}
