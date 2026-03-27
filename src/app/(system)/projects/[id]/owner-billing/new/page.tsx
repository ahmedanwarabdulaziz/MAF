'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { createOwnerBillingDocument } from '@/actions/owner_billing'
import DatePicker from '@/components/DatePicker'

export default function NewOwnerBilling({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    document_no: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
    billing_date: new Date().toISOString().split('T')[0],
    notes: '',
    taxRate: 14 // default VAT %
  })

  const [lines, setLines] = useState<{
    line_description: string, 
    quantity: number, 
    unit_price: number, 
    notes: string
  }[]>([{
    line_description: '', quantity: 1, unit_price: 0, notes: ''
  }])

  useEffect(() => {
    async function fetchProject() {
      const db = createClient()
      const { data, error } = await db.from('projects').select('owner_party_id').eq('id', params.id).single()
      if (data?.owner_party_id) {
        setProjectOwnerId(data.owner_party_id)
      } else {
        setError('تعذر العثور على المالك المرتبط بهذا المشروع. يرجى إعداد المالك في بيانات المشروع أولاً.')
      }
      setLoading(false)
    }
    fetchProject()
  }, [params.id])

  function addLine() {
    setLines([...lines, { line_description: '', quantity: 1, unit_price: 0, notes: '' }])
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

  // Auto-calculated totals
  const totalGross = lines.reduce((acc, l) => acc + ((l.quantity || 0) * (l.unit_price || 0)), 0)
  const taxAmount = totalGross * (formData.taxRate / 100)
  const netAmount = totalGross + taxAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectOwnerId) {
      setError('لا يمكن حفظ الفاتورة بدون مالك.')
      return
    }
    if (lines.some(l => !l.line_description)) {
      setError('يرجى كتابة وصف لجميع البنود.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Map to the required API payload
      const mappedLines = lines.map(l => {
        const lineVal = (l.quantity || 0) * (l.unit_price || 0)
        return {
          ...l,
          line_gross: lineVal,
          line_net: lineVal // For now, tax is aggregated at header level. Line net = line gross
        }
      })

      await createOwnerBillingDocument({
        project_id: params.id,
        owner_party_id: projectOwnerId,
        document_no: formData.document_no,
        billing_date: formData.billing_date,
        gross_amount: totalGross,
        tax_amount: taxAmount,
        net_amount: netAmount,
        notes: formData.notes,
        lines: mappedLines
      })
      router.push(`/projects/${params.id}/owner-billing`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الفاتورة')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-text-secondary">جاري التحميل...</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/owner-billing`} className="hover:text-primary transition-colors">فواتير المالك</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">إنشاء فاتورة جديدة</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">إصدار فاتورة للمالك (Owner Invoice)</h1>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Header section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">رقم الفاتورة (المرجع) <span className="text-danger">*</span></label>
              <input
                type="text"
                required
                value={formData.document_no}
                onChange={e => setFormData({ ...formData, document_no: e.target.value })}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ الإصدار <span className="text-danger">*</span></label>
              <DatePicker
                value={formData.billing_date}
                onChange={val => setFormData({ ...formData, billing_date: val })}
              />
            </div>
            <div className="flex flex-col gap-1.5 focus-within:text-primary">
              <label className="text-sm font-medium text-text-primary">نسبة ضريبة القيمة المضافة (%)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.taxRate}
                onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors block w-full text-right"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 focus-within:text-primary">
            <label className="text-sm font-medium text-text-primary">ملاحظات الفاتورة</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <hr className="border-border" />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">بنود الأعمال والمطالبات (Billable Lines)</h3>
              <button
                type="button"
                onClick={addLine}
                className="text-sm font-medium text-primary hover:text-navy transition-colors"
              >
                + إضافة بند أخر
              </button>
            </div>

            <div className="space-y-4">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-4 items-start bg-background-secondary/50 p-4 rounded-lg border border-border">
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-text-secondary">وصف البند / المطالبة <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        required
                        value={line.line_description}
                        onChange={e => updateLine(idx, 'line_description', e.target.value)}
                        placeholder="أعمال توريد وتركيب..."
                        className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text-secondary">الكمية</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={line.quantity}
                          onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                          className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary dir-ltr text-right"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text-secondary">فئة الوحدة (Price)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={line.unit_price}
                          onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}
                          className="rounded-md border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-primary dir-ltr text-right"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text-secondary">الإجمالي (Gross)</label>
                        <div className="rounded-md bg-white border border-border/50 px-2 py-1.5 text-sm text-navy font-semibold dir-ltr text-right">
                          {((line.quantity || 0) * (line.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="mt-8 text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors"
                      title="حذف البند"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border" />

          {/* Totals Engine */}
          <div className="flex justify-end">
            <div className="w-full md:w-1/3 space-y-3 bg-background-secondary p-5 rounded-lg border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-right">الإجمالي قبل الضريبة:</span>
                <span className="font-medium text-navy dir-ltr">{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary text-right">الضريبة ({formData.taxRate}%):</span>
                <span className="font-medium text-danger dir-ltr">{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-lg font-bold">
                <span className="text-text-primary text-right">الصافي المستحق:</span>
                <span className="text-primary dir-ltr">{netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href={`/projects/${params.id}/owner-billing`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving || !projectOwnerId}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جارٍ الحفظ...' : 'إنشاء فاتورة המالك'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
