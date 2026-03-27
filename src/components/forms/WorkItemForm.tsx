'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectWorkItem, updateProjectWorkItem } from '@/actions/agreements'
import { createClient } from '@/lib/supabase'

export default function WorkItemForm({ 
  projectId, 
  initialData 
}: { 
  projectId: string, 
  initialData?: any 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [fetching, setFetching] = useState(true)
  const [units, setUnits] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<string>('')

  const [formData, setFormData] = useState({
    item_code: initialData?.item_code || '',
    arabic_description: initialData?.arabic_description || '',
    english_description: initialData?.english_description || '',
    default_unit_id: initialData?.default_unit_id || '',
    notes: initialData?.notes || ''
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: proj } = await supabase.from('projects').select('company_id').eq('id', projectId).single()
      if (proj) setCompanyId(proj.company_id)
      
      const { data: u } = await supabase.from('units').select('id, arabic_name')
      if (u) setUnits(u)
        
      setFetching(false)
    }
    load()
  }, [projectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (initialData?.id) {
        await updateProjectWorkItem(initialData.id, projectId, formData)
      } else {
        await createProjectWorkItem({ ...formData, project_id: projectId, company_id: companyId })
      }
      router.push(`/projects/${projectId}/work-items`)
    } catch (err: any) {
      if (err.message?.includes('project_work_items_project_id_item_code_key')) {
        setError('كود البند مستخدم بالفعل في هذا المشروع.')
      } else {
        setError(err.message || 'حدث خطأ أثناء حفظ البند')
      }
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="text-sm text-text-secondary">جاري التحميل...</div>

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-sm font-medium text-text-primary">وصف البند (عربي) <span className="text-danger">*</span></label>
          <input
            type="text"
            required
            value={formData.arabic_description}
            onChange={e => setFormData({ ...formData, arabic_description: e.target.value })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            placeholder="مثال: أعمال حفر لزوم الأساسات..."
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-sm font-medium text-text-primary">وصف البند (إنجليزي)</label>
          <input
            type="text"
            value={formData.english_description}
            onChange={e => setFormData({ ...formData, english_description: e.target.value })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">كود البند</label>
          <input
            type="text"
            value={formData.item_code}
            onChange={e => setFormData({ ...formData, item_code: e.target.value })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            dir="ltr"
            placeholder="EXC-001"
          />
          <span className="text-xs text-text-secondary">اختياري - يفضل لتسهيل البحث والربط مع المقايسة</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">الوحدة الافتراضية</label>
          <select
            value={formData.default_unit_id}
            onChange={e => setFormData({ ...formData, default_unit_id: e.target.value })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
          >
            <option value="">لا توجد وحدة افتراضية (مقطوعية)</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.arabic_name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-sm font-medium text-text-primary">ملاحظات والتوصيف الفني</label>
          <textarea
            rows={4}
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}/work-items`)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'جارٍ الحفظ...' : 'حفظ البند'}
        </button>
      </div>
    </form>
  )
}
