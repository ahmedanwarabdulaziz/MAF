'use client'

import { useState, useEffect } from 'react'
import { createPurchaseRequest, updatePurchaseRequest } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'

interface PurchaseRequestFormProps {
  projectId: string
  onSuccess: () => void
  onCancel: () => void
  initialData?: any // Added for editing
}

export default function PurchaseRequestForm({ projectId, onSuccess, onCancel, initialData }: PurchaseRequestFormProps) {
  const [items, setItems] = useState<any[]>([])
  const [itemGroups, setItemGroups] = useState<any[]>([])
  const [itemsWithStock, setItemsWithStock] = useState<Set<string>>(new Set())
  const [loadingItems, setLoadingItems] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    request_no: initialData?.request_no || 'تلقائي',
    request_date: initialData?.request_date || new Date().toISOString().split('T')[0],
    required_by_date: initialData?.required_by_date || '',
    notes: initialData?.notes || ''
  })

  const [lines, setLines] = useState<{item_id: string, requested_quantity: number, estimated_unit_price: number, notes: string}[]>(
    initialData?.lines?.length > 0
      ? initialData.lines.map((l: any) => ({
          item_id: l.item_id,
          requested_quantity: l.requested_quantity,
          estimated_unit_price: l.estimated_unit_price || 0,
          notes: l.notes || ''
        }))
      : [{ item_id: '', requested_quantity: 1, estimated_unit_price: 0, notes: '' }]
  )

  useEffect(() => {
    async function fetchItems() {
      const db = createClient()
      const { data: itemsData } = await db.from('items').select('id, item_code, arabic_name, item_group:item_group_id(id, arabic_name)')
      setItems(itemsData || [])
      const { data: groupsData } = await db.from('item_groups').select('id, arabic_name, parent_group_id, group_code')
      setItemGroups(groupsData || [])

      // Fetch items with stock > 0
      const { data: stockData } = await db.from('stock_balances').select('item_id').gt('quantity_on_hand', 0)
      if (stockData) {
        setItemsWithStock(new Set(stockData.map(s => s.item_id)))
      }

      setLoadingItems(false)
    }
    async function fetchSeq() {
      if (initialData?.request_no) return
      try {
        const seq = await peekNextDocumentNoByProject(projectId, 'purchase_request', 'PR')
        setFormData(prev => ({ ...prev, request_no: seq }))
      } catch (err) {}
    }
    fetchItems()
    fetchSeq()
  }, [projectId])

  function addLine() {
    setLines([...lines, { item_id: '', requested_quantity: 1, estimated_unit_price: 0, notes: '' }])
  }

  function updateLine(index: number, field: string, val: any) {
    const arr = [...lines]
    arr[index] = { ...arr[index], [field]: val }
    setLines(arr)
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (lines.some(l => !l.item_id || l.requested_quantity <= 0)) {
      setError('يرجى اختيار الصنف وتحديد كمية أكبر من صفر لجميع البنود.')
      setSaving(false)
      return
    }

    try {
      if (initialData?.id) {
        await updatePurchaseRequest(initialData.id, {
          project_id: projectId,
          request_date: formData.request_date,
          required_by_date: formData.required_by_date || undefined,
          notes: formData.notes,
          lines: lines
        })
      } else {
        await createPurchaseRequest({
          project_id: projectId,
          request_no: formData.request_no,
          request_date: formData.request_date,
          required_by_date: formData.required_by_date || undefined,
          notes: formData.notes,
          lines: lines
        })
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الطلب')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full space-y-6">
      {error && (
        <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loadingItems ? (
        <div className="text-sm text-text-secondary">جاري تحميل دليل الأصناف...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex flex-col gap-1.5 md:col-span-3">
              <h2 className="font-semibold text-text-primary mb-2">بيانات الطلب الأساسية</h2>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">رقم الطلب <span className="text-danger">*</span></label>
              <input
                type="text"
                required
                readOnly
                value={formData.request_no}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none cursor-not-allowed text-text-secondary transition-colors"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ الطلب <span className="text-danger">*</span></label>
              <input
                type="date"
                required
                readOnly
                value={formData.request_date}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none cursor-not-allowed text-text-secondary transition-colors w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">مطلوب التوريد قبل (مهلة)</label>
              <DatePicker
                value={formData.required_by_date}
                onChange={val => setFormData({ ...formData, required_by_date: val })}
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-3 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">ملاحظات وسبب الطلب</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
              <h2 className="text-xl font-black text-navy flex items-center gap-2">
                <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
                بنود المواد المطلوبة
              </h2>
              <button
                type="button"
                onClick={addLine}
                className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                إضافة مادة للصرف
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-4 items-start bg-background-secondary/30 p-5 rounded-2xl border border-border hover:border-primary/40 hover:shadow-sm transition-all group relative">
                  
                  {/* Item Number */}
                  <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold shrink-0 mt-[1.6rem] hidden md:flex shadow-sm">
                    {idx + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 w-full">
                    {/* Item */}
                    <div className="flex flex-col gap-1.5 md:col-span-5 relative">
                      <label className="text-sm font-bold text-navy flex items-center gap-1.5">
                        الصنف (المادة) <span className="text-danger">*</span>
                      </label>
                      <CustomSelect
                        searchable
                        required
                        value={line.item_id}
                        onChange={val => updateLine(idx, 'item_id', val)}
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
                              const gItems = items.filter(it => {
                                const gId = Array.isArray(it.item_group) ? it.item_group[0]?.id : it.item_group?.id
                                return gId === g.id
                              })
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

                          const ungrouped = items.filter(it => {
                            const gId = Array.isArray(it.item_group) ? it.item_group[0]?.id : it.item_group?.id
                            return !gId
                          })
                          if (ungrouped.length > 0) {
                            result.push({ value: 'header-ungrouped', label: 'أصناف غير مصنفة', isHeader: true })
                            ungrouped.sort((a,b) => a.arabic_name.localeCompare(b.arabic_name)).forEach(it => {
                              result.push({ value: it.id, label: `\u00a0\u00a0└ ${it.item_code} - ${it.arabic_name}` })
                            })
                          }
                          return result
                        })()}
                        placeholder="ابحث عن الصنف بالاسم أو الكود..."
                        dropdownMinWidth={280}
                      />
                      {line.item_id && itemsWithStock.has(line.item_id) && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0 text-amber-500 mt-0.5">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          <span>هذا الصنف متوفر بمخازن الشركة، يرجى مراجعة أرصدة المخازن لتفادي شراء كميات إضافية.</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col gap-1.5 md:col-span-3">
                      <label className="text-sm font-bold text-navy">الكمية المطلوبة <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={line.requested_quantity || ''}
                        onChange={e => updateLine(idx, 'requested_quantity', Number(e.target.value))}
                        placeholder="0.00"
                        className="rounded-lg border border-border bg-white px-3 py-[9px] text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dir-ltr text-right font-black text-navy transition-all shadow-sm"
                      />
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5 md:col-span-4">
                      <label className="text-sm font-bold text-text-secondary">ملاحظات والتفاصيل</label>
                      <input
                        type="text"
                        value={line.notes}
                        onChange={e => updateLine(idx, 'notes', e.target.value)}
                        placeholder="مواصفات، لون، متطلبات خاصة..."
                        className="rounded-lg border border-border bg-white px-3 py-[9px] text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Delete Action */}
                  <div className="shrink-0 mt-2 md:mt-[1.6rem]">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-danger/70 hover:bg-danger/10 hover:text-danger hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                      title="حذف البند"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors shadow-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || items.length === 0}
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>جارٍ الحفظ...</>
              ) : (
                <>
                  {initialData ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.827.942.943-2.828a4.5 4.5 0 011.12-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                  {initialData ? 'حفظ التعديلات' : 'إنشاء طلب الشراء'}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
