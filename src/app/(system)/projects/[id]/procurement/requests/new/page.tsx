'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPurchaseRequest } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'
import { peekNextDocumentNoByProject } from '@/actions/sequences'
import DatePicker from '@/components/DatePicker'
import CustomSelect from '@/components/CustomSelect'

export default function NewPurchaseRequest({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    request_no: 'تلقائي',
    request_date: new Date().toISOString().split('T')[0],
    required_by_date: '',
    notes: ''
  })

  const [lines, setLines] = useState<{item_id: string, requested_quantity: number, estimated_unit_price: number, notes: string}[]>([
    { item_id: '', requested_quantity: 1, estimated_unit_price: 0, notes: '' }
  ])

  useEffect(() => {
    async function fetchItems() {
      const db = createClient()
      const { data } = await db.from('items').select('id, item_code, arabic_name')
      setItems(data || [])
      setLoadingItems(false)
    }
    async function fetchSeq() {
      try {
        const seq = await peekNextDocumentNoByProject(params.id, 'purchase_request', 'PR')
        setFormData(prev => ({ ...prev, request_no: seq }))
      } catch (err) {}
    }
    fetchItems()
    fetchSeq()
  }, [params.id])

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
      await createPurchaseRequest({
        project_id: params.id,
        request_no: formData.request_no,
        request_date: formData.request_date,
        required_by_date: formData.required_by_date || undefined,
        notes: formData.notes,
        lines: lines
      })
      router.push(`/projects/${params.id}/procurement/requests`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الطلب')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/procurement/requests`} className="hover:text-primary transition-colors">طلبات الشراء</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">طلب شراء جديد</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">إصدار طلب شراء (PR)</h1>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <hr className="border-border" />

            {/* Lines */}
            {/* Lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <h3 className="text-xl font-black text-navy flex items-center gap-2">
                  <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
                  بنود المواد المطلوبة
                </h3>
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
                      <div className="flex flex-col gap-1.5 md:col-span-5">
                        <label className="text-sm font-bold text-navy flex items-center gap-1.5">
                          الصنف (المادة) <span className="text-danger">*</span>
                        </label>
                        <CustomSelect
                          searchable
                          required
                          value={line.item_id}
                          onChange={val => updateLine(idx, 'item_id', val)}
                          options={items.map(it => ({ value: it.id, label: `${it.item_code} - ${it.arabic_name}` }))}
                          placeholder="ابحث عن الصنف بالاسم أو الكود..."
                        />
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

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6">
              <Link
                href={`/projects/${params.id}/procurement/requests`}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                disabled={saving || items.length === 0}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'جارٍ الحفظ...' : 'إنشاء طلب الشراء'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
