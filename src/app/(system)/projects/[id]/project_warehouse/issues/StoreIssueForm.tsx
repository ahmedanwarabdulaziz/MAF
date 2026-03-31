'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createStoreIssue, getWarehouseStockBalances, peekNextIssueNo } from '@/actions/store-issues'
import DatePicker from '@/components/DatePicker'

interface StoreIssueFormProps {
  companyId: string
  projectId: string
  warehouses: { id: string; arabic_name: string }[]
  onSuccess: () => void
  onCancel: () => void
}

interface StockRow {
  item_id: string
  quantity_on_hand: number
  weighted_avg_cost: number
  item: any
}

interface LineItem {
  item_id: string
  unit_id: string
  quantity: string
  // display
  item_code: string
  arabic_name: string
  unit_name: string
  available_qty: number
  avg_cost: number
}

export default function StoreIssueForm({
  companyId,
  projectId,
  warehouses,
  onSuccess,
  onCancel,
}: StoreIssueFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [docNo, setDocNo] = useState('تلقائي')

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)

  const [lines, setLines] = useState<LineItem[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedQty, setSelectedQty] = useState('')

  // Load doc number once
  useEffect(() => {
    peekNextIssueNo(companyId).then(setDocNo).catch(() => {})
  }, [companyId])

  // Load stock when warehouse changes
  useEffect(() => {
    if (!warehouseId) return
    setStockLoading(true)
    getWarehouseStockBalances(warehouseId)
      .then((rows) => setStockRows(rows as any[]))
      .catch(() => setStockRows([]))
      .finally(() => setStockLoading(false))
  }, [warehouseId])

  function addLine() {
    if (!selectedItem || !selectedQty || Number(selectedQty) <= 0) return
    const row = stockRows.find((r) => r.item_id === selectedItem)
    if (!row || !row.item) return
    const item = Array.isArray(row.item) ? (row.item as any)[0] : row.item
    const unit = item.primary_unit
      ? Array.isArray(item.primary_unit)
        ? (item.primary_unit as any)[0]
        : item.primary_unit
      : null

    if (Number(selectedQty) > row.quantity_on_hand) {
      setError(`الكمية المطلوبة تتجاوز الرصيد المتاح (${row.quantity_on_hand})`)
      return
    }
    if (lines.some((l) => l.item_id === selectedItem)) {
      setError('تم إضافة هذا الصنف بالفعل. عدّل الكمية في السطر الموجود.')
      return
    }

    setLines((prev) => [
      ...prev,
      {
        item_id: selectedItem,
        unit_id: unit?.id ?? '',
        quantity: selectedQty,
        item_code: item.item_code,
        arabic_name: item.arabic_name,
        unit_name: unit?.arabic_name ?? '—',
        available_qty: row.quantity_on_hand,
        avg_cost: row.weighted_avg_cost,
      },
    ])
    setSelectedItem('')
    setSelectedQty('')
    setError('')
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item_id !== itemId))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!lines.length) {
      setError('أضف صنفاً واحداً على الأقل')
      return
    }
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      await createStoreIssue({
        header: {
          company_id: companyId,
          warehouse_id: warehouseId,
          project_id: projectId,
          issue_date: formData.get('issue_date') as string,
          notes: (formData.get('notes') as string) || null,
        },
        lines: lines.map((l) => ({
          item_id: l.item_id,
          unit_id: l.unit_id,
          quantity: Number(l.quantity),
        })),
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  const availableItems = stockRows.filter(
    (r) => !lines.some((l) => l.item_id === r.item_id)
  )

  return (
    <form onSubmit={onSubmit} className="space-y-6 w-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
        <h2 className="font-semibold text-gray-800">بيانات الإذن الأساسية</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Doc No */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الإذن المستندي</label>
            <input
              type="text"
              readOnly
              value={docNo}
              dir="ltr"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تاريخ الصرف <span className="text-red-500">*</span>
            </label>
            <DatePicker
              name="issue_date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المخزن <span className="text-red-500">*</span>
            </label>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value)
                setLines([])
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.arabic_name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="أي ملاحظات إضافية..."
            />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
        <h2 className="font-semibold text-gray-800">الأصناف المراد صرفها</h2>

        {/* Add line row */}
        <div className="grid gap-4 md:grid-cols-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">اختر الصنف</label>
            {stockLoading ? (
              <div className="text-xs text-gray-500 px-3 py-2">جاري التحميل...</div>
            ) : (
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— اختر صنف —</option>
                {availableItems.map((r) => {
                  const item = Array.isArray(r.item) ? (r.item as any)[0] : r.item
                  return (
                    <option key={r.item_id} value={r.item_id}>
                      {item?.item_code} — {item?.arabic_name} (متاح: {r.quantity_on_hand})
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {/* Avg cost display */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">متوسط التكلفة (للمعلومية)</label>
            <input
              type="text"
              readOnly
              dir="ltr"
              value={
                selectedItem
                  ? Number(
                      stockRows.find((r) => r.item_id === selectedItem)?.weighted_avg_cost ?? 0
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })
                  : '—'
              }
              className="w-full border border-gray-200 rounded-lg bg-gray-100 px-3 py-2 text-sm cursor-not-allowed text-gray-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-medium text-gray-600">الكمية المطلوبة</label>
              {selectedItem && (
                <span className="text-xs font-semibold text-blue-600">
                  المتاح: {stockRows.find((r) => r.item_id === selectedItem)?.quantity_on_hand || 0}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.0001"
                step="any"
                value={selectedQty}
                onChange={(e) => setSelectedQty(e.target.value)}
                placeholder="0"
                dir="ltr"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={addLine}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm shrink-0 flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                إضافة
              </button>
            </div>
          </div>
        </div>

        {/* Lines table */}
        {lines.length > 0 && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-right text-gray-500 text-xs">
                  <th className="px-4 py-3 font-medium">الصنف</th>
                  <th className="px-4 py-3 font-medium">الوحدة</th>
                  <th className="px-4 py-3 font-medium">الكمية المطلوبة</th>
                  <th className="px-4 py-3 font-medium">متوسط التكلفة</th>
                  <th className="px-4 py-3 font-medium">القيمة التقديرية</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line) => (
                  <tr key={line.item_id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className="text-xs text-blue-600 font-mono mr-1">{line.item_code}</span>
                      <span className="font-medium text-gray-800">{line.arabic_name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{line.unit_name}</td>
                    <td className="px-4 py-3 font-bold text-gray-800" dir="ltr">{line.quantity}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {Number(line.avg_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-700" dir="ltr">
                      {(Number(line.quantity) * line.avg_cost).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line.item_id)}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                        title="حذف السطر"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 border-t font-semibold text-gray-800">
                  <td className="px-4 py-3" colSpan={4}>إجمالي القيمة التقديرية</td>
                  <td className="px-4 py-3 text-blue-700 text-base" dir="ltr">
                    {lines
                      .reduce((s, l) => s + Number(l.quantity) * l.avg_cost, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!lines.length && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 bg-gray-50/50">
            لم تتم إضافة أي أصناف بعد. اختر صنفاً من الرصيد المتاح وأضفه.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-semibold shadow-sm"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading || !lines.length}
          className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition text-sm font-bold shadow-sm"
        >
          {loading && (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {loading ? 'جارٍ الإرسال...' : 'إرسال للموافقة'}
        </button>
      </div>
    </form>
  )
}
