'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectWorkItem, updateProjectWorkItem, getNextWorkItemCode } from '@/actions/agreements'
import { createUnit } from '@/actions/warehouse'
import { createClient } from '@/lib/supabase'

export default function WorkItemForm({ 
  projectId, 
  initialData,
  onSuccess,
  onCancel
}: { 
  projectId: string, 
  initialData?: any,
  onSuccess?: () => void,
  onCancel?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [fetching, setFetching] = useState(true)
  const [units, setUnits] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<string>('')

  // New Unit State
  const [isAddingUnit, setIsAddingUnit] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [unitLoading, setUnitLoading] = useState(false)

  // Searchable Unit State
  const [unitSearchOpen, setUnitSearchOpen] = useState(false)
  const [unitSearch, setUnitSearch] = useState('')
  const filteredUnits = units.filter(u => u.arabic_name.toLowerCase().includes(unitSearch.toLowerCase()))

  const [formData, setFormData] = useState({
    item_code: initialData?.item_code || '',
    arabic_description: initialData?.arabic_description || '',
    english_description: initialData?.english_description || '',
    default_unit_id: initialData?.default_unit_id || '',
    owner_price: initialData?.owner_price || 0,
    subcontractor_price: initialData?.subcontractor_price || 0,
    notes: initialData?.notes || ''
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: proj } = await supabase.from('projects').select('company_id').eq('id', projectId).single()
      if (proj) setCompanyId(proj.company_id)
      
      const { data: u } = await supabase.from('units').select('id, arabic_name')
      if (u) setUnits(u)
        
      if (!initialData) {
        const nextCode = await getNextWorkItemCode(projectId)
        setFormData(prev => ({ ...prev, item_code: nextCode }))
      }
      
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
        const cleanUpdates = {
          ...formData,
          default_unit_id: formData.default_unit_id || null,
          english_description: formData.english_description || null,
          notes: formData.notes || null,
        }
        await updateProjectWorkItem(initialData.id, projectId, cleanUpdates)
      } else {
        await createProjectWorkItem({ ...formData, project_id: projectId, company_id: companyId })
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/projects/${projectId}/work-items`)
      }
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

  async function handleAddUnit() {
    if (!newUnitName.trim()) return
    setUnitLoading(true)
    try {
      const newUnit = await createUnit({ company_id: companyId, arabic_name: newUnitName.trim() })
      setUnits([...units, newUnit])
      setFormData(prev => ({ ...prev, default_unit_id: newUnit.id }))
      setIsAddingUnit(false)
      setNewUnitName('')
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة الوحدة')
    } finally {
      setUnitLoading(false)
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
            readOnly
            value={formData.item_code}
            className="rounded-lg border border-border bg-background-secondary/50 px-3 py-2 text-sm outline-none cursor-not-allowed text-text-secondary"
            dir="ltr"
          />
          <span className="text-xs text-text-secondary">تم إنشاء الكود تلقائياً ولا يمكن تعديله</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">الوحدة الافتراضية</label>
          <div className="flex items-center gap-2 relative">
            <div className="relative flex-1">
              <div 
                onClick={() => setUnitSearchOpen(!unitSearchOpen)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm cursor-pointer"
              >
                <span className={!formData.default_unit_id ? "text-text-secondary" : "text-text-primary"}>
                  {formData.default_unit_id === "" 
                    ? "لا توجد وحدة افتراضية (مقطوعية)" 
                    : units.find(u => u.id === formData.default_unit_id)?.arabic_name || "اختر الوحدة"}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {unitSearchOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUnitSearchOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 w-full bg-white border border-border rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      className="w-full rounded border border-border px-3 py-1.5 text-sm mb-2 outline-none focus:border-primary bg-background-secondary"
                      placeholder="بحث..."
                      value={unitSearch}
                      onChange={e => setUnitSearch(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                    <div 
                      className={`px-3 py-2 text-sm cursor-pointer rounded transition-colors hover:bg-background-secondary ${formData.default_unit_id === "" ? 'font-bold text-primary bg-primary/5' : ''}`}
                      onClick={() => {
                        setFormData({ ...formData, default_unit_id: "" })
                        setUnitSearchOpen(false)
                        setUnitSearch("")
                      }}
                    >
                      لا توجد وحدة افتراضية (مقطوعية)
                    </div>
                    {filteredUnits.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-text-secondary text-center">لا توجد نتائج</div>
                    ) : (
                      filteredUnits.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setFormData({ ...formData, default_unit_id: u.id })
                            setUnitSearchOpen(false)
                            setUnitSearch("")
                          }}
                          className={`px-3 py-2 text-sm cursor-pointer rounded transition-colors hover:bg-background-secondary ${formData.default_unit_id === u.id ? 'font-bold text-primary bg-primary/5' : ''}`}
                        >
                          {u.arabic_name}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsAddingUnit(true)}
              className="shrink-0 flex items-center justify-center rounded-lg border border-border bg-white px-3 py-2 text-text-primary hover:bg-background-secondary transition-colors shadow-sm"
              title="إضافة وحدة جديدة"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4 md:col-span-2">
          <h3 className="text-sm font-bold text-text-primary mb-2">تسعير البند (الوحدة الواحدة)</h3>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-medium text-text-primary">سعر المالك الافتراضي (Revenue)</label>
          <input
            type="number"
            step="0.0001"
            value={formData.owner_price}
            onChange={e => setFormData({ ...formData, owner_price: Number(e.target.value) })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-medium text-text-primary">سعر مقاول الباطن التقديري (Cost)</label>
          <input
            type="number"
            step="0.0001"
            value={formData.subcontractor_price}
            onChange={e => setFormData({ ...formData, subcontractor_price: Number(e.target.value) })}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
            dir="ltr"
          />
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

      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel()
            else router.push(`/projects/${projectId}/work-items`)
          }}
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

      {isAddingUnit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={() => setIsAddingUnit(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl p-6 text-right z-10 border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-4">إضافة وحدة قياس جديدة</h3>
            <div className="space-y-4 text-right">
              <div>
                <label className="text-sm font-medium text-text-primary mb-1 block">اسم الوحدة (بالعربية)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:bg-white"
                  placeholder="مثال: لتر، متر مكعب..."
                  value={newUnitName}
                  onChange={e => setNewUnitName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddingUnit(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={unitLoading || !newUnitName.trim()}
                  onClick={handleAddUnit}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {unitLoading ? 'جاري الإضافة...' : 'إضافة الوحدة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
