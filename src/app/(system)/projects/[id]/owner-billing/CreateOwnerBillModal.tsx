'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createOwnerBillingDocument,
  updateOwnerBillingDocument,
  getBillableSubcontractorItems,
  getBillableStoreIssues,
  getBillableMaterialsOnSite,
  getPreviousBilledQuantities,
  getPreviousOwnerBillingLines,
  getOwnerBillingPendingStatus,
  getOwnerBillingDetails,
  getOwnerCollectedAmount,
  getOwnerAdvanceTotal,
  getProjectBasicInfo,
} from '@/actions/owner_billing'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'

interface BillLine {
  id: string
  line_description: string
  override_description: string
  unit_name: string           // وحدة القياس (نص حر)
  previous_quantity: number
  quantity: number
  cumulative_quantity: number
  unit_price: number
  disbursement_rate: number  // نسبة الصرف %
  notes: string
  is_material_on_site: boolean
  _inherited: boolean  // true = from previous doc, cannot delete
}

export default function CreateOwnerBillModal({
  projectId,
  editDocId,
  isOpenProp,
  onCloseProp,
}: {
  projectId: string
  editDocId?: string | null
  isOpenProp?: boolean
  onCloseProp?: () => void
}) {
  const router = useRouter()

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = isOpenProp !== undefined
  const isOpen = isControlled ? isOpenProp : internalIsOpen

  const handleClose = () => {
    if (isControlled && onCloseProp) onCloseProp()
    else setInternalIsOpen(false)
  }

  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [hasPending,     setHasPending]     = useState(false)
  const [pendingMsg,     setPendingMsg]      = useState<string | null>(null)
  const [collected,      setCollected]      = useState(0)
  const [advanceTotal,   setAdvanceTotal]   = useState(0)  // إجمالي الدفعات المقدمة — read-only

  const [formData, setFormData] = useState({
    document_no:       'تلقائي',
    billing_date:      new Date().toISOString().split('T')[0],
    end_date:          '',
    notes:             '',
    taxRate:           14,
    advance_deduction: 0,
  })

  const [lines,      setLines]      = useState<BillLine[]>([])
  const [subItems,   setSubItems]   = useState<any[]>([])
  const [storeIssues,setStoreIssues]= useState<any[]>([])
  const [materials,  setMaterials]  = useState<any[]>([])
  const [prevQtys,   setPrevQtys]   = useState<Record<string, number>>({})
  const [selectorType, setSelectorType] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen, editDocId])

  async function loadData() {
    setLoading(true)
    setError(null)
    setSaving(false)
    setHasPending(false)
    setPendingMsg(null)

    try {
      // Use server action (admin client) to bypass RLS reliably
      const projectInfo = await getProjectBasicInfo(projectId)

      if (!mountedRef.current) return

      if (!projectInfo?.owner_party_id) {
        setError('تعذر العثور على المالك. يرجى إعداده في بيانات المشروع أولاً.')
        setLoading(false)
        return
      }

      setProjectOwnerId(projectInfo.owner_party_id)

      if (editDocId) {
        // ── EDIT MODE: run all in parallel ─────────────────────────
        const [subs, issues, mats, prevqs, col, adv, docDetails] = await Promise.all([
          getBillableSubcontractorItems(projectId),
          getBillableStoreIssues(projectId),
          getBillableMaterialsOnSite(projectId),
          getPreviousBilledQuantities(projectId),
          getOwnerCollectedAmount(projectId),
          getOwnerAdvanceTotal(projectId),
          getOwnerBillingDetails(editDocId),
        ])

        if (!mountedRef.current) return

        setSubItems(subs)
        setStoreIssues(issues)
        setMaterials(mats)
        setPrevQtys(prevqs)
        setCollected(col)
        setAdvanceTotal(adv)
        setFormData(prev => ({ ...prev, advance_deduction: adv }))

        if (docDetails) {
          const tax = docDetails.gross_amount > 0
            ? Math.round((docDetails.tax_amount / docDetails.gross_amount) * 100)
            : 0
          setFormData({
            document_no:       docDetails.document_no,
            billing_date:      docDetails.billing_date,
            end_date:          docDetails.end_date || '',
            notes:             docDetails.notes || '',
            taxRate:           tax || 14,
            advance_deduction: adv,
          })
          const editLines: BillLine[] = (docDetails.lines || []).map((l: any) => ({
            id:                   Math.random().toString(),
            line_description:     l.line_description,
            override_description: l.override_description || '',
            unit_name:            l.unit_name || '',
            previous_quantity:    Number(l.previous_quantity || 0),
            quantity:             Number(l.quantity || 0),
            cumulative_quantity:  Number(l.cumulative_quantity || l.quantity || 0),
            unit_price:           Number(l.unit_price || 0),
            disbursement_rate:    Number(l.disbursement_rate ?? 100),
            notes:                l.notes || '',
            is_material_on_site:  l.is_material_on_site || false,
            _inherited:           Number(l.previous_quantity || 0) > 0,
          }))
          setLines(editLines)
        }

      } else {
        // ── CREATE MODE: run everything in parallel ─────────────────
        const [subs, issues, mats, prevqs, col, adv, pendingStatus, inheritedLines, seq] = await Promise.all([
          getBillableSubcontractorItems(projectId),
          getBillableStoreIssues(projectId),
          getBillableMaterialsOnSite(projectId),
          getPreviousBilledQuantities(projectId),
          getOwnerCollectedAmount(projectId),
          getOwnerAdvanceTotal(projectId),
          getOwnerBillingPendingStatus(projectId),
          getPreviousOwnerBillingLines(projectId),
          peekNextDocumentNoByProject(projectId, 'owner_billing_documents', `INV-${projectInfo.project_code || 'PRJ'}`),
        ])

        if (!mountedRef.current) return

        setSubItems(subs)
        setStoreIssues(issues)
        setMaterials(mats)
        setPrevQtys(prevqs)
        setCollected(col)
        setAdvanceTotal(adv)
        setFormData(prev => ({ ...prev, advance_deduction: adv, document_no: seq || 'تلقائي' }))

        if (pendingStatus.hasPending) {
          setHasPending(true)
          setPendingMsg(
            `يوجد فاتورة ${pendingStatus.pendingStatus === 'draft' ? 'كمسودة' : 'بانتظار الاعتماد'} (رقم ${pendingStatus.pendingNo}). يجب اعتمادها أو حذفها أولاً.`
          )
          return
        }

        setLines(inheritedLines.map(l => ({
          id:                   Math.random().toString(),
          line_description:     l.line_description,
          override_description: l.override_description || '',
          unit_name:            l.unit_name || '',
          previous_quantity:    Number(l.previous_quantity || 0),
          quantity:             0,
          cumulative_quantity:  Number(l.previous_quantity || 0),
          unit_price:           Number(l.unit_price || 0),
          disbursement_rate:    Number(l.disbursement_rate ?? 100),
          notes:                '',
          is_material_on_site:  l.is_material_on_site || false,
          _inherited:           true,
        })))
      }
    } catch (e: any) {
      if (mountedRef.current) setError('تعذر تحميل البيانات: ' + e.message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  // ── Line Helpers ──────────────────────────────────────────────────

  function addManualLine() {
    setLines([...lines, {
      id: Math.random().toString(),
      line_description:    '',
      override_description:'',
      unit_name:           '',
      previous_quantity:   0,
      quantity:            0,
      cumulative_quantity: 0,
      unit_price:          0,
      disbursement_rate:   100,
      notes:               '',
      is_material_on_site: false,
      _inherited:          false,
    }])
  }

  function addSelectedItems(items: any[], type: 'subcontractor' | 'store_issue' | 'material') {
    const newLines: BillLine[] = items.map(item => {
      let desc      = ''
      let qty       = 0
      let price     = 0
      let unit      = ''
      let isMaterial = false

      if (type === 'subcontractor') {
        desc  = item.project_work_items?.arabic_description || 'بند مقاول باطن'
        qty   = Number(item.cumulative_quantity || 0)
        price = Number(item.project_work_items?.owner_price || 0)
        unit  = item.project_work_items?.units?.arabic_name || ''
      } else if (type === 'store_issue') {
        desc  = item.items?.arabic_name || 'بند مهام أعمال'
        qty   = Number(item.quantity || 0)
      } else if (type === 'material') {
        desc       = item.item?.arabic_name || 'مادة تشوين'
        qty        = Number(item.quantity_on_hand || 0)
        price      = Number(item.weighted_avg_cost || 0)
        isMaterial = true
      }

      const prevQty   = prevQtys[desc] || 0
      const currentQty = Math.max(0, qty - prevQty)

      return {
        id:                   Math.random().toString(),
        line_description:     desc,
        override_description: '',
        unit_name:            unit,
        previous_quantity:    prevQty,
        quantity:             currentQty,
        cumulative_quantity:  prevQty + currentQty,
        unit_price:           price,
        disbursement_rate:    100,
        notes:                '',
        is_material_on_site:  isMaterial,
        _inherited:           false,
      }
    })

    setLines([...lines, ...newLines])
    setSelectorType(null)
  }

  function updateLine(id: string, field: keyof BillLine, val: any) {
    setLines(lines.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: val }
      if (field === 'quantity' || field === 'previous_quantity') {
        updated.cumulative_quantity = Number(updated.previous_quantity || 0) + Number(updated.quantity || 0)
      }
      if (field === 'cumulative_quantity') {
        updated.quantity = Math.max(0, Number(updated.cumulative_quantity || 0) - Number(updated.previous_quantity || 0))
      }
      return updated
    }))
  }

  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id))
  }

  // ── Totals ────────────────────────────────────────────────────────
  const totalCumulativeGross    = lines.reduce((s, l) => s + (l.cumulative_quantity * l.unit_price), 0)
  const totalCumulativeEntitled = lines.reduce((s, l) => s + (l.cumulative_quantity * l.unit_price * (l.disbursement_rate / 100)), 0)
  const totalCurrentGross       = lines.reduce((s, l) => s + (l.quantity * l.unit_price), 0)
  const totalCurrentEntitled    = lines.reduce((s, l) => s + (l.quantity * l.unit_price * (l.disbursement_rate / 100)), 0)
  // المستحق = الإجمالي التراكمي − ما سبق صرفه
  const netDue                  = Math.max(0, totalCumulativeGross - collected)
  // ضمان الأعمال = التراكمي − المستحق بنسبة الصرف
  const totalRetention          = totalCumulativeGross - totalCumulativeEntitled
  const taxAmount               = (netDue - formData.advance_deduction) * (formData.taxRate / 100)
  // صافي المستحق = المستحق − اهلاك − ضريبة − ضمان
  const netFinal                = netDue - formData.advance_deduction - taxAmount - totalRetention
  // legacy — محتاجها فقط للحفظ في قاعدة البيانات
  const netAmount               = netFinal
  const remaining               = Math.max(0, totalCumulativeEntitled - collected)

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectOwnerId) { setError('لا يوجد مالك مربوط بالمشروع.'); return }
    if (!formData.end_date) { setError('تاريخ الإغلاق (حتى تاريخ) إجباري.'); return }
    if (lines.length === 0) { setError('يرجى إضافة بند واحد على الأقل.'); return }
    if (lines.some(l => !l.line_description && !l.override_description)) {
      setError('يرجى كتابة وصف لجميع البنود.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const mappedLines = lines.map(l => ({
        line_description:     l.line_description || l.override_description,
        override_description: l.override_description || undefined,
        unit_name:            l.unit_name || undefined,
        previous_quantity:    l.previous_quantity,
        quantity:             l.quantity,
        cumulative_quantity:  l.cumulative_quantity,
        unit_price:           l.unit_price,
        disbursement_rate:    l.disbursement_rate,
        cumulative_amount:    l.cumulative_quantity * l.unit_price,
        cumulative_entitled:  l.cumulative_quantity * l.unit_price * (l.disbursement_rate / 100),
        line_gross:           l.quantity * l.unit_price,
        line_net:             l.quantity * l.unit_price * (l.disbursement_rate / 100),
        is_material_on_site:  l.is_material_on_site,
        notes:                l.notes,
      }))

      if (editDocId) {
        await updateOwnerBillingDocument(editDocId, {
          project_id:        projectId,
          owner_party_id:    projectOwnerId,
          billing_date:      formData.billing_date,
          end_date:          formData.end_date,
          gross_amount:      totalCumulativeGross,
          tax_amount:        taxAmount,
          net_amount:        netFinal,
          advance_deduction: formData.advance_deduction,
          notes:             formData.notes,
          lines:             mappedLines,
        })
      } else {
        await createOwnerBillingDocument({
          project_id:        projectId,
          owner_party_id:    projectOwnerId,
          document_no:       formData.document_no,
          billing_date:      formData.billing_date,
          end_date:          formData.end_date,
          gross_amount:      totalCumulativeGross,
          tax_amount:        taxAmount,
          net_amount:        netFinal,
          advance_deduction: formData.advance_deduction,
          notes:             formData.notes,
          lines:             mappedLines,
        })
      }

      setSaving(false)
      handleClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => !saving && handleClose()} />

      <div className="relative w-full max-w-6xl max-h-[95vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {editDocId ? 'تعديل فاتورة المالك' : 'فاتورة مالك جديدة (تراكمية)'}
            </h2>
            <p className="text-white/60 text-xs mt-0.5">
              {editDocId ? 'تعديل بنود الفاتورة الحالية' : 'البنود السابقة تُحمل تلقائياً بكمية صفر — أضف الكميات الجديدة فقط'}
            </p>
          </div>
          <button disabled={saving} onClick={handleClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-text-secondary font-medium">جاري التحميل...</p>
            </div>
          ) : hasPending ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-8 max-w-md text-center">
                <span className="text-4xl">⚠️</span>
                <h3 className="text-lg font-bold text-amber-800 mt-3 mb-2">لا يمكن إنشاء فاتورة جديدة</h3>
                <p className="text-sm text-amber-700">{pendingMsg}</p>
              </div>
            </div>
          ) : (
            <form id="owner-billing-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger font-bold flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              {/* 4 SUMMARY CARDS — تُحسب لحظياً من البنود */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي التراكمي</p>
                  <p className="text-lg font-bold text-navy dir-ltr text-right">{totalCumulativeGross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">المبالغ المسددة</p>
                  <p className="text-lg font-bold text-amber-600 dir-ltr text-right">{collected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
                  <p className="text-xs font-semibold text-text-secondary mb-1">ضمان أعمال</p>
                  <p className="text-lg font-bold text-danger/80 dir-ltr text-right">{(totalCumulativeGross - totalCumulativeEntitled).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-success/5 rounded-xl border-2 border-success p-4 shadow-sm">
                  <p className="text-xs font-semibold text-success mb-1">صافي المستحق</p>
                  <p className="text-lg font-black text-success dir-ltr text-right">{Math.max(0, totalCumulativeEntitled - collected).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Header Fields */}
              <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">رقم المطالبة</label>
                    <input
                      type="text" readOnly value={formData.document_no}
                      className="rounded-lg border border-border bg-background-secondary/50 px-3 py-2 text-sm text-text-secondary cursor-not-allowed font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 z-30">
                    <label className="text-sm font-medium text-text-primary">تاريخ الإصدار <span className="text-danger">*</span></label>
                    <DatePicker required value={formData.billing_date} onChange={val => setFormData({ ...formData, billing_date: val })} />
                  </div>
                  <div className="flex flex-col gap-1.5 z-20">
                    <label className="text-sm font-medium text-text-primary">حتى تاريخ (الإغلاق) <span className="text-danger">*</span></label>
                    <DatePicker required value={formData.end_date} onChange={val => setFormData({ ...formData, end_date: val })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">الضريبة (%)</label>
                    <input
                      type="number" step="0.1"
                      value={formData.taxRate}
                      onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                      className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dir-ltr text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Add Line Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setSelectorType('subcontractor')}
                  className="px-4 py-2 rounded-lg bg-white border border-border text-sm font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors shadow-sm flex items-center gap-2">
                  <span className="text-lg">+</span> أعمال مقاولي الباطن
                </button>
                <button type="button" onClick={() => setSelectorType('store_issue')}
                  className="px-4 py-2 rounded-lg bg-white border border-border text-sm font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors shadow-sm flex items-center gap-2">
                  <span className="text-lg">+</span> مهام الأعمال (صرف مخازن)
                </button>
                <button type="button" onClick={() => setSelectorType('material')}
                  className="px-4 py-2 rounded-lg bg-white border border-border text-sm font-semibold text-text-primary hover:border-amber-600 hover:text-amber-600 transition-colors shadow-sm flex items-center gap-2">
                  <span className="text-lg">+</span> تشوينات (مواد بالموقع)
                </button>
                <div className="w-px h-6 bg-border mx-1" />
                <button type="button" onClick={addManualLine}
                  className="px-4 py-2 rounded-lg bg-background-secondary border border-border text-sm font-bold text-text-secondary hover:bg-border/50 transition-colors flex items-center gap-2">
                  إدخال يدوي
                </button>
              </div>

              {/* BOQ Table */}
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-background-secondary border-b border-border text-text-secondary">
                      <tr>
                        <th className="px-4 py-3 font-semibold min-w-[250px]">الوصف</th>
                          <th className="px-4 py-3 font-semibold w-[80px] text-center text-text-secondary">وحدة</th>
                        <th className="px-4 py-3 font-semibold w-[100px] text-center bg-green-50/60 text-green-700">كمية سابقة</th>
                        <th className="px-4 py-3 font-semibold w-[100px] text-center bg-blue-50/60 text-navy">كمية حالية</th>
                        <th className="px-4 py-3 font-semibold w-[90px] text-center bg-slate-50/60">تراكمي كمية</th>
                        <th className="px-4 py-3 font-semibold w-[110px] text-center bg-navy/5 text-navy">سعر المالك</th>
                        <th className="px-4 py-3 font-semibold w-[80px] text-center bg-amber-50/60 text-amber-700">صرف %</th>
                        <th className="px-4 py-3 font-semibold w-[120px] text-center bg-navy/5">إجمالي تراكمي</th>
                        <th className="px-4 py-3 font-semibold w-[120px] text-center bg-success/10 text-success">مستحق تراكمي</th>
                        <th className="px-4 py-3 w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center text-text-secondary">
                            لا توجد بنود. استخدم الأزرار أعلاه لإضافة بنود الفاتورة.
                          </td>
                        </tr>
                      ) : lines.map((line) => (
                        <tr key={line.id} className={`hover:bg-background-secondary/30 transition-colors group ${line._inherited ? '' : 'bg-blue-50/20'}`}>
                          <td className="px-4 py-3">
                            {line._inherited ? (
                              // Inherited: show description, allow override edit
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-text-tertiary font-medium">البيان: {line.line_description}</span>
                                <input
                                  type="text"
                                  placeholder="وصف مخصص للطباعة..."
                                  value={line.override_description}
                                  onChange={e => updateLine(line.id, 'override_description', e.target.value)}
                                  className="w-full rounded bg-transparent border-b border-border/50 px-1 py-1 outline-none focus:border-primary text-sm"
                                />
                                {line.is_material_on_site && <span className="inline-block px-2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded w-max">تشوينات</span>}
                              </div>
                            ) : (
                              // New line: full description input
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  placeholder="وصف البند..."
                                  value={line.override_description || line.line_description}
                                  onChange={e => updateLine(line.id, 'line_description', e.target.value)}
                                  className="w-full rounded border border-border/50 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                                />
                                {line.is_material_on_site && <span className="inline-block px-2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded w-max mt-1">تشوينات</span>}
                              </div>
                            )}
                          </td>

                          {/* Unit */}
                          <td className="px-2 py-3 text-center">
                            <input
                              type="text"
                              placeholder="م²"
                              value={line.unit_name}
                              onChange={e => updateLine(line.id, 'unit_name', e.target.value)}
                              className="w-16 rounded border border-border/50 bg-transparent px-1 py-1.5 text-xs text-center text-text-secondary outline-none focus:border-primary"
                            />
                          </td>

                          {/* Previous Qty */}
                          <td className="px-4 py-3 bg-green-50/30 text-center">
                            <span className="font-medium text-text-secondary dir-ltr">
                              {Number(line.previous_quantity).toLocaleString()}
                            </span>
                          </td>

                          {/* Current Qty */}
                          <td className="px-4 py-3 bg-blue-50/40 text-center">
                            <input
                              type="number" step="0.01"
                              value={line.quantity || ''}
                              onChange={e => updateLine(line.id, 'quantity', Number(e.target.value))}
                              className="w-20 rounded border border-primary/40 bg-white px-2 py-1.5 text-center font-bold text-navy outline-none focus:border-primary dir-ltr"
                              placeholder="0"
                            />
                          </td>

                          {/* Cumulative Qty */}
                          <td className="px-4 py-3 bg-slate-50/40 text-center">
                            <span className="font-bold text-text-primary dir-ltr">
                              {Number(line.cumulative_quantity).toLocaleString()}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="px-4 py-3 bg-navy/5 text-center">
                            <input
                              type="number" step="0.01"
                              value={line.unit_price || ''}
                              onChange={e => updateLine(line.id, 'unit_price', Number(e.target.value))}
                              className="w-20 rounded border border-navy/30 bg-white px-2 py-1.5 text-center font-bold text-navy outline-none focus:border-navy dir-ltr"
                              placeholder="0"
                            />
                          </td>

                          {/* Disbursement Rate % */}
                          <td className="px-4 py-3 bg-amber-50/40 text-center">
                            <div className="flex items-center gap-0.5 w-16">
                              <input
                                type="number" step="0.1" min="0" max="100"
                                value={line.disbursement_rate}
                                onChange={e => updateLine(line.id, 'disbursement_rate', Number(e.target.value))}
                                className="w-full rounded border border-amber-300/60 bg-white px-1 py-1.5 text-center text-amber-700 font-bold outline-none focus:border-amber-500 dir-ltr text-xs"
                              />
                              <span className="text-xs text-amber-600">%</span>
                            </div>
                          </td>

                          {/* Cumulative Amount */}
                          <td className="px-4 py-3 bg-slate-100/60 text-center">
                            <span className="font-bold text-text-primary dir-ltr">
                              {(line.cumulative_quantity * line.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Cumulative Entitled */}
                          <td className="px-4 py-3 bg-success/5 text-center">
                            <span className="font-bold text-success dir-ltr">
                              {(line.cumulative_quantity * line.unit_price * (line.disbursement_rate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Delete */}
                          <td className="px-4 py-3 text-center">
                            {line._inherited ? (
                              <span className="text-xs text-text-tertiary" title="بند موروث — لا يمكن حذفه">🔒</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                className="text-danger/40 hover:text-danger hover:bg-danger/10 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="حذف البند"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">ملاحظات</label>
                  <textarea
                    rows={3} value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="w-80 bg-navy rounded-xl text-white shrink-0 overflow-hidden">
                  {/* Title */}
                  <div className="px-5 py-3 bg-navy/80 border-b border-white/10">
                    <p className="text-xs font-bold text-white/60 uppercase tracking-wider">موقف الحساب</p>
                  </div>

                  <div className="p-5 space-y-0">
                    {/* 1. الإجمالي التراكمي */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                      <span className="text-sm text-white/80">إجمالي المستخلص التراكمي</span>
                      <span className="dir-ltr font-bold">{totalCumulativeGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* 2. ما سبق صرفه */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                      <span className="text-sm text-white/60">يُخصم: ما سبق صرفه</span>
                      <span className="dir-ltr text-white/60">({collected.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                    </div>

                    {/* 3. المستحق */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/20 bg-white/5 px-2 rounded-lg mb-1">
                      <span className="text-sm font-semibold">المستحق</span>
                      <span className="dir-ltr font-bold">{netDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* 4. اهلاك الدفعة المقدمة — read-only (يُحسب من إجمالي الدفعات المقدمة المسجلة) */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                      <div className="flex flex-col">
                        <span className="text-sm text-white/70">يُخصم: إهلاك الدفعة المقدمة</span>
                        <span className="text-[10px] text-white/40 mt-0.5">محسوب تلقائياً من الدفعات المقدمة المستلمة</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-white/50 text-xs">(</span>
                        <span className="dir-ltr font-bold text-amber-300">
                          {advanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-white/50 text-xs">)</span>
                      </div>
                    </div>

                    {/* 5. الضريبة */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                      <span className="text-sm text-white/60">يُخصم: الضريبة ({formData.taxRate}%)</span>
                      <span className="dir-ltr text-white/60">({taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                    </div>

                    {/* 6. ضمان الأعمال */}
                    <div className="flex justify-between items-center py-2.5 border-b border-white/10">
                      <span className="text-sm text-white/60">يُخصم: ضمان الأعمال</span>
                      <span className="dir-ltr text-white/60">({totalRetention.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                    </div>

                    {/* 7. صافي المستحق */}
                    <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/20">
                      <span className="text-base font-bold">صافي المستحق</span>
                      <span className={`dir-ltr text-xl font-black ${netFinal >= 0 ? 'text-[#4ade80]' : 'text-red-400'}`}>
                        {netFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        {!loading && !hasPending && (
          <div className="px-6 py-4 border-t border-border bg-background flex justify-between gap-3">
            <button type="button" onClick={handleClose} disabled={saving} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors">
              إلغاء
            </button>
            <button type="submit" form="owner-billing-form" disabled={saving || !projectOwnerId}
              className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all hover:-translate-y-0.5">
              {saving ? 'جارٍ الحفظ...' : editDocId ? 'حفظ التعديلات' : 'حفظ مسودة الفاتورة ←'}
            </button>
          </div>
        )}

        {/* ── INNER SELECTOR MODAL ── */}
        {selectorType && (
          <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 pb-20">
            <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-4xl h-full max-h-full flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background-secondary/50">
                <h3 className="font-bold text-lg text-navy">
                  {selectorType === 'subcontractor' ? 'إضافة أعمال مقاولي الباطن المعتمدة' :
                   selectorType === 'store_issue'   ? 'إضافة بنود من مهام تنفيذية (صرف مخازن)' :
                   'إضافة تشوينات (أرصدة بالموقع)'}
                </h3>
                <button onClick={() => setSelectorType(null)} className="text-text-secondary hover:text-danger rounded-full p-1 bg-white border border-border shadow-sm">✕</button>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-background-secondary/20">

                {/* Subcontractors */}
                {selectorType === 'subcontractor' && (
                  <div>
                    {subItems.length === 0
                      ? <p className="text-center text-text-secondary p-8">لا توجد بنود مقاولي باطن معتمدة</p>
                      : (
                        <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                          <thead className="bg-background-secondary border-b border-border text-text-secondary">
                            <tr>
                              <th className="px-4 py-3 font-semibold">بند الأعمال</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">إجمالي المقاول</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">السابق (للمالك)</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">المتبقي</th>
                              <th className="px-4 py-3 font-semibold text-center w-[100px]">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {subItems.map((item, i) => {
                              const desc = item.project_work_items?.arabic_description || 'بند مقاول باطن'
                              const total = Number(item.cumulative_quantity || 0)
                              const prev  = prevQtys[desc] || 0
                              const remaining = Math.max(0, total - prev)
                              return (
                                <tr key={i} className="hover:bg-background-secondary/30">
                                  <td className="px-4 py-3">
                                    <p className="font-medium">{desc}</p>
                                    <p className="text-xs text-text-tertiary">{item.project_work_items?.item_code || ''}</p>
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-navy dir-ltr">{total.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center text-text-secondary dir-ltr">{prev.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remaining.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => addSelectedItems([item], 'subcontractor')} disabled={remaining <= 0}
                                      className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      إدراج
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                )}

                {/* Store Issues */}
                {selectorType === 'store_issue' && (
                  <div>
                    {storeIssues.length === 0
                      ? <p className="text-center text-text-secondary p-8">لا توجد مهام / صرف مخازن معتمدة</p>
                      : (
                        <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                          <thead className="bg-background-secondary border-b border-border text-text-secondary">
                            <tr>
                              <th className="px-4 py-3 font-semibold">الصنف / المهمة</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">إجمالي المنصرف</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">السابق</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px]">المتبقي</th>
                              <th className="px-4 py-3 font-semibold text-center w-[100px]">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {storeIssues.map((item, i) => {
                              const desc = item.items?.arabic_name || 'بند مهام'
                              const total = Number(item.quantity || 0)
                              const prev  = prevQtys[desc] || 0
                              const remaining = Math.max(0, total - prev)
                              return (
                                <tr key={i} className="hover:bg-background-secondary/30">
                                  <td className="px-4 py-3 font-medium">{desc}</td>
                                  <td className="px-4 py-3 text-center font-bold text-navy dir-ltr">{total.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center text-text-secondary dir-ltr">{prev.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remaining.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => addSelectedItems([item], 'store_issue')} disabled={remaining <= 0}
                                      className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      إدراج
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                )}

                {/* Materials */}
                {selectorType === 'material' && (
                  <div>
                    {materials.length === 0
                      ? <p className="text-center text-text-secondary p-8">لا توجد أرصدة مواد في الموقع</p>
                      : (
                        <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                          <thead className="bg-amber-50 border-b border-amber-200">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-amber-900">المادة المشونة</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px] text-amber-900">إجمالي الموقع</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px] text-amber-900">السابق</th>
                              <th className="px-4 py-3 font-semibold text-center w-[130px] text-amber-900">المتبقي</th>
                              <th className="px-4 py-3 font-semibold text-center w-[100px] text-amber-900">إجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {materials.map((item, i) => {
                              const desc = item.item?.arabic_name || 'مادة تشوين'
                              const total = Number(item.quantity_on_hand || 0)
                              const prev  = prevQtys[desc] || 0
                              const remaining = Math.max(0, total - prev)
                              return (
                                <tr key={i} className="hover:bg-amber-50/50">
                                  <td className="px-4 py-3 font-medium">{desc}</td>
                                  <td className="px-4 py-3 text-center font-bold text-amber-700 dir-ltr">{total.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center text-amber-900/60 dir-ltr">{prev.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remaining.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => addSelectedItems([item], 'material')} disabled={remaining <= 0}
                                      className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      إدراج مشون
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
