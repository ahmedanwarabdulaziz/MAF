'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceDetails, saveInvoiceLines, submitInvoiceForReceipt, confirmReceipt } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'

export default function SupplierInvoiceDetails() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const invoiceId = params.inv_id as string
  
  const [inv, setInv] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

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
      alert('تم حفظ تسعير وكميات الفاتورة بنجاح')
      await load()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReceipt() {
    if (!warehouseId) {
      return alert('يجب تحديد مخزن للاستلام والتوريد')
    }
    setSaving(true)
    try {
      await submitInvoiceForReceipt(inv.id, projectId, warehouseId)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSignature(role: 'pm' | 'warehouse_manager') {
    if (!confirm('تأكيد التوقيع الإلكتروني على البضاعة؟ سيتم تحويلها عهدة.')) return
    setSaving(true)
    try {
      await confirmReceipt(inv.id, projectId, role)
      alert('تم اعتماد التوقيع بنجاح!')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري تحميل الفاتورة...</div>
  if (!inv) return <div className="text-sm text-danger">الفاتورة غير موجودة.</div>

  const isEditable = inv.status === 'draft'
  const supplier = Array.isArray(inv.supplier) ? inv.supplier[0] : inv.supplier
  const conf = inv.receipt_confirmation

  return (
    <div className="space-y-6 pb-24 mx-auto max-w-5xl">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${projectId}/procurement/invoices`} className="hover:text-primary transition-colors">فواتير الموردين</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{inv.invoice_no}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            تطابق فاتورة مورد رقم: <span className="font-mono text-navy">{inv.invoice_no}</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            جهة التوريد: {supplier?.arabic_name} | تاريخ הפاتورة: {inv.invoice_date}
          </p>
        </div>
        
        {isEditable && (
          <div className="flex items-center gap-2">
            <select
              title="مخزن الاستلام"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary w-64"
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
            <div className={`flex flex-col items-center p-3 rounded-lg border ${conf?.warehouse_manager_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
              <span className="text-xs font-bold mb-2">أمين المخزن</span>
              {conf?.warehouse_manager_status === 'approved' ? (
                <span className="text-sm font-bold text-success">✓ تم الاستلام</span>
              ) : (
                <button onClick={() => handleConfirmSignature('warehouse_manager')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80">
                  توقيع الاستلام
                </button>
              )}
            </div>

            <div className={`flex flex-col items-center p-3 rounded-lg border ${conf?.pm_status === 'approved' ? 'bg-success/10 border-success' : 'bg-white border-border'}`}>
              <span className="text-xs font-bold mb-2">مدير المشروع / المهندس</span>
              {conf?.pm_status === 'approved' ? (
                <span className="text-sm font-bold text-success">✓ تم الفحص والمطابقة</span>
              ) : (
                <button onClick={() => handleConfirmSignature('pm')} className="rounded bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy/80">
                  توقيع المطابقة
                </button>
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
             inv.status === 'posted' ? 'مستلمة ومعتمدة (Posted)' : inv.status}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الإجمالي الكلي (Net)</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{Number(inv.net_amount).toLocaleString()} ج.م</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary mb-1">الرصيد المتبقي (غير مسدد)</p>
          <p className="text-2xl font-black text-danger dir-ltr text-right">{Number(inv.net_amount - inv.paid_to_date).toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* LINES GRID */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col pt-2">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary">أصناف الفاتورة</h2>
          {isEditable && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">يمكنك تعديل أسعار الفعلية والكميات المستلمة</span>}
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-secondary">الصنف (المادة)</th>
                <th className="px-4 py-3 font-semibold text-text-secondary text-center">الوحدة</th>
                <th className="px-4 py-3 font-semibold text-navy">الكمية المستلمة</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">سعر الوحدة</th>
                <th className="px-4 py-3 font-semibold text-text-primary">الإجمالي الصافي</th>
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
                        disabled={!isEditable}
                        value={line.invoiced_quantity}
                        onChange={e => updateLine(idx, 'invoiced_quantity', Number(e.target.value))}
                        className="w-24 rounded border border-border/50 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-navy disabled:bg-transparent disabled:border-transparent text-right dir-ltr"
                      />
                    </td>
                    <td className="px-4 py-2 border-r border-border">
                      <input
                        type="number"
                        step="0.01"
                        disabled={!isEditable}
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
        
        {isEditable && (
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
    </div>
  )
}
