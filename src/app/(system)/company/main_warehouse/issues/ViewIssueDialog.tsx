'use client'

import { useState, useEffect } from 'react'
import { getStoreIssueDetails } from '@/actions/store-issues'
import { formatCurrency } from '@/lib/format'
import IssueApprovalActions from '@/components/StoreIssueApprovalActions'

interface Props {
  issueId: string
  issue?: any // lightweight partial from list to show fast actions
  canApprovePM?: boolean
  canApproveWM?: boolean
  canCancel?: boolean
}

export default function ViewIssueDialog({ issueId, issue: initialIssue, canApprovePM, canApproveWM, canCancel }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [issue, setIssue] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && !issue) {
      setLoading(true)
      getStoreIssueDetails(issueId)
        .then(data => setIssue(data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen, issue, issueId])

  const statusStyle = {
    confirmed: 'bg-success/10 text-success border-success/30',
    pending_approval: 'bg-warning/10 text-warning border-warning/30',
    rejected: 'bg-danger/10 text-danger border-danger/30',
    cancelled: 'bg-secondary/10 text-secondary border-secondary/30',
  } as Record<string, string>

  const statusAr = {
    confirmed: 'معتمد', pending_approval: 'بانتظار الموافقة',
    rejected: 'مرفوض', cancelled: 'ملغي',
  } as Record<string, string>

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
        title="عرض تفاصيل الإذن"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0">
              <div className="text-right w-full" dir="rtl">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  إذن صرف مخزني
                  {issue && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border bg-white/10 ${
                      issue.status === 'confirmed' ? 'text-green-300 border-green-400/30' : 
                      issue.status === 'rejected' ? 'text-red-300 border-red-400/30' : 'text-amber-300 border-amber-400/30'
                    }`}>
                      {statusAr[issue.status] ?? issue.status}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-white/75 mt-0.5" dir="ltr">{issue?.document_no ?? '...'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute left-5 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30" dir="rtl">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                  <p>جاري تحميل التفاصيل...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-danger/10 text-danger rounded-xl border border-danger/20 text-center">
                  {error}
                </div>
              ) : issue ? (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                      <div className="text-xs text-text-secondary mb-1">تاريخ الصرف</div>
                      <div className="font-semibold text-text-primary">{issue.issue_date}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                      <div className="text-xs text-text-secondary mb-1">المخزن</div>
                      <div className="font-semibold text-text-primary">{(Array.isArray(issue.warehouse) ? issue.warehouse[0] : issue.warehouse)?.arabic_name ?? '—'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                      <div className="text-xs text-text-secondary mb-1">الجهة المستفيدة</div>
                      <div className="font-semibold text-text-primary">
                        {issue.issue_type === 'internal' 
                          ? (Array.isArray(issue.cost_center) ? issue.cost_center[0] : issue.cost_center)?.arabic_name ?? 'الشركة الرئيسية'
                          : (Array.isArray(issue.project) ? issue.project[0] : issue.project)?.arabic_name ?? '—'}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                      <div className="text-xs text-text-secondary mb-1">النوع</div>
                      <div className="font-semibold text-text-primary">
                        {issue.issue_type === 'internal' ? 'صرف داخلي (مركز تكلفة)' : 'صرف لمشروع'}
                      </div>
                    </div>
                  </div>

                  {issue.notes && (
                    <div className="bg-background-secondary p-4 rounded-xl border border-border text-sm">
                      <span className="font-bold ml-2 text-text-secondary">ملاحظات:</span>
                      {issue.notes}
                    </div>
                  )}

                  {/* Lines */}
                  <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-background-secondary">
                      <h3 className="font-bold text-sm text-text-primary">الأصناف المصروفة</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-gray-50 text-right text-xs text-gray-500">
                          <th className="px-5 py-3 font-semibold">الكود</th>
                          <th className="px-5 py-3 font-semibold">الصنف</th>
                          <th className="px-5 py-3 font-semibold">الوحدة</th>
                          <th className="px-5 py-3 font-semibold text-left">الكمية</th>
                          <th className="px-5 py-3 font-semibold text-left">التكلفة الإجمالية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(issue.lines) && issue.lines.map((line: any) => {
                          const item = Array.isArray(line.item) ? line.item[0] : line.item
                          const unit = Array.isArray(line.unit) ? line.unit[0] : line.unit
                          return (
                            <tr key={line.id} className="border-b border-border/50 hover:bg-gray-50/50">
                              <td className="px-5 py-3 font-mono text-xs text-primary" dir="ltr">{item?.item_code}</td>
                              <td className="px-5 py-3 font-medium">{item?.arabic_name}</td>
                              <td className="px-5 py-3 text-text-secondary text-xs">{unit?.arabic_name}</td>
                              <td className="px-5 py-3 font-bold text-left" dir="ltr">{Number(line.quantity).toLocaleString()}</td>
                              <td className="px-5 py-3 text-left font-medium text-primary text-xs" dir="ltr">
                                {issue.status === 'confirmed' ? formatCurrency(Number(line.total_cost)) : 'يُحدد عند الاعتماد'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Approvals */}
                  <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-sm text-text-primary mb-3">سجل الموافقات</h3>
                    <div className="grid md:grid-cols-2 gap-3 mb-4">
                      {[
                        { label: 'موافقة المفوض / الإدارة', statusVal: issue.pm_status, at: issue.pm_approved_at, by: issue.approved_by_pm },
                        { label: 'موافقة أمين المخزن', statusVal: issue.wm_status, at: issue.wm_approved_at, by: issue.approved_by_wm },
                      ].map((app, idx) => (
                        <div key={idx} className={`rounded-xl p-3 border ${app.statusVal === 'approved' ? 'border-success/30 bg-success/5' : app.statusVal === 'rejected' ? 'border-danger/30 bg-danger/5' : 'border-border bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs">{app.label}</span>
                            <span className={`text-xs font-bold ${app.statusVal === 'approved' ? 'text-success' : app.statusVal === 'rejected' ? 'text-danger' : 'text-gray-400'}`}>
                              {app.statusVal === 'approved' ? '✓ معتمد' : app.statusVal === 'rejected' ? '✗ مرفوض' : '◷ بالانتظار'}
                            </span>
                          </div>
                          {app.statusVal === 'approved' && (
                            <div className="text-[11px] text-gray-500 mt-2 flex justify-between">
                              <span>{(Array.isArray(app.by) ? app.by[0] : app.by)?.display_name ?? '—'}</span>
                              <span dir="ltr">{app.at?.split('T')[0]}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {(canApprovePM || canApproveWM || canCancel) && (
                      <div className="pt-4 border-t border-border mt-2">
                        <IssueApprovalActions
                          issueId={issue.id}
                          projectId="main"
                          canApprovePM={!!canApprovePM}
                          canApproveWM={!!canApproveWM}
                          canCancel={!!canCancel}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 bg-gray-50 flex justify-end shrink-0">
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
    </>
  )
}
