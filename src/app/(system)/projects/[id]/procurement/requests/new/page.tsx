'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPurchaseRequest } from '@/actions/procurement'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

export default function NewPurchaseRequest({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    request_no: `PR-${Math.floor(Math.random() * 10000)}`,
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
    fetchItems()
  }, [])

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
              <div className="flex flex-col gap-1.5 focus-within:text-primary">
                <label className="text-sm font-medium text-text-primary">رقم الطلب <span className="text-danger">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.request_no}
                  onChange={e => setFormData({ ...formData, request_no: e.target.value })}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">تاريخ الطلب <span className="text-danger">*</span></label>
                <DatePicker
                  value={formData.request_date}
                  onChange={val => setFormData({ ...formData, request_date: val })}
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
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">بنود المواد المطلوبة</h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-sm font-medium text-primary hover:text-navy transition-colors"
                >
                  + إضافة بند أخر
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-4 items-start bg-background-secondary/50 p-4 rounded-lg border border-border">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">الصنف (المادة) <span className="text-danger">*</span></label>
                          <select
                            required
                            value={line.item_id}
                            onChange={e => updateLine(idx, 'item_id', e.target.value)}
                            className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary"
                          >
                            <option value="" disabled>اختر الصنف من الدليل...</option>
                            {items.map(it => (
                              <option key={it.id} value={it.id}>{it.item_code} - {it.arabic_name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-text-secondary">الكمية المطلوبة <span className="text-danger">*</span></label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={line.requested_quantity}
                            onChange={e => updateLine(idx, 'requested_quantity', Number(e.target.value))}
                            className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary dir-ltr text-right"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-text-secondary">السعر التقديري للوحدة (اختياري)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={line.estimated_unit_price}
                            onChange={e => updateLine(idx, 'estimated_unit_price', Number(e.target.value))}
                            className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary dir-ltr text-right"
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">ملاحظات البند</label>
                          <input
                            type="text"
                            value={line.notes}
                            onChange={e => updateLine(idx, 'notes', e.target.value)}
                            placeholder="مواصفات، لون، متطلبات خاصة..."
                            className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="mt-6 text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors"
                        title="حذف البند"
                      >
                        ✕
                      </button>
                    )}
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
