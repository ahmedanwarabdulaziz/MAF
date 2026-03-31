'use client'

import { useState } from 'react'
import { getPaymentVoucherDetails } from '@/actions/payments'

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

export default function ViewPaymentVoucherModal({ voucherId }: { voucherId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [voucher, setVoucher] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setIsOpen(true)
    if (!voucher) {
      setLoading(true)
      try {
        const data = await getPaymentVoucherDetails(voucherId)
        setVoucher(data)
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
  }

  const partyRecord = voucher?.parties ? (Array.isArray(voucher.parties) ? voucher.parties[0] : voucher.parties) : null
  const allocations = partyRecord?.allocations || []

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="عرض المستند"
        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.05)_inset]"
      >
        <EyeIcon />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10" dir="rtl">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">تفاصيل السند <span className="font-mono text-white/90 text-sm mr-2">{voucher?.voucher_no || '...'}</span></h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right" dir="rtl">
              {loading ? (
                <div className="py-12 text-center text-text-secondary animate-pulse">جاري تحميل بيانات السند...</div>
              ) : !voucher ? (
                <div className="text-sm text-danger text-center">تعذر تحميل تفاصيل السند.</div>
              ) : (
                <div className="space-y-6">
                  {/* Header Banner */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-white shadow-sm p-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-navy" dir="ltr">{voucher.voucher_no}</h1>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                voucher.status === 'posted' ? 'bg-success/10 text-success-dark' : 'bg-text-tertiary/10 text-text-secondary'
                            }`}>
                                {voucher.status === 'posted' ? 'ترحيل محقق' : voucher.status}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">تم الإصدار في {voucher.payment_date} بواسطة {voucher.created_by_user?.display_name || 'النظام'}</p>
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-text-secondary uppercase mb-1">المبلغ الإجمالي</p>
                        <p className="text-3xl font-bold text-navy" dir="ltr">
                            {Number(voucher.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.financial_account?.currency || 'EGP'}
                        </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="rounded-xl border border-border bg-white shadow-sm p-6 overflow-hidden">
                    <h2 className="text-lg font-bold text-navy border-b border-border pb-3 mb-4">بيانات السند</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                        <div>
                            <span className="block text-xs text-text-secondary mb-1">الطرف المستفيد</span>
                            <span className="font-bold text-primary">{partyRecord?.party?.arabic_name || 'مجهول'}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-text-secondary mb-1">جهة الصرف (الخزينة)</span>
                            <span className="font-medium text-text-primary">{voucher.financial_account?.arabic_name || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-text-secondary mb-1">طريقة الدفع</span>
                            <span className="font-medium text-text-primary">
                                {voucher.payment_method === 'cash' ? 'نقداً' : voucher.payment_method === 'cheque' ? 'شيك' : voucher.payment_method === 'bank_transfer' ? 'تحويل' : voucher.payment_method}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs text-text-secondary mb-1">المرجع</span>
                            <span className="font-medium text-text-primary" dir="ltr">{voucher.receipt_reference_no || '-'}</span>
                        </div>
                        <div className="md:col-span-2 bg-background-secondary/50 rounded p-4 text-sm mt-2">
                            <span className="block text-xs text-text-secondary mb-1">ملاحظات والتفاصيل</span>
                            <span className="text-text-primary whitespace-pre-wrap">{voucher.notes || 'لا يوجد'}</span>
                        </div>
                    </div>
                  </div>

                  {/* Allocations Table */}
                  <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-border bg-background-secondary/50 px-6 py-4 flex items-center gap-2">
                        <h2 className="text-lg font-bold text-navy">التوجيه المستندي والمطالبات التي تم إغلاقها</h2>
                    </div>
                    
                    {allocations.length === 0 ? (
                        <div className="p-8 text-center text-sm text-text-secondary">لا توجد توجيهات مسجلة لهذه الدفعة (قد تكون دفعة مقدمة غير مرتبطة بفاتورة).</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-background-secondary border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-text-secondary">البيان</th>
                                        <th className="px-6 py-4 font-semibold text-text-secondary">التاريخ</th>
                                        <th className="px-6 py-4 font-semibold text-text-secondary">المبلغ المخصوم</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {allocations.map((alloc: any) => {
                                        const label = alloc.source_entity_type === 'supplier_invoice' 
                                                        ? `فاتورة توريد #${alloc.supplier_invoices?.invoice_no}`
                                                        : alloc.source_entity_type === 'subcontractor_certificate'
                                                        ? `مستخلص أعمال #${alloc.subcontractor_certificates?.certificate_no}`
                                                        : alloc.source_entity_type
                                        const docDate = alloc.source_entity_type === 'supplier_invoice'
                                                        ? alloc.supplier_invoices?.invoice_date
                                                        : alloc.source_entity_type === 'subcontractor_certificate'
                                                        ? alloc.subcontractor_certificates?.certificate_date
                                                        : null
                                        
                                        return (
                                            <tr key={alloc.id} className="hover:bg-black/5 transition-colors">
                                                <td className="px-6 py-4 font-medium text-text-primary">{label}</td>
                                                <td className="px-6 py-4 text-text-secondary" dir="ltr">{docDate || '-'}</td>
                                                <td className="px-6 py-4 font-bold text-danger" dir="ltr">
                                                    -{Number(alloc.allocated_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-background-secondary/50 border-t border-border">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-4 text-left font-bold text-text-secondary">إجمالي التوزيع المعتمد:</td>
                                        <td className="px-6 py-4 font-bold text-text-primary" dir="ltr">
                                            {allocations.reduce((sum: number, curr: any) => sum + Number(curr.allocated_amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.financial_account?.currency || 'EGP'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
