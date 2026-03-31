'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { 
  createOwnerBillingDocument,
  updateOwnerBillingDocument,
  getBillableSubcontractorItems, 
  getBillableStoreIssues, 
  getBillableMaterialsOnSite, 
  getPreviousBilledQuantities,
  getOwnerBillingDetails,
  getLastOwnerBillingEndDate
} from '@/actions/owner_billing'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'

interface BillLine {
  id: string; // temp id for react key
  sourceType: 'manual' | 'subcontractor' | 'store_issue' | 'material';
  sourceId?: string; // used to link to original item
  line_description: string;
  override_description: string;
  previous_quantity: number;
  quantity: number;      // Current Period
  cumulative_quantity: number; // To Date
  unit_price: number;
  notes: string;
  is_material_on_site: boolean;
}

export default function CreateOwnerBillModal({ 
  projectId,
  editDocId,
  isOpenProp,
  onCloseProp
}: { 
  projectId: string,
  editDocId?: string | null,
  isOpenProp?: boolean,
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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    document_no: 'تلقائي',
    billing_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    notes: '',
    taxRate: 14 // default VAT %
  })

  const [lines, setLines] = useState<BillLine[]>([])

  // External Items State
  const [subItems, setSubItems] = useState<any[]>([])
  const [storeIssues, setStoreIssues] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [prevQuantities, setPrevQuantities] = useState<Record<string, number>>({})
  const [lastEndDate, setLastEndDate] = useState<string | null>(null)

  // Selector Modal State
  const [selectorType, setSelectorType] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, editDocId])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    // Reset forms if not editing
    if (!editDocId) {
      setLines([])
      setFormData({
          document_no: 'تلقائي',
          billing_date: new Date().toISOString().split('T')[0],
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          notes: '',
          taxRate: 14
      })
    }
    setSelectorType(null)

    try {
      const db = createClient()
      const { data, error: prjErr } = await db.from('projects').select('owner_party_id, project_code').eq('id', projectId).single()
      if (data?.owner_party_id) {
        setProjectOwnerId(data.owner_party_id)
      } else {
        setError('تعذر العثور على المالك المرتبط بهذا المشروع. يرجى إعداد المالك في بيانات المشروع أولاً.')
      }

      // Fetch external items
      const [subs, issues, mats, prevqs, lastEnd] = await Promise.all([
        getBillableSubcontractorItems(projectId),
        getBillableStoreIssues(projectId),
        getBillableMaterialsOnSite(projectId),
        getPreviousBilledQuantities(projectId),
        getLastOwnerBillingEndDate(projectId, editDocId || undefined)
      ])

      setSubItems(subs)
      setStoreIssues(issues)
      setMaterials(mats)
      setPrevQuantities(prevqs)
      setLastEndDate(lastEnd)

      if (editDocId) {
        const docDetails = await getOwnerBillingDetails(editDocId)
        if (docDetails) {
          const defaultTaxRate = (docDetails.tax_amount / (docDetails.gross_amount || 1)) * 100
          setFormData({
            document_no: docDetails.document_no,
            billing_date: docDetails.billing_date,
            start_date: docDetails.start_date || docDetails.billing_date,
            end_date: docDetails.end_date || docDetails.billing_date,
            notes: docDetails.notes || '',
            taxRate: Math.round(defaultTaxRate) || 0
          })

          const loadedLines: BillLine[] = (docDetails.lines || []).map((l: any) => ({
             id: Math.random().toString(),
             sourceType: 'manual', // simplification, editing source type tracking wasn't persisted in schema explicitly without source_links
             line_description: l.line_description,
             override_description: l.override_description || '',
             previous_quantity: l.previous_quantity,
             quantity: l.quantity,
             cumulative_quantity: l.cumulative_quantity,
             unit_price: l.unit_price,
             notes: l.notes || '',
             is_material_on_site: l.is_material_on_site || false
          }))
          setLines(loadedLines)
        }
      } else {
        // Format INV-ProjCode
        const pCode = data?.project_code || 'PRJ'
        const seq = await peekNextDocumentNoByProject(projectId, 'owner_billing_documents', `INV-${pCode}`)
        
        let defaultStart = new Date().toISOString().split('T')[0]
        if (lastEnd) {
           const nextDay = new Date(lastEnd)
           nextDay.setDate(nextDay.getDate() + 1)
           defaultStart = nextDay.toISOString().split('T')[0]
        }
        setFormData(prev => ({ ...prev, document_no: seq || 'تلقائي', start_date: defaultStart }))
      }

    } catch (e: any) {
        setError('تعذر تحميل البيانات: ' + e.message)
    } finally {
        setLoading(false)
    }
  }

  const handleOpen = () => {
    if (!isControlled) setInternalIsOpen(true)
  }

  function addManualLine() {
    setLines([...lines, { 
      id: Math.random().toString(),
      sourceType: 'manual',
      line_description: '', 
      override_description: '',
      previous_quantity: 0,
      quantity: 1, 
      cumulative_quantity: 1,
      unit_price: 0, 
      notes: '',
      is_material_on_site: false
    }])
  }

  function addSelectedItems(items: any[], type: 'subcontractor' | 'store_issue' | 'material') {
    const newLines = items.map(item => {
      let desc = ''
      let qty = 0
      let price = 0
      let sourceId = ''
      let isMaterial = false

      if (type === 'subcontractor') {
        desc = item.project_work_items?.arabic_description || 'بند مقاول باطن'
        qty = Number(item.cumulative_quantity || 0)
        price = Number(item.project_work_items?.owner_price || 0)
        sourceId = item.id
      } else if (type === 'store_issue') {
        desc = item.items?.arabic_name || 'بند مهام أعمال'
        qty = Number(item.quantity || 0)
        sourceId = item.id
      } else if (type === 'material') {
        desc = item.item?.arabic_name || 'مادة تشوين'
        qty = Number(item.quantity_on_hand || 0)
        price = Number(item.weighted_avg_cost || 0) // Default to warehouse cost, user should overwrite with owner price.
        sourceId = item.item_id
        isMaterial = true
      }

      const prevQty = prevQuantities[desc] || 0
      // We expect the user wants to bill the "current" = (Total Final Quantity - Previous) 
      const currentQty = Math.max(0, qty - prevQty)

      return {
        id: Math.random().toString(),
        sourceType: type,
        sourceId,
        line_description: desc,
        override_description: '',
        previous_quantity: prevQty,
        quantity: currentQty,
        cumulative_quantity: prevQty + currentQty,
        unit_price: price,
        notes: '',
        is_material_on_site: isMaterial
      }
    })

    setLines([...lines, ...newLines])
    setSelectorType(null)
  }

  function updateLine(id: string, field: keyof BillLine, val: any) {
    setLines(lines.map(l => {
      if (l.id === id) {
        const updated = { ...l, [field]: val }
        // Auto calculate cumulative if current or previous changes
        if (field === 'quantity' || field === 'previous_quantity') {
           updated.cumulative_quantity = Number(updated.previous_quantity || 0) + Number(updated.quantity || 0)
        }
        // Auto calculate current if cumulative changes
        if (field === 'cumulative_quantity') {
           updated.quantity = Math.max(0, Number(updated.cumulative_quantity || 0) - Number(updated.previous_quantity || 0))
        }
        return updated
      }
      return l
    }))
  }

  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id))
  }

  // Auto-calculated totals
  const totalGross = lines.reduce((acc, l) => acc + ((l.quantity || 0) * (l.unit_price || 0)), 0)
  const taxAmount = totalGross * (formData.taxRate / 100)
  const netAmount = totalGross + taxAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectOwnerId) {
      setError('لا يمكن حفظ الفاتورة بدون المالك المربوط بالمشروع.')
      return
    }
    if (lines.length === 0) {
      setError('يرجى إضافة بند واحد على الأقل.')
      return
    }
    if (lines.some(l => !l.line_description && !l.override_description)) {
      setError('يرجى كتابة وصف لجميع البنود.')
      return
    }
    if (formData.start_date > formData.end_date) {
      setError('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.')
      return
    }
    if (lastEndDate && new Date(formData.start_date) <= new Date(lastEndDate)) {
      setError(`تاريخ البداية يتداخل مع الفاتورة السابقة التي تنتهي في ${lastEndDate}. يجب أن تبدأ الفاتورة بعد هذا التاريخ.`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const mappedLines = lines.map(l => {
        const lineVal = (l.quantity || 0) * (l.unit_price || 0)
        return {
          line_description: l.line_description || l.override_description,
          override_description: l.override_description || undefined,
          previous_quantity: l.previous_quantity,
          quantity: l.quantity,
          cumulative_quantity: l.cumulative_quantity,
          unit_price: l.unit_price,
          line_gross: lineVal,
          line_net: lineVal,
          is_material_on_site: l.is_material_on_site,
          notes: l.notes
        }
      })

      const payloadToSend = {
        project_id: projectId,
        owner_party_id: projectOwnerId,
        document_no: formData.document_no,
        billing_date: formData.billing_date,
        start_date: formData.start_date,
        end_date: formData.end_date,
        gross_amount: totalGross,
        tax_amount: taxAmount,
        net_amount: netAmount,
        notes: formData.notes,
        lines: mappedLines
      }

      if (editDocId) {
         await updateOwnerBillingDocument(editDocId, payloadToSend)
      } else {
         await createOwnerBillingDocument(payloadToSend)
      }
      
      handleClose()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
            <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => !saving && handleClose()} />
            
            <div className="relative w-full max-w-6xl max-h-[95vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          إعداد مسودة فاتورة مالك
                        </h2>
                    </div>
                    <button disabled={saving} onClick={() => handleClose()} className="rounded-full p-2 text-white/80 hover:bg-white/10 transition-colors">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 relative">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      <p className="text-text-secondary font-medium animate-pulse">جاري تحميل بيانات المالك والكميات السابقة...</p>
                    </div>
                ) : (
                    <form id="owner-billing-form" onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger font-bold shadow-sm flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        {/* Invoice Header details */}
                        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-5 relative overflow-visible z-20 group">
                            <div className="absolute top-0 right-0 w-2 h-full bg-primary/80 group-hover:bg-primary transition-colors rounded-r-xl -z-10"></div>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                <div className="flex flex-col gap-1.5 focus-within:text-primary">
                                    <label className="text-sm font-medium text-text-primary">رقم المطالبة <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        readOnly
                                        value={formData.document_no}
                                        onChange={e => setFormData({ ...formData, document_no: e.target.value })}
                                        className="rounded-lg border border-border bg-background-secondary/50 px-3 py-2 text-sm outline-none text-text-secondary cursor-not-allowed font-mono"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 focus-within:text-primary z-30">
                                    <label className="text-sm font-medium text-text-primary">تاريخ الإصدار <span className="text-danger">*</span></label>
                                    <DatePicker
                                        required
                                        value={formData.billing_date}
                                        onChange={val => setFormData({ ...formData, billing_date: val })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 focus-within:text-primary z-20">
                                    <label className="text-sm font-medium text-text-primary">من تاريخ <span className="text-danger">*</span></label>
                                    <DatePicker
                                        required
                                        value={formData.start_date}
                                        onChange={val => setFormData({ ...formData, start_date: val })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 focus-within:text-primary z-10">
                                    <label className="text-sm font-medium text-text-primary">إلى تاريخ <span className="text-danger">*</span></label>
                                    <DatePicker
                                        required
                                        value={formData.end_date}
                                        onChange={val => setFormData({ ...formData, end_date: val })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 focus-within:text-primary">
                                    <label className="text-sm font-medium text-text-primary">الضريبة (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={formData.taxRate}
                                        onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                        className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-right dir-ltr"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions row */}
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
                            <div className="w-px h-6 bg-border mx-2"></div>
                            <button type="button" onClick={addManualLine}
                                    className="px-4 py-2 rounded-lg bg-background-secondary border border-border text-sm font-bold text-text-secondary hover:bg-border/50 transition-colors flex items-center gap-2">
                                إدخال يدوي
                            </button>
                        </div>

                        {/* Line Items Table */}
                        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-background-secondary border-b border-border text-text-secondary">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold min-w-[250px]">الوصف للطباعة (تعديل حسب الرغبة)</th>
                                            <th className="px-4 py-3 font-semibold w-[120px] text-center">الكمية السابقة</th>
                                            <th className="px-4 py-3 font-semibold w-[120px] text-center text-primary bg-primary/5">الكمية الحالية</th>
                                            <th className="px-4 py-3 font-semibold w-[120px] text-center">الإجمالي للتاريخ</th>
                                            <th className="px-4 py-3 font-semibold w-[140px] text-center bg-navy/5">سعر المالك</th>
                                            <th className="px-4 py-3 font-semibold w-[140px] text-center bg-navy/5">الإجمالي (حالي)</th>
                                            <th className="px-4 py-3 font-semibold w-[50px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {lines.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                                                    لا توجد بنود مضافة بعد. استخدم الأزرار أعلاه لإضافة بنود الفاتورة.
                                                </td>
                                            </tr>
                                        )}
                                        {lines.map((line) => (
                                            <tr key={line.id} className="hover:bg-background-secondary/30 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-xs text-text-tertiary font-medium">البيان الأصلي: {line.line_description}</span>
                                                        <input 
                                                            type="text" 
                                                            placeholder="أدخل الوصف المخصص للمالك..."
                                                            value={line.override_description}
                                                            onChange={e => updateLine(line.id, 'override_description', e.target.value)}
                                                            className="w-full rounded bg-transparent border-b border-border/50 px-1 py-1 outline-none focus:border-primary transition-colors"
                                                        />
                                                        {line.is_material_on_site && <span className="inline-block px-2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded w-max mt-1">تشوينات</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" step="0.01" 
                                                        value={line.previous_quantity || ''}
                                                        onChange={e => updateLine(line.id, 'previous_quantity', e.target.value)}
                                                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-center outline-none focus:border-primary dir-ltr"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 bg-primary/5">
                                                    <input 
                                                        type="number" step="0.01" 
                                                        value={line.quantity || ''}
                                                        onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                                                        className="w-full rounded border border-primary/40 bg-white px-2 py-1.5 text-center font-bold text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary dir-ltr"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" step="0.01" 
                                                        value={line.cumulative_quantity || ''}
                                                        onChange={e => updateLine(line.id, 'cumulative_quantity', e.target.value)}
                                                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-center outline-none focus:border-primary dir-ltr"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 bg-navy/5">
                                                    <input 
                                                        type="number" step="0.01" 
                                                        value={line.unit_price || ''}
                                                        onChange={e => updateLine(line.id, 'unit_price', e.target.value)}
                                                        className="w-full rounded border border-navy/30 bg-white px-2 py-1.5 text-center font-bold text-navy outline-none focus:border-navy dir-ltr"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 bg-navy/5 text-center">
                                                    <span className="font-bold text-navy dir-ltr">
                                                        {((line.quantity || 0) * (line.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button type="button" onClick={() => removeLine(line.id)} className="text-danger/50 hover:text-danger hover:bg-danger/10 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totals Engine */}
                        <div className="flex justify-between items-start pt-4">
                            <div className="w-1/2 flex flex-col gap-1.5 focus-within:text-primary">
                                <label className="text-sm font-medium text-text-primary">ملاحظات عامة على المستند</label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-none"
                                />
                            </div>
                            <div className="w-1/3 space-y-3 bg-navy p-6 rounded-xl border border-navy shadow-lg text-white">
                                <div className="flex justify-between text-sm opacity-80">
                                    <span>إجمالي الأعمال والتشوينات الحالي:</span>
                                    <span className="font-medium dir-ltr">{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm opacity-80 pb-3 border-b border-white/20">
                                    <span>الضريبة ({formData.taxRate}%):</span>
                                    <span className="font-medium dir-ltr">{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold pt-2">
                                    <span>صافي الدفعة الحالية:</span>
                                    <span className="dir-ltr text-[#4ade80]">{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                    </form>
                )}
                </div>
                
                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-border bg-background flex justify-between gap-3 rounded-b-2xl relative z-20 shadow-sm">
                    <button
                        type="button"
                        onClick={() => handleClose()}
                        disabled={saving}
                        className="rounded-lg px-6 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors"
                    >
                        إلغاء التغييرات
                    </button>
                    <button
                        type="submit"
                        form="owner-billing-form"
                        disabled={saving || !projectOwnerId}
                        className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                    >
                        {saving ? 'جارٍ الحفظ...' : 'حفظ مسودة الفاتورة ←'}
                    </button>
                </div>

                {/* --- INNER SELECTOR MODAL --- */}
                {selectorType && (
                  <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 pb-20 fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-4xl h-full max-h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                      
                      <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background-secondary/50">
                        <h3 className="font-bold text-lg text-navy">
                          {selectorType === 'subcontractor' ? 'إضافة أعمال مقاولي الباطن المعتمدة' :
                           selectorType === 'store_issue' ? 'إضافة بنود من مهام تنفيذية (صرف مخازن)' :
                           'إضافة تشوينات (أرصدة بالموقع)'}
                        </h3>
                        <button onClick={() => setSelectorType(null)} className="text-text-secondary hover:text-danger rounded-full p-1 bg-white border border-border shadow-sm">✕</button>
                      </div>

                      <div className="flex-1 overflow-auto p-4 bg-background-secondary/20 hidden-scrollbar">
                        {/* Subcontractors */}
                        {selectorType === 'subcontractor' && (
                          <div className="grid grid-cols-1 gap-3">
                            {subItems.length === 0 ? <p className="text-center text-text-secondary p-8">لا توجد بنود مقاولي باطن معتمدة</p> : null}
                            {subItems.length > 0 && (
                            <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                              <thead className="bg-background-secondary border-b border-border text-text-secondary">
                                <tr>
                                  <th className="px-4 py-3 font-semibold">بند الأعمال المعتمد (وصف الباطن)</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">إجمالي المقاول</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">السابق (للمالك)</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">المتبقي المسموح</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[100px]">إجراء</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {subItems.map((item, i) => {
                                  const desc = item.project_work_items?.arabic_description || 'بند مقاول باطن'
                                  const totalQty = Number(item.cumulative_quantity || 0)
                                  const prevQty = prevQuantities[desc] || 0
                                  const remainingQty = Math.max(0, totalQty - prevQty)
                                  return (
                                  <tr key={i} className="hover:bg-background-secondary/30">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-text-primary">{desc}</p>
                                      <p className="text-xs text-text-tertiary mt-1">كود: <span className="dir-ltr">{item.project_work_items?.item_code || '---'}</span></p>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-navy dir-ltr">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center text-text-secondary dir-ltr">{prevQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remainingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button 
                                        onClick={() => addSelectedItems([item], 'subcontractor')}
                                        disabled={remainingQty <= 0}
                                        className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-primary/10 disabled:hover:text-primary disabled:cursor-not-allowed"
                                      >
                                        إدراج
                                      </button>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                            )}
                          </div>
                        )}

                        {/* Store Issues */}
                        {selectorType === 'store_issue' && (
                          <div className="grid grid-cols-1 gap-3">
                            {storeIssues.length === 0 ? <p className="text-center text-text-secondary p-8">لا توجد مهام أعمال / صرف مخازن معتمدة</p> : null}
                            <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                              <thead className="bg-background-secondary border-b border-border text-text-secondary">
                                <tr>
                                  <th className="px-4 py-3 font-semibold">الصنف / المهمة</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">إجمالي المنصرف</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">السابق (للمالك)</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px]">المتبقي المسموح</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[100px]">إجراء</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {storeIssues.map((item, i) => {
                                  const desc = item.items?.arabic_name || 'بند مهام أعمال'
                                  const totalQty = Number(item.quantity || 0)
                                  const prevQty = prevQuantities[desc] || 0
                                  const remainingQty = Math.max(0, totalQty - prevQty)
                                  return (
                                  <tr key={i} className="hover:bg-background-secondary/30">
                                    <td className="px-4 py-3 font-medium">{desc}</td>
                                    <td className="px-4 py-3 text-center font-bold text-navy dir-ltr">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center text-text-secondary dir-ltr">{prevQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remainingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button 
                                        onClick={() => addSelectedItems([item], 'store_issue')} 
                                        disabled={remainingQty <= 0}
                                        className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-primary/10 disabled:hover:text-primary disabled:cursor-not-allowed"
                                      >
                                        إدراج
                                      </button>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Materials */}
                        {selectorType === 'material' && (
                          <div className="grid grid-cols-1 gap-3">
                            {materials.length === 0 ? <p className="text-center text-text-secondary p-8">لا توجد أرصدة ومواد في موقع المشروع</p> : null}
                            <table className="w-full text-sm text-right bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                              <thead className="bg-amber-50 border-b border-amber-200">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-amber-900">المادة المشونة</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px] text-amber-900">إجمالي كمية الموقع</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px] text-amber-900">السابق (للمالك)</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[150px] text-amber-900">المتبقي المسموح</th>
                                  <th className="px-4 py-3 font-semibold text-center w-[100px] text-amber-900">إجراء</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100">
                                {materials.map((item, i) => {
                                  const desc = item.item?.arabic_name || 'مادة تشوين'
                                  const totalQty = Number(item.quantity_on_hand || 0)
                                  const prevQty = prevQuantities[desc] || 0
                                  const remainingQty = Math.max(0, totalQty - prevQty)
                                  return (
                                  <tr key={i} className="hover:bg-amber-50/50">
                                    <td className="px-4 py-3 font-medium">{desc}</td>
                                    <td className="px-4 py-3 text-center font-bold text-amber-700 dir-ltr">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center text-amber-900/60 dir-ltr">{prevQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center font-bold text-success dir-ltr">{remainingQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button 
                                        onClick={() => addSelectedItems([item], 'material')} 
                                        disabled={remainingQty <= 0}
                                        className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-600 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-amber-100 disabled:hover:text-amber-700 disabled:cursor-not-allowed"
                                      >
                                        إدراج مشون
                                      </button>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
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
