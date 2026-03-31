'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { createItemGroup } from '@/actions/warehouse'

interface Props {
  companyId: string
  parentGroups: { id: string; arabic_name: string }[]
}

export default function NewItemGroupDialog({ companyId, parentGroups }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCode, setAutoCode] = useState('جاري التوليد...')
  
  const initialForm = {
    arabic_name: '',
    english_name: '',
    parent_group_id: '',
    is_active: true,
    notes: '',
  }
  
  const [form, setForm] = useState(initialForm)

  const resetForm = () => {
    setForm(initialForm)
    setError(null)
  }

  const openModal = () => setIsOpen(true)
  const closeModal = () => {
    setIsOpen(false)
    resetForm()
  }

  function set(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // Auto-generate item group code based on existing groups
  useEffect(() => {
    if (!isOpen) return
    
    async function generateCode() {
      const supabase = createClient()
      const { count } = await supabase
        .from('item_groups')
        .select('id', { count: 'exact', head: true })
      const next = (count ?? 0) + 1
      setAutoCode(`GRP-${String(next).padStart(3, '0')}`)
    }
    generateCode()
    resetForm()
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await createItemGroup({
        company_id: companyId,
        group_code: autoCode,
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        parent_group_id: form.parent_group_id || null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      })
      
      setLoading(false)
      closeModal()
      router.refresh()
    } catch (err: any) {
      console.error('Error saving item group:', err)
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        + إضافة مجموعة
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">إضافة مجموعة أصناف</h2>
                <p className="mt-1 text-sm text-white/80">تعريف فئة جديدة في شجرة الأصناف للمخزن الرئيسي</p>
              </div>
              <button onClick={closeModal} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              <form id="new-item-group-form" onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                  <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات الأساسية</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Group Code (Auto) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">كود المجموعة</label>
                      <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-3 py-2.5" dir="ltr">
                        <span className="text-sm font-bold text-primary tracking-widest">{autoCode}</span>
                      </div>
                    </div>

                    {/* Parent Group */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">المجموعة الرئيسية (اختياري)</label>
                      <select
                        value={form.parent_group_id}
                        onChange={e => set('parent_group_id', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                      >
                        <option value="">بدون مستوى رئيسي (مستوى أول)</option>
                        {parentGroups.map(p => (
                          <option key={p.id} value={p.id}>{p.arabic_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">اسم المجموعة (عربي) <span className="text-danger">*</span></label>
                      <input required value={form.arabic_name} onChange={e => set('arabic_name', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        placeholder="مثال: أدوات كهربائية" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">اسم المجموعة (إنجليزي) <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
                      <input value={form.english_name} onChange={e => set('english_name', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        placeholder="Electrical Tools" dir="ltr" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">ملاحظات</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" />
                  </div>
                  
                  {/* Status Toggle */}
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={form.is_active}
                      onChange={e => set('is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-text-primary cursor-pointer">
                      مجموعة نشطة
                    </label>
                  </div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-white p-4 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={closeModal}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
                إلغاء
              </button>
              <button form="new-item-group-form" type="submit" disabled={loading}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {loading ? 'جارٍ الحفظ...' : 'حفظ وإضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
