'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getCertificateDetails,
  getCertificateBOQGrid,
  saveCertificateLines,
  submitCertificateForApproval,
  approveCertificate,
  getCertificatePaidAmount,
  deleteCertificate,
} from '@/actions/certificates'
import { getProjectWorkItems } from '@/actions/agreements'
import { getPartyAdvanceBalance } from '@/actions/payments'
import EditCertificateDialog from './EditCertificateDialog'

export default function ViewCertificateDialog({
  certId, projectId, status,
}: { certId: string; projectId: string; status?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  const [cert,         setCert]         = useState<any>(null)
  const [lines,        setLines]        = useState<any[]>([])
  const [workItems,    setWorkItems]    = useState<any[]>([])
  const [paidAmount,   setPaidAmount]   = useState(0)
  const [advanceTotal, setAdvanceTotal] = useState(0)  // الدفعات المقدمة للمقاول
  const [taxRate,      setTaxRate]      = useState(0)  // الضريبة % (0 = لا ضريبة)

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: 'submit' | 'approve' | null }>({
    isOpen: false, action: null,
  })
  const [quickApproveConfirm, setQuickApproveConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const openModal = () => { setIsOpen(true); load(true) }
  const closeModal = () => { setIsOpen(false); router.refresh() }

  useEffect(() => {
    if (searchParams.get('openCert') === certId && !isOpen) {
      openModal()
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams, certId, isOpen])

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const c = await getCertificateDetails(certId)
      setCert(c)

      const [boqGrid, items, paid, advBal] = await Promise.all([
        getCertificateBOQGrid(c.subcontract_agreement_id, c.id),
        getProjectWorkItems(projectId),
        getCertificatePaidAmount(c.subcontractor_party_id, c.project_id),
        getPartyAdvanceBalance(c.project_id, c.subcontractor_party_id, 'contractor'),
      ])

      let pricesUpdatedGlobal = false

      setLines((boqGrid || []).map((l: any, i: number) => {
        const line = { ...l, _id: l._id || `existing-${i}` }
        let pricesUpdatedForLine = false

        // Auto-sync prices if editable
        if (c.status === 'draft' || c.status === 'pending_approval') {
          const wi = items?.find((item: any) => item.id === line.project_work_item_id)
          if (wi) {
            const newRate = Number(wi.subcontractor_price || 0)
            if (Number(line.agreed_rate) !== newRate) {
              line.agreed_rate = newRate
              pricesUpdatedForLine = true
              pricesUpdatedGlobal = true
            }
          }
        }

        // Recalculate if price changed OR fallback for inherited lines that were seeded with 0 totals directly from the DB
        if (pricesUpdatedForLine || (Number(line.previous_quantity) > 0 && !Number(line.cumulative_amount))) {
          const qty = Number(line.previous_quantity) + Number(line.current_quantity || 0)
          const rate = Number(line.agreed_rate || 0)
          const disb = Number(line.taaliya_value || line.disbursement_rate || c?.agreement?.default_taaliya_value || 90)
          const gross = qty * rate
          const entitled = gross * (disb / 100)
          line.cumulative_amount = gross
          line.cumulative_entitled = entitled
          line.retention = gross - entitled
          line.this_line_net = entitled - Number(line.previous_disbursed || 0)
        }
        return line
      }))

      if (pricesUpdatedGlobal) {
        setSuccessMsg('تم تحديث أسعار بعض البنود لتطابق أحدث تسعير مسجل. يرجى النقر على "حفظ وإعادة الحساب".')
        setTimeout(() => setSuccessMsg(null), 8000)
      }
      setWorkItems(items || [])
      setPaidAmount(paid)
      setAdvanceTotal(advBal?.balance_remaining ?? advBal?.total_advanced ?? 0)
    } catch (err: any) {
      setError('خطأ في تحميل بيانات المستخلص: ' + err.message)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  async function handleSaveLines() {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await saveCertificateLines(cert.id, cert.subcontract_agreement_id, lines)
      await load(false)
      setSuccessMsg('تم حفظ الكميات وإعادة الحساب بنجاح.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ البنود')
    } finally {
      setSaving(false)
    }
  }

  function promptAction(action: 'submit' | 'approve') {
    setConfirmDialog({ isOpen: true, action })
  }

  async function executeAction() {
    if (!confirmDialog.action) return
    const action = confirmDialog.action
    setConfirmDialog({ isOpen: false, action: null })
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      if (action === 'submit') {
        await submitCertificateForApproval(cert.id, projectId)
        setSuccessMsg('تم تقديم المستخلص للاعتماد بنجاح.')
      } else {
        await approveCertificate(cert.id, projectId)
        setSuccessMsg('تم الاعتماد النهائي بنجاح.')
      }
      setTimeout(() => setSuccessMsg(null), 3000)
      await load(false)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  function updateQuantity(index: number, qty: number) {
    const list = [...lines]
    list[index].current_quantity = qty
    const prevQty   = Number(list[index].previous_quantity || 0)
    const cumulQty  = prevQty + qty
    const rate      = Number(list[index].agreed_rate || 0)
    const disbRate  = Number(list[index].taaliya_value || 0)
    const cumAmount = cumulQty * rate
    const entitled  = cumAmount * (disbRate / 100)
    const retention = cumAmount - entitled
    const prevDisb  = Number(list[index].previous_disbursed || 0)
    list[index].cumulative_quantity = cumulQty
    list[index].cumulative_amount   = cumAmount
    list[index].cumulative_entitled = entitled
    list[index].retention           = retention
    list[index].this_line_net       = entitled - prevDisb
    setLines(list)
  }

  function updateDisbursementRate(index: number, rate: number) {
    const list = [...lines]
    list[index].taaliya_value    = rate
    list[index].disbursement_rate = rate
    const cumAmount = Number(list[index].cumulative_amount || 0)
    const entitled  = cumAmount * (rate / 100)
    const retention = cumAmount - entitled
    const prevDisb  = Number(list[index].previous_disbursed || 0)
    list[index].cumulative_entitled = entitled
    list[index].retention           = retention
    list[index].this_line_net       = entitled - prevDisb
    setLines(list)
  }

  function addLine() {
    const agg = Array.isArray(cert?.agreement) ? cert.agreement[0] : cert?.agreement
    setLines([...lines, {
      _id:                    'new-' + Date.now(),
      project_work_item_id:   '',
      item_code:              '',
      item_desc:              '',
      unit_id:                '',
      unit_name:              '',
      agreed_rate:            0,
      previous_quantity:      0,
      current_quantity:       0,
      cumulative_quantity:    0,
      cumulative_amount:      0,
      taaliya_type:           'percentage',
      taaliya_value:          Number(agg?.default_taaliya_value || 90),
      disbursement_rate:      Number(agg?.default_taaliya_value || 90),
      cumulative_entitled:    0,
      retention:              0,
      previous_disbursed:     0,
      this_line_net:          0,
      owner_billable:         true,
      notes:                  '',
    }])
  }

  function handleWorkItemChange(index: number, workItemId: string) {
    const selectedItem = workItems.find(i => i.id === workItemId)
    const list = [...lines]
    list[index] = {
      ...list[index],
      project_work_item_id: workItemId,
      item_code:            selectedItem?.item_code || '',
      item_desc:            selectedItem?.arabic_description || '',
      unit_id:              selectedItem?.default_unit_id || list[index].unit_id,
      unit_name:            selectedItem?.units?.arabic_name || '',
      agreed_rate:          Number(selectedItem?.subcontractor_price || 0),
      previous_quantity:    0,
    }
    setLines(list)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  const isEditable     = cert?.status === 'draft' || cert?.status === 'pending_approval'
  const canApprove     = cert?.status === 'pending_approval' || cert?.status === 'draft'
  const canEditOrApprove = status === 'draft' || status === 'pending_approval'

  // Summary totals (live, from current lines state)
  const totalCumulativeGross = lines.reduce((s, l) => s + Number(l.cumulative_amount   || 0), 0)
  const totalEntitled        = lines.reduce((s, l) => s + Number(l.cumulative_entitled || l.net_line_amount || 0), 0)
  const totalRetention       = lines.reduce((s, l) => s + Number(l.retention           || l.taaliya_amount  || 0), 0)
  // موقف الحساب التفصيلي
  const netDue               = Math.max(0, totalCumulativeGross - paidAmount)
  const afterAdvance         = Math.max(0, netDue - advanceTotal)
  const taxAmount            = afterAdvance * (taxRate / 100)
  const netFinal             = afterAdvance - taxAmount - totalRetention
  // للبطاقات العلوية
  const totalRemaining       = Math.max(0, totalEntitled - paidAmount)

  // IDs of work items already used in any line of this certificate
  const usedWorkItemIds = new Set(lines.map(l => l.project_work_item_id).filter(Boolean))

  const handleQuickApprove = async () => {
    setSaving(true)
    try {
      await approveCertificate(certId, projectId)
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الاعتماد')
    } finally {
      setSaving(false)
      setQuickApproveConfirm(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await deleteCertificate(certId, projectId)
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحذف')
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
    }
  }

  // Icons
  const EyeIcon   = ({ className }: { className?: string }) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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
  const TrashIcon = ({ className }: { className?: string }) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )

  return (
    <>
      {/* Quick action buttons on the list row */}
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={openModal} className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors" title="التفاصيل">
          <EyeIcon className="w-4 h-4" />
        </button>
        {canEditOrApprove && (
          <>
            <button onClick={openModal} className="p-1.5 rounded-md text-text-secondary hover:text-navy hover:bg-navy/10 transition-colors" title="تعديل">
              <EditIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setQuickApproveConfirm(true)} className="p-1.5 rounded-md text-text-secondary hover:text-success hover:bg-success/10 transition-colors" title="اعتماد">
              <CheckIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="p-1.5 rounded-md text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors" title="حذف">
              <TrashIcon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Quick Approve Confirm */}
      {quickApproveConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-navy mb-2 flex items-center gap-2">
              <CheckIcon className="w-6 h-6 text-success" />
              تأكيد الاعتماد النهائي
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              هل أنت متأكد من اعتماد هذا المستخلص بشكل نهائي؟ (لن يمكن تعديله بعد الاعتماد).
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setQuickApproveConfirm(false)} disabled={saving} className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm">تراجع</button>
              <button onClick={handleQuickApprove} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 transition-colors flex items-center justify-center gap-2 min-w-[130px] text-sm">
                {saving ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-navy mb-2 flex items-center gap-2">
              <TrashIcon className="w-6 h-6 text-danger" />
              تأكيد حـذف المستخلص
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              هل أنت متأكد من حذف هذا المستخلص نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(false)} disabled={saving} className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm">تراجع</button>
              <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 transition-colors flex items-center justify-center gap-2 min-w-[130px] text-sm">
                {saving ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN DIALOG */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6 lg:p-8">
          <div
            className="w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl relative"
            style={{ animation: 'selectDropdown 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-6 py-4 shrink-0">
              <div className="flex items-center gap-4">
                <button type="button" onClick={closeModal} className="rounded-full p-2 bg-white shadow-sm border border-border text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    المستخلص التراكمي {cert?.certificate_no ? `(${cert.certificate_no})` : ''}
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    كشف الموقف التراكمي للمقاول — حتى تاريخ:{' '}
                    <span className="font-medium dir-ltr">{cert?.period_to || '---'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto w-full p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-text-secondary">جاري تحميل المستخلص...</div>
              ) : !cert ? (
                <div className="py-12 text-center text-sm text-danger font-medium">المستخلص غير موجود.</div>
              ) : (
                <div className="space-y-6 pb-12">

                  {/* Title + Actions */}
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
                        مستخلص رقم: <span className="font-mono text-navy">{cert.certificate_no}</span>
                        {isEditable && <EditCertificateDialog certificate={cert} projectId={projectId} />}
                      </h1>
                      <p className="mt-1 text-sm text-text-secondary">
                        المقاول: {Array.isArray(cert.subcontractor) ? cert.subcontractor[0]?.arabic_name : cert.subcontractor?.arabic_name}{' '}
                        | العقد: {Array.isArray(cert.agreement) ? cert.agreement[0]?.agreement_code : cert.agreement?.agreement_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {cert.status === 'draft' && (
                        <button onClick={() => promptAction('submit')} disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm">تقديم للاعتماد</button>
                      )}
                      {canApprove && (
                        <button onClick={() => promptAction('approve')} disabled={saving} className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50 shadow-sm">اعتماد نهائي</button>
                      )}
                    </div>
                  </div>

                  {error      && <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger shadow-sm">{error}</div>}
                  {successMsg && (
                    <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success shadow-sm flex items-center gap-2 font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      {successMsg}
                    </div>
                  )}



                  {/* BOQ GRID */}
                  <div className="rounded-xl border border-border bg-white shadow-sm flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-border flex-wrap gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-text-primary">دفتر حصر الكميات التراكمي</h2>
                        <p className="text-xs text-text-tertiary mt-1">
                          من: <span className="dir-ltr font-medium">{cert.period_from || (Array.isArray(cert.agreement) ? cert.agreement[0]?.start_date : cert.agreement?.start_date) || '---'}</span>
                          {' '}حتى: <span className="dir-ltr font-medium">{cert.period_to || '---'}</span>
                        </p>
                      </div>
                      {isEditable && (
                        <button onClick={addLine} className="rounded-lg bg-primary/10 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/20 transition-colors">
                          + إضافة بند جديد
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-xs">الكود</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary min-w-[220px] text-xs">بند الأعمال</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-xs">وحدة</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-xs">السعر</th>
                            <th className="px-3 py-3 font-semibold text-green-700 bg-green-50/60 text-xs border-r border-border">كمية سابقة</th>
                            <th className="px-3 py-3 font-semibold text-navy bg-blue-50/60 text-xs border-r border-border">كمية حالية</th>
                            <th className="px-3 py-3 font-semibold text-text-primary bg-slate-50/60 text-xs border-r border-border">تراكمي كمية</th>
                            <th className="px-3 py-3 font-semibold text-text-primary text-xs border-r border-border">قيمة تراكمية</th>
                            <th className="px-3 py-3 font-semibold text-amber-700 text-xs border-r border-border">صرف %</th>
                            <th className="px-3 py-3 font-semibold text-success text-xs border-r border-border">مستحق تراكمي</th>
                            <th className="px-3 py-3 font-semibold text-text-secondary text-xs border-r border-border">محجوز</th>
                            {isEditable && <th className="px-3 py-3 w-10 text-center text-text-secondary text-xs"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={isEditable ? 12 : 11} className="py-8 text-center text-sm text-text-secondary">
                                لا يوجد بنود. {isEditable && 'انقر على "إضافة بند جديد".'}
                              </td>
                            </tr>
                          ) : lines.map((line, idx) => {
                            const cumulQty  = Number(line.previous_quantity || 0) + Number(line.current_quantity || 0)
                            const cumulAmt  = Number(line.cumulative_amount   || (cumulQty * Number(line.agreed_rate || 0)))
                            const disbRate  = Number(line.taaliya_value       || line.disbursement_rate || 0)
                            const entitled  = Number(line.cumulative_entitled || line.net_line_amount   || 0)
                            const retention = Number(line.retention           || line.taaliya_amount    || 0)

                            // Is this an inherited line from a previous certificate?
                            const isInherited = Number(line.previous_quantity) > 0

                            // Available work items for this line's dropdown:
                            // show all items NOT used by OTHER lines, plus the item already selected in THIS line
                            const availableItems = workItems.filter(wi =>
                              !lines.some((l, i) => i !== idx && l.project_work_item_id === wi.id)
                            )

                            return (
                              <tr key={line._id} className={`hover:bg-background-secondary/30 transition-colors ${isInherited ? '' : 'bg-blue-50/10'}`}>
                                {/* Code */}
                                <td className="px-3 py-2 text-xs text-text-secondary font-medium">{line.item_code || '---'}</td>

                                {/* Item desc / selector */}
                                <td className="px-3 py-2 min-w-[220px]">
                                  {isEditable && !isInherited ? (
                                    <select
                                      required
                                      value={line.project_work_item_id}
                                      onChange={e => handleWorkItemChange(idx, e.target.value)}
                                      className="w-full rounded border border-border/50 bg-white px-2 py-1.5 text-xs outline-none focus:border-primary min-w-[250px]"
                                    >
                                      <option value="" disabled>اختر البند...</option>
                                      {availableItems.map(wi => (
                                        <option key={wi.id} value={wi.id}>
                                          {wi.item_code ? `[${wi.item_code}] ` : ''}{wi.arabic_description}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className={`font-medium text-xs ${isInherited ? 'text-text-primary' : 'text-text-secondary'}`}>
                                      {line.item_desc || '---'}
                                    </span>
                                  )}
                                </td>

                                {/* Unit */}
                                <td className="px-3 py-2 text-xs text-text-secondary">{line.unit_name}</td>

                                {/* Rate */}
                                <td className="px-3 py-2 font-bold text-navy dir-ltr text-right text-xs">{Number(line.agreed_rate).toLocaleString('en-US')}</td>

                                {/* Previous Qty */}
                                <td className="px-3 py-2 bg-green-50/30 border-r border-border text-xs text-text-secondary dir-ltr text-right font-medium">
                                  {Number(line.previous_quantity).toLocaleString('en-US')}
                                </td>

                                {/* Current Qty (editable) */}
                                <td className="px-3 py-2 bg-blue-50/30 border-r border-border">
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={!isEditable}
                                    value={line.current_quantity === 0 ? '' : line.current_quantity}
                                    onChange={e => updateQuantity(idx, Number(e.target.value))}
                                    placeholder="0"
                                    className="w-20 rounded border border-border/50 bg-white px-2 py-1 text-xs outline-none focus:border-primary font-bold text-navy disabled:bg-transparent disabled:border-transparent dir-ltr text-right"
                                  />
                                </td>

                                {/* Cumulative Qty */}
                                <td className="px-3 py-2 bg-slate-50/40 border-r border-border text-xs font-bold text-text-primary dir-ltr text-right">
                                  {cumulQty.toLocaleString('en-US')}
                                </td>

                                {/* Cumulative Amount */}
                                <td className="px-3 py-2 border-r border-border text-xs font-bold text-navy dir-ltr text-right">
                                  {cumulAmt.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                </td>

                                {/* Disbursement rate % (editable) */}
                                <td className="px-3 py-2 border-r border-border">
                                  <div className="flex items-center gap-1 w-20">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      disabled={!isEditable}
                                      value={disbRate}
                                      onChange={e => updateDisbursementRate(idx, Number(e.target.value))}
                                      className="w-full rounded border border-border/50 bg-transparent px-2 py-1 text-xs outline-none focus:border-amber-500 text-amber-700 disabled:border-transparent dir-ltr text-right"
                                    />
                                    <span className="text-xs text-amber-700">%</span>
                                  </div>
                                </td>

                                {/* Cumulative Entitled */}
                                <td className="px-3 py-2 border-r border-border text-xs font-bold text-success dir-ltr text-right">
                                  {entitled.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                </td>

                                {/* Retention */}
                                <td className="px-3 py-2 border-r border-border text-xs text-danger/70 dir-ltr text-right">
                                  {retention.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                </td>

                                {/* Remove column */}
                                {isEditable && (
                                  <td className="px-3 py-2 text-center border-r border-border bg-background-secondary/20">
                                    {isInherited ? (
                                      // Inherited lines are locked — cannot be removed
                                      <span className="text-xs text-text-tertiary" title="بند موروث من مستخلص سابق — لا يمكن حذفه">🔒</span>
                                    ) : (
                                      // New lines added in this certificate — can be removed
                                      <button
                                        type="button"
                                        onClick={() => removeLine(idx)}
                                        className="p-1 rounded-md hover:bg-danger/10 hover:text-danger transition-colors text-text-tertiary"
                                        title="حذف البند"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Save button */}
                    {isEditable && (
                      <div className="p-4 bg-background-secondary/50 border-t border-border flex justify-end items-center">
                        <button
                          onClick={handleSaveLines}
                          disabled={saving}
                          className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'جارٍ الحفظ...' : 'حفظ وإعادة الحساب'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FINAL ACCOUNT SUMMARY — موقف الحساب */}
                  <div className="flex items-start justify-end gap-6" dir="rtl">
                    <div className="w-96 bg-navy rounded-xl text-white shrink-0 overflow-hidden">
                      {/* Title + Tax Input */}
                      <div className="px-5 py-3 bg-navy/80 border-b border-white/10 flex items-center justify-between">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">موقف الحساب</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50">ضريبة %</span>
                          <input
                            type="number" step="1" min="0" max="100"
                            value={taxRate}
                            onChange={e => setTaxRate(Number(e.target.value) || 0)}
                            className="w-14 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-center text-white outline-none focus:border-white/50 dir-ltr"
                          />
                        </div>
                      </div>

                      <div className="p-5 space-y-0">
                        {/* 1. الإجمالي التراكمي */}
                        <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                          <span className="text-sm text-white/80">إجمالي المستخلص التراكمي</span>
                          <span className="dir-ltr font-bold">
                            {totalCumulativeGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* 2. ما سبق صرفه */}
                        <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                          <span className="text-sm text-white/60">يُخصم: ما سبق صرفه</span>
                          <span className="dir-ltr text-white/60">
                            ({paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </span>
                        </div>

                        {/* 3. المستحق */}
                        <div className="flex justify-between items-center py-2.5 border-b border-white/20 bg-white/5 px-2 rounded-lg mb-1">
                          <span className="text-sm font-semibold">المستحق</span>
                          <span className="dir-ltr font-bold">
                            {netDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* 4. الدفعة المقدمة */}
                        {advanceTotal > 0 && (
                          <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                            <div className="flex flex-col">
                              <span className="text-sm text-white/70">يُخصم: الدفعة المقدمة</span>
                              <span className="text-[10px] text-white/40 mt-0.5">محسوب تلقائياً من الدفعات المقدمة المسجلة</span>
                            </div>
                            <span className="dir-ltr text-amber-300 font-bold">
                              ({advanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                            </span>
                          </div>
                        )}

                        {/* 5. الضريبة */}
                        {taxRate > 0 && (
                          <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                            <span className="text-sm text-white/60">يُخصم: الضريبة ({taxRate}%)</span>
                            <span className="dir-ltr text-white/60">
                              ({taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                            </span>
                          </div>
                        )}

                        {/* 6. محجوز نسبة الصرف */}
                        <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                          <div className="flex flex-col">
                            <span className="text-sm text-white/70">يُخصم: محتجزات نسبة الصرف</span>
                            <span className="text-[10px] text-white/40 mt-0.5">المبالغ غير المستحقة بناءً على نسب الصرف</span>
                          </div>
                          <span className="dir-ltr text-white/60">
                            ({totalRetention.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                          </span>
                        </div>

                        {/* 7. صافي المستحق */}
                        <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/20">
                          <span className="text-base font-bold">صافي المستحق</span>
                          <span className={`dir-ltr text-xl font-black ${netFinal >= 0 ? 'text-[#4ade80]' : 'text-red-400'}`}>
                            {netFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>


                </div>
              )}
            </div>

            {/* CONFIRMATION DIALOG */}
            {confirmDialog.isOpen && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="border-b border-border bg-background-secondary/50 px-5 py-4 flex items-center gap-3">
                    <div className={`p-2 rounded-full ${confirmDialog.action === 'submit' ? 'bg-amber-100 text-amber-600' : 'bg-success/20 text-success'}`}>
                      {confirmDialog.action === 'submit'
                        ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      }
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">تأكيد الإجراء</h3>
                      <p className="text-xs text-text-secondary">مستخلص رقم {cert?.certificate_no}</p>
                    </div>
                  </div>
                  <div className="px-5 py-6">
                    <p className="text-[15px] font-medium text-text-primary">
                      {confirmDialog.action === 'submit'
                        ? 'هل أنت متأكد من تقديم المستخلص للمراجعة والاعتماد؟'
                        : 'هل أنت متأكد من الاعتماد النهائي للمستخلص؟ (لن يمكنك تعديله بعد ذلك).'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-border bg-background-secondary/30 px-5 py-4">
                    <button type="button" onClick={() => setConfirmDialog({ isOpen: false, action: null })} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-border/50 transition-colors">
                      تراجع
                    </button>
                    <button type="button" onClick={executeAction} disabled={saving}
                      className={`rounded-lg px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 ${confirmDialog.action === 'submit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-success hover:bg-success/90'}`}
                    >
                      {saving ? 'جارٍ التنفيذ...' : 'نعم، تأكيد'}
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
