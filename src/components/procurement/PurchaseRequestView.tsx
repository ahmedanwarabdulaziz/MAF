'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPurchaseRequestDetails, submitPurchaseRequest, approvePurchaseRequest } from '@/actions/procurement'
import NewSupplierInvoiceDialog from '@/app/(system)/projects/[id]/procurement/invoices/NewSupplierInvoiceDialog'
import PurchaseRequestForm from '@/app/(system)/projects/[id]/procurement/requests/PurchaseRequestForm'

interface PurchaseRequestViewProps {
  projectId: string
  prId: string
  onActionSuccess?: () => void
  hideBreadcrumbs?: boolean
  hideNewInvoice?: boolean
}

export default function PurchaseRequestView({ 
  projectId, 
  prId, 
  onActionSuccess,
  hideBreadcrumbs = false,
  hideNewInvoice = false
}: PurchaseRequestViewProps) {
  const router = useRouter()
  const [pr, setPr] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (prId) {
      load()
    }
  }, [prId])

  const [confirmAction, setConfirmAction] = useState<{type: 'submit' | 'approve', message: string} | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await getPurchaseRequestDetails(prId)
      setPr(data)
    } catch (err: any) {
      setError('خطأ في تحميل بيانات الطلب: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleAction(actionType: 'submit' | 'approve') {
    setConfirmAction({
      type: actionType,
      message: actionType === 'submit' 
        ? 'هل أنت متأكد من تقديم الطلب للاعتماد؟ لا يمكن تعديله بعد ذلك.' 
        : 'تأكيد اعتماد طلب الشراء والموافقة على توفير المواد؟'
    })
  }

  async function executeAction() {
    if (!confirmAction) return
    const actionType = confirmAction.type
    setConfirmAction(null)
    
    setSaving(true)
    setError(null)
    
    try {
      if (actionType === 'submit') {
        await submitPurchaseRequest(pr.id, projectId)
      } else {
        await approvePurchaseRequest(pr.id, projectId)
      }
      await load()
      if (onActionSuccess) onActionSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary p-8 text-center min-h-[300px] flex items-center justify-center">جاري تحميل بيانات الطلب...</div>
  if (!pr) return <div className="text-sm text-danger p-8 text-center min-h-[300px] flex items-center justify-center">طلب الشراء غير موجود.</div>

  const req = Array.isArray(pr.requester) ? pr.requester[0] : pr.requester
  const proj = Array.isArray(pr.project) ? pr.project[0] : pr.project
  const canApprove = pr.status === 'pending_approval' && pr.can_approve

  if (isEditing && (pr.status === 'draft' || pr.status === 'pending_approval')) {
    return (
      <div className="space-y-6 pb-6 mx-auto w-full max-w-5xl">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            تعديل طلب الشراء: <span className="font-mono text-navy">{pr.request_no}</span>
          </h1>
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm font-semibold text-text-secondary hover:text-navy underline"
          >
            إلغاء والتراجع للتفاصيل
          </button>
        </div>
        <PurchaseRequestForm
          projectId={projectId}
          initialData={pr}
          onSuccess={() => {
            setIsEditing(false);
            load();
            router.refresh();
            if (onActionSuccess) onActionSuccess();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-6 mx-auto w-full max-w-5xl">
      {!hideBreadcrumbs && (
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Link href={`/projects/${projectId}/procurement/requests`} className="hover:text-primary transition-colors">طلبات الشراء</Link>
          <span>←</span>
          <span className="text-text-primary font-medium">{pr.request_no}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            طلب شراء رقم: <span className="font-mono text-navy">{pr.request_no}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            المشروع: {proj?.arabic_name || proj?.name} | مُقدم الطلب: {req?.display_name || 'غير محدد'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {(pr.status === 'draft' || pr.status === 'pending_approval') && (
            <button
              onClick={() => setIsEditing(true)}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-text-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-navy transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942.943-2.828a4.5 4.5 0 011.12-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" />
              </svg>
              تعديل الطلب
            </button>
          )}
          {pr.status === 'draft' && (
            <button
              onClick={() => handleAction('submit')}
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              تقديم الطلب للاعتماد
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => handleAction('approve')}
              disabled={saving}
              className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              اعتماد نهائي (Approve)
            </button>
          )}
          {!hideNewInvoice && pr.status === 'approved' && (
            <NewSupplierInvoiceDialog
              projectId={projectId}
              initialPrId={pr.id}
              trigger={
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white p-4 lg:p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">تاريخ الطلب</p>
          <p className="text-lg font-bold text-navy dir-ltr text-right">{pr.request_date}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 lg:p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">مطلوب التوريد قبل</p>
          <p className="text-lg font-bold text-amber-700 dir-ltr text-right">{pr.required_by_date || 'غير محدد'}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 lg:p-5 shadow-sm">
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
        <div className="rounded-xl border border-border bg-white p-4 lg:p-5 shadow-sm">
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
                 <tr key={idx} className="hover:bg-background-secondary/30 transition-colors">
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
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={executeAction}
                disabled={saving}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  confirmAction.type === 'submit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-success hover:bg-success/90'
                }`}
              >
                {saving ? 'جاري التنفيذ...' : 'نعم، تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
