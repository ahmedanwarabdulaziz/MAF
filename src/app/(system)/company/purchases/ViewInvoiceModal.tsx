'use client'

import { useState, useTransition } from 'react'
import { getCompanyPurchaseInvoice, postCompanyPurchaseInvoice, getCompanyPurchaseReturns } from './actions'
import { useRouter } from 'next/navigation'
import PayInvoiceDialog from './PayInvoiceDialog'
import CompanyPurchaseReturnDialog from './CompanyPurchaseReturnDialog'
import InvoiceAttachmentsButton from './InvoiceAttachmentsButton'

const ViewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  draft:          { label: 'مسودة',       class: 'bg-gray-100 text-gray-700' },
  posted:         { label: 'مُرحَّلة',    class: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'مدفوعة جزئياً', class: 'bg-yellow-100 text-yellow-700' },
  paid:           { label: 'مدفوعة',     class: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'ملغية',       class: 'bg-red-100 text-red-700' },
}

export default function ViewInvoiceModal({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [returns, setReturns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirmApproveOpen, setIsConfirmApproveOpen] = useState(false)
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await getCompanyPurchaseInvoice(id)
      setData(res)
      const retRes = await getCompanyPurchaseReturns(id)
      setReturns(retRes)
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleOpen = () => {
    setIsOpen(true)
    if (!data) {
      fetchData()
    }
  }

  const confirmApprove = () => {
    setIsConfirmApproveOpen(true)
  }

  const executeApprove = () => {
    startTransition(async () => {
      try {
        await postCompanyPurchaseInvoice(id)
        setIsConfirmApproveOpen(false)
        setIsOpen(false)
        router.refresh()
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'حدث خطأ')
      }
    })
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1 text-gray-400 hover:text-blue-600 transition"
        title="عرض التفاصيل"
      >
        <ViewIcon />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border" dir="rtl">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="block w-full text-right">
                <div className="flex items-center justify-start gap-4">
                  <h2 className="text-xl font-bold text-white">
                    {data ? `مراجعة الفاتورة رقم: ${data.invoice_no}` : 'جاري التحميل...'}
                  </h2>
                  {data?.attachment_urls && data.attachment_urls.length > 0 && (
                    <div className="bg-white/10 rounded-lg pr-2">
                       <InvoiceAttachmentsButton urls={data.attachment_urls} />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-sm text-white/80">
                  تفاصيل الفاتورة / المصروف المحددة
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              {isLoading && (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {!isLoading && data && (
                <div className="space-y-6">
                  
                  {/* Info Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-border space-y-3 shadow-sm">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">التاريخ</span>
                        <span className="font-semibold text-gray-900">{data.invoice_date}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">المورد</span>
                        <span className="font-semibold text-gray-900">{data.supplier?.arabic_name || '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{data.invoice_type === 'general_expense' ? 'قسم المصروف' : 'المستودع'}</span>
                        <span className="font-semibold text-gray-900">
                          {data.invoice_type === 'general_expense' 
                            ? data.expense_category?.arabic_name ?? '—'
                            : data.warehouse?.arabic_name ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">الحالة</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[data.status]?.class}`}>
                          {STATUS_LABELS[data.status]?.label}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-border space-y-3 shadow-sm">
                      <div className="flex justify-between text-sm" dir="ltr">
                        <span className="font-semibold text-gray-900">{fmt(data.gross_amount)}</span>
                        <span className="text-gray-500" dir="rtl">الإجمالي</span>
                      </div>
                      <div className="flex justify-between text-sm" dir="ltr">
                        <span className="font-semibold text-gray-900">{fmt(data.tax_amount)}</span>
                        <span className="text-gray-500" dir="rtl">الضريبة</span>
                      </div>
                      <div className="flex justify-between text-sm" dir="ltr">
                        <span className="font-semibold text-gray-900">{fmt(data.discount_amount)}</span>
                        <span className="text-gray-500" dir="rtl">الخصم</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2 mt-2" dir="ltr">
                        <span className="font-bold text-gray-900">{fmt(data.net_amount)}</span>
                        <span className="text-gray-500" dir="rtl">الصافي الأصلي</span>
                      </div>
                      <div className="flex justify-between text-sm" dir="ltr">
                        <span className="font-semibold text-red-600">{fmt(data.returned_amount || 0)}</span>
                        <span className="text-gray-500" dir="rtl">مرتجعات</span>
                      </div>
                      <div className="flex justify-between text-sm" dir="ltr">
                        <span className="font-semibold text-success">{fmt(data.paid_to_date || 0)}</span>
                        <span className="text-gray-500" dir="rtl">المُسدّد</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-navy/10 pt-2 mt-2" dir="ltr">
                        <span className="font-bold text-primary">{fmt(data.outstanding_amount)}</span>
                        <span className="text-gray-500" dir="rtl">الرصيد المتبقي</span>
                      </div>
                    </div>
                  </div>

                  {/* Lines Table */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 text-right">سطور الفاتورة</h3>
                    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr className="text-gray-500">
                            <th className="px-4 py-3 font-medium text-right">الوصف</th>
                            <th className="px-4 py-3 font-medium text-right w-24">الكمية</th>
                            <th className="px-4 py-3 font-medium text-right w-32">السعر</th>
                            <th className="px-4 py-3 font-medium text-right w-32">الصافي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.lines?.map((line: any) => (
                            <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-gray-900">{line.description}</td>
                              <td className="px-4 py-3 text-gray-900">{fmt(line.quantity)}</td>
                              <td className="px-4 py-3 text-gray-900">{fmt(line.unit_price)}</td>
                              <td className="px-4 py-3 font-medium text-primary">{fmt(line.line_net)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Returns Table */}
                  {returns && returns.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-700 mb-3 text-right">إشعارات الخصم / المرتجعات</h3>
                      <div className="bg-red-50/50 border border-red-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-right">
                          <thead className="bg-red-100/50 border-b border-red-100">
                            <tr className="text-red-800">
                              <th className="px-4 py-3 font-medium text-right">رقم المرتجع</th>
                              <th className="px-4 py-3 font-medium text-right">التاريخ</th>
                              <th className="px-4 py-3 font-medium text-right">الإجمالي</th>
                              <th className="px-4 py-3 font-medium text-right">الصافي</th>
                              <th className="px-4 py-3 font-medium text-right">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100/50">
                            {returns.map((ret: any) => (
                              <tr key={ret.id} className="hover:bg-red-50 transition-colors">
                                <td className="px-4 py-3 text-red-900 font-medium">{ret.return_no}</td>
                                <td className="px-4 py-3 text-red-800">{ret.return_date}</td>
                                <td className="px-4 py-3 text-red-800" dir="ltr">{fmt(ret.gross_amount)}</td>
                                <td className="px-4 py-3 font-bold text-red-700" dir="ltr">{fmt(ret.net_amount)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[ret.status]?.class}`}>
                                    {STATUS_LABELS[ret.status]?.label}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {data.notes && (
                    <div className="bg-yellow-50/50 text-yellow-800 p-4 rounded-xl text-sm border border-yellow-100 shadow-sm text-right">
                      <strong className="block mb-1">ملاحظات:</strong> {data.notes}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Actions Footer */}
            {!isLoading && data && (
              <div className="border-t border-navy/10 p-4 bg-muted/30 flex justify-between items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-border bg-white text-gray-700 hover:bg-gray-50 transition font-medium shadow-sm"
                >
                  إغلاق
                </button>
                
                {data.status === 'draft' && (
                  <button
                    onClick={confirmApprove}
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition font-bold disabled:opacity-50 shadow-sm text-sm whitespace-nowrap"
                  >
                    <CheckCircleIcon />
                    {isPending ? 'جاري الاعتماد...' : 'اعتماد وترحيل هذه الفاتورة'}
                  </button>
                )}

                {['posted', 'partially_paid', 'paid'].includes(data.status) && (
                  <button
                    onClick={() => setIsReturnDialogOpen(true)}
                    className="px-6 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition font-medium shadow-sm min-w-max"
                  >
                    إنشاء إشعار مرتجع
                  </button>
                )}

                {['posted', 'partially_paid'].includes(data.status) && Number(data.outstanding_amount) > 0 && (
                  <PayInvoiceDialog 
                    invoiceId={data.id} 
                    maxAmount={Number(data.outstanding_amount)} 
                    invoiceNo={data.invoice_no}
                    asButton={true}
                  />
                )}
              </div>
            )}

            {isReturnDialogOpen && data && (
              <CompanyPurchaseReturnDialog 
                invoice={data} 
                onClose={() => setIsReturnDialogOpen(false)} 
                onSuccess={fetchData} 
              />
            )}

            {/* Confirmation Overlay within the Modal */}
            {isConfirmApproveOpen && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-[2px] rounded-2xl" dir="rtl">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-border">
                  <div className="p-6">
                    <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4 border border-orange-100">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-center text-gray-900 mb-2">تأكيد الاعتماد والترحيل</h3>
                    <p className="text-gray-500 text-sm text-center">
                      هل أنت متأكد من ترحيل هذه الفاتورة المبدئية؟ سيتم تسجيل القيود المالية والمخزنية ولن تتمكن من تعديلها لاحقاً.
                    </p>
                  </div>
                  <div className="border-t border-navy/10 p-4 bg-muted/30 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 border border-border bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm shadow-sm"
                      onClick={() => setIsConfirmApproveOpen(false)}
                      disabled={isPending}
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition disabled:opacity-60 text-sm shadow-sm"
                      onClick={executeApprove}
                      disabled={isPending}
                    >
                      {isPending ? 'جاري الترحيل...' : 'تأكيد واعتماد'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
