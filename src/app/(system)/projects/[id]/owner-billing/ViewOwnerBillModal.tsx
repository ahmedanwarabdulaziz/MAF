'use client'

import React, { useState, useEffect } from 'react'
import {
  getOwnerBillingDetails,
  updateOwnerBillingStatus,
  getOwnerCollectedAmount,
} from '@/actions/owner_billing'
import { useRouter } from 'next/navigation'

const XIcon     = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)
const EditIcon  = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
  </svg>
)
const CheckIcon = ({ className }: { className?: string }) => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

export default function ViewOwnerBillModal({
  isOpen, onClose, docId, projectId, onEdit,
}: {
  isOpen: boolean
  onClose: () => void
  docId: string | null
  projectId: string
  onEdit: () => void
}) {
  const router = useRouter()
  const [doc,      setDoc]      = useState<any>(null)
  const [collected,setCollected]= useState(0)
  const [loading,  setLoading]  = useState(false)
  const [approving,setApproving]= useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && docId) {
      setLoading(true)
      setError(null)
      Promise.all([
        getOwnerBillingDetails(docId),
        getOwnerCollectedAmount(projectId),
      ])
        .then(([data, col]) => { setDoc(data); setCollected(col) })
        .catch(err => setError('حدث خطأ أثناء جلب التفاصيل: ' + err.message))
        .finally(() => setLoading(false))
    } else {
      setDoc(null)
    }
  }, [isOpen, docId, projectId])

  if (!isOpen) return null

  const confirmApprove = async () => {
    if (!docId) return
    try {
      setApproving(true)
      await updateOwnerBillingStatus(docId, 'approved', projectId)
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير معروف')
    } finally {
      setApproving(false)
      setConfirmOpen(false)
    }
  }

  // Summary totals from lines
  const lines = doc?.lines || []
  const totalCumulativeGross    = lines.reduce((s: number, l: any) => s + (Number(l.cumulative_quantity || 0) * Number(l.unit_price || 0)), 0)
  const totalCumulativeEntitled = lines.reduce((s: number, l: any) => {
    const rate = Number(l.disbursement_rate ?? 100)
    return s + (Number(l.cumulative_quantity || 0) * Number(l.unit_price || 0) * (rate / 100))
  }, 0)
  const totalRetention = totalCumulativeGross - totalCumulativeEntitled
  const remaining      = Math.max(0, totalCumulativeEntitled - collected)

  const ownerName = doc?.owner
    ? (Array.isArray(doc.owner) ? doc.owner[0]?.arabic_name : doc.owner?.arabic_name)
    : ''

  const statusLabel: Record<string, string> = {
    draft:     'مسودة',
    submitted: 'مقدمة',
    approved:  'معتمدة',
    paid:      'محصلة',
    cancelled: 'ملغاة',
  }
  const statusColor: Record<string, string> = {
    draft:     'bg-text-tertiary/20 text-text-primary',
    submitted: 'bg-amber-100 text-amber-700',
    approved:  'bg-success/10 text-success',
    paid:      'bg-purple-100 text-purple-700',
    cancelled: 'bg-danger/10 text-danger',
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden ring-1 ring-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-navy">
          <div>
            <h2 className="text-lg font-bold text-white">
              فاتورة المالك التراكمية — {doc?.document_no || '...'}
            </h2>
            <p className="text-white/60 text-xs mt-0.5">
              كشف الموقف التراكمي حتى تاريخ:{' '}
              <span className="dir-ltr font-medium text-white/80">{doc?.end_date || '—'}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/10 text-white/80 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-text-secondary flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
              جاري تحميل التفاصيل...
            </div>
          ) : !doc ? (
            <div className="py-12 text-center text-text-secondary">التفاصيل غير متاحة.</div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
              )}

              {/* SUMMARY CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي التراكمي</p>
                  <p className="text-xl font-bold text-navy dir-ltr text-right">{totalCumulativeGross.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</p>
                  <p className="text-xs text-text-tertiary mt-1">Σ (كمية تراكمية × سعر)</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">المبالغ المسددة</p>
                  <p className="text-xl font-bold text-amber-600 dir-ltr text-right">{collected.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</p>
                  <p className="text-xs text-text-tertiary mt-1">من سندات التحصيل المعتمدة</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">ضمان أعمال (Retention)</p>
                  <p className="text-xl font-bold text-danger/80 dir-ltr text-right">{totalRetention.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</p>
                  <p className="text-xs text-text-tertiary mt-1">التراكمي − المستحق</p>
                </div>
                <div className="bg-success/5 rounded-xl border-2 border-success p-5 shadow-sm">
                  <p className="text-xs font-semibold text-success mb-1">صافي المستحق</p>
                  <p className="text-2xl font-black text-success dir-ltr text-right">{remaining.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</p>
                  <p className="text-xs text-success/70 mt-1">المستحق − المسدد</p>
                </div>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-background-secondary p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">الحالة</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${statusColor[doc.status] || ''}`}>
                    {statusLabel[doc.status] || doc.status}
                  </span>
                </div>
                <div className="bg-background-secondary p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">المالك</span>
                  <p className="font-semibold text-sm text-text-primary">{ownerName || 'غير محدد'}</p>
                </div>
                <div className="bg-background-secondary p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">من تاريخ</span>
                  <p className="font-semibold text-sm text-navy dir-ltr text-right">{doc.start_date || '—'}</p>
                </div>
                <div className="bg-background-secondary p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-text-tertiary block mb-1">حتى تاريخ</span>
                  <p className="font-semibold text-sm text-navy dir-ltr text-right">{doc.end_date || '—'}</p>
                </div>
              </div>

              {/* BOQ TABLE */}
              <div className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
                <div className="px-5 py-3 border-b border-border bg-background-secondary/50">
                  <h3 className="text-sm font-bold text-text-primary">دفتر حصر الكميات التراكمي</h3>
                </div>
                <div className="overflow-x-auto hide-scrollbar">
                  {lines.length === 0 ? (
                    <div className="py-8 text-center text-sm text-text-secondary">لا توجد بنود.</div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-background-secondary border-b border-border">
                        <tr>
                          <th className="px-3 py-3 font-semibold text-text-secondary min-w-[220px]">البيان</th>
                          <th className="px-3 py-3 font-semibold text-green-700 bg-green-50/60 text-center w-24">كمية سابقة</th>
                          <th className="px-3 py-3 font-semibold text-navy bg-blue-50/60 text-center w-24">كمية حالية</th>
                          <th className="px-3 py-3 font-semibold text-text-secondary bg-slate-50/60 text-center w-24">تراكمي</th>
                          <th className="px-3 py-3 font-semibold text-text-secondary text-center w-28">سعر المالك</th>
                          <th className="px-3 py-3 font-semibold text-amber-700 bg-amber-50/50 text-center w-20">صرف %</th>
                          <th className="px-3 py-3 font-semibold text-navy bg-navy/5 text-center w-32">إجمالي تراكمي</th>
                          <th className="px-3 py-3 font-semibold text-success bg-success/5 text-center w-32">مستحق تراكمي</th>
                          <th className="px-3 py-3 font-semibold text-danger/70 text-center w-24">محجوز</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lines.map((line: any) => {
                          const rate         = Number(line.disbursement_rate ?? 100)
                          const cumulAmt     = Number(line.cumulative_quantity || 0) * Number(line.unit_price || 0)
                          const cumulEnt     = cumulAmt * (rate / 100)
                          const retention    = cumulAmt - cumulEnt
                          const isInherited  = Number(line.previous_quantity || 0) > 0

                          return (
                            <tr key={line.id} className={`hover:bg-background-secondary/30 transition-colors ${isInherited ? '' : 'bg-blue-50/10'}`}>
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-text-primary leading-tight">
                                  {line.override_description || line.line_description}
                                </p>
                                {line.is_material_on_site && (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">تشوينات</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-text-secondary dir-ltr text-center font-mono bg-green-50/20">{Number(line.previous_quantity || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-navy font-bold dir-ltr text-center bg-blue-50/20">{Number(line.quantity || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-text-primary font-bold dir-ltr text-center bg-slate-50/30">{Number(line.cumulative_quantity || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-text-secondary dir-ltr text-center">{Number(line.unit_price || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-amber-700 font-bold dir-ltr text-center bg-amber-50/30">{rate}%</td>
                              <td className="px-3 py-2.5 text-navy font-bold dir-ltr text-center bg-navy/5">{cumulAmt.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2.5 text-success font-bold dir-ltr text-center bg-success/5">{cumulEnt.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2.5 text-danger/70 dir-ltr text-center">{retention.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* FINAL ACCOUNT SUMMARY — 7-step waterfall */}
              <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-navy">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider">موقف الحساب</h3>
                </div>
                <div className="bg-navy divide-y divide-white/10">
                  {/* 1 */}
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-sm text-white/80">إجمالي المستخلص التراكمي</span>
                    <span className="dir-ltr font-bold text-white">{totalCumulativeGross.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {/* 2 */}
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-sm text-white/60">يُخصم: ما سبق صرفه</span>
                    <span className="dir-ltr text-white/60">({collected.toLocaleString('ar-EG', { maximumFractionDigits: 2 })})</span>
                  </div>
                  {/* 3 = subtotal */}
                  <div className="flex justify-between items-center px-5 py-3 bg-white/5">
                    <span className="text-sm font-semibold text-white">المستحق</span>
                    <span className="dir-ltr font-bold text-white">{Math.max(0, totalCumulativeGross - collected).toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {/* 4 */}
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-sm text-white/60">يُخصم: اهلاك الدفعة المقدمة</span>
                    <span className="dir-ltr text-white/60">({Number(doc.advance_deduction || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })})</span>
                  </div>
                  {/* 5 */}
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-sm text-white/60">يُخصم: الضريبة</span>
                    <span className="dir-ltr text-white/60">({Number(doc.tax_amount || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })})</span>
                  </div>
                  {/* 6 */}
                  <div className="flex justify-between items-center px-5 py-3">
                    <span className="text-sm text-white/60">يُخصم: ضمان الأعمال</span>
                    <span className="dir-ltr text-white/60">({totalRetention.toLocaleString('ar-EG', { maximumFractionDigits: 2 })})</span>
                  </div>
                  {/* 7 = net */}
                  <div className="flex justify-between items-center px-5 py-4 border-t-2 border-white/20 bg-white/5">
                    <span className="text-base font-bold text-white">صافي المستحق</span>
                    <span className={`dir-ltr text-xl font-black ${(doc.net_amount || 0) >= 0 ? 'text-[#4ade80]' : 'text-red-400'}`}>
                      {Number(doc.net_amount || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {doc.notes && (
                <div className="bg-background-secondary/50 p-4 rounded-xl text-sm border border-border">
                  <span className="font-semibold text-text-primary block mb-1">ملاحظات</span>
                  <p className="text-text-secondary">{doc.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background-secondary flex justify-between items-center">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm">
            إغلاق
          </button>

          {doc && (doc.status === 'draft' || doc.status === 'submitted') && (
            <div className="flex gap-3">
              <button onClick={() => { onClose(); onEdit() }}
                className="px-5 py-2.5 rounded-xl font-medium text-navy bg-navy/10 hover:bg-navy/20 transition-colors flex items-center gap-2 text-sm">
                <EditIcon className="w-4 h-4" />
                تعديل المطالبة
              </button>
              <button onClick={() => setConfirmOpen(true)} disabled={approving}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm">
                <CheckIcon className="w-5 h-5" />
                اعتماد نهائي
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Approve */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-navy mb-2 flex items-center gap-2">
              <CheckIcon className="w-6 h-6 text-success" />
              تأكيد اعتماد الفاتورة
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              هل أنت متأكد من اعتماد هذه الفاتورة نهائياً؟ (لن يمكن تعديلها بعد الاعتماد).
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmOpen(false)} disabled={approving}
                className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm">
                تراجع
              </button>
              <button onClick={confirmApprove} disabled={approving}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 transition-colors flex items-center gap-2 min-w-[130px] text-sm">
                {approving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'تأكيد الاعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
