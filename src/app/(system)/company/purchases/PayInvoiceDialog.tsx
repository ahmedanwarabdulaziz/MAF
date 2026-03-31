'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { payCompanyInvoice } from './actions'
import { getTreasuryAccounts } from '@/actions/treasury'

const PayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function PayInvoiceDialog({ invoiceId, maxAmount, invoiceNo, asButton = false }: { invoiceId: string, maxAmount: number, invoiceNo: string, asButton?: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [accounts, setAccounts] = useState<any[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)

  const [payAmount, setPayAmount] = useState(maxAmount)
  const [payAccountId, setPayAccountId] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')

  const openModal = async () => {
    setIsOpen(true)
    setPayAmount(maxAmount)
    if (accounts.length === 0) {
      setIsLoadingAccounts(true)
      try {
        const accs = await getTreasuryAccounts()
        setAccounts(accs)
      } catch (err) {
        console.error(err)
      }
      setIsLoadingAccounts(false)
    }
  }

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAccountId) return setError('يرجى اختيار حساب الخزينة/البنك')
    if (payAmount <= 0 || payAmount > maxAmount) return setError('المبلغ المدخل غير صالح (تجاوز المستحق)')

    setError(null)
    startTransition(async () => {
      try {
        await payCompanyInvoice(invoiceId, {
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          amount: payAmount,
          receipt_reference_no: payRef,
        })
        setIsOpen(false)
        router.refresh()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  return (
    <>
      {asButton ? (
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-bold shadow-sm text-sm whitespace-nowrap"
        >
          <PayIcon />
          تسجيل سداد دفعة
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="p-1 text-gray-400 hover:text-emerald-600 transition"
          title="سداد دفعة"
        >
          <PayIcon />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border flex flex-col">
            
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="block w-full text-right">
                <h3 className="font-bold text-white text-lg">سداد فاتورة: {invoiceNo}</h3>
                <p className="text-sm text-white/80 mt-0.5">تسجيل دفعة من الخزينة</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePay} className="p-6 space-y-5 bg-background text-right">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>
              )}

              {isLoadingAccounts ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">حساب السداد (الخزينة/البنك) *</label>
                    <select
                      required
                      value={payAccountId}
                      onChange={e => setPayAccountId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.financial_account_id}>
                          {acc.arabic_name} - متاح: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">المبلغ (ج.م) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxAmount}
                        required
                        dir="ltr"
                        value={payAmount}
                        onChange={e => setPayAmount(Number(e.target.value))}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ السداد *</label>
                      <input
                        type="date"
                        required
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع *</label>
                      <select
                        required
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value)}
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                      >
                        <option value="cash">نقدي</option>
                        <option value="bank_transfer">تحويل بنكي</option>
                        <option value="cheque">شيك</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم مرجعي / شيك</label>
                      <input
                        type="text"
                        value={payRef}
                        onChange={e => setPayRef(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none text-right"
                        placeholder="اختياري"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-border pt-5 mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2.5 border border-border bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm shadow-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending || isLoadingAccounts}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                >
                  {isPending ? 'جاري السداد...' : 'تأكيد السداد المنصرف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
