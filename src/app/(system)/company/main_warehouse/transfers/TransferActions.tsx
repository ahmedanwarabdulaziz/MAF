'use client'

import { useState, useTransition } from 'react'
import { dispatchTransfer, receiveTransfer } from '@/actions/warehouse'

function ActionIconButton({ onClick, disabled, loading, icon, title, bgClass, textClass }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`p-1.5 rounded-lg transition-colors border border-transparent shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${bgClass} ${textClass} hover:border-current`}
      title={title}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon}
    </button>
  )
}

export function TransferActions({ transfer }: { transfer: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  
  const [confirmAction, setConfirmAction] = useState<'dispatch' | 'receive' | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    setError('')
    startTransition(async () => {
      try {
        if (confirmAction === 'dispatch') {
          await dispatchTransfer(transfer.id)
        } else if (confirmAction === 'receive') {
          await receiveTransfer(transfer.id)
        }
        if (isOpen) setIsOpen(false)
        setIsConfirmOpen(false)
      } catch (err: any) {
        setError(err.message || 'فشل العملية')
        if (!isOpen) alert(err.message || 'فشل العملية')
      }
    })
  }

  const promptAction = (action: 'dispatch' | 'receive') => {
    setConfirmAction(action)
    setIsConfirmOpen(true)
  }

  const src = Array.isArray(transfer.source) ? transfer.source[0] : transfer.source
  const dst = Array.isArray(transfer.destination) ? transfer.destination[0] : transfer.destination

  return (
    <>
      <div className="flex items-center gap-2">
        {transfer.status === 'draft' && (
          <ActionIconButton
            onClick={() => promptAction('dispatch')}
            loading={isPending}
            title="صرف الشحنة"
            bgClass="hover:bg-orange-100"
            textClass="text-orange-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            }
          />
        )}
        {transfer.status === 'dispatched' && (
          <ActionIconButton
            onClick={() => promptAction('receive')}
            loading={isPending}
            title="تأكيد الاستلام"
            bgClass="hover:bg-green-100"
            textClass="text-green-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            }
          />
        )}
        <ActionIconButton
          onClick={() => setIsOpen(true)}
          title="تفاصيل الإذن"
          bgClass="hover:bg-blue-50"
          textClass="text-blue-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0">
              <div className="text-right w-full" dir="rtl">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-blue-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  تفاصيل إذن التحويل
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border bg-white/10 ${
                    transfer.status === 'confirmed' ? 'text-green-300 border-green-400/30' : 
                    transfer.status === 'dispatched' ? 'text-blue-300 border-blue-400/30' : 
                    transfer.status === 'draft' ? 'text-orange-300 border-orange-400/30' : 'text-gray-300 border-gray-400/30'
                  }`}>
                    {transfer.status === 'confirmed' ? 'تم الاستلام' : transfer.status === 'dispatched' ? 'جاري النقل' : transfer.status === 'draft' ? 'مسودة' : 'ملغي'}
                  </span>
                </h2>
                <p className="text-sm text-white/75 mt-0.5" dir="ltr">{transfer.document_no}</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute left-5 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30" dir="rtl">
              <div className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div className="text-xs text-text-secondary mb-1">تاريخ التحويل</div>
                    <div className="font-semibold text-text-primary">{transfer.transfer_date}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div className="text-xs text-text-secondary mb-1">من مخزن (المنصرف)</div>
                    <div className="font-bold text-orange-600 truncate" title={src?.arabic_name}>{src?.arabic_name || '-'}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div className="text-xs text-text-secondary mb-1">إلى مخزن (المستلم)</div>
                    <div className="font-bold text-green-600 truncate" title={dst?.arabic_name}>{dst?.arabic_name || '-'}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div className="text-xs text-text-secondary mb-1">منشئ الطلب</div>
                    <div className="font-semibold text-text-primary truncate" title={Array.isArray(transfer.creator) ? transfer.creator[0]?.display_name : transfer.creator?.display_name}>
                      {Array.isArray(transfer.creator) ? transfer.creator[0]?.display_name : transfer.creator?.display_name || 'غير معروف'}
                    </div>
                  </div>
                </div>

                {transfer.notes && (
                  <div className="bg-background-secondary p-4 rounded-xl border border-border text-sm">
                    <span className="font-bold ml-2 text-text-secondary">ملاحظات التحويل:</span>
                    {transfer.notes}
                  </div>
                )}

                {/* Lines Table */}
                <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-background-secondary">
                    <h3 className="font-bold text-sm text-text-primary">الأصناف المحولة</h3>
                  </div>
                  <table className="w-full text-sm flex-1">
                    <thead>
                      <tr className="border-b border-border bg-gray-50 text-xs text-gray-500">
                        <th className="px-5 py-3 font-semibold w-1/4 text-left">كود الصنف</th>
                        <th className="px-5 py-3 font-semibold w-2/4 text-right">اسم الصنف</th>
                        <th className="px-5 py-3 font-semibold w-1/4 text-left">الكمية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(transfer.lines) ? transfer.lines.map((line: any) => {
                        const item = Array.isArray(line.item) ? line.item[0] : line.item
                        const unit = Array.isArray(line.unit) ? line.unit[0] : line.unit
                        return (
                          <tr key={line.id} className="border-b border-border/50 hover:bg-gray-50/50">
                            <td className="px-5 py-3 font-mono text-xs text-primary text-left" dir="ltr">{item?.item_code || '-'}</td>
                            <td className="px-5 py-3 font-medium text-right">{item?.arabic_name || '-'}</td>
                            <td className="px-5 py-3 font-bold text-left text-blue-600 whitespace-nowrap" dir="ltr">
                              {Number(line.quantity).toLocaleString()} <span className="text-xs font-normal text-text-secondary pr-1">{unit?.arabic_name || ''}</span>
                            </td>
                          </tr>
                        )
                      }) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 bg-gray-50 flex justify-between shrink-0" dir="rtl">
              <div className="flex gap-2">
                {transfer.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => promptAction('dispatch')}
                    disabled={isPending}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPending ? 'جاري الصرف...' : 'صرف الشحنة (إصدار)'}
                  </button>
                )}
                {transfer.status === 'dispatched' && (
                  <button
                    type="button"
                    onClick={() => promptAction('receive')}
                    disabled={isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-green-700 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPending ? 'جاري التحديث...' : 'استلام الشحنة'}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-white border border-border rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {isConfirmOpen && confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center border border-border">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${confirmAction === 'receive' ? 'bg-green-100' : 'bg-orange-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-6 h-6 ${confirmAction === 'receive' ? 'text-green-600' : 'text-orange-600'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmAction === 'dispatch' ? 'تأكيد صرف الشحنة' : 'تأكيد الاستلام بالمخزن'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmAction === 'dispatch' 
                ? 'هل أنت متأكد من صرف الأصناف؟ سيتم خصم الرصيد من المخزن المرسل وتصبح الشحنة في الطريق.'
                : 'هل أنت متأكد من استلام الشحنة كاملة وسليمة؟ سيتم إضافة الأرصدة للمخزن المستلم بشكل نهائي ولا يمكن التراجع.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-transparent"
                disabled={isPending}
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isPending}
                className={`px-6 py-2 text-white rounded-lg text-sm font-bold transition-colors shadow flex items-center gap-2 disabled:opacity-50 ${confirmAction === 'receive' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}`}
              >
                {isPending && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isPending ? 'جاري التنفيذ...' : (confirmAction === 'dispatch' ? 'نعم، صرف من الرصيد' : 'نعم، استلام في المخزن')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
