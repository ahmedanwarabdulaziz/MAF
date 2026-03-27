'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSubcontractAgreement, updateSubcontractAgreement, saveSubcontractAgreementLines, getProjectWorkItems } from '@/actions/agreements'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

export default function AgreementDetailsPage({ params }: { params: { id: string, ag_id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [agreement, setAgreement] = useState<any>(null)
  const [workItems, setWorkItems] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  
  // Header form state
  const [headerData, setHeaderData] = useState<any>({})
  
  // Lines state
  const [lines, setLines] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [ag, items, uData] = await Promise.all([
          getSubcontractAgreement(params.ag_id),
          getProjectWorkItems(params.id),
          createClient().from('units').select('id, arabic_name')
        ])
        
        setAgreement(ag)
        setHeaderData({
          status: ag.status,
          default_taaliya_type: ag.default_taaliya_type,
          default_taaliya_value: Number(ag.default_taaliya_value),
          start_date: ag.start_date || '',
          end_date: ag.end_date || '',
          notes: ag.notes || ''
        })
        
        // Ensure lines have unique IDs for React mapping
        const mappedLines = (ag.lines || []).map((l: any, i: number) => ({
          ...l,
          _id: l.id || `existing-${i}`,
          owner_billable_default: l.owner_billable_default ?? true
        }))
        setLines(mappedLines)
        
        setWorkItems(items || [])
        setUnits(uData.data || [])
      } catch (err: any) {
        setError('خطأ في تحميل تفاصيل العقد: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.ag_id, params.id])

  async function handleUpdateHeader(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateSubcontractAgreement(params.ag_id, params.id, headerData)
      alert('تم تحديث بيانات العقد بنجاح')
    } catch (err: any) {
      setError('خطأ في حفظ العقد: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveLines() {
    setSaving(true)
    setError(null)
    try {
      // Validate lines
      for (const line of lines) {
        if (!line.work_item_id || !line.unit_id) {
          throw new Error('يرجى التأكد من اختيار البند والوحدة لجميع السطور')
        }
      }
      await saveSubcontractAgreementLines(params.ag_id, params.id, lines)
      alert('تم حفظ بنود العقد والفئات بنجاح')
    } catch (err: any) {
      setError(err.message || 'خطأ في حفظ البنود')
    } finally {
      setSaving(false)
    }
  }

  function addLine() {
    setLines([
      ...lines,
      {
        _id: 'new-' + Date.now(),
        work_item_id: '',
        unit_id: '',
        agreed_rate: 0,
        taaliya_type: agreement?.default_taaliya_type || 'percentage',
        taaliya_value: agreement?.default_taaliya_value || 5,
        estimated_quantity: 0,
        owner_billable_default: true,
        notes: ''
      }
    ])
  }

  function updateLine(_id: string, field: string, value: any) {
    setLines(lines.map(l => l._id === _id ? { ...l, [field]: value } : l))
  }

  function removeLine(_id: string) {
    setLines(lines.filter(l => l._id !== _id))
  }

  // Work item auto-population logic
  function handleWorkItemChange(_id: string, workItemId: string) {
    const selectedItem = workItems.find(i => i.id === workItemId)
    setLines(lines.map(l => {
      if (l._id === _id) {
        return {
          ...l,
          work_item_id: workItemId,
          unit_id: selectedItem?.default_unit_id || l.unit_id
        }
      }
      return l
    }))
  }

  if (loading) return <div className="text-sm text-text-secondary">جاري تحميل العقد...</div>
  if (!agreement) return <div className="text-sm text-danger">العقد غير موجود أو لا تملك صلاحية</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/agreements`} className="hover:text-primary transition-colors">عقود مقاولي الباطن</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{agreement.agreement_code}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            عقد مقاول: {agreement.subcontractor?.arabic_name || 'غير معروف'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة بيانات العقد وتحديد الفئات (الأسعار) للبنود المتفق عليها.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text-primary mb-4 border-b border-border pb-2">بيانات العقد الأساسية</h2>
        
        <form onSubmit={handleUpdateHeader} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">رقم العقد</label>
            <input type="text" disabled value={agreement.agreement_code} className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-tertiary cursor-not-allowed" dir="ltr" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">حالة العقد</label>
            <select
              value={headerData.status}
              onChange={e => setHeaderData({ ...headerData, status: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="draft">مسودة (Draft)</option>
              <option value="active">ساري (Active)</option>
              <option value="suspended">موقوف (Suspended)</option>
              <option value="closed">مغلق (Closed)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">نوع التعلية (الاستقطاع) الافتراضي</label>
            <select
              value={headerData.default_taaliya_type}
              onChange={e => setHeaderData({ ...headerData, default_taaliya_type: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed_amount">مبلغ ثابت</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">قيمة التعلية</label>
            <input
              type="number"
              step="0.01"
              value={headerData.default_taaliya_value}
              onChange={e => setHeaderData({ ...headerData, default_taaliya_value: Number(e.target.value) })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">تاريخ البدء</label>
            <DatePicker
              value={headerData.start_date}
              onChange={val => setHeaderData({ ...headerData, start_date: val })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">تاريخ الانتهاء</label>
            <DatePicker
              value={headerData.end_date}
              onChange={val => setHeaderData({ ...headerData, end_date: val })}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-3">
            <label className="text-sm font-medium text-text-primary">ملاحظات عامة</label>
            <textarea
              rows={2}
              value={headerData.notes}
              onChange={e => setHeaderData({ ...headerData, notes: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-background-secondary border border-border px-6 py-2 text-sm font-semibold text-text-primary hover:bg-border/50 transition-colors disabled:opacity-50"
            >
              حفظ التعديلات الأساسية
            </button>
          </div>
        </form>
      </div>

      {/* LINES SECTION */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">فئات الأعمال المعتمدة (B.O.Q)</h2>
          <button
            onClick={addLine}
            className="rounded-lg bg-primary/10 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/20 transition-colors"
          >
            + إضافة بند أعمال
          </button>
        </div>

        <div className="overflow-x-auto hide-scrollbar p-6 pt-2">
          {lines.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-secondary border border-dashed border-border rounded-lg">
              لم يتم إدراج أي بنود أعمال في هذا العقد. اضغط على "إضافة بند أعمال".
            </div>
          ) : (
            <table className="w-full text-right text-sm whitespace-nowrap">
              <thead className="bg-background-secondary border-b border-border">
                <tr>
                  <th className="px-3 py-3 font-semibold text-text-secondary min-w-[250px]">بند الأعمال</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-32">الوحدة</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-32">الفئة (السعر)</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-32">الكمية المقدرة</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-32 text-amber-600">نوع التعلية</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-28 text-amber-600">قيمة التعلية</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary w-32">يطالب به المالك؟</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary min-w-[150px]">ملاحظات</th>
                  <th className="px-3 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map(line => (
                  <tr key={line._id}>
                    <td className="px-3 py-2">
                      <select
                        required
                        value={line.work_item_id}
                        onChange={e => handleWorkItemChange(line._id, e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر البند...</option>
                        {workItems.map(wi => (
                          <option key={wi.id} value={wi.id}>
                            {wi.item_code ? `[${wi.item_code}] ` : ''}{wi.arabic_description}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        required
                        value={line.unit_id}
                        onChange={e => updateLine(line._id, 'unit_id', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="" disabled>اختر الوحدة...</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.arabic_name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={line.agreed_rate}
                        onChange={e => updateLine(line._id, 'agreed_rate', Number(e.target.value))}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary font-bold text-navy"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.estimated_quantity}
                        onChange={e => updateLine(line._id, 'estimated_quantity', Number(e.target.value))}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.taaliya_type}
                        onChange={e => updateLine(line._id, 'taaliya_type', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary text-amber-600"
                      >
                        <option value="percentage">نسبة مئوية (%)</option>
                        <option value="fixed_amount">مبلغ ثابت (/وحدة)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.taaliya_value}
                        onChange={e => updateLine(line._id, 'taaliya_value', Number(e.target.value))}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary text-amber-600"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.owner_billable_default ? 'true' : 'false'}
                        onChange={e => updateLine(line._id, 'owner_billable_default', e.target.value === 'true')}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="true">نعم (يُفوتر)</option>
                        <option value="false">لا (داخلي)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.notes}
                        onChange={e => updateLine(line._id, 'notes', e.target.value)}
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-left">
                      <button
                        type="button"
                        onClick={() => removeLine(line._id)}
                        className="text-text-tertiary hover:text-danger transition-colors p-1"
                        title="حذف البند"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveLines}
              disabled={saving}
              className="rounded-lg bg-primary px-8 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ فئات وبنود الأعمال'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
