'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createStoreIssue, getWarehouseStockBalances, peekNextIssueNo, getCostCenters } from '@/actions/store-issues'
import DatePicker from '@/components/DatePicker'

interface Props {
  companyId: string
  warehouseId: string
  warehouseName: string
  returnUrl: string
}

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
  id: string; cost_center_code: string; arabic_name: string; center_type: string
}

export default function MainWarehouseIssueForm({ companyId, warehouseId, warehouseName, returnUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [docNo, setDocNo] = useState('تلقائي')
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedQty, setSelectedQty] = useState('')

  // Issue type: 'project' or 'internal'
  const [issueType, setIssueType] = useState<'project' | 'internal'>('internal')
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [selectedCostCenter, setSelectedCostCenter] = useState('')

  useEffect(() => {
    peekNextIssueNo(companyId).then(setDocNo).catch(() => {})
    setStockLoading(true)
    getWarehouseStockBalances(warehouseId)
      .then((rows) => setStockRows(rows as unknown as StockRow[]))
      .catch(() => setStockRows([]))
      .finally(() => setStockLoading(false))

    // Load cost centers for internal issues
    getCostCenters()
      .then((data) => setCostCenters(data as unknown as CostCenter[]))
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
    setLines(prev => [...prev, { item_id: selectedItem, unit_id: unit?.id ?? '', quantity: selectedQty, item_code: item.item_code, arabic_name: item.arabic_name, unit_name: unit?.arabic_name ?? '—', available_qty: row.quantity_on_hand, avg_cost: row.weighted_avg_cost }])
    setSelectedItem(''); setSelectedQty(''); setError('')
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!lines.length) { setError('أضف صنفاً واحداً على الأقل'); return }
    if (issueType === 'internal' && !selectedCostCenter) { setError('يرجى اختيار مركز التكلفة للصرف الداخلي'); return }
    setLoading(true); setError('')
    const formData = new FormData(e.currentTarget)
    try {
      await createStoreIssue({
        header: {
          company_id: companyId,
          warehouse_id: warehouseId,
          project_id: null,
          issue_date: formData.get('issue_date') as string,
          issue_type: issueType,
          cost_center_id: issueType === 'internal' ? selectedCostCenter : null,
          notes: (formData.get('notes') as string) || null,
        },
        lines: lines.map(l => ({ item_id: l.item_id, unit_id: l.unit_id, quantity: Number(l.quantity) })),
      })
      router.push(returnUrl); router.refresh()
    } catch (err: any) { setError(err.message || 'حدث خطأ'); setLoading(false) }
  }

  const availableItems = stockRows.filter(r => !lines.some(l => l.item_id === r.item_id))

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-8" dir="rtl">
      {error && <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-8">

        {/* Issue Type Toggle */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-3 pb-2 border-b border-border">نوع الصرف</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIssueType('internal')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right ${
                issueType === 'internal'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-white hover:border-primary/30'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${issueType === 'internal' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-bold ${issueType === 'internal' ? 'text-primary' : 'text-gray-700'}`}>صرف داخلي للشركة</p>
                <p className="text-xs text-gray-400 mt-0.5">للاستخدام الداخلي في الشركة — مربوط بمركز تكلفة</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIssueType('project')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right ${
                issueType === 'project'
                  ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                  : 'border-border bg-white hover:border-amber-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${issueType === 'project' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-bold ${issueType === 'project' ? 'text-amber-700' : 'text-gray-700'}`}>صرف لمشروع</p>
                <p className="text-xs text-gray-400 mt-0.5">لتغذية مخزن مشروع معين — خاضع لموافقة المشروع</p>
              </div>
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">بيانات الإذن الأساسية</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">رقم الإذن</label>
              <input type="text" readOnly value={docNo} dir="ltr" className="w-full rounded-lg border border-border bg-background-secondary px-4 py-2 text-sm cursor-not-allowed text-text-secondary" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">تاريخ الصرف <span className="text-danger">*</span></label>
              <DatePicker name="issue_date" defaultValue={new Date().toISOString().split('T')[0]} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">المخزن</label>
              <input type="text" readOnly value={warehouseName} className="w-full rounded-lg border border-border bg-background-secondary px-4 py-2 text-sm cursor-not-allowed text-text-secondary" />
            </div>

            {/* Cost Center (for internal issues) */}
            {issueType === 'internal' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">
                  مركز التكلفة <span className="text-danger">*</span>
                </label>
                <select
                  value={selectedCostCenter}
                  onChange={e => setSelectedCostCenter(e.target.value)}
                  required={issueType === 'internal'}
                  className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">— اختر مركز التكلفة —</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.id}>
                      {cc.cost_center_code} — {cc.arabic_name}
                    </option>
                  ))}
                </select>
                {costCenters.length === 0 && (
                  <p className="text-xs text-amber-600">
                    لا توجد مراكز تكلفة — <a href="/company/cost-centers" className="underline" target="_blank">أضف مراكز تكلفة</a> أولاً
                  </p>
                )}
              </div>
            )}

            <div className={`space-y-2 ${issueType === 'project' ? 'md:col-span-2' : ''}`}>
              <label className="text-sm font-medium text-text-primary">ملاحظات</label>
              <textarea name="notes" rows={2} className="w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-border">الأصناف المراد صرفها</h3>
          <div className="grid gap-4 md:grid-cols-3 mb-6 p-4 rounded-lg bg-background-secondary border border-border">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">اختر الصنف</label>
              {stockLoading ? <div className="text-xs text-text-secondary px-4 py-2">جاري التحميل...</div> : (
                <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">— اختر صنف —</option>
                  {availableItems.map(r => { const item = Array.isArray(r.item) ? (r.item as any)[0] : r.item; return (<option key={r.item_id} value={r.item_id}>{item?.item_code} — {item?.arabic_name} (متاح: {r.quantity_on_hand})</option>) })}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">متوسط التكلفة</label>
              <input type="text" readOnly dir="ltr" value={selectedItem ? Number(stockRows.find(r => r.item_id === selectedItem)?.weighted_avg_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'} className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm cursor-not-allowed text-text-secondary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">الكمية</label>
              <div className="flex gap-2">
                <input type="number" min="0.0001" step="any" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} placeholder="0" dir="ltr" className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                <button type="button" onClick={addLine} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">+ إضافة</button>
              </div>
            </div>
          </div>

          {lines.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-background-secondary text-right"><th className="px-4 py-3 font-semibold text-text-secondary">الصنف</th><th className="px-4 py-3 font-semibold text-text-secondary">الوحدة</th><th className="px-4 py-3 font-semibold text-text-secondary">الكمية</th><th className="px-4 py-3 font-semibold text-text-secondary">المتوسط</th><th className="px-4 py-3 font-semibold text-text-secondary">القيمة التقديرية</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.item_id} className="border-b border-border/50">
                      <td className="px-4 py-3"><span className="text-xs text-primary font-mono mr-1">{line.item_code}</span>{line.arabic_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{line.unit_name}</td>
                      <td className="px-4 py-3 font-bold" dir="ltr">{line.quantity}</td>
                      <td className="px-4 py-3 text-text-secondary" dir="ltr">{Number(line.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 font-medium text-primary" dir="ltr">{(Number(line.quantity) * line.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-left"><button type="button" onClick={() => setLines(prev => prev.filter(l => l.item_id !== line.item_id))} className="text-xs text-danger hover:underline">حذف</button></td>
                    </tr>
                  ))}
                  <tr className="bg-background-secondary font-bold"><td className="px-4 py-3" colSpan={4}>الإجمالي التقديري</td><td className="px-4 py-3 text-primary" dir="ltr">{lines.reduce((s, l) => s + Number(l.quantity) * l.avg_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td /></tr>
                </tbody>
              </table>
            </div>
          )}
          {!lines.length && <p className="text-center text-sm text-text-secondary py-6">لم يتم إضافة أي أصناف بعد.</p>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link href={returnUrl} className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary">إلغاء</Link>
          <button type="submit" disabled={loading || !lines.length} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {loading ? 'جاري الإرسال...' : 'إرسال للموافقة'}
          </button>
        </div>
      </form>
    </div>
  )
}
