'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSubcontractAgreement, getNextAgreementCode } from '@/actions/agreements'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

export default function NewAgreementDialog({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
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
    if (!isOpen) return

    async function load() {
      const supabase = createClient()
      const { data: proj } = await supabase.from('projects').select('company_id').eq('id', projectId).single()
      if (proj) setCompanyId(proj.company_id)
      
      const { data: pts } = await supabase
        .from('parties')
        .select(`
          id, 
          arabic_name,
          party_roles!inner(role_type)
        `)
        .eq('party_roles.role_type', 'subcontractor')

      if (pts) setParties(pts)
      
      const nextCode = await getNextAgreementCode(projectId)
      setFormData(f => ({ ...f, agreement_code: nextCode }))
        
      setFetching(false)
    }
    load()
  }, [projectId, isOpen])

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const result = await createSubcontractAgreement({ 
        ...formData, 
        project_id: projectId, 
        company_id: companyId 
      })
      // Redirect to the newly created agreement details page to add lines
      closeModal()
      router.push(`/projects/${projectId}/agreements/${result.id}`)
    } catch (err: any) {
      if (err.message?.includes('subcontract_agreements_project_id_agreement_code_key')) {
        setError('رقم العقد مستخدم بالفعل في هذا المشروع.')
      } else {
        setError(err.message || 'حدث خطأ أثناء حفظ العقد')
      }
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        <PlusIcon />
        إضافة عقد جديد
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">إضافة عقد مقاول باطن</h2>
                <p className="mt-1 text-sm text-white/80">
                  إدخال البيانات الأساسية لعقد المقاول. يمكنك إضافة بنود الأعمال وفئات الأسعار بعد الحفظ.
                </p>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              <div className="bg-white rounded-xl border border-border p-6 shadow-sm mx-auto">
                {fetching ? (
                  <div className="text-sm text-text-secondary text-center py-10">جاري التحميل...</div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
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
                          readOnly
                          value={formData.agreement_code}
                          className="rounded-lg border border-border bg-background-secondary/60 px-3 py-2 text-sm font-bold text-primary tracking-widest outline-none cursor-default"
                          dir="ltr"
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

                    <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-border">
                      <button
                        type="button"
                        onClick={closeModal}
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
