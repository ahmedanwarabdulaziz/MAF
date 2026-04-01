'use client'

import { useState } from 'react'
import Link from 'next/link'
import ViewPaymentVoucherModal from './ViewPaymentVoucherModal'
import AdvancePaymentModal from './AdvancePaymentModal'
import { useRouter } from 'next/navigation'

// نحول الصفحة لـ client component عشان نفتح الـ modal
export default function ProjectPaymentsPage({ params, vouchers }: { params: { id: string }; vouchers: any[] }) {
  const router = useRouter()
  const [showAdvance, setShowAdvance] = useState(false)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':  return 'مسودة'
      case 'posted': return 'مرحّل / مدفوع'
      case 'cancelled': return 'ملغى'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':     return 'bg-amber-100 text-amber-800'
      case 'posted':    return 'bg-success/10 text-success-dark'
      case 'cancelled': return 'bg-danger/10 text-danger'
      default: return 'bg-text-tertiary/10 text-text-secondary'
    }
  }

  const getPaymentTypeBadge = (type: string) => {
    if (type === 'advance') return (
      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-300 mr-1">
        مقدمة
      </span>
    )
    return null
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">سجلات الصرف والمدفوعات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            مستندات الصرف والدفع الخاصة بهذا المشروع من جميع الخزائن أو الحسابات.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdvance(true)}
            className="rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-800 px-4 py-2 text-sm font-semibold hover:bg-amber-100 transition-colors flex items-center gap-2"
          >
            <span className="text-lg">💰</span> دفعة مقدمة
          </button>
          <Link
            href={`/projects/${params.id}/payments/queue`}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 transition-colors"
          >
            الاستحقاقات المعلقة
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {!vouchers || vouchers.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary bg-background-secondary">
            لا توجد سجلات صرف مسجلة لهذا المشروع بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-text-secondary">رقم الإذن</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">تاريخ الدفع</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المستفيد</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">خزينة / حساب الصرف</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المبلغ</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">المرجع</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">الحالة</th>
                  <th className="px-6 py-4 w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vouchers.map((voucher: any) => {
                  const party = Array.isArray(voucher.parties) ? voucher.parties[0]?.party : voucher.parties?.party

                  return (
                    <tr key={voucher.id} className="hover:bg-background-secondary transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary" dir="ltr">
                        {getPaymentTypeBadge(voucher.payment_type)}
                        {voucher.voucher_no}
                      </td>
                      <td className="px-6 py-4 text-text-secondary" dir="ltr">{voucher.payment_date || '-'}</td>
                      <td className="px-6 py-4 font-semibold text-primary">{party?.arabic_name || '-'}</td>
                      <td className="px-6 py-4 text-text-secondary">{voucher.financial_account?.arabic_name || '-'}</td>
                      <td className="px-6 py-4 font-bold text-text-primary" dir="ltr">
                        {Number(voucher.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.financial_account?.currency || 'EGP'}
                      </td>
                      <td className="px-6 py-4 text-text-secondary whitespace-nowrap" dir="ltr">
                        <span className="text-xs uppercase bg-black/5 px-2 py-0.5 rounded">{voucher.payment_method}</span> {voucher.receipt_reference_no}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(voucher.status)}`}>
                          {getStatusLabel(voucher.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ViewPaymentVoucherModal voucherId={voucher.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdvancePaymentModal
        projectId={params.id}
        isOpen={showAdvance}
        onClose={() => { setShowAdvance(false); router.refresh() }}
      />
    </div>
  )
}
