'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CustomSelect from '@/components/CustomSelect'
import DatePicker from '@/components/DatePicker'
import { peekNextCompanyDocumentNo } from '@/actions/sequences'

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
)
import { createCompanyPurchaseInvoice, updateCompanyPurchaseInvoice } from './actions'

type Category = { id: string; arabic_name: string; category_code: string; parent_id: string | null }
type Party    = { id: string; arabic_name: string }
type Warehouse = { id: string; arabic_name: string; warehouse_code: string }
type ItemGroup = { id: string; arabic_name: string; group_code: string; parent_group_id: string | null }
type Item     = { id: string; arabic_name: string; item_code: string; item_group?: { id: string, arabic_name: string } | null; unit?: any }

type Line = {
  id: string
  item_id: string | null
  description: string
  expense_category_id: string | null
  quantity: number
  unit_price: number
  line_gross: number
  line_net: number
}

function generateLineId() {
  return Math.random().toString(36).slice(2)
}

function buildCategoryTree(cats: Category[]) {
  const roots = cats.filter(c => !c.parent_id)
  const children = (parentId: string) => cats.filter(c => c.parent_id === parentId)
  const flatten = (cat: Category, depth = 0): { cat: Category; depth: number }[] => {
    return [{ cat, depth }, ...children(cat.id).flatMap(c => flatten(c, depth + 1))]
  }
  return roots.flatMap(r => flatten(r))
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  categories: Category[]
  suppliers: Party[]
  warehouses: Warehouse[]
  items: Item[]
  itemGroups?: ItemGroup[]
  costCenters?: any[]
  onSuccess?: () => void
  onCancel?: () => void
}

