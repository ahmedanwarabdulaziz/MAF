'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'
import { createProject } from '@/actions/projects'

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCode, setAutoCode] = useState('جاري التوليد...')
  const [form, setForm] = useState({
    arabic_name: '',
    english_name: '',
    project_onboarding_type: 'new',
    status: 'active',
    location: '',
    start_date: '',
    expected_end_date: '',
    estimated_contract_value: '',
    planned_allocation_amount: '',
    notes: '',
  })

  // Auto-generate project code based on existing project count
  useEffect(() => {
    async function generateCode() {
      const supabase = createClient()
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
      const next = (count ?? 0) + 1
      setAutoCode(`PRJ-${String(next).padStart(3, '0')}`)
    }
    generateCode()
  }, [])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await createProject({
        project_code: autoCode,
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        project_onboarding_type: form.project_onboarding_type,
        status: form.status,
        location: form.location.trim() || null,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        estimated_contract_value: form.estimated_contract_value ? Number(form.estimated_contract_value) : null,
        planned_allocation_amount: form.planned_allocation_amount ? Number(form.planned_allocation_amount) : null,
        notes: form.notes.trim() || null,
      })
      router.push(`/company/projects/${data.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">مشروع جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">أدخل بيانات المشروع الأساسية</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Type selection */}
        <div className="rounded-xl border border-border bg-white p-5">
          <label className="mb-3 block text-sm font-semibold text-text-primary">نوع المشروع</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ v: 'new', label: 'مشروع جديد', sub: 'يبدأ من الصفر' },
              { v: 'existing', label: 'مشروع قائم', sub: 'يحتاج ترحيل بيانات' }].map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => set('project_onboarding_type', opt.v)}
                className={`rounded-lg border-2 px-4 py-3 text-right transition-colors ${
                  form.project_onboarding_type === opt.v
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background-secondary hover:border-primary/40'
                }`}
              >
                <div className="font-medium text-text-primary text-sm">{opt.label}</div>
                <div className="text-xs text-text-secondary">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Basic info */}
        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-text-primary">البيانات الأساسية</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">رمز المشروع</label>
              <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-3 py-2.5" dir="ltr">
                <span className="text-sm font-bold text-primary tracking-widest">{autoCode}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">حالة المشروع</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="active">نشط</option>
                <option value="on_hold">متوقف</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الاسم بالعربية <span className="text-danger">*</span></label>
            <input required value={form.arabic_name} onChange={e => set('arabic_name', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              placeholder="مشروع العاصمة الإدارية" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
            <input value={form.english_name} onChange={e => set('english_name', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              placeholder="New Administrative Capital" dir="ltr" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الموقع</label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              placeholder="القاهرة الجديدة" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ البداية</label>
              <DatePicker value={form.start_date} onChange={val => set('start_date', val)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ الانتهاء المتوقع</label>
              <DatePicker value={form.expected_end_date} onChange={val => set('expected_end_date', val)} />
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-text-primary">البيانات المالية</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">قيمة العقد التقديرية (ج.م)</label>
              <input type="number" value={form.estimated_contract_value} onChange={e => set('estimated_contract_value', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                placeholder="0.00" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">التخصيص المخطط (ج.م)</label>
              <input type="number" value={form.planned_allocation_amount} onChange={e => set('planned_allocation_amount', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                placeholder="0.00" dir="ltr" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">ملاحظات</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {loading ? 'جارٍ الحفظ...' : 'إنشاء المشروع'}
          </button>
          <a href="/company/projects"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
            إلغاء
          </a>
        </div>
      </form>
    </div>
  )
}
