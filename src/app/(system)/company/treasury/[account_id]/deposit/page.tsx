'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { depositFunds, getAccountDetails } from '@/actions/treasury'
import DatePicker from '@/components/DatePicker'
import { useEffect } from 'react'

export default function DepositPage() {
  const router = useRouter()
  const params = useParams()
  const accountId = params.account_id as string

  const [account, setAccount] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amount: '',
    transaction_date: today,
    notes: '',
  })

  useEffect(() => {
    getAccountDetails(accountId).then(setAccount)
  }, [accountId])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      setError('يجب إدخال مبلغ صحيح أكبر من الصفر')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await depositFunds({
        account_id: accountId,
        amount: Number(form.amount),
        transaction_date: form.transaction_date,
        notes: form.notes.trim() || undefined,
      })
      router.push(`/company/treasury/${accountId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/treasury" className="hover:text-primary transition-colors">الخزينة والحسابات</Link>
        <span>←</span>
        <Link href={`/company/treasury/${accountId}`} className="hover:text-primary transition-colors">
          {account?.arabic_name ?? '...'}
        </Link>
        <span>←</span>
        <span className="text-text-primary font-medium">إيداع</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">إيداع أموال</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تسجيل إيداع يدوي في حساب{account ? ` "${account.arabic_name}"` : ''}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            المبلغ <span className="text-danger">*</span>
          </label>
          <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background-secondary focus-within:border-primary focus-within:bg-white">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              placeholder="0.00"
              dir="ltr"
            />
            <span className="border-r border-border bg-background-secondary px-3 py-2.5 text-xs font-medium text-text-secondary">
              {account?.currency ?? 'EGP'}
            </span>
          </div>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            تاريخ الإيداع <span className="text-danger">*</span>
          </label>
          <DatePicker
            value={form.transaction_date}
            onChange={val => set('transaction_date', val)}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            البيان / ملاحظات <span className="text-text-secondary font-normal text-xs">(اختياري)</span>
          </label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white resize-none"
            placeholder="مثال: إيداع إيراد مشروع الخليج"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/company/treasury/${accountId}`}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جارٍ الحفظ...' : '+ تسجيل الإيداع'}
          </button>
        </div>
      </form>
    </div>
  )
}
