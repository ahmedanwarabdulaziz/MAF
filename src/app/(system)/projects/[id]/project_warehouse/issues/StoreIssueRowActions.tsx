'use client'

import { useState, useTransition } from 'react'
import { approveStoreIssue } from '@/actions/store-issues'
import { formatCurrency } from '@/lib/format'
import IssueApprovalActions from '@/components/StoreIssueApprovalActions'
import { useRouter } from 'next/navigation'

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

export function StoreIssueRowActions({
  issue,
  projectId,
  canApprovePM,
  canApproveWM,
  canCancel,
}: {
  issue: any
  projectId: string
  canApprovePM: boolean
  canApproveWM: boolean
  canCancel: boolean
}) {
  const router = useRouter()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  
  const [confirmRole, setConfirmRole] = useState<'pm' | 'warehouse_manager' | null>(null)
  
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleApprove = async () => {
    if (!confirmRole) return
    setError('')
    startTransition(async () => {
      try {
        await approveStoreIssue(issue.id, confirmRole, projectId)
        setIsConfirmOpen(false)
        router.refresh()
      } catch (err: any) {
        setError(err.message || 'فشل الاعتماد')
        alert(err.message || 'فشل الاعتماد')
      }
    })
  }

  const promptApprove = (role: 'pm' | 'warehouse_manager') => {
    setConfirmRole(role)
    setIsConfirmOpen(true)
  }

  const warehouse = Array.isArray(issue.warehouse) ? issue.warehouse[0] : issue.warehouse
  const lines = Array.isArray(issue.lines) ? issue.lines : []
  const totalCost = lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)

  return (
    <>
      <div className="flex items-center gap-2">
        {canApprovePM && (
          <ActionIconButton
            onClick={() => promptApprove('pm')}
            loading={isPending && confirmRole === 'pm'}
            title="اعتماد كمدير مشروع"
            bgClass="hover:bg-blue-100 bg-white border-blue-200"
            textClass="text-blue-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        )}
        {canApproveWM && (
          <ActionIconButton
            onClick={() => promptApprove('warehouse_manager')}
            loading={isPending && confirmRole === 'warehouse_manager'}
            title="اعتماد كأمين مخزن"
            bgClass="hover:bg-green-100 bg-white border-green-200"
            textClass="text-green-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        )}
        <ActionIconButton
          onClick={() => setIsDetailsOpen(true)}
          title="التفاصيل"
          bgClass="hover:bg-gray-100 bg-white border-gray-200"
          textClass="text-gray-600"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Details Modal */}
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsDetailsOpen(false)} />

          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0">
              <div className="text-right w-full" dir="rtl">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-blue-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  تفاصيل إذن الصرف
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border bg-white/10 ${
                    issue.status === 'confirmed' ? 'text-green-300 border-green-400/30' : 
                    issue.status === 'pending_approval' ? 'text-warning border-warning/30' : 
                    issue.status === 'rejected' ? 'text-danger border-danger/30' : 'text-gray-300 border-gray-400/30'
                  }`}>
                    {issue.status === 'confirmed' ? 'معتمد' : issue.status === 'pending_approval' ? 'بانتظار الموافقة' : issue.status === 'rejected' ? 'مرفوض' : 'ملغي'}
                  </span>
                </h2>
                <p className="text-sm text-white/75 mt-0.5" dir="ltr">{issue.document_no}</p>
              </div>
              <button 
                onClick={() => setIsDetailsOpen(false)}
                className="absolute left-5 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30" dir="rtl">
              <div className="space-y-6">
                
                {/* Timeline */}
                <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="text-base font-bold text-text-primary mb-6">حالة الموافقة المزدوجة</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* PM Approval */}
                    <div
                      className={`rounded-lg p-4 border-2 ${
                        issue.pm_status === 'approved'
                          ? 'border-success/40 bg-success/5'
                          : issue.pm_status === 'rejected'
                          ? 'border-danger/40 bg-danger/5'
                          : 'border-warning/30 bg-warning/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-lg ${
                            issue.pm_status === 'approved'
                              ? 'text-success'
                              : issue.pm_status === 'rejected'
                              ? 'text-danger'
                              : 'text-warning'
                          }`}
                        >
                          {issue.pm_status === 'approved' ? '✓' : issue.pm_status === 'rejected' ? '✗' : '◷'}
                        </span>
                        <span className="font-semibold text-text-primary">موافقة مدير المشروع</span>
                      </div>
                      {issue.pm_status === 'approved' && (
                        <div className="text-xs text-text-secondary">
                          <div>
                            {(Array.isArray(issue.approved_by_pm)
                              ? (issue.approved_by_pm as any)[0]
                              : issue.approved_by_pm)?.display_name ?? '—'}
                          </div>
                          <div dir="ltr">{issue.pm_approved_at?.split('T')[0]}</div>
                        </div>
                      )}
                      {issue.pm_status === 'pending' && (
                        <div className="text-xs text-warning">بانتظار موافقة مدير المشروع</div>
                      )}
                    </div>

                    {/* WM Approval */}
                    <div
                      className={`rounded-lg p-4 border-2 ${
                        issue.wm_status === 'approved'
                          ? 'border-success/40 bg-success/5'
                          : issue.wm_status === 'rejected'
                          ? 'border-danger/40 bg-danger/5'
                          : 'border-warning/30 bg-warning/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-lg ${
                            issue.wm_status === 'approved'
                              ? 'text-success'
                              : issue.wm_status === 'rejected'
                              ? 'text-danger'
                              : 'text-warning'
                          }`}
                        >
                          {issue.wm_status === 'approved' ? '✓' : issue.wm_status === 'rejected' ? '✗' : '◷'}
                        </span>
                        <span className="font-semibold text-text-primary">موافقة أمين المخزن</span>
                      </div>
                      {issue.wm_status === 'approved' && (
                        <div className="text-xs text-text-secondary">
                          <div>
                            {(Array.isArray(issue.approved_by_wm)
                              ? (issue.approved_by_wm as any)[0]
                              : issue.approved_by_wm)?.display_name ?? '—'}
                          </div>
                          <div dir="ltr">{issue.wm_approved_at?.split('T')[0]}</div>
                        </div>
                      )}
                      {issue.wm_status === 'pending' && (
                        <div className="text-xs text-warning">بانتظار موافقة أمين المخزن</div>
                      )}
                    </div>
                  </div>

                  {issue.status === 'confirmed' && (
                    <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success text-center font-medium">
                      ✓ تم تأكيد الصرف وتحديث رصيد المخزون بالمتوسط الموزون
                    </div>
                  )}
                  {issue.rejection_reason && (
                    <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex flex-col items-center">
                      <span className="font-bold">سبب الرفض / الإلغاء:</span> 
                      {issue.rejection_reason}
                    </div>
                  )}

                  {/* Actions inside Modal */}
                  {(canApprovePM || canApproveWM || canCancel) && (
                    <div className="mt-6 pt-4 border-t border-border">
                      <IssueApprovalActions
                        issueId={issue.id}
                        projectId={projectId}
                        canApprovePM={canApprovePM}
                        canApproveWM={canApproveWM}
                        canCancel={canCancel}
                      />
                    </div>
                  )}
                </div>

                {/* Lines Table */}
                <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-background-secondary flex items-center justify-between">
                    <h3 className="font-bold text-sm text-text-primary">الأصناف المصروفة</h3>
                    {issue.status === 'confirmed' && (
                      <span className="text-sm font-bold text-primary">
                        الإجمالي: {formatCurrency(totalCost)}
                      </span>
                    )}
                  </div>
                  <table className="w-full text-sm flex-1">
                    <thead>
                      <tr className="border-b border-border bg-gray-50 text-xs text-gray-500">
                        <th className="px-5 py-3 font-semibold text-left">كود الصنف</th>
                        <th className="px-5 py-3 font-semibold text-right">اسم الصنف</th>
                        <th className="px-5 py-3 font-semibold text-right">الوحدة</th>
                        <th className="px-5 py-3 font-semibold text-left">الكمية</th>
                        <th className="px-5 py-3 font-semibold text-left">متوسط التكلفة</th>
                        <th className="px-5 py-3 font-semibold text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line: any) => {
                        const item = Array.isArray(line.item) ? line.item[0] : line.item
                        const unit = Array.isArray(line.unit) ? line.unit[0] : line.unit
                        return (
                          <tr key={line.id} className="border-b border-border/50 hover:bg-gray-50/50">
                            <td className="px-5 py-3 font-mono text-xs text-primary text-left" dir="ltr">{item?.item_code || '-'}</td>
                            <td className="px-5 py-3 font-medium text-right">{item?.arabic_name || '-'}</td>
                            <td className="px-5 py-3 text-text-secondary">{unit?.arabic_name}</td>
                            <td className="px-5 py-3 font-bold text-left text-blue-600 whitespace-nowrap" dir="ltr">
                              {Number(line.quantity).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 text-left text-text-secondary" dir="ltr">
                              {Number(line.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3 font-medium text-left" dir="ltr">
                              {issue.status === 'confirmed'
                                ? formatCurrency(Number(line.total_cost))
                                : <span className="text-text-secondary text-xs">يُحدد عند الاعتماد</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {issue.notes && (
                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-bold text-text-primary mb-2">ملاحظات</h2>
                    <p className="text-sm text-text-secondary">{issue.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 bg-gray-50 flex justify-end shrink-0" dir="rtl">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-6 py-2 bg-white border border-border rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {isConfirmOpen && confirmRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center border border-border">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              تأكيد الموافقة
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmRole === 'pm'
                ? 'هل أنت متأكد من اعتماد الصرف كمدير مشروع؟'
                : 'هل أنت متأكد من اعتماد الصرف كأمين مخزن؟ سيتم تحديث الكميات في المخزون وبذلك يكون الصرف نهائياً.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-transparent"
                disabled={isPending}
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="px-6 py-2 text-white rounded-lg text-sm font-bold transition-colors shadow flex items-center gap-2 disabled:opacity-50 bg-green-600 hover:bg-green-700"
              >
                {isPending && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isPending ? 'جاري الاعتماد...' : 'نعم، أعتمد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
