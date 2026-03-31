'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  getCertificateDetails, 
  getCertificateBOQGrid, 
  saveCertificateLines,
  submitCertificateForApproval,
  approveCertificate,
  getAgreementCumulativeMap
} from '@/actions/certificates'
import { getProjectWorkItems } from '@/actions/agreements'
import EditCertificateDialog from './EditCertificateDialog'

export default function ViewCertificateDialog({ certId, projectId, status }: { certId: string, projectId: string, status?: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const [cert, setCert] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [workItems, setWorkItems] = useState<any[]>([])
  const [cumulativeMap, setCumulativeMap] = useState<Record<string, number>>({})
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, action: 'submit' | 'approve' | null}>({ isOpen: false, action: null })
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const openModal = () => {
    setIsOpen(true)
    load(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    router.refresh()
  }

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const c = await getCertificateDetails(certId)
      setCert(c)
      
      const [boqGrid, items, map] = await Promise.all([
        getCertificateBOQGrid(c.subcontract_agreement_id, c.id),
        getProjectWorkItems(projectId),
        getAgreementCumulativeMap(c.subcontract_agreement_id)
      ])
      
      setLines((boqGrid || []).map((l: any, i: number) => ({ ...l, _id: l._id || `existing-${i}` })))
      setWorkItems(items || [])
      setCumulativeMap(map || {})
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
      await load(false) // refresh silently without unmounting the UI
      setSuccessMsg('تم حفظ الكميات وإعادة حساب إجماليات المستخلص بنجاح.')
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
      } else if (action === 'approve') {
        await approveCertificate(cert.id, projectId)
        setSuccessMsg('تم الاعتماد النهائي بنجاح.')
      }
      setTimeout(() => setSuccessMsg(null), 3000)
      await load(false)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSaving(false)
    }
  }

  function updateQuantity(index: number, qty: number) {
    const list = [...lines]
    list[index].current_quantity = qty
    setLines(list)
  }

  function updateTotalLineOverrides(index: number, field: string, val: any) {
    const list = [...lines]
    list[index][field] = val
    setLines(list)
  }

  function addLine() {
    const agg = Array.isArray(cert.agreement) ? cert.agreement[0] : cert.agreement
    setLines([...lines, {
      _id: 'new-' + Date.now(),
      project_work_item_id: '',
      item_code: '',
      item_desc: '',
      unit_id: '',
      unit_name: '',
      agreed_rate: 0,
      previous_quantity: 0,
      current_quantity: 0,
      taaliya_type: agg?.default_taaliya_type || 'percentage',
      taaliya_value: Number(agg?.default_taaliya_value || 5),
      owner_billable: true,
      notes: ''
    }])
  }

  function handleWorkItemChange(index: number, workItemId: string) {
    const selectedItem = workItems.find(i => i.id === workItemId)
    const prevQty = cumulativeMap[workItemId] || 0
    
    const list = [...lines]
    list[index] = {
      ...list[index],
      project_work_item_id: workItemId,
      item_code: selectedItem?.item_code || '',
      item_desc: selectedItem?.arabic_description || '',
      unit_id: selectedItem?.default_unit_id || list[index].unit_id,
      unit_name: selectedItem?.units?.arabic_name || '',
      agreed_rate: Number(selectedItem?.subcontractor_price || 0),
      previous_quantity: prevQty
    }
    setLines(list)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  const isEditable = cert?.status === 'draft' || cert?.status === 'pending_approval'
  const canApprove = cert?.status === 'pending_approval' || cert?.status === 'draft'

  const canEditOrApprove = status === 'draft' || status === 'pending_approval'
  const [quickApproveConfirm, setQuickApproveConfirm] = useState(false)

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

      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={openModal}
          className="p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors tooltip-wrapper"
          title="التفاصيل"
        >
          <EyeIcon className="w-4 h-4" />
        </button>

        {canEditOrApprove && (
          <>
            <button
              onClick={openModal}
              className="p-1.5 rounded-md text-text-secondary hover:text-navy hover:bg-navy/10 transition-colors tooltip-wrapper"
              title="تعديل"
            >
              <EditIcon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setQuickApproveConfirm(true)}
              className="p-1.5 rounded-md text-text-secondary hover:text-success hover:bg-success/10 transition-colors tooltip-wrapper"
              title="اعتماد"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {quickApproveConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 text-right dir-rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-navy mb-2 flex items-center gap-2">
              <CheckIcon className="w-6 h-6 text-success" />
              تأكيد الاعتماد النهائي
            </h3>
            <p className="text-text-secondary mb-6 text-sm leading-relaxed">
              هل أنت متأكد من اعتماد وحفظ هذا المستخلص بشكل نهائي؟ (بمجرد الاعتماد، لن يمكنك تعديل الكميات).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setQuickApproveConfirm(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-black/5 transition-colors text-sm"
                disabled={saving}
              >
                تراجع
              </button>
              <button
                onClick={handleQuickApprove}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-success hover:bg-success/90 transition-colors flex items-center justify-center gap-2 min-w-[130px] text-sm"
              >
                {saving ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6 lg:p-8">
          <div 
            className="w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl relative"
            style={{ animation: 'selectDropdown 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-border bg-background-secondary/50 px-6 py-4 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full p-2 bg-white shadow-sm border border-border text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    تفاصيل المستخلص {cert?.certificate_no ? `(${cert.certificate_no})` : ''}
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    استعراض وإدارة بنود الأعمال للمستخلص.
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
                <div className="space-y-6 pb-12 overflow-x-hidden">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
                        مستخلص رقم: <span className="font-mono text-navy">{cert.certificate_no}</span>
                        {isEditable && <EditCertificateDialog certificate={cert} projectId={projectId} />}
                      </h1>
                      <p className="mt-1 text-sm text-text-secondary">
                        المقاول: {Array.isArray(cert.subcontractor) ? cert.subcontractor[0]?.arabic_name : cert.subcontractor?.arabic_name} | 
                        العقد: {Array.isArray(cert.agreement) ? cert.agreement[0]?.agreement_code : cert.agreement?.agreement_code}
                      </p>
                    </div>
                    
                    {/* ACTIONS */}
                    <div className="flex items-center gap-3">
                      {cert.status === 'draft' && (
                        <button
                          onClick={() => promptAction('submit')}
                          disabled={saving}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          تقديم للاعتماد
                        </button>
                      )}
                      {canApprove && (
                        <button
                          onClick={() => promptAction('approve')}
                          disabled={saving}
                          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          اعتماد نهائي (Approve)
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger shadow-sm">
                      {error}
                    </div>
                  )}

                  {successMsg && (
                    <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success shadow-sm flex items-center gap-2 font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      {successMsg}
                    </div>
                  )}

                  {/* DASHBOARD WIDGETS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">حالة المستخلص</p>
                      <p className="text-lg font-bold text-text-primary">
                        {cert.status === 'draft' ? 'مسودة (Draft)' : 
                         cert.status === 'pending_approval' ? 'بانتظار الاعتماد' : 
                         cert.status === 'approved' ? 'معتمد' : 'مغلق'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي (Gross)</p>
                      <p className="text-xl font-bold text-navy dir-ltr text-right">{Number(cert.gross_amount).toLocaleString()} ج.م</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold text-text-secondary mb-1 cursor-help" title="إجمالي الاستقطاعات والتعليات">الخصومات (Ta'liya & Deds)</p>
                      <p className="text-xl font-bold text-danger dir-ltr text-right">
                        {(Number(cert.taaliya_amount) + Number(cert.other_deductions_amount)).toLocaleString()} ج.م
                      </p>
                    </div>
                    <div className="rounded-xl border border-success bg-success/5 p-5 shadow-sm">
                      <p className="text-xs font-semibold text-success mb-1">الصافي للدفع (Net Payable)</p>
                      <p className="text-2xl font-black text-success dir-ltr text-right">{Number(cert.net_amount).toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  {/* BOQ GRID */}
                  <div className="rounded-xl border border-border bg-white shadow-sm flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-border flex-wrap gap-4">
                      <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold text-text-primary">دفتر حصر الكميات (B.O.Q Ledger)</h2>
                        <div className="text-sm text-text-tertiary">
                          فترة التنفيذ: <span className="dir-ltr inline-block">{cert.period_from || '---'} : {cert.period_to || '---'}</span>
                        </div>
                      </div>
                      {isEditable && (
                        <button
                          onClick={addLine}
                          className="rounded-lg bg-primary/10 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/20 transition-colors"
                        >
                          + إضافة بند حصر
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-text-secondary">الكود</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary min-w-[250px]">بند الأعمال (البيان)</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">الوحدة</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary">فئة (السعر)</th>
                            <th className="px-4 py-3 font-semibold text-text-secondary border-r border-border bg-green-50/50">كمية سابقة</th>
                            <th className="px-4 py-3 font-semibold text-navy border-r border-border bg-blue-50/50">الكمية الحالية</th>
                            <th className="px-4 py-3 font-semibold text-text-primary border-r border-border bg-slate-50">الإجمالي التراكمي</th>
                            <th className="px-4 py-3 font-semibold text-amber-600 border-r border-border">تعلية الخط (%)</th>
                            {isEditable && <th className="px-4 py-3 w-12 text-center text-text-secondary"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={isEditable ? 10 : 9} className="py-8 text-center text-sm text-text-secondary">
                                لا يوجد بنود أعمال مدرجة في هذا المستخلص. {isEditable && 'انقر على "إضافة بند حصر".'}
                              </td>
                            </tr>
                          ) : lines.map((line, idx) => (
                            <tr key={line._id} className="hover:bg-background-secondary/30 transition-colors">
                              <td className="px-4 py-2 font-medium text-text-secondary text-xs">{line.item_code || '---'}</td>
                              <td className="px-4 py-2 whitespace-normal min-w-[250px] overflow-visible z-10">
                                {isEditable ? (
                                  <select
                                    required
                                    value={line.project_work_item_id}
                                    onChange={e => handleWorkItemChange(idx, e.target.value)}
                                    className="w-full rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary text-text-primary min-w-[300px]"
                                  >
                                    <option value="" disabled>اختر البند المعتمد...</option>
                                    {workItems.map(wi => (
                                      <option key={wi.id} value={wi.id}>
                                        {wi.item_code ? `[${wi.item_code}] ` : ''}{wi.arabic_description}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-text-primary font-medium">{line.item_desc}</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-text-secondary">{line.unit_name}</td>
                              <td className="px-4 py-2 font-bold text-navy dir-ltr text-right">{line.agreed_rate.toLocaleString()}</td>
                              
                              <td className="px-4 py-3 text-text-secondary border-r border-border bg-green-50/30 font-medium dir-ltr text-right">
                                {line.previous_quantity}
                              </td>
                              
                              <td className="px-4 py-2 border-r border-border bg-blue-50/30">
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={!isEditable}
                                  value={line.current_quantity === 0 ? '' : line.current_quantity}
                                  onChange={e => updateQuantity(idx, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-navy disabled:bg-transparent disabled:border-transparent text-right dir-ltr"
                                />
                              </td>
                              
                              <td className="px-4 py-3 font-bold text-text-primary border-r border-border bg-slate-50/50 dir-ltr text-right">
                                {(Number(line.previous_quantity) + Number(line.current_quantity)).toFixed(2)}
                              </td>
            
                              <td className="px-4 py-2 border-r border-border">
                                <div className="flex items-center gap-1 w-24">
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={!isEditable}
                                    value={line.taaliya_value}
                                    onChange={e => updateTotalLineOverrides(idx, 'taaliya_value', Number(e.target.value))}
                                    className="w-full rounded border border-border/50 bg-transparent px-2 py-1 text-xs outline-none focus:border-amber-500 text-amber-700 disabled:border-transparent dir-ltr text-right"
                                  />
                                  <span className="text-xs text-amber-700">
                                    {line.taaliya_type === 'percentage' ? '%' : 'ثابت'}
                                  </span>
                                </div>
                              </td>
                              
                              {isEditable && (
                                <td className="px-4 py-2 text-center text-text-secondary border-r border-border bg-background-secondary/30">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(idx)}
                                    className="p-1.5 rounded-md hover:bg-danger/10 hover:text-danger transition-colors text-text-tertiary"
                                    title="حذف البند"
                                  >
                                    ✕
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
            
                    {isEditable && (
                      <div className="p-4 bg-background-secondary/50 border-t border-border flex justify-end">
                        <button
                          onClick={handleSaveLines}
                          disabled={saving}
                          className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'جارٍ الحفظ...' : 'حفظ الكميات وحساب المستخلص'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CONFIRMATION DIALOG */}
            {confirmDialog.isOpen && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                  {/* Header */}
                  <div className="border-b border-border bg-background-secondary/50 px-5 py-4 flex items-center gap-3">
                    <div className={`p-2 rounded-full ${confirmDialog.action === 'submit' ? 'bg-amber-100 text-amber-600' : 'bg-success/20 text-success'}`}>
                      {confirmDialog.action === 'submit' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">تأكيد الإجراء</h3>
                      <p className="text-xs text-text-secondary">
                        مستخلص المستخلص رقم {cert?.certificate_no}
                      </p>
                    </div>
                  </div>
      
                  {/* Body */}
                  <div className="px-5 py-6">
                    <p className="text-[15px] font-medium text-text-primary">
                      {confirmDialog.action === 'submit' 
                        ? 'هل أنت متأكد من تقديم المستخلص للمراجعة والاعتماد؟ (لا يزال بإمكانك تعديل الكميات حتى الاعتماد النهائي).' 
                        : 'هل أنت متأكد من الاعتماد النهائي للمستخلص؟ (لن يمكنك تعديل بياناته أو كمياته بعد ذلك).'}
                    </p>
                  </div>
      
                  {/* Footer */}
                  <div className="flex items-center justify-end gap-3 border-t border-border bg-background-secondary/30 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setConfirmDialog({ isOpen: false, action: null })}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-border/50 transition-colors"
                      disabled={saving}
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      onClick={executeAction}
                      disabled={saving}
                      className={`rounded-lg px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 ${
                        confirmDialog.action === 'submit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-success hover:bg-success/90'
                      }`}
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
