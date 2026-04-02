'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DatePicker from '@/components/DatePicker'
import { createProject, getProjectWizardData } from '@/actions/projects'
import TreasuryForm from '@/app/(system)/company/treasury/TreasuryForm'
import WarehouseForm from '@/app/(system)/company/main_warehouse/warehouses/WarehouseForm'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type Step = '1_project' | '2_prompt_treasury' | '2_treasury_form' | '3_prompt_warehouse' | '3_warehouse_form'

export default function NewProjectWizardModal({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('1_project')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Wizard Data generated for the steps after project
  const [wizardData, setWizardData] = useState<any>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [createdProjectName, setCreatedProjectName] = useState<string>('')
  
  // Step 1: Project Form State
  const [autoCode, setAutoCode] = useState('جاري التوليد...')
  const initialForm = {
    arabic_name: '',
    english_name: '',
    project_onboarding_type: 'new',
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
    setStep('1_project')
    setCreatedProjectId(null)
    setForm(initialForm)
    setError(null)
    setLoading(true)

    async function loadData() {
      try {
        const supabase = createClient()
        const { count } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
        
        const next = (count ?? 0) + 1
        setAutoCode(`PRJ-${String(next).padStart(3, '0')}`)
        
        const { data: owners } = await supabase
          .from('parties')
          .select(`
            id, 
            arabic_name,
            party_roles!inner(role_type)
          `)
          .eq('party_roles.role_type', 'owner')
          
        if (owners) setOwners(owners)

        // Preload Wizard Data for Treasuries and Warehouses
        const wData = await getProjectWizardData()
        setWizardData(wData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [isOpen])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // Submit Step 1
  async function handleCreateProject(e: React.FormEvent) {
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
        owner_party_id: form.owner_party_id || null,
        location: form.location.trim() || null,
        start_date: form.start_date || null,
        planned_allocation_amount: form.planned_allocation_amount ? Number(form.planned_allocation_amount) : null,
      })
      
      setCreatedProjectId(data.id)
      setCreatedProjectName(form.arabic_name.trim())
      
      // Add the new project to wizardData so it becomes available in subsequent selects like WarehouseForm
      setWizardData((prev: any) => {
        if (!prev) return prev
        const newProject = { id: data.id, arabic_name: form.arabic_name.trim(), project_code: autoCode }
        // Ensure not duplicate
        if (!prev.projects.find((p: any) => p.id === data.id)) {
          return { ...prev, projects: [newProject, ...prev.projects] }
        }
        return prev
      })

      setStep('2_prompt_treasury')
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ المشروع')
      setLoading(false)
    }
  }

  // Advance Wizard
  function proceedToTreasuryForm() {
    setStep('2_treasury_form')
  }

  function skipToWarehousePrompt() {
    setStep('3_prompt_warehouse')
  }

  function proceedToWarehouseForm() {
    setStep('3_warehouse_form')
  }

  function finishWizard() {
    router.refresh()
    onClose()
  }

  if (!isOpen) return null

  // Progress logic
  let progressNum = 1
  if (step.startsWith('2_')) progressNum = 2
  if (step.startsWith('3_')) progressNum = 3

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={step === '1_project' ? onClose : undefined} />
      
      <div className="relative z-10 w-full max-w-2xl flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
        {/* Header with Progress */}
        <div className="bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {step === '1_project' && 'نافذة المشروع الجديد'}
                {step.startsWith('2_') && 'إعدادات الخزينة الإلزامية للمشروع'}
                {step.startsWith('3_') && 'إعدادات مستودع المشروع'}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {step === '1_project' && 'أدخل بيانات المشروع الأساسية'}
                {step.startsWith('2_') && `إعداد الخزينة لمشروع: ${createdProjectName}`}
                {step.startsWith('3_') && `إعداد المستودع لمشروع: ${createdProjectName}`}
              </p>
            </div>
            {step === '1_project' && (
              <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-white/70">
            <span>الخطوة {progressNum} من 3</span>
            <span>{Math.round((progressNum / 3) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(progressNum / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto bg-background-secondary/30 relative" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {error && step === '1_project' && (
            <div className="m-6 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* STEP 1: PROJECT FORM */}
          {step === '1_project' && (
            <form id="new-project-form" onSubmit={handleCreateProject} className="p-6 space-y-6">
              {/* Basic info */}
              <div className="rounded-xl border border-border bg-white p-5 space-y-4 shadow-sm">
                <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات الأساسية</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">رمز المشروع</label>
                    <div className="flex items-center rounded-lg border border-border bg-background-secondary/60 px-3 py-2.5" dir="ltr">
                      <span className="text-sm font-bold text-primary tracking-widest">{autoCode}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">حالة المشروع</label>
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
                    className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="مشروع العاصمة الإدارية" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
                  <input value={form.english_name} onChange={e => set('english_name', e.target.value)}
                    className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="New Administrative Capital" dir="ltr" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">الجهة المالكة</label>
                  <select
                    value={form.owner_party_id}
                    onChange={e => set('owner_party_id', e.target.value)}
                    className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
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
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                      placeholder="القاهرة الجديدة" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">تاريخ البداية</label>
                    <DatePicker value={form.start_date} onChange={val => set('start_date', val)} />
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div className="rounded-xl border border-border bg-white p-5 space-y-4 shadow-sm">
                <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات المالية</h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-primary">التخصيص المخطط (ج.م)</label>
                  <input type="number" value={form.planned_allocation_amount} onChange={e => set('planned_allocation_amount', e.target.value)}
                    className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="0.00" dir="ltr" />
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: PROMPT TREASURY */}
          {step === '2_prompt_treasury' && (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="h-16 w-16 mb-6 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">🎉</div>
              <h3 className="text-2xl font-bold text-navy mb-2">تم إنشاء المشروع بنجاح!</h3>
              <p className="text-text-secondary w-full max-w-sm mb-10">
                مبروك! تم حفظ المشروع. هل ترغب الآن في فتح <strong>خزينة نقدية (عهدة)</strong> مخصصة لحركات هذا المشروع؟
              </p>
              
              <div className="flex items-center gap-4 w-full max-w-md">
                <button onClick={skipToWarehousePrompt} className="flex-1 py-3 px-4 rounded-xl font-medium border border-border bg-white text-text-secondary hover:bg-background-secondary hover:border-text-tertiary transition shadow-sm">
                  تخطي لاحقاً
                </button>
                <button onClick={proceedToTreasuryForm} className="flex-1 py-3 px-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition shadow-sm">
                  نعم، فتح خزينة
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: TREASURY FORM */}
          {step === '2_treasury_form' && (
            <div className="animate-in fade-in slide-in-from-left duration-300">
              {wizardData ? (
                <TreasuryForm 
                  projects={wizardData.projects}
                  users={wizardData.users}
                  treasuryGroupIds={wizardData.treasuryGroupIds}
                  fixedProjectId={createdProjectId!}
                  onSuccess={() => setStep('3_prompt_warehouse')}
                  onCancel={() => setStep('3_prompt_warehouse')}
                />
              ) : (
                <div className="flex items-center justify-center p-20 text-text-secondary">جاري التحميل...</div>
              )}
            </div>
          )}

          {/* STEP 3: PROMPT WAREHOUSE */}
          {step === '3_prompt_warehouse' && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="h-16 w-16 mb-6 rounded-full bg-blue-100 flex items-center justify-center text-3xl">📦</div>
              <h3 className="text-2xl font-bold text-navy mb-2">مستودع المشروع</h3>
              <p className="text-text-secondary w-full max-w-sm mb-10">
                هل ترغب في تحديد وإضافة مكان تخزين مركزي (مستودع مواد) ليتم توريد المشتريات وصرف العهد المتعلقة بهذا المشروع إليه؟
              </p>
              
              <div className="flex items-center gap-4 w-full max-w-md">
                <button onClick={finishWizard} className="flex-1 py-3 px-4 rounded-xl font-medium border border-border bg-white text-text-secondary hover:bg-background-secondary hover:border-text-tertiary transition shadow-sm">
                  تخطي وإنهاء
                </button>
                <button onClick={proceedToWarehouseForm} className="flex-1 py-3 px-4 rounded-xl font-bold bg-navy text-white hover:bg-navy/90 transition shadow-sm">
                  نعم، إضافة مستودع
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WAREHOUSE FORM */}
          {step === '3_warehouse_form' && (
            <div className="animate-in fade-in slide-in-from-left duration-300">
              {wizardData ? (
                <WarehouseForm 
                  companyId={wizardData.companyId}
                  projects={wizardData.projects}
                  initialData={{ warehouse_type: 'project', project_id: createdProjectId }}
                  onSuccess={finishWizard}
                  onCancel={finishWizard}
                  cancelText="تخطي وإنهاء"
                />
              ) : (
                <div className="flex items-center justify-center p-20 text-text-secondary">جاري التحميل...</div>
              )}
            </div>
          )}

        </div>

        {/* Footer for Project Step Only (The forms have their own footers) */}
        {step === '1_project' && (
          <div className="border-t border-border bg-white p-4 shrink-0 flex justify-end gap-3 z-10">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
              إلغاء
            </button>
            <button form="new-project-form" type="submit" disabled={loading}
              className="rounded-lg bg-primary px-8 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60 shadow-sm transition-colors">
              {loading ? 'جارٍ الحفظ...' : 'حفظ ومتابعة >>'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
