'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceDetails, saveInvoiceLines, submitInvoiceForReceipt, confirmReceipt, getSupplierReturns, deleteSupplierReturn, postSupplierReturn, receiveAdditionalQuantity } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'
import SupplierReturnDialog from './SupplierReturnDialog'

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

interface SupplierInvoiceRowActionsProps {
  inv: any
  projectId: string
  canApprove: boolean
  canWhApprove: boolean
  confirmation: any
}

export default function SupplierInvoiceRowActions({ inv: rowInv, projectId, canApprove, canWhApprove, confirmation }: SupplierInvoiceRowActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  
  const [inv, setInv] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [confirmSignature, setConfirmSignature] = useState<'pm' | 'warehouse_manager' | null>(null)
  const [confirmAction, setConfirmAction] = useState<{type: 'delete_return' | 'post_return', retId: string} | null>(null)
  const [isPartialReceiptOpen, setPartialReceiptOpen] = useState(false)
  const [partialInputs, setPartialInputs] = useState<Record<string, number>>({})

  const [returns, setReturns] = useState<any[]>([])
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  
  // State for viewing a specific return's details
  const [viewReturn, setViewReturn] = useState<any>(null)

  const openModal = async () => {
    setIsOpen(true)
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const data = await getInvoiceDetails(rowInv.id)
      setInv(data)
      setLines(data.lines || [])

      const retData = await getSupplierReturns(rowInv.id)
      setReturns(retData || [])

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

  const closeModal = () => setIsOpen(false)

  async function reloadData() {
    try {
      const data = await getInvoiceDetails(rowInv.id)
      setInv(data)
      setLines(data.lines || [])
      
      const retData = await getSupplierReturns(rowInv.id)
      setReturns(retData || [])
    } catch(err) {}
    router.refresh()
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
    if (!inv) return
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
      await reloadData()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReceipt() {
    if (!inv) return
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
      await reloadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmReceipt() {
    if (!inv || !confirmSignature) return
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      await confirmReceipt(inv.id, projectId, confirmSignature)
      await reloadData()
      setConfirmSignature(null)
      setSuccessMessage('تم تأكيد التوقيع بنجاح')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteReturn(retId: string) {
    setSaving(true)
    setError(null)
    try {
      await deleteSupplierReturn(retId)
      await reloadData()
      setSuccessMessage('تم الحذف بنجاح')
      setConfirmAction(null)
    } catch(err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePostReturn(retId: string) {
    setSaving(true)
    setError(null)
    try {
      await postSupplierReturn(retId)
      await reloadData()
      setSuccessMessage('تم الترحيل بنجاح')
      setConfirmAction(null)
    } catch(err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSignature(role: 'pm' | 'warehouse_manager', e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setConfirmSignature(role)
    if (role === 'warehouse_manager' && lines.length === 0) {
      setLoading(true)
      try {
        const data = await getInvoiceDetails(rowInv.id)
        setInv(data)
        setLines(data.lines || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
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

      await confirmReceipt(rowInv.id, projectId, role, receivedLines)
      setSuccessMessage('تم اعتماد التوقيع بنجاح!')
      if (isOpen) {
        await reloadData()
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
      if (!isOpen) {
        alert(err.message)
      }
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
      
      if (isOpen) {
        await reloadData()
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isRowEditable = rowInv.status === 'draft'
  const isPendingReceipt = rowInv.status === 'pending_receipt'

  return (
    <div className="flex items-center gap-2 justify-end">
      {/* Quick Actions in Row */}
      {isPendingReceipt && canWhApprove && confirmation?.warehouse_manager_status !== 'approved' && (
        <button
          onClick={openModal}
          title="توقيع الاستلام (أمين المخزن)"
          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <CheckCircleIcon />
        </button>
      )}

      {isPendingReceipt && canApprove && confirmation?.pm_status !== 'approved' && (
        <button
          onClick={openModal}
          title="توقيع المطابقة (مدير المشروع)"
          className="p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors"
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

      {/* Details Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">تطابق فاتورة مورد <span className="font-mono text-white/90 text-sm mr-2">{rowInv.invoice_no}</span></h2>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              {loading ? (
                <div className="py-12 text-center text-text-secondary animate-pulse">جاري تحميل الفاتورة...</div>
              ) : !inv ? (
                <div className="text-sm text-danger">الفاتورة غير موجودة.</div>
              ) : (
                <div className="space-y-6">
                  {/* Action Bar inside Dialog */}
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
                    <div>
                      <h3 className="text-lg font-bold text-navy">{inv.invoice_no}</h3>
                      <p className="text-sm text-text-secondary">جهة التوريد: {Array.isArray(inv.supplier) ? inv.supplier[0]?.arabic_name : inv.supplier?.arabic_name} | تاريخ الفاتورة: {inv.invoice_date}</p>
                    </div>
                    {inv.status === 'draft' && (
                      <div className="flex items-center gap-2">
                        <select
                          title="مخزن الاستلام"
                          value={warehouseId}
                          onChange={e => setWarehouseId(e.target.value)}
                          className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary w-64"
                        >
                          <option value="">-- اختر مخزن المشروع --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
                        </select>
                        <button
                          onClick={handleSubmitForReceipt}
                          disabled={saving}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                    <div className="rounded-xl border border-primary/20 bg-blue-50 p-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-navy mb-1">تأكيد استلام المواد (GRN - Goods Receipt Note)</h3>
                        <p className="text-sm text-text-secondary">يتطلب النظام توقيع مزدوج لإدخال المواد إلى المخزن ورصد المديونية.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`flex flex-col items-center p-3 rounded-lg border ${inv.receipt_confirmation?.warehouse_manager_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
                          <span className="text-xs font-bold mb-2">أمين المخزن</span>
                          {inv.receipt_confirmation?.warehouse_manager_status === 'approved' ? (
                            <span className="text-sm font-bold text-success">✓ تم الاستلام</span>
                          ) : inv.can_wh_approve ? (
                            <button onClick={() => handleConfirmSignature('warehouse_manager')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80">
                              توقيع الاستلام
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary mt-1">ليس لديك صلاحية الاستلام</span>
                          )}
                        </div>

                        <div className={`flex flex-col items-center p-3 rounded-lg border ${inv.receipt_confirmation?.pm_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
                          <span className="text-xs font-bold mb-2">مدير المشروع / المهندس</span>
                          {inv.receipt_confirmation?.pm_status === 'approved' ? (
                            <span className="text-sm font-bold text-success">✓ تم الفحص والمطابقة</span>
                          ) : inv.can_approve ? (
                            <button onClick={() => handleConfirmSignature('pm')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80">
                              توقيع المطابقة
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary mt-1">ليس لديك صلاحية الاعتماد</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TOTALS */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-text-secondary mb-1">حالة الفاتورة (النظام)</p>
                      <p className="text-lg font-bold text-text-primary">
                        {inv.status === 'draft' ? 'مسودة' :
                         inv.status === 'pending_receipt' ? 'بانتظار تأكيد الاستلام' : 
                         inv.status === 'posted' ? 'مستلمة ومعتمدة' : 
                         inv.status === 'partially_paid' ? 'تسديد جزئي' :
                         inv.status === 'paid' ? 'مسددة بالكامل' : inv.status}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي الكلي (Net)</p>
                      <p className="text-xl font-black text-navy dir-ltr text-right">{Number(inv.net_amount).toLocaleString()} ج.م</p>
                    </div>
                    <div className="rounded-xl border border-danger/20 bg-red-50/50 p-5 shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-danger mb-1">مرتجعات</p>
                      <p className="text-xl font-black text-danger dir-ltr text-right">{Number(inv.returned_amount || 0).toLocaleString()} ج.م</p>
                    </div>
                    <div className="rounded-xl border border-success/20 bg-emerald-50/50 p-5 shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-success mb-1">تم سداده (خزينة/تسوية)</p>
                      <p className="text-xl font-black text-success dir-ltr text-right">{Number(inv.paid_to_date || 0).toLocaleString()} ج.م</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm flex flex-col justify-center">
                      <p className="text-xs font-semibold text-text-secondary mb-1">المتبقي</p>
                      <p className="text-xl font-black text-danger dir-ltr text-right">{Number(inv.outstanding_amount).toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  {/* LINES GRID */}
                  <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
                    <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                      <h2 className="text-lg font-bold text-text-primary">أصناف الفاتورة</h2>
                      {inv.status === 'draft' && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">يمكنك تعديل أسعار الفعلية والكميات المستلمة</span>}
                    </div>
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-background-secondary border-b border-border">
                          <tr>
                            <th className="font-semibold px-4 py-3 border-b text-navy">الصنف (الكود)</th>
                            <th className="font-semibold px-4 py-3 border-b text-navy w-[8%]">الوحدة</th>
                            <th className="font-semibold px-4 py-3 border-b text-navy w-[12%]">الكمية المفوترة</th>
                            <th className="font-semibold px-4 py-3 border-b text-navy w-[12%] text-blue-700 bg-blue-50/50">الكمية المستلمة</th>
                            {returns && returns.length > 0 && <th className="font-semibold text-purple-700 px-4 py-3 border-b w-[12%]">المرتجع</th>}
                            <th className="font-semibold px-4 py-3 border-b text-navy w-[12%]">سعر الوحدة</th>
                            <th className="font-semibold px-4 py-3 border-b text-navy w-[12%]">القيمة الإجمالية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lines.map((line: any, idx: number) => {
                            const item = Array.isArray(line.item) ? line.item[0] : line.item
                            const unit = item?.unit ? (Array.isArray(item.unit) ? item.unit[0] : item.unit) : null
                            
                            return (
                             <tr key={idx} className="hover:bg-background-secondary/30 transition-colors">
                                <td className="px-4 py-4 whitespace-normal min-w-[200px] text-text-primary font-medium">{item?.item_code} - {item?.arabic_name || '---'}</td>
                                <td className="px-4 py-4 text-center text-text-tertiary">{unit?.arabic_name || '---'}</td>
                                
                                <td className="px-4 py-2 border-r border-border">
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={inv.status !== 'draft'}
                                    value={line.invoiced_quantity}
                                    onChange={e => updateLine(idx, 'invoiced_quantity', Number(e.target.value))}
                                    className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-navy disabled:bg-transparent disabled:border-transparent text-right dir-ltr"
                                  />
                                </td>
                                <td className="px-4 py-4 font-bold text-blue-700 bg-blue-50/30 text-center dir-ltr">
                                  {line.received_quantity !== undefined && line.received_quantity !== null 
                                    ? Number(line.received_quantity).toLocaleString() 
                                    : (inv.status === 'draft' ? '—' : Number(line.invoiced_quantity).toLocaleString())}
                                </td>
                                {returns && returns.length > 0 && (
                                  <td className="px-4 py-4 font-bold text-purple-700 dir-ltr text-right">
                                    {Number(line.returned_quantity || 0) > 0 ? Number(line.returned_quantity).toLocaleString() : '—'}
                                  </td>
                                )}
                                <td className="px-4 py-2 border-r border-border">
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={inv.status !== 'draft'}
                                    value={line.unit_price}
                                    onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}
                                    className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-text-primary disabled:bg-transparent disabled:border-transparent text-right dir-ltr"
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
                    
                    {inv.status === 'draft' && (
                      <div className="p-4 bg-background-secondary/50 border-t border-border flex justify-end">
                        <button
                          onClick={handleSaveLines}
                          disabled={saving}
                          className="rounded-lg bg-text-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-navy disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'جارٍ الحفظ...' : 'حفظ الأصناف ومطابقة الحساب'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* RETURNS GRID */}
                  {returns && returns.length > 0 && (
                    <div className="rounded-xl border border-danger/20 bg-red-50/50 shadow-sm overflow-hidden flex flex-col mt-4">
                      <div className="px-6 py-4 border-b border-danger/10 flex justify-between items-center bg-red-100/30">
                        <h2 className="text-lg font-bold text-danger">إشعارات الخصم / المرتجعات</h2>
                      </div>
                      <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-right text-sm whitespace-nowrap">
                          <thead className="border-b border-danger/10">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-danger">رقم المرتجع</th>
                              <th className="px-4 py-3 font-semibold text-danger text-center">التاريخ</th>
                              <th className="px-4 py-3 font-semibold text-danger">الصافي</th>
                              <th className="px-4 py-3 font-semibold text-danger">الحالة</th>
                              <th className="px-4 py-3 font-semibold text-danger text-center">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-danger/10">
                            {returns.map((ret: any) => (
                              <tr key={ret.id} className="hover:bg-red-100/30 transition-colors">
                                <td className="px-4 py-4 text-danger font-bold">{ret.return_no}</td>
                                <td className="px-4 py-4 text-center text-danger/80">{ret.return_date}</td>
                                <td className="px-4 py-4 font-bold text-danger dir-ltr text-right">{Number(ret.net_amount).toLocaleString()} ج.م</td>
                                <td className="px-4 py-4 text-danger/80">{ret.status === 'posted' ? 'مُرحّل' : ret.status === 'draft' ? 'مسودة' : ret.status}</td>
                                <td className="px-4 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => setViewReturn(ret)}
                                      className="text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded"
                                      title="عرض التفاصيل"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    </button>
                                    {ret.status === 'draft' && (
                                      <>
                                        <button 
                                          onClick={() => setConfirmAction({ type: 'post_return', retId: ret.id })}
                                          disabled={saving}
                                          className="text-white bg-danger hover:bg-red-700 px-3 py-1.5 rounded text-xs font-bold shadow-sm disabled:opacity-50"
                                        >
                                          إعتماد
                                        </button>
                                        <button 
                                          onClick={() => setConfirmAction({ type: 'delete_return', retId: ret.id })}
                                          disabled={saving}
                                          className="text-danger hover:bg-danger/10 px-3 py-1.5 rounded border border-danger/30 text-xs font-bold disabled:opacity-50"
                                        >
                                          حذف
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Return / Discrepancy Actions */}
                  <div className="mt-4 flex justify-end gap-3">
                    {inv.discrepancy_status === 'pending' && canWhApprove && (
                      <button
                        onClick={() => {
                          // Initialize partialInputs
                          const ini: Record<string, number> = {}
                          lines.forEach(l => ini[l.id] = 0)
                          setPartialInputs(ini)
                          setPartialReceiptOpen(true)
                        }}
                        className="rounded-lg bg-navy text-white px-6 py-2.5 text-sm font-bold shadow-sm hover:bg-navy/90 transition-colors"
                      >
                        استكمال استلام النواقص
                      </button>
                    )}
                    {['receipt_confirmed', 'posted', 'paid', 'partially_paid'].includes(inv.status) && (
                      <button
                        onClick={() => setIsReturnDialogOpen(true)}
                        className="rounded-lg bg-white border border-danger/30 text-danger px-6 py-2.5 text-sm font-bold shadow-sm hover:bg-red-50 transition-colors"
                      >
                        إنشاء إشعار مرتجع
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Signature */}
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

      {/* Confirmation Dialog for Action */}
      {confirmAction && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setConfirmAction(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-danger animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-xl font-bold text-navy mb-2">تأكيد الإجراء</h3>
            <p className="text-text-secondary mb-6">
              {confirmAction.type === 'delete_return' 
                ? 'هل أنت متأكد من حذف مسودة المرتجع؟ لا يمكن التراجع عن هذا الإجراء.' 
                : 'تأكيد ترحيل واعتماد المرتجع؟ سيتم خصم الكميات من المخزن ولا يمكن التراجع.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => confirmAction.type === 'delete_return' ? handleDeleteReturn(confirmAction.retId) : handlePostReturn(confirmAction.retId)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2 bg-danger hover:bg-danger/90"
              >
                {saving ? 'جاري التنفيذ...' : (confirmAction.type === 'delete_return' ? 'نعم، قم بالحذف' : 'ترحيل المرتجع')}
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

      {isReturnDialogOpen && inv && (
        <SupplierReturnDialog 
          invoice={inv} 
          projectId={projectId} 
          onClose={() => setIsReturnDialogOpen(false)} 
          onSuccess={reloadData} 
        />
      )}

      {/* Return Details Dialog */}
      {viewReturn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setViewReturn(null)} />
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b bg-red-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-danger">تفاصيل إشعار المرتجع</h2>
                <p className="text-sm text-text-secondary mt-1">رقم: {viewReturn.return_no} | التاريخ: {viewReturn.return_date}</p>
              </div>
              <button
                onClick={() => setViewReturn(null)}
                className="p-2 text-danger hover:bg-red-100 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <h3 className="font-bold text-navy mb-4 border-b pb-2">الأصناف المرتجعة</h3>
              <div className="border rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-right text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-text-secondary">الصنف</th>
                      <th className="px-4 py-3 font-semibold text-text-secondary text-center">الكمية المرتجعة</th>
                      <th className="px-4 py-3 font-semibold text-text-secondary text-center">السعر</th>
                      <th className="px-4 py-3 font-semibold text-text-secondary text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewReturn.lines?.map((rl: any) => (
                      <tr key={rl.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-bold text-navy">{rl.original_line?.item?.arabic_name}</td>
                        <td className="px-4 py-3 text-center dir-ltr text-purple-700 font-bold">{Number(rl.returned_quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center dir-ltr">{Number(rl.unit_price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center dir-ltr font-bold text-navy">{Number(rl.line_gross).toLocaleString()} <span className="text-xs font-normal">ج.م</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-64 bg-red-50/50 p-4 rounded-xl border border-danger/10">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-sm font-semibold text-text-secondary">الإجمالي قبل الخصم:</span>
                     <span className="font-bold text-navy dir-ltr">{Number(viewReturn.gross_amount).toLocaleString()} ج.م</span>
                  </div>
                  {Number(viewReturn.discount_amount) > 0 && (
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-semibold text-text-secondary">الخصم (النسبة الأصغرية):</span>
                       <span className="font-bold text-danger dir-ltr">{Number(viewReturn.discount_amount).toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {Number(viewReturn.tax_amount) > 0 && (
                    <div className="flex justify-between items-center mb-3">
                       <span className="text-sm font-semibold text-text-secondary">الضريبة المضافة:</span>
                       <span className="font-bold text-navy dir-ltr">{Number(viewReturn.tax_amount).toLocaleString()} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-danger/10 pt-3 mt-1">
                     <span className="text-base font-bold text-danger">صافي المرتجع:</span>
                     <span className="text-lg font-black text-danger dir-ltr">{Number(viewReturn.net_amount).toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>

              {viewReturn.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-text-secondary mb-2">ملاحظات:</h3>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg border">{viewReturn.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
