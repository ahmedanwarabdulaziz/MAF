'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { transferFunds } from '@/actions/treasury'
import DatePicker from '@/components/DatePicker'

export default function NewTransferDialog({ accounts }: { accounts: any[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  // Prevent selecting the same account twice and only show active accounts
  const activeAccounts = accounts.filter(a => a.is_active)
  const availableToAccounts = activeAccounts.filter(a => a.financial_account_id !== formData.from_account_id)

  const selectedFromAccount = activeAccounts.find(a => a.financial_account_id === formData.from_account_id)

  const closeModal = () => {
    if (loading) return
    setIsOpen(false)
    setTimeout(() => {
      setError(null)
      setFormData({
        from_account_id: '',
        to_account_id: '',
        amount: '',
        transfer_date: new Date().toISOString().split('T')[0],
        notes: ''
      })
    }, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (Number(formData.amount) <= 0) {
        setError('يجب أن يكون مبلغ التحويل أكبر من صفر')
        setLoading(false)
        return
    }

    if (selectedFromAccount && Number(formData.amount) > Number(selectedFromAccount.current_balance)) {
        setError('الرصيد غير كافٍ لإتمام هذا التحويل من الحساب المصدر.')
        setLoading(false)
        return
    }

    try {
      await transferFunds({
        from_account_id: formData.from_account_id,
        to_account_id: formData.to_account_id,
        amount: Number(formData.amount),
        transfer_date: formData.transfer_date,
        notes: formData.notes
      })
      router.refresh()
      closeModal()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ التحويل')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors shadow-sm"
      >
        ← تحويل داخلي
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />

          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-navy px-6 py-5 shrink-0 relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">إصدار تحويل مالي داخلي</h2>
                <p className="mt-1 text-sm text-white/80">نقل السيولة بين البنوك وخزائن المشاريع داخل الشركة.</p>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              <form id="transfer-form" onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-md bg-danger/10 p-4 text-sm text-danger border border-danger/20 text-right">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 text-right">
                        <label className="text-sm font-bold text-text-primary">
                            من الحساب (المصدر) *
                        </label>
                        <select
                            required
                            value={formData.from_account_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, from_account_id: e.target.value, to_account_id: prev.to_account_id === e.target.value ? '' : prev.to_account_id }))}
                            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm shadow-sm"
                        >
                            <option value="">-- اختر الحساب المصدر --</option>
                            {activeAccounts.map(acc => (
                                <option key={acc.financial_account_id} value={acc.financial_account_id}>
                                    {acc.arabic_name} {acc.project_id ? `(مشروع: ${acc.project?.arabic_name})` : '(رئيسي)'} - متاح: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5 text-right">
                        <label className="text-sm font-bold text-text-primary">
                            إلى الحساب (المستلم) *
                        </label>
                        <select
                            required
                            value={formData.to_account_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, to_account_id: e.target.value }))}
                            disabled={!formData.from_account_id}
                            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 disabled:bg-background-secondary disabled:cursor-not-allowed focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm shadow-sm"
                        >
                            <option value="">-- اختر الحساب المستلم --</option>
                            {availableToAccounts.map(acc => (
                                <option key={acc.financial_account_id} value={acc.financial_account_id}>
                                    {acc.arabic_name} {acc.project_id ? `(مشروع: ${acc.project?.arabic_name})` : '(رئيسي)'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 text-right">
                        <label className="text-sm font-bold text-text-primary">مبلغ التحويل *</label>
                        <div className="relative">
                            <input
                                type="number"
                                required
                                min="1"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-left text-sm shadow-sm"
                                dir="ltr"
                            />
                            <span className="absolute right-3 top-2.5 text-sm font-medium text-text-secondary bg-white">EGP</span>
                        </div>
                    </div>
                    
                    <div className="space-y-1.5 text-right">
                        <label className="text-sm font-bold text-text-primary">تاريخ التحويل *</label>
                        <DatePicker
                            value={formData.transfer_date}
                            onChange={val => setFormData({ ...formData, transfer_date: val })}
                            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm shadow-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5 text-right">
                    <label className="text-sm font-bold text-text-primary">البيان / ملاحظات *</label>
                    <textarea
                        required
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none text-sm shadow-sm"
                        placeholder="تفاصيل سبب التحويل واعتمادات الإدارة إن وجدت..."
                    />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-white p-4 shrink-0 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.05)]">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </button>
              <button
                form="transfer-form"
                type="submit"
                disabled={loading}
                className="rounded-xl bg-primary px-8 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'جاري التنفيذ...' : 'اعتماد التحويل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