export default function PurchaseInvoiceForm({
  initialData,
  categories,
  suppliers,
  warehouses,
  items,
  itemGroups = [],
  costCenters = [],
  onSuccess,
  onCancel
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [invoiceType, setInvoiceType] = useState<'general_expense' | 'stock_purchase'>(
    initialData?.invoice_type || 'general_expense'
  )
  const [supplierId, setSupplierId] = useState(initialData?.supplier_party_id || '')
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoice_no || 'تلقائي')
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoice_date || new Date().toISOString().split('T')[0])
  const [expenseCategoryId, setExpenseCategoryId] = useState(initialData?.expense_category_id || '')
  const [costCenterId, setCostCenterId] = useState(initialData?.cost_center_id || '')
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouse_id || '')

  const initialTaxRate = initialData?.gross_amount > 0 ? (initialData.tax_amount / initialData.gross_amount) * 100 : 0
  const [taxRate, setTaxRate] = useState(initialTaxRate)

  const [discountAmount, setDiscountAmount] = useState(initialData?.discount_amount || 0)
  const [notes, setNotes] = useState(initialData?.notes || '')

  const [lines, setLines] = useState<Line[]>(
    initialData?.lines?.length > 0
      ? initialData.lines.map((l: any) => ({
          id: l.id || generateLineId(),
          item_id: l.item_id || null,
          description: l.description || '',
          expense_category_id: l.expense_category_id || null,
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          line_gross: l.line_gross || 0,
          line_net: l.line_net || 0
        }))
      : [{ id: generateLineId(), item_id: null, description: '', expense_category_id: null, quantity: 1, unit_price: 0, line_gross: 0, line_net: 0 }]
  )

  useEffect(() => {
    if (initialData?.invoice_no) return // Skip fetching sequential number if editing
    const docType = invoiceType === 'general_expense' ? 'company_expense_invoices' : 'company_purchase_invoices'
    const prefix  = invoiceType === 'general_expense' ? 'EXP' : 'PINV'
    peekNextCompanyDocumentNo(docType, prefix)
      .then(seq => setInvoiceNo(seq))
      .catch(() => {})
  }, [invoiceType, initialData?.invoice_no])

  const categoryTree = buildCategoryTree(categories)

  // Computed totals
  const grossAmount = lines.reduce((s, l) => s + l.line_gross, 0)
  const taxAmount   = grossAmount * (taxRate / 100)
  const netAmount   = grossAmount + taxAmount - discountAmount

  const updateLine = (id: string, field: keyof Line, value: string | number | null) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated.line_gross = Number(updated.quantity) * Number(updated.unit_price)
        updated.line_net   = updated.line_gross
      }
      return updated
    }))
  }

  const addLine = () => {
    setLines(prev => [...prev, {
      id: generateLineId(), item_id: null, description: '', expense_category_id: null,
      quantity: 1, unit_price: 0, line_gross: 0, line_net: 0,
    }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (invoiceType === 'stock_purchase' && !supplierId) { setError('يرجى اختيار المورد'); return }
    if (!invoiceNo)  { setError('يرجى إدخال رقم الفاتورة'); return }

    if (invoiceType === 'general_expense' && !costCenterId) { setError('يرجى اختيار مركز التكلفة'); return }
    if (invoiceType === 'stock_purchase'  && !warehouseId)       { setError('يرجى اختيار المستودع'); return }
    if (lines.some(l => !l.description)) { setError('يرجى ادخال وصف لكل سطر'); return }

    startTransition(async () => {
      try {
        const payload = {
          supplier_party_id:   supplierId,
          invoice_no:          invoiceNo,
          invoice_date:        invoiceDate,
          invoice_type:        invoiceType,
          expense_category_id: null,
          cost_center_id:      invoiceType === 'general_expense' ? costCenterId || null : null,

          warehouse_id:        invoiceType === 'stock_purchase' ? warehouseId || null : null,
          gross_amount:        grossAmount,
          tax_amount:          taxAmount,
          discount_amount:     discountAmount,
          net_amount:          netAmount,
          notes:               notes || undefined,
          lines: lines.map(l => ({
            item_id:             l.item_id || null,
            description:         l.description,
            expense_category_id: l.expense_category_id || null,
            quantity:            l.quantity,
            unit_price:          l.unit_price,
            line_gross:          l.line_gross,
            line_net:            l.line_net,
          })),
        }

        if (initialData?.id) {
          await updateCompanyPurchaseInvoice(initialData.id, payload)
        } else {
          await createCompanyPurchaseInvoice(payload)
        }
        
        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/company/purchases')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      }
    })
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 })

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Invoice Type Toggle */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">نوع الفاتورة</h2>
        <div className="flex gap-3">
          {[
            { value: 'general_expense', label: 'مصروف عام', desc: 'إيجار، كهرباء، خدمات...', color: 'orange' },
            { value: 'stock_purchase',  label: 'شراء للمخزن', desc: 'مواد وبضائع للمستودع', color: 'purple' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInvoiceType(opt.value as typeof invoiceType)}
              className={`flex-1 p-4 rounded-xl border-2 text-right transition ${
                invoiceType === opt.value
                  ? opt.color === 'orange'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">{opt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">بيانات الفاتورة</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {invoiceType === 'stock_purchase' ? 'المورد *' : 'المورد (اختياري)'}
            </label>
            <CustomSelect
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers.map(s => ({ value: s.id, label: s.arabic_name }))}
              placeholder={invoiceType === 'stock_purchase' ? '-- اختر المورد --' : '-- بدون مورد --'}
              searchable={true}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الفاتورة *</label>
            <input
              value={invoiceNo}
              readOnly
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
            <DatePicker
              value={invoiceDate}
              onChange={setInvoiceDate}
            />
          </div>
        </div>



        {/* Conditional: Stock Purchase → warehouse */}
        {invoiceType === 'stock_purchase' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المخازن المتاحة *</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- اختر المستودع --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.arabic_name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Conditional: General Expense → cost center */}
        {invoiceType === 'general_expense' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">مركز التكلفة *</label>
              <CustomSelect
                value={costCenterId}
                onChange={setCostCenterId}
                options={costCenters.map(c => ({ value: c.id, label: `${c.cost_center_code} — ${c.arabic_name}` }))}
                placeholder="-- اختر مركز التكلفة --"
                searchable={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">سطور الفاتورة</h2>
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <PlusIcon />
            إضافة سطر
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-gray-500 text-xs border-b">
                {invoiceType === 'general_expense' && <th className="pb-2 font-medium">القسم</th>}
                {invoiceType === 'stock_purchase'  && <th className="pb-2 font-medium">الصنف</th>}
                <th className="pb-2 font-medium">الوصف *</th>
                <th className="pb-2 font-medium w-24">الكمية</th>
                <th className="pb-2 font-medium w-32">سعر الوحدة</th>
                <th className="pb-2 font-medium w-32">الإجمالي</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map(line => (
                <tr key={line.id}>
                  {invoiceType === 'general_expense' && (
                    <td className="py-2 pl-2 min-w-[180px]">
                      <CustomSelect
                        value={line.expense_category_id ?? ''}
                        onChange={val => updateLine(line.id, 'expense_category_id', val || null)}
                        options={categoryTree.map(({ cat, depth }) => ({
                          value: cat.id,
                          label: '\u00a0'.repeat(depth * 2) + (depth > 0 ? '└ ' : '') + cat.arabic_name,
                        }))}
                        placeholder="-- القسم --"
                        searchable={true}
                      />
                    </td>
                  )}
                  {invoiceType === 'stock_purchase' && (
                    <td className="py-2 pl-2 min-w-[200px]">
                      <CustomSelect
                        value={line.item_id ?? ''}
                        onChange={val => {
                          const item = items.find(i => i.id === val)
                          updateLine(line.id, 'item_id', val || null)
                          if (item && !line.description) updateLine(line.id, 'description', item.arabic_name)
                        }}
                        options={(() => {
                          const result: any[] = []
                          const getChildren = (parentId: string | null, depth: number) => {
                            const subGroups = itemGroups.filter(g => g.parent_group_id === parentId)
                            subGroups.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(g => {
                              result.push({ 
                                value: `group-${g.id}`, 
                                label: '\u00a0'.repeat(depth * 3) + (depth > 0 ? '└ ' : '') + g.arabic_name, 
                                isHeader: true 
                              })
                              const gItems = items.filter(it => it.item_group?.id === g.id)
                              gItems.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(it => {
                                result.push({ 
                                  value: it.id, 
                                  label: '\u00a0'.repeat((depth + 1) * 3) + '└ ' + it.item_code + ' - ' + it.arabic_name 
                                })
                              })
                              getChildren(g.id, depth + 1)
                            })
                          }

                          getChildren(null, 0)

                          const ungrouped = items.filter(it => !it.item_group?.id)
                          if (ungrouped.length > 0) {
                            result.push({ value: 'header-ungrouped', label: 'أصناف غير مصنفة', isHeader: true })
                            ungrouped.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(it => {
                              result.push({ value: it.id, label: `\u00a0\u00a0└ ${it.item_code} - ${it.arabic_name}` })
                            })
                          }
                          return result
                        })()}
                        placeholder="-- اختر صنف --"
                        searchable={true}
                        dropdownMinWidth={280}
                      />
                    </td>
                  )}
                  <td className="py-2 pl-2">
                    <input
                      value={line.description}
                      onChange={e => updateLine(line.id, 'description', e.target.value)}
                      placeholder="وصف البند..."
                      className="border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pl-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={line.quantity}
                      onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="border rounded px-2 py-1 text-xs w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </td>
                  <td className="py-2 pl-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={e => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="border rounded px-2 py-1 text-xs w-28 text-left focus:outline-none focus:ring-1 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </td>
                  <td className="py-2 pl-2 text-left font-medium text-gray-700" dir="ltr">
                    {fmt(line.line_gross)}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals + Notes */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="أي ملاحظات إضافية..."
          />
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-800 mb-3">ملخص المبالغ</h3>
          <div className="flex justify-between text-sm" dir="ltr">
            <span className="font-medium">{fmt(grossAmount)} <span className="text-gray-500 text-xs">EGP</span></span>
            <span className="text-gray-500" dir="rtl">الإجمالي قبل الضريبة</span>
          </div>
          <div className="flex justify-between items-center text-sm" dir="ltr">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-xs text-gray-500">%</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                className="border rounded px-2 py-0.5 text-xs w-16 text-center"
                dir="ltr"
              />
            </div>
            <span className="text-gray-500" dir="rtl">نسبة الضريبة</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-orange-600" dir="ltr">
              <span>{fmt(taxAmount)} <span className="text-orange-500 text-xs">EGP</span></span>
              <span dir="rtl">الضريبة</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm" dir="ltr">
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="border rounded px-2 py-0.5 text-xs w-28 text-left"
              dir="ltr"
            />
            <span className="text-gray-500" dir="rtl">الخصم</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold" dir="ltr">
            <span className="text-blue-700 text-lg">{fmt(netAmount)} <span className="text-blue-600 text-xs">EGP</span></span>
            <span dir="rtl">الصافي</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end mt-4">
        <button
          type="button"
          onClick={() => onCancel ? onCancel() : router.back()}
          className="px-5 py-2.5 rounded-xl border border-border text-gray-700 hover:bg-background-secondary transition text-sm font-semibold shadow-sm"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-8 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition text-sm font-bold shadow-sm"
        >
          {isPending ? 'جارٍ الحفظ...' : initialData?.id ? 'حفظ التعديلات' : 'اعتماد وحفظ الفاتورة'}
        </button>
      </div>
    </form>
  )
}
