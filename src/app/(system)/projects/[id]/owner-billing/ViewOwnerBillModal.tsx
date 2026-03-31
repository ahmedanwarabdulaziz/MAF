'use client'

import React, { useState, useEffect } from 'react'
import { getOwnerBillingDetails, updateOwnerBillingStatus } from '@/actions/owner_billing'
import { useRouter } from 'next/navigation'

// Inline SVG Icons to replace lucide-react
const XIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

const EditIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
)


export default function ViewOwnerBillModal({ 
  isOpen, 
  onClose, 
  docId, 
  projectId,
  onEdit
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  docId: string | null,
  projectId: string,
  onEdit: () => void
}) {
  const router = useRouter()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)

  useEffect(() => {
    if (isOpen && docId) {
      setLoading(true)
      getOwnerBillingDetails(docId)
        .then((data) => {
          setDoc(data)
        })
        .catch((err) => {
          setNotification({ type: 'error', message: 'حدث خطأ أثناء جلب تفاصيل الفاتورة' })
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setDoc(null)
    }
  }, [isOpen, docId])

  if (!isOpen) return null

  const handleApproveClick = () => {
    if (!docId) return
    setConfirmApproveOpen(true)
  }

  const confirmApprove = async () => {
    if (!docId) return

    try {
      setApproving(true)
      await updateOwnerBillingStatus(docId, 'approved', projectId)
      setNotification({ type: 'success', message: 'تم اعتماد الفاتورة وتغيير حالتها بنجاح' })
      router.refresh()
      onClose()
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'حدث خطأ غير معروف' })
    } finally {
      setApproving(false)
      setConfirmApproveOpen(false)
    }
  }

  const ownerName = doc?.owner ? (Array.isArray(doc.owner) ? doc.owner[0]?.arabic_name : doc.owner?.arabic_name) : ''
  const projectName = doc?.project ? (Array.isArray(doc.project) ? doc.project[0]?.arabic_name : doc.project?.arabic_name) : ''

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 text-right dir-rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-border">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-primary/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FileTextIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy">تفاصيل المطالبة (فاتورة مالك)</h2>
              <p className="text-sm text-text-secondary">{doc?.document_no || 'جاري التحميل...'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-background-secondary text-text-secondary transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-text-secondary flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
              جاري تحميل التفاصيل...
            </div>
          ) : !doc ? (
            <div className="py-12 text-center text-text-secondary">التفاصيل غير متاحة أو الفاتورة محذوفة.</div>
          ) : (
            <>
              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-background-secondary p-4 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">حالة الفاتورة</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                    doc.status === 'approved' ? 'bg-success/10 text-success' : 
                    doc.status === 'paid' ? 'bg-purple-100 text-purple-700' :
                    doc.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                    'bg-text-tertiary/20 text-text-primary'
                  }`}>
                    {doc.status === 'draft' ? 'مسودة' :
                     doc.status === 'submitted' ? 'مقدمة' :
                     doc.status === 'approved' ? 'معتمدة - قيد التحصيل' :
                     doc.status === 'paid' ? 'محصلة' :
                     doc.status === 'cancelled' ? 'ملغاة' : doc.status}
                  </span>
                </div>
                <div className="bg-background-secondary p-4 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">المالك</span>
                  <p className="font-semibold text-text-primary truncate">{ownerName || 'غير محدد'}</p>
                </div>
                <div className="bg-background-secondary p-4 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">تاريخ المطالبة</span>
                  <p className="font-semibold text-navy dir-ltr text-right">{doc.billing_date}</p>
                </div>
                <div className="bg-background-secondary p-4 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">الصافي المطلوب</span>
                  <p className="font-bold text-primary dir-ltr text-right">
                    {doc.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-3">بنود المطالبة المرفوعة</h3>
                <div className="rounded-xl border border-border overflow-hidden bg-white">
                  <div className="overflow-x-auto hide-scrollbar">
                    {doc.lines?.length === 0 ? (
                      <div className="py-6 text-center text-sm text-text-secondary">لا توجد بنود.</div>
                    ) : (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="px-3 py-3 font-semibold text-text-secondary w-1/3">البيان</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-center w-24">الكمية السابقة</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-center w-24">الحالية</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-center w-24">الإجمالي/التراكمي</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-center w-24">سعر المالك</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-center w-32">المبلغ (Net)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {doc.lines?.map((line: any) => (
                            <tr key={line.id} className="hover:bg-background-secondary/40">
                              <td className="px-3 py-3">
                                <p className="font-medium text-text-primary leading-tight">
                                  {line.override_description || line.line_description}
                                </p>
                                {line.is_material_on_site && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    تشوينات موقع
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-text-secondary dir-ltr text-center font-mono">
                                {line.previous_quantity?.toLocaleString() || 0}
                              </td>
                              <td className="px-3 py-3 text-primary font-bold dir-ltr text-center font-mono bg-primary/5">
                                {line.quantity?.toLocaleString() || 0}
                              </td>
                              <td className="px-3 py-3 text-text-secondary dir-ltr text-center font-mono">
                                {line.cumulative_quantity?.toLocaleString() || 0}
                              </td>
                              <td className="px-3 py-3 text-text-secondary dir-ltr text-center">
                                {line.unit_price?.toLocaleString()}
                              </td>
                              <td className="px-3 py-3 text-navy font-bold dir-ltr text-center bg-navy/5">
                                {line.line_net?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Totals Summary */}
              {doc.notes && (
                <div className="bg-background-secondary/50 p-4 rounded-xl text-sm border border-border">
                  <span className="font-semibold text-text-primary block mb-1">ملاحظات</span>
                  <p className="text-text-secondary">{doc.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-background-secondary flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors"
          >
            إغلاق النافذة
          </button>
          
          <div className="flex gap-3">
            {doc && (doc.status === 'draft' || doc.status === 'submitted') && (
              <>
                <button
                  onClick={() => {
                    onClose()
                    onEdit()
                  }}
                  className="px-5 py-2.5 rounded-xl font-medium text-navy bg-navy/10 hover:bg-navy/20 transition-colors flex items-center gap-2"
                >
                  <EditIcon className="w-4 h-4" />
                  تعديل المطالبة
                </button>
                <button
                  onClick={handleApproveClick}
                  disabled={approving}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {approving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckIcon className="w-5 h-5" />
                  )}
                  اعتماد نهائي
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmApproveOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right dir-rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-navy mb-2 flex items-center gap-2">
              <CheckIcon className="w-6 h-6 text-success" />
              تأكيد اعتماد الفاتورة
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              هل أنت متأكد من اعتماد وحفظ هذه الفاتورة بشكل نهائي؟ (بمجرد الاعتماد، لا يمكن التراجع أو تعديل الفاتورة).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmApproveOpen(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm"
                disabled={approving}
              >
                تراجع
              </button>
              <button
                onClick={confirmApprove}
                disabled={approving}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 transition-colors flex items-center justify-center gap-2 min-w-[130px] text-sm"
              >
                {approving ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'تأكيد الاعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right dir-rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 ${notification.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {notification.type === 'success' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'success' ? 'عملية ناجحة' : 'حدث خطأ'}
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              {notification.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setNotification(null)}
                className={`px-5 py-2.5 rounded-xl font-bold text-white transition-colors flex items-center justify-center min-w-[100px] text-sm ${
                  notification.type === 'success' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'
                }`}
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
