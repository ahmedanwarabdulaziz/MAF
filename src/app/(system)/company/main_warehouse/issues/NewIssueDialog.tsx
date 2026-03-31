'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createStoreIssue, getWarehouseStockBalances, peekNextIssueNo, getCostCenters } from '@/actions/store-issues'
import DatePicker from '@/components/DatePicker'

interface StockRow {
  item_id: string
  quantity_on_hand: number
  weighted_avg_cost: number
  item: { id: string; item_code: string; arabic_name: string; primary_unit: { id: string; arabic_name: string } | null } | null
}

interface LineItem {
  item_id: string; unit_id: string; quantity: string
  item_code: string; arabic_name: string; unit_name: string
  available_qty: number; avg_cost: number
}

interface CostCenter {
  id: string; cost_center_code: string; arabic_name: string
}

interface Props {
  companyId: string
  warehouseId: string
  warehouseName: string
}

function IssueFormBody({
  companyId, warehouseId, warehouseName,
  onSuccess, onCancel,
}: Props & { onSuccess: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [docNo, setDocNo] = useState('تلقائي')
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedQty, setSelectedQty] = useState('')
  const [issueType, setIssueType] = useState<'project' | 'internal'>('internal')
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [selectedCostCenter, setSelectedCostCenter] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (companyId) {
      setDocNo('جاري التحميل...')
      peekNextIssueNo(companyId)
        .then(res => setDocNo(res))
        .catch(err => {
          console.error('Failed to peek next issue no:', err)
          setDocNo(`فشل: ${err.message}`)
        })
    } else {
      setDocNo('خطأ: لا يوجد Company ID')
    }
    setStockLoading(true)
    getWarehouseStockBalances(warehouseId)
      .then(rows => setStockRows(rows as unknown as StockRow[]))
      .catch(() => setStockRows([]))
      .finally(() => setStockLoading(false))
    getCostCenters()
      .then(data => setCostCenters(data as unknown as CostCenter[]))
      .catch(() => {})
  }, [companyId, warehouseId])

  function addLine() {
    if (!selectedItem || !selectedQty || Number(selectedQty) <= 0) return
    const row = stockRows.find(r => r.item_id === selectedItem)
    if (!row || !row.item) return
    const item = Array.isArray(row.item) ? (row.item as any)[0] : row.item
    const unit = item.primary_unit ? (Array.isArray(item.primary_unit) ? (item.primary_unit as any)[0] : item.primary_unit) : null
    if (Number(selectedQty) > row.quantity_on_hand) { setError(`الكمية تتجاوز الرصيد (${row.quantity_on_hand})`); return }
    if (lines.some(l => l.item_id === selectedItem)) { setError('الصنف مضاف بالفعل'); return }
    setLines(prev => [...prev, {
      item_id: selectedItem, unit_id: unit?.id ?? '', quantity: selectedQty,
      item_code: item.item_code, arabic_name: item.arabic_name,
      unit_name: unit?.arabic_name ?? '—', available_qty: row.quantity_on_hand, avg_cost: row.weighted_avg_cost,
    }])
    setSelectedItem(''); setSelectedQty(''); setError('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lines.length) { setError('أضف صنفاً واحداً على الأقل'); return }
    if (issueType === 'internal' && !selectedCostCenter) { setError('يرجى اختيار مركز التكلفة للصرف الداخلي'); return }
    setLoading(true); setError('')
    try {
      await createStoreIssue({
        header: {
          company_id: companyId,
          warehouse_id: warehouseId,
          project_id: null,
          issue_date: issueDate,
          issue_type: issueType,
          cost_center_id: issueType === 'internal' ? selectedCostCenter : null,
          notes: notes || null,
        },
        lines: lines.map(l => ({ item_id: l.item_id, unit_id: l.unit_id, quantity: Number(l.quantity) })),
      })
      onSuccess()
    } catch (err: any) { setError(err.message || 'حدث خطأ'); setLoading(false) }
  }

  const availableItems = stockRows.filter(r => !lines.some(l => l.item_id === r.item_id))
  const grandTotal = lines.reduce((s, l) => s + Number(l.quantity) * l.avg_cost, 0)

  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full" dir="rtl">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">{error}</div>}

        {/* Issue Type Toggle */}
        <div>
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">نوع الصرف</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIssueType('internal')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${
                issueType === 'internal'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${issueType === 'internal' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-bold ${issueType === 'internal' ? 'text-primary' : 'text-gray-700'}`}>صرف داخلي للشركة</p>
                <p className="text-xs text-gray-400 mt-0.5">مركز تكلفة داخلي</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIssueType('project')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${
                issueType === 'project'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-border bg-white hover:border-amber-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${issueType === 'project' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-bold ${issueType === 'project' ? 'text-amber-700' : 'text-gray-700'}`}>صرف لمشروع</p>
                <p className="text-xs text-gray-400 mt-0.5">يُغذي مخزن مشروع</p>
              </div>
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">رقم الإذن</label>
            <input type="text" readOnly value={docNo} dir="ltr"
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm cursor-not-allowed text-text-secondary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">تاريخ الصرف <span className="text-danger">*</span></label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">المخزن</label>
            <input type="text" readOnly value={warehouseName}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm cursor-not-allowed text-text-secondary" />
          </div>

          {issueType === 'internal' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                مركز التكلفة <span className="text-danger">*</span>
              </label>
              <select value={selectedCostCenter} onChange={e => setSelectedCostCenter(e.target.value)} required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none">
                <option value="">— اختر مركز التكلفة —</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.cost_center_code} — {cc.arabic_name}</option>
                ))}
              </select>
              {costCenters.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  <a href="/company/cost-centers" className="underline" target="_blank">أضف مراكز تكلفة</a> أولاً
                </p>
              )}
            </div>
          )}

          <div className={issueType === 'project' ? 'col-span-2' : 'col-span-2'}>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">ملاحظات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>
        </div>

        {/* Add Items */}
        <div>
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">الأصناف المراد صرفها</p>
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-background-secondary border border-border mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">الصنف</label>
              {stockLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary">
                  <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full"></div>
                  جاري التحميل...
                </div>
              ) : (
                <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">— اختر صنف —</option>
                  {availableItems.map(r => {
                    const item = Array.isArray(r.item) ? (r.item as any)[0] : r.item
                    return <option key={r.item_id} value={r.item_id}>{item?.item_code} — {item?.arabic_name} (متاح: {r.quantity_on_hand})</option>
                  })}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">متوسط التكلفة</label>
              <input type="text" readOnly dir="ltr"
                value={selectedItem ? Number(stockRows.find(r => r.item_id === selectedItem)?.weighted_avg_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm cursor-not-allowed text-text-secondary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">الكمية</label>
              <div className="flex gap-2">
                <input type="number" min="0.0001" step="any" value={selectedQty} onChange={e => setSelectedQty(e.target.value)}
                  placeholder="0" dir="ltr"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                <button type="button" onClick={addLine}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 whitespace-nowrap">
                  + إضافة
                </button>
              </div>
            </div>
          </div>

          {lines.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-right font-semibold">الصنف</th>
                    <th className="px-4 py-2.5 text-right font-semibold">الوحدة</th>
                    <th className="px-4 py-2.5 text-right font-semibold">الكمية</th>
                    <th className="px-4 py-2.5 text-left font-semibold">المتوسط</th>
                    <th className="px-4 py-2.5 text-left font-semibold">القيمة</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map(line => (
                    <tr key={line.item_id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-primary font-mono">{line.item_code}</span>
                        <span className="mr-1.5 text-gray-800">{line.arabic_name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{line.unit_name}</td>
                      <td className="px-4 py-2.5 font-bold" dir="ltr">{line.quantity}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs" dir="ltr">{Number(line.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 font-medium text-primary text-xs" dir="ltr">
                        {(Number(line.quantity) * line.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setLines(prev => prev.filter(l => l.item_id !== line.item_id))}
                          className="text-xs text-danger hover:text-danger/70 transition">حذف</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5 border-t">
                    <td className="px-4 py-2.5 font-bold text-gray-700" colSpan={4}>الإجمالي التقديري</td>
                    <td className="px-4 py-2.5 font-black text-primary" dir="ltr">
                      {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary text-sm border border-dashed border-border rounded-xl">
              لم يتم إضافة أي أصناف بعد
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-background-secondary/50 shrink-0">
        <div className="text-sm text-text-secondary">
          {lines.length > 0 && <span><span className="font-bold text-text-primary">{lines.length}</span> صنف — الإجمالي: <span className="font-bold text-primary" dir="ltr">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م</span></span>}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-background-secondary transition">
            إلغاء
          </button>
          <button type="submit" disabled={loading || !lines.length}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                جاري الإرسال...
              </span>
            ) : 'إرسال للموافقة'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function NewIssueDialog({ companyId, warehouseId, warehouseName }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleSuccess = () => {
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        إذن صرف جديد
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0">
              <div className="text-right w-full" dir="rtl">
                <h2 className="text-lg font-bold text-white">إذن صرف جديد — المخزن الرئيسي</h2>
                <p className="text-sm text-white/75 mt-0.5">صرف مواد للاستخدام الداخلي أو لمشروع — يُرسل للموافقة</p>
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
            <IssueFormBody
              companyId={companyId}
              warehouseId={warehouseId}
              warehouseName={warehouseName}
              onSuccess={handleSuccess}
              onCancel={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
