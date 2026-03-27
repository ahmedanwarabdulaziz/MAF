'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
)
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)
import { postCompanyPurchaseInvoice, deleteCompanyPurchaseInvoice, payCompanyInvoice } from '../actions'

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  draft:          { label: 'مسودة',          badgeClass: 'bg-gray-100 text-gray-700' },
  posted:         { label: 'مُرحَّلة',       badgeClass: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'مدفوعة جزئياً', badgeClass: 'bg-yellow-100 text-yellow-700' },
  paid:           { label: 'مدفوعة',         badgeClass: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'ملغية',           badgeClass: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  general_expense: 'مصروف عام',
  stock_purchase: 'شراء للمخزن',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function InvoiceDetailClient({ invoice, accounts = [] }: { invoice: any; accounts?: any[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState(invoice.outstanding_amount || 0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')

  const status = STATUS_LABELS[invoice.status] ?? { label: invoice.status, badgeClass: 'bg-gray-100 text-gray-700' }
  const fmt    = (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

  const handlePost = () => {
    setError(null)
    startTransition(async () => {
      try {
        await postCompanyPurchaseInvoice(invoice.id)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في الترحيل')
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    startTransition(async () => {
      try {
        await deleteCompanyPurchaseInvoice(invoice.id)
        router.push('/company/purchases')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في الحذف')
      }
    })
  }

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAccountId) return setError('يرجى اختيار حساب الخزينة/البنك')
    if (payAmount <= 0 || payAmount > invoice.outstanding_amount) return setError('المبلغ المدخل غير صالح')

    setError(null)
    startTransition(async () => {
      try {
        await payCompanyInvoice(invoice.id, {
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          amount: payAmount,
          receipt_reference_no: payRef,
        })
        setShowPayModal(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const contextLabel = invoice.invoice_type === 'general_expense'
    ? invoice.expense_category?.arabic_name ?? '—'
    : invoice.warehouse?.arabic_name ?? '—'

  const canPay = ['posted', 'partially_paid'].includes(invoice.status) && Number(invoice.outstanding_amount) > 0

  return (
    <div className="p-6 space-y-6 max-w-5xl" dir="rtl">

      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/company/purchases')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowRightIcon />
            العودة للفواتير
          </button>
          <h1 className="text-2xl font-bold text-gray-900">فاتورة رقم: {invoice.invoice_no}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{invoice.invoice_date}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${status.badgeClass}`}>
            {status.label}
          </span>
          {invoice.status === 'draft' && (
            <>
              <button
                onClick={handlePost}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <CheckCircleIcon />
                ترحيل الفاتورة
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50 transition"
              >
                <TrashIcon />
              </button>
            </>
          )}
          {canPay && (
            <button
              onClick={() => {
                setPayAmount(invoice.outstanding_amount)
                setShowPayModal(true)
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
            >
              <CheckCircleIcon />
              سداد دفعة
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">بيانات عامة</h2>
          <Row label="المورد"      value={invoice.supplier?.arabic_name} />
          <Row label="النوع"       value={TYPE_LABELS[invoice.invoice_type] ?? invoice.invoice_type} />
          <Row label={invoice.invoice_type === 'general_expense' ? 'قسم المصروف' : 'المستودع'} value={contextLabel} />
          {invoice.branch && <Row label="الفرع" value={invoice.branch.arabic_name} />}
          {invoice.notes && <Row label="ملاحظات" value={invoice.notes} />}
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">ملخص مالي</h2>
          <Row label="الإجمالي"   value={`${fmt(invoice.gross_amount)} ج.م`} />
          {Number(invoice.discount_amount) > 0 && <Row label="الخصم" value={`${fmt(invoice.discount_amount)} ج.م`} cls="text-orange-600" />}
          {Number(invoice.tax_amount) > 0      && <Row label="الضريبة" value={`${fmt(invoice.tax_amount)} ج.م`} cls="text-orange-600" />}
          <div className="border-t pt-2">
            <Row label="الصافي"         value={`${fmt(invoice.net_amount)} ج.م`} bold />
          </div>
          <Row label="المدفوع"           value={`${fmt(invoice.paid_to_date)} ج.م`}      cls="text-green-700" />
          <Row label="المستحق"           value={`${fmt(invoice.outstanding_amount)} ج.م`} cls={Number(invoice.outstanding_amount) > 0 ? 'text-red-700' : 'text-gray-400'} />
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-800">سطور الفاتورة</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-right px-4 py-2 font-medium text-gray-600">الوصف</th>
              {invoice.invoice_type === 'general_expense' && (
                <th className="text-right px-4 py-2 font-medium text-gray-600">القسم</th>
              )}
              {invoice.invoice_type === 'stock_purchase' && (
                <th className="text-right px-4 py-2 font-medium text-gray-600">الصنف</th>
              )}
              <th className="text-left px-4 py-2 font-medium text-gray-600">الكمية</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">السعر</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">المجموع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(invoice.lines ?? []).map((line: any) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{line.description}</td>
                {invoice.invoice_type === 'general_expense' && (
                  <td className="px-4 py-2 text-gray-500">{line.line_category?.arabic_name ?? '—'}</td>
                )}
                {invoice.invoice_type === 'stock_purchase' && (
                  <td className="px-4 py-2 text-gray-500">{line.item?.arabic_name ?? '—'}</td>
                )}
                <td className="px-4 py-2 text-left">{fmt(line.quantity)}</td>
                <td className="px-4 py-2 text-left">{fmt(line.unit_price)}</td>
                <td className="px-4 py-2 text-left font-medium">{fmt(line.line_gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">سداد دفعة للشركة / المورد</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حساب السداد (الخزينة/البنك) *</label>
                <select
                  required
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- اختر الحساب --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.financial_account_id}>
                      {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {Number(acc.current_balance).toLocaleString()} {acc.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.outstanding_amount}
                    required
                    dir="ltr"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ السداد *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع *</label>
                  <select
                    required
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="cash">نقدي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم مرجعي / شيك</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-lg border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جاري السداد...' : 'تأكيد السداد'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  disabled={isPending}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, cls }: { label: string; value: string; bold?: boolean; cls?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold text-base' : 'font-medium'} ${cls ?? 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
