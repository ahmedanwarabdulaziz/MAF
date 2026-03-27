'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCutoverBatch } from '@/actions/cutover'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

interface Props {
  params: { id: string }
}

export default function CutoverSetupPage({ params }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Basic states
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data: project } = await supabase.from('projects').select('company_id').eq('id', params.id).single()
      
      if (!project) throw new Error('المشروع غير موجود')
      
      await createCutoverBatch({
        company_id: project.company_id,
        project_id: params.id,
        cutover_date: date,
        notes: notes.trim() || undefined
      })
      
      router.push(`/projects/${params.id}/cutover/financials`)
    } catch (err: any) {
      if (err.message?.includes('duplicate key value violates unique constraint') || err.message?.includes('Only one active cutover')) {
        setError('يوجد بالفعل ملف ترحيل بيانات نشط لهذا المشروع. يمكنك الانتقال للخطوة التالية مباشرة.')
      } else {
        setError(err.message || 'حدث خطأ غير متوقع')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">إعداد الترحيل</h2>
        <p className="mt-1 text-sm text-text-secondary">
          حدد تاريخ الترحيل (Cutover Date) الذي يمثل الحد الفاصل بين البيانات التاريخية والبيانات المباشرة على النظام.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">تاريخ الترحيل الفعلي <span className="text-danger">*</span></label>
          <DatePicker
            value={date}
            onChange={setDate}
          />
          <span className="text-xs text-text-secondary">ملاحظة: جميع الأرصدة والمواقف يجب أن تكون دقيقة تماماً كما هي في نهاية هذا اليوم.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">ملاحظات عامة</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white resize-none"
            placeholder="أي ملاحظات حول سبب الترحيل أو الفترة المالية المرتبطة..."
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !date}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
          </button>
        </div>
      </form>
    </div>
  )
}
