'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'
import { updateProject } from '@/actions/projects'

interface Props {
  isOpen: boolean
  onClose: () => void
  project: any | null
}

export default function EditProjectModal({ isOpen, onClose, project }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const initialForm = {
    arabic_name: '',
    english_name: '',
    status: 'active',
    owner_party_id: '',
    location: '',
    start_date: '',
    planned_allocation_amount: '',
  }
  
  const [form, setForm] = useState(initialForm)
  const [owners, setOwners] = useState<any[]>([])

  useEffect(() => {
    if (!isOpen) return
    
    async function loadData() {
      const supabase = createClient()
      
      const { data: owners } = await supabase
        .from('parties')
        .select(`
          id, 
          arabic_name,
          party_roles!inner(role_type)
        `)
        .eq('party_roles.role_type', 'owner')
        
      if (owners) setOwners(owners)
    }
    loadData()
    
    // Reset form when opened with project data
    if (project) {
      setForm({
        arabic_name: project.arabic_name || '',
        english_name: project.english_name || '',
        status: project.status || 'active',
        owner_party_id: project.owner_party_id || '',
        location: project.location || '',
        start_date: project.start_date || '',
        planned_allocation_amount: project.planned_allocation_amount ? String(project.planned_allocation_amount) : '',
      })
    } else {
      setForm(initialForm)
    }
    setError(null)
  }, [isOpen, project])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setLoading(true)
    setError(null)

    try {
      await updateProject(project.id, {
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        status: form.status,
        owner_party_id: form.owner_party_id || null,
        location: form.location.trim() || null,
        start_date: form.start_date || null,
        planned_allocation_amount: form.planned_allocation_amount ? Number(form.planned_allocation_amount) : null,
      })
      
      router.refresh()
      onClose()
      window.setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  if (!isOpen || !project) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">تعديل المشروع</h2>
              <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-mono font-medium text-white shadow-inner" dir="ltr">
                {project.project_code}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/80">تحديث بيانات المشروع الأساسية والمالية</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
          <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            {/* Basic info */}
            <div className="rounded-xl border border-border bg-white p-5 space-y-4">
              <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات الأساسية</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-text-primary">حالة المشروع</label>
                  {/* Professional Toggle */}
                  <div className="flex items-center bg-background-secondary p-1 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => set('status', 'active')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        form.status === 'active' 
                          ? 'bg-white text-success shadow-sm ring-1 ring-border' 
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      نشط
                    </button>
                    <button
                      type="button"
                      onClick={() => set('status', 'on_hold')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                        form.status === 'on_hold' 
                          ? 'bg-white text-amber-600 shadow-sm ring-1 ring-border' 
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      متوقف
                    </button>
                  </div>
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
                <label className="text-sm font-medium text-text-primary">الجهة المالكة</label>
                <select
                  value={form.owner_party_id}
                  onChange={e => set('owner_party_id', e.target.value)}
                  className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                >
                  <option value="">لا يوجد مالك مسجل (اختياري)</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>{o.arabic_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">الموقع</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)}
                    className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                    placeholder="القاهرة الجديدة" />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">تاريخ البداية</label>
                  <DatePicker value={form.start_date} onChange={val => set('start_date', val)} />
                </div>
              </div>
            </div>

            {/* Financial */}
            <div className="rounded-xl border border-border bg-white p-5 space-y-4">
              <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات المالية</h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">التخصيص المخطط (ج.م)</label>
                <input type="number" value={form.planned_allocation_amount} onChange={e => set('planned_allocation_amount', e.target.value)}
                  className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                  placeholder="0.00" dir="ltr" />
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-white p-4 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
            إلغاء
          </button>
          <button form="edit-project-form" type="submit" disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  )
}
