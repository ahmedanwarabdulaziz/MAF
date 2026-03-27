'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { payCompanyInvoice } from '../../actions'

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  draft:          { label: 'مسودة',          badgeClass: 'bg-gray-100 text-gray-700' },
  posted:         { label: 'مُرحَّلة',       badgeClass: 'bg-blue-100 text-blue-700' },
  pending_receipt:{ label: 'انتظار استلام',  badgeClass: 'bg-orange-100 text-orange-700' },
  partially_paid: { label: 'مدفوعة جزئياً', badgeClass: 'bg-yellow-100 text-yellow-700' },
  paid:           { label: 'مدفوعة',         badgeClass: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'ملغية',           badgeClass: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  general_expense: 'مصروف عام',
  stock_purchase: 'شراء للمخزن',
}

export default function VendorStatementClient({ party, companyInvoices, projectInvoices, accounts }: { party: any; companyInvoices: any[]; projectInvoices: any[]; accounts: any[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Payment Modal State
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')

  const fmt = (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

  // Summary Metrics (Combo)
  const computeMetrics = (list: any[]) => list.reduce((acc, inv) => {
    if (['posted', 'partially_paid', 'paid'].includes(inv.status)) {
      acc.total_gross += Number(inv.gross_amount)
      acc.total_net += Number(inv.net_amount)
      acc.total_paid += Number(inv.paid_to_date)
      acc.total_outstanding += Number(inv.outstanding_amount)
    }
    return acc
  }, { total_gross: 0, total_net: 0, total_paid: 0, total_outstanding: 0 })

  const compMetrics = computeMetrics(companyInvoices)
  const projMetrics = computeMetrics(projectInvoices)

  const summary = {
    total_net: compMetrics.total_net + projMetrics.total_net,
    total_paid: compMetrics.total_paid + projMetrics.total_paid,
    total_outstanding: compMetrics.total_outstanding + projMetrics.total_outstanding,
  }

  // Group Project Invoices by Project
  const projectsGroup = useMemo(() => {
    const groups: Record<string, any[]> = {}
    projectInvoices.forEach(inv => {
      const pName = inv.project?.arabic_name || 'مشروع غير معروف'
      if (!groups[pName]) groups[pName] = []
      groups[pName].push(inv)
    })
    return groups
  }, [projectInvoices])

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payInvoiceId) return
    if (!payAccountId) return setError('يرجى اختيار حساب الخزينة/البنك')
    
    const maxAmt = companyInvoices.find(i => i.id === payInvoiceId)?.outstanding_amount || 0
    if (payAmount <= 0 || payAmount > maxAmt) return setError('المبلغ المدخل غير صالح')

    setError(null)
    startTransition(async () => {
      try {
        await payCompanyInvoice(payInvoiceId, {
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          amount: payAmount,
          receipt_reference_no: payRef,
        })
        setPayInvoiceId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const selectedInvoiceAmount = payInvoiceId ? companyInvoices.find(i => i.id === payInvoiceId)?.outstanding_amount : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/company/purchases/suppliers" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              العودة لقائمة الموردين
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-navy border-b-2 border-primary pb-2 inline-block">
            {party.arabic_name}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">{party.email ? `${party.email} | ` : ''}الهاتف: {party.phone || 'غير مسجل'}</p>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-lg border border-danger/20 text-sm">
          {error}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-sm font-semibold text-text-secondary mb-1">إجمالي الفواتير المعتمدة (مجمع)</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{fmt(summary.total_net)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-success">
          <p className="text-sm font-semibold text-text-secondary mb-1">إجمالي المسدد (مجمع)</p>
          <p className="text-2xl font-black text-success dir-ltr text-right">{fmt(summary.total_paid)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-danger">
          <p className="text-sm font-semibold text-text-secondary mb-1">الرصيد المستحق (مجمع)</p>
          <p className="text-2xl font-black text-danger dir-ltr text-right">{fmt(summary.total_outstanding)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-sm font-semibold text-text-secondary mb-1">عدد الفواتير الكلي</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{companyInvoices.length + projectInvoices.length}</p>
        </div>
      </div>

      <p className="text-sm text-text-tertiary">يعرض هذا الكشف الفواتير منفصلة لكل قطاع ومشروع لتسهيل متابعة المديونيات المركزية.</p>

      {/* Corporate Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
        <div className="px-5 py-4 border-b bg-background-secondary flex items-center justify-between">
          <h2 className="font-bold text-navy text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary mx-1"></span>
            فواتير ومشتريات الشركة الرئيسية
          </h2>
          <span className="text-xs bg-white border border-border px-2 py-1 rounded text-text-secondary">يعرض مدفوعات الخزينة الرئيسية</span>
        </div>
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
              <th className="px-4 py-3 font-semibold">التاريخ</th>
              <th className="px-4 py-3 font-semibold">النوع / القسم</th>
              <th className="px-4 py-3 font-semibold">الإجمالي</th>
              <th className="px-4 py-3 font-semibold">المسدد</th>
              <th className="px-4 py-3 font-semibold">المتبقي</th>
              <th className="px-4 py-3 font-semibold text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companyInvoices.map((inv) => {
              const status = STATUS_LABELS[inv.status] || { label: inv.status, badgeClass: 'bg-gray-100 text-gray-700' }
              const canPay = ['posted', 'partially_paid'].includes(inv.status) && Number(inv.outstanding_amount) > 0
              const contextLabel = inv.invoice_type === 'general_expense' 
                ? (inv.expense_category?.arabic_name ?? '—') 
                : (inv.warehouse?.arabic_name ?? '—')

              return (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-primary">
                    <Link href={`/company/purchases/${inv.id}`}>{inv.invoice_no}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dir-ltr text-right">{inv.invoice_date}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 font-medium">{TYPE_LABELS[inv.invoice_type]}</div>
                    <div className="text-xs text-text-tertiary">{contextLabel}</div>
                  </td>
                  <td className="px-4 py-3 dir-ltr text-right">{fmt(inv.net_amount)}</td>
                  <td className="px-4 py-3 text-success font-medium dir-ltr text-right">{fmt(inv.paid_to_date)}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 dir-ltr text-right">
                     <span className={Number(inv.outstanding_amount) > 0 ? 'text-danger' : 'text-gray-500'}>
                        {fmt(inv.outstanding_amount)}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${status.badgeClass}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                    {canPay && (
                      <button
                        onClick={() => {
                          setPayInvoiceId(inv.id)
                          setPayAmount(inv.outstanding_amount)
                          setPayAccountId('')
                          setPayRef('')
                          setError(null)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded text-xs font-bold hover:bg-success/20 transition-colors shadow-sm"
                      >
                        سداد الدفعة
                      </button>
                    )}
                    <Link
                      href={`/company/purchases/${inv.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-text-primary bg-white hover:bg-background-secondary text-xs font-bold transition-colors"
                    >
                      التفاصيل
                    </Link>
                  </td>
                </tr>
              )
            })}
            {companyInvoices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">لا توجد فواتير للشركة الرئيسية مبنية على هذا المورد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Project Invoices Lists */}
      {Object.entries(projectsGroup).map(([projectName, prjInvoices]) => (
        <div key={projectName} className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="px-5 py-4 border-b bg-amber-50/30 flex items-center justify-between">
            <h2 className="font-bold text-amber-900 text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 mx-1"></span>
              فواتير مشروع: {projectName}
            </h2>
            <span className="text-xs bg-white border border-border px-2 py-1 rounded text-text-secondary">تسدد الفواتير من خزائن المشروع</span>
          </div>
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
                <th className="px-4 py-3 font-semibold">تاريخ المطالبة</th>
                <th className="px-4 py-3 font-semibold">الإجمالي</th>
                <th className="px-4 py-3 font-semibold">المسدد</th>
                <th className="px-4 py-3 font-semibold">المتبقي</th>
                <th className="px-4 py-3 font-semibold text-center">حالة الفحص / المخزن</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prjInvoices.map((inv) => {
                const status = STATUS_LABELS[inv.status] || { label: inv.status, badgeClass: 'bg-gray-100 text-gray-700' }
                
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-amber-700">
                      {inv.invoice_no}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dir-ltr text-right">{inv.invoice_date}</td>
                    <td className="px-4 py-3 dir-ltr text-right">{fmt(inv.net_amount)}</td>
                    <td className="px-4 py-3 text-success font-medium dir-ltr text-right">{fmt(inv.paid_to_date)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 dir-ltr text-right">
                       <span className={Number(inv.outstanding_amount) > 0 ? 'text-danger' : 'text-gray-500'}>
                          {fmt(inv.outstanding_amount)}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                      <Link
                        href={`/projects/${inv.project_id}/procurement/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-text-primary bg-white hover:bg-background-secondary text-xs font-bold transition-colors"
                      >
                        عرض الفاتورة أو دفعها
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Payment Modal for Company Invoices */}
      {payInvoiceId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">سداد الفاتورة (خزينة الشركة الرئيسية)</h3>
              <button 
                onClick={() => setPayInvoiceId(null)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-5">
              
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex justify-between items-center text-sm">
                <span className="text-gray-600">المبلغ المستحق كحد أقصى:</span>
                <span className="font-bold text-blue-700 dir-ltr text-right">{fmt(selectedInvoiceAmount || 0)} ج.م</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حساب السداد (الخزينة/البنك) *</label>
                <select
                  required
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- اختر الحساب الذي سيتم الدفع منه --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.financial_account_id}>
                      {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {fmt(acc.current_balance)} {acc.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المراد سداده *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoiceAmount}
                    required
                    dir="ltr"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-medium text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ السداد *</label>
                  <input
                    type="date"
                    required
                    dir="ltr"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-right"
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
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
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
                    placeholder="اختياري"
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-right"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-primary text-white rounded-lg py-2.5 font-bold hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جاري السداد وتحديث الأرصدة...' : 'تأكيد السداد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayInvoiceId(null)}
                  disabled={isPending}
                  className="px-5 py-2.5 border border-border rounded-lg text-text-primary hover:bg-background-secondary font-bold transition"
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
