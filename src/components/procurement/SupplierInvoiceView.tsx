'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getInvoiceDetails, saveInvoiceLines, submitInvoiceForReceipt, confirmReceipt, receiveAdditionalQuantity } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'
import AttachmentsViewer from '@/components/AttachmentsViewer'

interface SupplierInvoiceViewProps {
  projectId: string
  invoiceId: string
  hideBreadcrumbs?: boolean
  onActionSuccess?: () => void
}

export default function SupplierInvoiceView({ projectId, invoiceId, hideBreadcrumbs = false, onActionSuccess }: SupplierInvoiceViewProps) {
  const [inv, setInv] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [confirmSignature, setConfirmSignature] = useState<'pm' | 'warehouse_manager' | null>(null)
  const [isPartialReceiptOpen, setPartialReceiptOpen] = useState(false)
  const [partialInputs, setPartialInputs] = useState<Record<string, number>>({})

  useEffect(() => {
    if (invoiceId) {
      load()
    }
  }, [invoiceId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getInvoiceDetails(invoiceId)
      setInv(data)
      setLines(data.lines || [])

      // fetch allowed warehouses for receipt
      const db = createClient()
      const { data: wh } = await db.from('warehouses').select('id, arabic_name').eq('project_id', projectId)
      setWarehouses(wh || [])
      if (wh && wh.length > 0) setWarehouseId(wh[0].id)

    } catch (err: any) {
      setError('خطأ في تحميل بيانات الفاتورة: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function updateLine(index: number, field: string, val: any) {
    const list = [...lines]
    list[index][field] = val
    // recalculate nets
    if (field === 'invoiced_quantity' || field === 'unit_price') {
      const q = list[index].invoiced_quantity || 0
      const p = list[index].unit_price || 0
      list[index].line_gross = q * p
      list[index].line_net = q * p
    }
    setLines(list)
  }

  async function handleSaveLines() {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      let gross = 0
      lines.forEach(l => gross += l.line_net)

      await saveInvoiceLines(inv.id, projectId, {
        gross_amount: gross,
        tax_amount: 0,
        discount_amount: 0,
        net_amount: gross,
        lines: lines
      })
      setSuccessMessage('تم حفظ تسعير وكميات الفاتورة بنجاح')
      await load()
      if (onActionSuccess) onActionSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReceipt() {
    if (!warehouseId) {
      setError('يجب تحديد مخزن للاستلام والتوريد')
      return
    }
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      await submitInvoiceForReceipt(inv.id, projectId, warehouseId)
      setSuccessMessage('تم إرسال الفاتورة للاستلام والتوريد بنجاح')
      await load()
      if (onActionSuccess) onActionSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleConfirmSignature(role: 'pm' | 'warehouse_manager') {
    setConfirmSignature(role)
  }

  async function executeConfirmSignature() {
    if (!confirmSignature) return
    const role = confirmSignature
    setConfirmSignature(null)
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const receivedLines = role === 'warehouse_manager'
        ? lines.map(l => ({ id: l.id, received_quantity: l.received_quantity ?? l.invoiced_quantity }))
        : undefined

      await confirmReceipt(inv.id, projectId, role, receivedLines)
      setSuccessMessage('تم اعتماد التوقيع بنجاح!')
      await load()
      if (onActionSuccess) onActionSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePartialSubmit() {
    if (!inv) return
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    const payload = Object.entries(partialInputs)
      .map(([id, qty]) => ({ id, new_quantity: Number(qty) }))
      .filter(x => x.new_quantity > 0)

    if (payload.length === 0) {
      setError('يرجى إدخال كمية واحدة على الأقل.')
      setSaving(false)
      return
    }

    try {
      await receiveAdditionalQuantity(inv.id, projectId, payload)
      setSuccessMessage('تم استلام وتسجيل الكميات الإضافية بنجاح')
      setPartialReceiptOpen(false)
      await load()
      if (onActionSuccess) onActionSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary p-8 text-center min-h-[300px] flex items-center justify-center">جاري تحميل الفاتورة...</div>
  if (!inv) return <div className="text-sm text-danger p-8 text-center min-h-[300px] flex items-center justify-center">الفاتورة غير موجودة.</div>

  const isEditable = inv.status === 'draft'
  const supplier = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
  const conf = inv.receipt_confirmation

  return (
    <div className="space-y-6 pb-6 mx-auto w-full max-w-5xl text-right">
      {!hideBreadcrumbs && (
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Link href={`/projects/${projectId}/procurement/invoices`} className="hover:text-primary transition-colors">فواتير الموردين</Link>
          <span>←</span>
          <span className="text-text-primary font-medium">{inv.invoice_no}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-text-primary">
              تطابق فاتورة مورد رقم: <span className="font-mono text-navy">{inv.invoice_no}</span>
            </h1>
            {inv.attachment_urls && inv.attachment_urls.length > 0 && (
              <AttachmentsViewer urls={inv.attachment_urls} />
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            جهة التوريد: {supplier?.arabic_name} | تاريخ הפاتورة: {inv.invoice_date}
          </p>
        </div>
        
        {isEditable && (
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <select
              title="مخزن الاستلام"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary w-full sm:w-64"
            >
              <option value="">-- اختر مخزن المشروع --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
            </select>
            <button
              onClick={handleSubmitForReceipt}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 w-full sm:w-auto whitespace-nowrap"
            >
              إرسال فاتورة مخزن / استلام
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* CONFIRMATION TRAY */}
      {(inv.status === 'pending_receipt' || inv.status === 'posted') && (
        <div className="rounded-xl border border-primary/20 bg-blue-50 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-navy mb-1">تأكيد استلام المواد (GRN - Goods Receipt Note)</h3>
            <p className="text-sm text-text-secondary">يتطلب النظام توقيع مزدوج لإدخال المواد إلى المخزن ورصد المديونية.</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className={`flex-1 sm:flex-none flex flex-col items-center p-3 rounded-lg border ${conf?.warehouse_manager_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
              <span className="text-xs font-bold mb-2">أمين المخزن</span>
              {conf?.warehouse_manager_status === 'approved' ? (
                <>
                  <span className="text-sm font-bold text-success">✓ تم الاستلام</span>
                  {inv.discrepancy_status === 'pending' && inv.can_wh_approve && (
                    <button
                      onClick={() => {
                        const ini: Record<string, number> = {}
                        lines.forEach(l => ini[l.id] = 0)
                        setPartialInputs(ini)
                        setPartialReceiptOpen(true)
                      }}
                      className="mt-2 rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-navy/90 whitespace-nowrap"
                    >
                      استكمال النواقص
                    </button>
                  )}
                </>
              ) : inv.can_wh_approve ? (
                <button onClick={() => handleConfirmSignature('warehouse_manager')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80 whitespace-nowrap">
                  توقيع الاستلام
                </button>
              ) : (
                <span className="text-xs text-text-secondary mt-1 text-center">ليس لديك صلاحية الاستلام</span>
              )}
            </div>

            <div className={`flex-1 sm:flex-none flex flex-col items-center p-3 rounded-lg border ${conf?.pm_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
              <span className="text-xs font-bold mb-2 text-center">المهندس / الاعتماد</span>
              {conf?.pm_status === 'approved' ? (
                <span className="text-sm font-bold text-success">✓ تم المطابقة</span>
              ) : inv.can_approve ? (
                <button onClick={() => handleConfirmSignature('pm')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80 whitespace-nowrap">
                  توقيع المطابقة
                </button>
              ) : (
                <span className="text-xs text-text-secondary mt-1 text-center">ليس لديك صلاحية الاعتماد</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOTALS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">حالة الفاتورة (النظام)</p>
          <p className="text-lg font-bold text-text-primary">
            {inv.status === 'draft' ? 'مسودة' :
             inv.status === 'pending_receipt' ? 'بانتظار تأكيد الاستلام' : 
             inv.status === 'posted' && inv.discrepancy_status === 'pending' ? 'مستلمة جزئياً (يوجد نواقص)' :
             inv.status === 'posted' ? 'مستلمة ومعتمدة (Posted)' : inv.status}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي الكلي (Net)</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{Number(inv.net_amount).toLocaleString()} ج.م</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الرصيد المتبقي (غير مسدد)</p>
          <p className="text-2xl font-black text-danger dir-ltr text-right">{Number(inv.net_amount - (inv.paid_to_date || 0)).toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* LINES GRID */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary">أصناف الفاتورة</h2>
          {isEditable && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hidden sm:inline-block">يمكنك تعديل الأسعار الفعلية والكميات المستلمة</span>}
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-secondary">الصنف (المادة)</th>
                <th className="px-4 py-3 font-semibold text-text-secondary text-center">الوحدة</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">كمية الفاتورة</th>
                <th className="px-4 py-3 font-semibold text-navy">مستلم فعلاً</th>
                <th className="px-4 py-3 font-semibold text-danger">متبقي (لم يستلم)</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">سعر الوحدة</th>
                <th className="px-4 py-3 font-semibold text-text-primary">الإجمالي الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line: any, idx: number) => {
                const item = Array.isArray(line.item) ? line.item[0] : line.item
                const unit = item?.unit ? (Array.isArray(item.unit) ? item.unit[0] : item.unit) : null
                const invoicedQty = Number(line.invoiced_quantity || 0)
                const receivedQty = (line.received_quantity !== null && line.received_quantity !== undefined)
                  ? Number(line.received_quantity)
                  : invoicedQty
                const pendingQty = Math.max(0, invoicedQty - receivedQty)
                const pendingValue = pendingQty * Number(line.unit_price || 0)
                const hasShortage = pendingQty > 0
                
                return (
                 <tr key={idx} className="hover:bg-background-secondary/30 transition-colors">
                    <td className="px-4 py-4 whitespace-normal min-w-[200px] text-text-primary font-medium">{item?.item_code} - {item?.arabic_name || '---'}</td>
                    <td className="px-4 py-4 text-center text-text-tertiary">{unit?.arabic_name || '---'}</td>
                    
                    {/* كمية الفاتورة */}
                    <td className="px-4 py-2 border-r border-border">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!isEditable}
                        value={line.invoiced_quantity}
                        onChange={e => updateLine(idx, 'invoiced_quantity', Number(e.target.value))}
                        className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-text-secondary disabled:bg-transparent disabled:border-transparent text-right dir-ltr transition-all"
                      />
                    </td>

                    {/* المستلم فعلاً */}
                    <td className="px-4 py-4 border-r border-border">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-bold dir-ltr ${hasShortage ? 'text-amber-700' : 'text-navy'}`}>
                          {receivedQty.toLocaleString()}
                        </span>
                        {hasShortage && (
                          <span className="text-[10px] text-amber-600 whitespace-nowrap">
                            {((receivedQty / invoicedQty) * 100).toFixed(0)}% من الفاتورة
                          </span>
                        )}
                      </div>
                    </td>

                    {/* المتبقي لم يستلم */}
                    <td className="px-4 py-4 border-r border-border">
                      {hasShortage ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-bold text-danger dir-ltr">{pendingQty.toLocaleString()}</span>
                          <span className="text-[10px] text-danger/80 whitespace-nowrap">
                            {Number(pendingValue).toLocaleString()} ج.م
                          </span>
                        </div>
                      ) : (
                        <span className="text-success font-bold text-sm">✓ مكتمل</span>
                      )}
                    </td>

                    <td className="px-4 py-2 border-r border-border">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!isEditable}
                        value={line.unit_price}
                        onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}
                        className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-text-primary disabled:bg-transparent disabled:border-transparent text-right dir-ltr transition-all"
                      />
                    </td>
                    
                    <td className="px-4 py-4 font-bold text-text-primary dir-ltr text-right bg-slate-50/50">
                      {Number(line.line_net).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {isEditable && (
          <div className="p-4 bg-background-secondary/50 border-t border-border flex justify-end">
            <button
              onClick={handleSaveLines}
              disabled={saving}
              className="rounded-lg bg-text-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-navy disabled:opacity-50 transition-colors whitespace-nowrap w-full sm:w-auto"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ الأصناف ومطابقة الحساب'}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmSignature && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setConfirmSignature(null)} />
          <div className={`relative w-full ${confirmSignature === 'warehouse_manager' ? 'max-w-4xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-2xl border border-border flex flex-col max-h-[90vh]`}>
            <h3 className="text-xl font-bold text-navy mb-4 text-right">
              {confirmSignature === 'warehouse_manager' ? 'تأكيد استلام البضاعة وإدخال المخزن' : 'تأكيد توقيع الاستلام'}
            </h3>
            
            {confirmSignature === 'warehouse_manager' ? (
              <div className="flex-1 overflow-y-auto mb-6 bg-background-secondary/30 rounded-xl border border-border hide-scrollbar text-right">
                <p className="p-4 text-sm text-text-secondary bg-white border-b border-border">
                  الرجاء مراجعة وإدخال الكميات المستلمة فعلياً. سيتم تسجيل المخزون بناءً على هذه الأرقام، وفي حال النقص سيتم تحويل الفاتورة لتسوية الفروق (إشعار خصم).
                </p>
                {loading ? (
                  <div className="p-8 text-center text-text-secondary animate-pulse">جاري تحميل الأصناف...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-background-secondary border-b border-border">
                        <tr>
                          <th className="font-semibold px-4 py-3 border-b text-navy text-right">الصنف</th>
                          <th className="font-semibold px-4 py-3 border-b text-navy text-center w-[15%]">الكمية المفوترة</th>
                          <th className="font-semibold px-4 py-3 border-b text-navy text-center w-[25%] bg-blue-50">الكمية المستلمة فعلياً</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lines.map((line: any, idx: number) => {
                          const item = Array.isArray(line.item) ? line.item[0] : line.item
                          const rqty = line.received_quantity ?? line.invoiced_quantity
                          const hasDiff = Number(rqty) < Number(line.invoiced_quantity)
                          return (
                            <tr key={idx} className="bg-white hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-text-primary text-right">{item?.item_code} - {item?.arabic_name || '---'}</td>
                              <td className="px-4 py-3 text-center dir-ltr text-text-secondary font-bold">{Number(line.invoiced_quantity)}</td>
                              <td className={`px-4 py-3 text-center bg-blue-50/30`}>
                                <div className="flex flex-col items-center">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={line.invoiced_quantity}
                                    value={rqty}
                                    onChange={e => {
                                      const list = [...lines]
                                      list[idx].received_quantity = e.target.value === '' ? 0 : Number(e.target.value)
                                      setLines(list)
                                    }}
                                    className="w-24 rounded border border-blue-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 font-bold text-navy text-center dir-ltr shadow-sm transition-all"
                                  />
                                  {hasDiff && <span className="text-[10px] text-danger font-bold mt-1">يوجد نقص ({Number(line.invoiced_quantity) - Number(rqty)})</span>}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-secondary text-right mb-6">
                تأكيد التوقيع الإلكتروني على البضاعة المستلمة؟ سيتم تحويلها لعهدتك في المخزن ولا يمكن التراجع عن ذلك.
              </p>
            )}

            <div className="flex gap-3 justify-end mt-auto pt-4 border-t border-border">
              <button
                onClick={() => setConfirmSignature(null)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={executeConfirmSignature}
                disabled={saving || (loading && confirmSignature === 'warehouse_manager')}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2 bg-success hover:bg-success/90"
              >
                {saving ? 'جاري الاعتماد...' : 'نعم، أؤكد توقيعي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Receipt Dialog */}
      {isPartialReceiptOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setPartialReceiptOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-border flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-navy mb-4 text-right">استكمال استلام نواقص التوريد</h3>
            <p className="text-text-secondary text-right mb-6 text-sm">
              أدخل فقط الكمية <span className="font-bold text-primary">الجديدة المستلمة اليوم</span> لكل صنف. سيتم دمجها وإضافتها لاستلامات الفاتورة.
            </p>
            
            <div className="flex-1 overflow-y-auto mb-6 bg-background-secondary/30 rounded-xl border border-border hide-scrollbar text-right">
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-background-secondary border-b border-border">
                    <tr>
                      <th className="font-semibold px-4 py-3 border-b text-navy text-right">الصنف</th>
                      <th className="font-semibold px-4 py-3 border-b text-navy text-center">المطلوب كليا</th>
                      <th className="font-semibold px-4 py-3 border-b text-success text-center">مُستلم سابقا</th>
                      <th className="font-semibold px-4 py-3 border-b text-danger text-center">متبقي كعجز</th>
                      <th className="font-semibold px-4 py-3 border-b text-primary text-center bg-blue-50/50">إضافة استلام جديد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.filter(l => Number(l.received_quantity ?? l.invoiced_quantity) < Number(l.invoiced_quantity)).map((l, idx) => {
                      const item = Array.isArray(l.item) ? l.item[0] : l.item
                      const invoiced = Number(l.invoiced_quantity || 0)
                      const received = Number(l.received_quantity ?? invoiced)
                      const shortage = invoiced - received
                      return (
                        <tr key={l.id} className="bg-white hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-text-primary text-right">{item?.item_code} - {item?.arabic_name || '---'}</td>
                          <td className="px-4 py-3 text-center dir-ltr text-text-secondary font-bold">{invoiced}</td>
                          <td className="px-4 py-3 text-center dir-ltr text-success font-bold">{received}</td>
                          <td className="px-4 py-3 text-center dir-ltr text-danger font-bold">{shortage}</td>
                          <td className="px-4 py-3 text-center bg-blue-50/30">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              max={shortage}
                              value={partialInputs[l.id] || ''}
                              onChange={e => {
                                let val = e.target.value === '' ? 0 : Number(e.target.value)
                                if (val > shortage) val = shortage
                                if (val < 0) val = 0
                                setPartialInputs(prev => ({ ...prev, [l.id]: val }))
                              }}
                              className="w-24 rounded border border-primary/40 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-black text-primary text-center dir-ltr shadow-sm transition-all"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-auto pt-4 border-t border-border">
              <button
                onClick={() => setPartialReceiptOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handlePartialSubmit}
                disabled={saving || (Object.values(partialInputs).filter(v => v > 0).length === 0)}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? 'جاري الاعتماد...' : 'استكمال وتسجيل الإذن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      {successMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setSuccessMessage(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-success animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 text-success">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-center text-navy mb-2">نجاح!</h3>
            <p className="text-center text-text-secondary mb-6">{successMessage}</p>
            <div className="flex justify-center">
              <button
                onClick={() => setSuccessMessage(null)}
                className="w-full rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-success/90 transition-colors"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
