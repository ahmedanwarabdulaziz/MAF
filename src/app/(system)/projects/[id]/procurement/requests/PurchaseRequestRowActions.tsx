'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getPurchaseRequestDetails, submitPurchaseRequest, approvePurchaseRequest } from '@/actions/procurement'

import PurchaseRequestForm from './PurchaseRequestForm'
import NewSupplierInvoiceDialog from '../invoices/NewSupplierInvoiceDialog'
import AttachmentsViewer from '@/components/AttachmentsViewer'

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const PaperAirplaneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
)

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942.943-2.828a4.5 4.5 0 011.12-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" />
  </svg>
)

interface PurchaseRequestRowActionsProps {
  pr: any
  projectId: string
  canApprove: boolean
}

export default function PurchaseRequestRowActions({ pr: rowPr, projectId, canApprove }: PurchaseRequestRowActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [pr, setPr] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{type: 'submit' | 'approve', message: string} | null>(null)

  const openModal = async () => {
    setIsOpen(true)
    setIsEditing(false)
    setLoading(true)
    setError(null)
    try {
      const data = await getPurchaseRequestDetails(rowPr.id)
      setPr(data)
    } catch (err: any) {
      setError('خطأ في تحميل بيانات الطلب: ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const closeModal = () => setIsOpen(false)

  const handleAction = (actionType: 'submit' | 'approve', e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setConfirmAction({
      type: actionType,
      message: actionType === 'submit' 
        ? 'هل أنت متأكد من تقديم الطلب للاعتماد؟ لا يمكن تعديله بعد ذلك.' 
        : 'تأكيد اعتماد طلب الشراء والموافقة على توفير المواد؟'
    })
  }

  const executeAction = async () => {
    if (!confirmAction) return
    const actionType = confirmAction.type
    setConfirmAction(null)
    
    setSavingAction(true)
    setError(null)
    
    try {
      if (actionType === 'submit') {
        await submitPurchaseRequest(rowPr.id, projectId)
      } else {
        await approvePurchaseRequest(rowPr.id, projectId)
      }
      if (isOpen) {
        const data = await getPurchaseRequestDetails(rowPr.id)
        setPr(data)
      }
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSavingAction(false)
    }
  }

  const req = pr ? (Array.isArray(pr.requester) ? pr.requester[0] : pr.requester) : null
  const proj = pr ? (Array.isArray(pr.project) ? pr.project[0] : pr.project) : null
  const canApproveStatus = rowPr.status === 'pending_approval' && canApprove

  return (
    <div className="flex items-center gap-2 justify-end">
      {/* Quick Actions in Row */}
      {rowPr.status === 'draft' && (
        <button
          onClick={(e) => handleAction('submit', e)}
          disabled={savingAction}
          title="تقديم الطلب للاعتماد"
          className="p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <PaperAirplaneIcon />
        </button>
      )}

      {canApproveStatus && (
        <button
          onClick={(e) => handleAction('approve', e)}
          disabled={savingAction}
          title="اعتماد نهائي"
          className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCircleIcon />
        </button>
      )}

      <button
        onClick={openModal}
        title="عرض التفاصيل"
        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        <EyeIcon />
      </button>

      {rowPr.attachment_urls && rowPr.attachment_urls.length > 0 && (
        <AttachmentsViewer urls={rowPr.attachment_urls} />
      )}

      {/* Details Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">تفاصيل طلب الشراء <span className="font-mono text-white/90 text-sm mr-2">{rowPr.request_no}</span></h2>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              {loading ? (
                <div className="py-12 text-center text-text-secondary animate-pulse">جاري تحميل بيانات الطلب...</div>
              ) : error && !pr ? (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
              ) : isEditing && pr?.status === 'draft' ? (
                <div>
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-sm font-semibold text-text-secondary hover:text-navy underline"
                    >
                      إلغاء التعديل والعودة للتفاصيل
                    </button>
                  </div>
                  <PurchaseRequestForm
                    projectId={projectId}
                    initialData={pr}
                    onSuccess={() => {
                      setIsEditing(false);
                      openModal(); // Reload updated data
                      router.refresh(); // Refresh background list
                    }}
                    onCancel={() => setIsEditing(false)}
                  />
                </div>
              ) : pr ? (
                <div className="space-y-6">
                  {/* Action Bar inside Dialog */}
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div>
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-navy">{pr.request_no}</h3>
                        {pr.attachment_urls && pr.attachment_urls.length > 0 && (
                          <AttachmentsViewer urls={pr.attachment_urls} />
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">مُقدم الطلب: {req?.display_name || 'غير محدد'}</p>
                    </div>
                    <div className="flex gap-3">
                      {pr.status === 'draft' && (
                        <button
                          onClick={() => setIsEditing(true)}
                          disabled={savingAction}
                          className="flex items-center gap-2 rounded-lg bg-text-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-navy transition-colors disabled:opacity-50"
                        >
                          <PencilIcon />
                          إضافة / تعديل البنود
                        </button>
                      )}
                      {pr.status === 'draft' && (
                        <button
                          onClick={() => handleAction('submit')}
                          disabled={savingAction}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          تقديم الطلب للاعتماد
                        </button>
                      )}
                      {(pr.status === 'pending_approval' && pr.can_approve) && (
                        <button
                          onClick={() => handleAction('approve')}
                          disabled={savingAction}
                          className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50"
                        >
                          <CheckCircleIcon />
                          اعتماد نهائي
                        </button>
                      )}
                      {pr.status === 'approved' && (
                        <NewSupplierInvoiceDialog
                          projectId={projectId}
                          initialPrId={pr.id}
                          trigger={
                            <button
                              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                            >
                              تحويل الطلب إلى فاتورة مورد
                            </button>
                          }
                        />
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">تاريخ الطلب</p>
                      <p className="text-lg font-bold text-navy dir-ltr text-right">{pr.request_date}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">مطلوب التوريد قبل</p>
                      <p className="text-lg font-bold text-amber-700 dir-ltr text-right">{pr.required_by_date || 'غير محدد'}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">الحالة</p>
                      <p className={`text-lg font-bold ${
                        pr.status === 'approved' ? 'text-success' : 
                        pr.status === 'pending_approval' ? 'text-amber-600' :
                        pr.status === 'closed' ? 'text-purple-700' : 'text-text-primary'
                      }`}>
                        {pr.status === 'draft' ? 'مسودة (Draft)' :
                         pr.status === 'pending_approval' ? 'بانتظار الاعتماد' :
                         pr.status === 'approved' ? 'معتمد' :
                         pr.status === 'closed' ? 'مغلق (منفذ)' : pr.status}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">عدد بنود المواد</p>
                      <p className="text-xl font-bold text-text-primary dir-ltr text-right">{pr.lines?.length || 0}</p>
                    </div>
                  </div>

                  {pr.notes && (
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-text-secondary mb-2">سبب الطلب / ملاحظات:</h3>
                      <p className="text-sm text-text-primary whitespace-pre-line">{pr.notes}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="text-lg font-bold text-text-primary">مفردات المواد المطلوبة (PR Lines)</h2>
                    </div>
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-text-secondary"># الكود</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary min-w-[200px]">المادة / الصنف</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary text-center">الوحدة</th>
                            <th className="px-4 py-3 font-semibold text-navy">الكمية المطلوبة</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">سعر تقديري</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">ملاحظات البند</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pr.lines?.map((line: any, idx: number) => {
                            const item = Array.isArray(line.item) ? line.item[0] : line.item
                            const unit = item?.unit ? (Array.isArray(item.unit) ? item.unit[0] : item.unit) : null
                            
                            return (
                             <tr key={idx} className="hover:bg-background-secondary/30 transition-colors border-b border-border/50 last:border-0">
                                <td className="px-4 py-4 font-medium text-text-secondary">{item?.item_code || '---'}</td>
                                <td className="px-4 py-4 whitespace-normal min-w-[200px] text-text-primary font-medium">{item?.arabic_name || '---'}</td>
                                <td className="px-4 py-4 text-center text-text-tertiary">{unit?.arabic_name || '---'}</td>
                                <td className="px-4 py-4 font-bold text-navy text-lg dir-ltr text-right">{Number(line.requested_quantity).toLocaleString()}</td>
                                <td className="px-4 py-4 text-text-secondary dir-ltr text-right">
                                  {Number(line.estimated_unit_price) > 0 ? `${Number(line.estimated_unit_price).toLocaleString()} ج.م` : '---'}
                                </td>
                                <td className="px-4 py-4 text-text-secondary whitespace-normal min-w-[150px]">{line.notes || '---'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setConfirmAction(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <h3 className="text-xl font-bold text-navy mb-4 text-right">تأكيد الإجراء</h3>
            <p className="text-text-secondary text-right mb-6">{confirmAction.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={savingAction}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={executeAction}
                disabled={savingAction}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  confirmAction.type === 'submit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-success hover:bg-success/90'
                }`}
              >
                {savingAction ? 'جاري التنفيذ...' : 'نعم، تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
