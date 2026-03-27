'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSubcontractAgreement } from '@/actions/agreements'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

export default function NewSubcontractAgreementPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [fetching, setFetching] = useState(true)
  const [parties, setParties] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<string>('')

  const [formData, setFormData] = useState({
    subcontractor_party_id: '',
    agreement_code: '',
    status: 'draft',
    default_taaliya_type: 'percentage',
    default_taaliya_value: 5,
    start_date: '',
    end_date: '',
    notes: ''
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: proj } = await supabase.from('projects').select('company_id').eq('id', params.id).single()
      if (proj) setCompanyId(proj.company_id)
      
      const { data: pts } = await supabase.from('parties').select('id, arabic_name')
      if (pts) setParties(pts)
        
      setFetching(false)
    }
    load()
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const result = await createSubcontractAgreement({ 
        ...formData, 
        project_id: params.id, 
        company_id: companyId 
      })
      // Redirect to the newly created agreement details page to add lines
      router.push(`/projects/${params.id}/agreements/${result.id}`)
    } catch (err: any) {
      if (err.message?.includes('subcontract_agreements_project_id_agreement_code_key')) {
        setError('رقم العقد مستخدم بالفعل في هذا المشروع.')
      } else {
        setError(err.message || 'حدث خطأ أثناء حفظ العقد')
      }
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="text-sm text-text-secondary">جاري التحميل...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">إضافة عقد مقاول باطن</h1>
        <p className="mt-1 text-sm text-text-secondary">
          إدخال البيانات الأساسية لعقد المقاول. يمكنك إضافة بنود الأعمال وفئات الأسعار بعد الحفظ.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">جهة المقاول <span className="text-danger">*</span></label>
              <select
                required
                value={formData.subcontractor_party_id}
                onChange={e => setFormData({ ...formData, subcontractor_party_id: e.target.value })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="" disabled>اختر المقاول...</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.arabic_name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">رقم / كود العقد <span className="text-danger">*</span></label>
              <input
                type="text"
                required
                value={formData.agreement_code}
                onChange={e => setFormData({ ...formData, agreement_code: e.target.value })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                dir="ltr"
                placeholder="SUB-2026-001"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">حالة العقد</label>
              <select
                required
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="draft">مسودة (Draft)</option>
                <option value="active">ساري (Active)</option>
                <option value="suspended">موقوف (Suspended)</option>
                <option value="closed">مغلق (Closed)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-4 md:col-span-2">
              <h3 className="text-sm font-bold text-text-primary mb-2">إعدادات التعلية (الضمانات / الاستقطاعات)</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">نوع التعلية الافتراضي <span className="text-danger">*</span></label>
              <select
                required
                value={formData.default_taaliya_type}
                onChange={e => setFormData({ ...formData, default_taaliya_type: e.target.value })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed_amount">مبلغ ثابت</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">قيمة التعلية الافتراضية <span className="text-danger">*</span></label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.default_taaliya_value}
                onChange={e => setFormData({ ...formData, default_taaliya_value: Number(e.target.value) })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border pt-4 md:col-span-2">
              <h3 className="text-sm font-bold text-text-primary mb-2">تواريخ العقد والتفاصيل</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ البدء</label>
              <DatePicker
                value={formData.start_date}
                onChange={val => setFormData({ ...formData, start_date: val })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">تاريخ الانتهاء</label>
              <DatePicker
                value={formData.end_date}
                onChange={val => setFormData({ ...formData, end_date: val })}
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">ملاحظات عامة</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => router.push(`/projects/${params.id}/agreements`)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جارٍ الحفظ...' : 'حفظ ومتابعة لإضافة البنود'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
