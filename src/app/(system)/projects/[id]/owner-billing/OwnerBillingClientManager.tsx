'use client'

import React, { useState } from 'react'
import CreateOwnerBillModal from './CreateOwnerBillModal'
import ViewOwnerBillModal from './ViewOwnerBillModal'
import { updateOwnerBillingStatus } from '@/actions/owner_billing'
import { useRouter } from 'next/navigation'

export default function OwnerBillingClientManager({ documents, projectId }: { documents: any[], projectId: string }) {
  const router = useRouter()
  
  const [viewDocId, setViewDocId] = useState<string | null>(null)
  
  const [editDocId, setEditDocId] = useState<string | null>(null)
  const [isUpsertOpen, setIsUpsertOpen] = useState(false)
  const [approvingDocId, setApprovingDocId] = useState<string | null>(null)

  const [confirmApproveDocId, setConfirmApproveDocId] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)

  const hasUnapprovedInvoice = documents?.some((doc) => doc.status === 'draft' || doc.status === 'submitted') || false

  const handleOpenCreate = () => {
    if (hasUnapprovedInvoice) {
      setShowWarning(true)
      return
    }
    setEditDocId(null)
    setIsUpsertOpen(true)
  }

  const handleApproveClick = (docId: string) => {
    setConfirmApproveDocId(docId)
  }

  const confirmApprove = async () => {
    if (!confirmApproveDocId) return
    try {
      setApprovingDocId(confirmApproveDocId)
      await updateOwnerBillingStatus(confirmApproveDocId, 'approved', projectId)
      setNotification({ type: 'success', message: 'تم اعتماد الفاتورة وتغيير حالتها بنجاح' })
      router.refresh()
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'حدث خطأ غير معروف' })
    } finally {
      setApprovingDocId(null)
      setConfirmApproveDocId(null)
    }
  }

  // Icons
  const EyeIcon = ({ className }: { className?: string }) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">فواتير ومستخلصات المالك</h1>
          <p className="mt-1 text-sm text-text-secondary">
            متابعة الفواتير المصدرة للمالك وحالتها المالية.
          </p>
        </div>
        <button
            onClick={handleOpenCreate}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all flex items-center gap-2 ${
              hasUnapprovedInvoice 
                ? 'bg-background-secondary text-text-tertiary border border-border shadow-none hover:bg-black/5' 
                : 'bg-primary text-white shadow-sm hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5'
            }`}
        >
            + إعداد فاتورة للمالك
        </button>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto hide-scrollbar">
          {documents?.length === 0 ? (
            <div className="py-12 text-center text-text-secondary">لا توجد فواتير مصدرة للمالك بعد.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-semibold text-text-secondary"># رقم المستند</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">التاريخ</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">المالك / العميل</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">إجمالي الفاتورة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الصافي المطلوب</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary">الحالة</th>
                  <th className="px-4 py-4 font-semibold text-text-secondary text-center w-32">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents?.map((doc) => {
                  const ownerName = Array.isArray(doc.owner) ? doc.owner[0]?.arabic_name : doc.owner?.arabic_name
                  const canEditOrApprove = doc.status === 'draft' || doc.status === 'submitted'
                  
                  return (
                    <tr key={doc.id} className="hover:bg-background-secondary/50 transition-colors">
                      <td className="px-4 py-4 font-medium text-navy dir-ltr text-right">{doc.document_no}</td>
                      <td className="px-4 py-4 text-text-secondary dir-ltr text-right">{doc.billing_date}</td>
                      <td className="px-4 py-4 text-text-primary">{ownerName || '---'}</td>
                      <td className="px-4 py-4 text-text-primary font-medium">
                        {doc.gross_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-navy font-bold">
                        {doc.net_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
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
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewDocId(doc.id)}
                            className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors tooltip-wrapper"
                            title="التفاصيل"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          
                          {canEditOrApprove && (
                            <>
                              <button
                                onClick={() => {
                                  setEditDocId(doc.id)
                                  setIsUpsertOpen(true)
                                }}
                                className="p-1.5 rounded-md text-text-secondary hover:text-navy hover:bg-navy/10 transition-colors tooltip-wrapper"
                                title="تعديل"
                              >
                                <EditIcon className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleApproveClick(doc.id)}
                                disabled={approvingDocId === doc.id}
                                className="p-1.5 rounded-md text-text-secondary hover:text-success hover:bg-success/10 transition-colors tooltip-wrapper disabled:opacity-50"
                                title="اعتماد"
                              >
                                {approvingDocId === doc.id ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-success/30 border-t-success animate-spin" />
                                ) : (
                                    <CheckIcon className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateOwnerBillModal
        projectId={projectId}
        editDocId={editDocId}
        isOpenProp={isUpsertOpen}
        onCloseProp={() => setIsUpsertOpen(false)}
      />

      <ViewOwnerBillModal
        isOpen={!!viewDocId}
        onClose={() => setViewDocId(null)}
        docId={viewDocId}
        projectId={projectId}
        onEdit={() => {
           setEditDocId(viewDocId)
           setIsUpsertOpen(true)
        }}
      />

      {confirmApproveDocId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right dir-rtl">
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
                onClick={() => setConfirmApproveDocId(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm"
                disabled={!!approvingDocId}
              >
                تراجع
              </button>
              <button
                onClick={confirmApprove}
                disabled={!!approvingDocId}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 transition-colors flex items-center justify-center gap-2 min-w-[130px] text-sm"
              >
                {approvingDocId ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'تأكيد الاعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right dir-rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-amber-600 mb-2 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              تنبيه
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              لا يمكنك إنشاء فاتورة جديدة لوجود فاتورة أخرى (أو مسودة) لم يتم اعتمادها بشكل نهائي بعد. يرجى مراجعة واعتماد الفاتورة الحالية لفك الحظر.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowWarning(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center min-w-[100px] text-sm"
              >
                حسناً
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
    </>
  )
}
