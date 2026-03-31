'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { logClientAction } from '@/actions/audit'

const ROLE_OPTIONS = [
  { value: 'owner',         label: 'مالك' },
  { value: 'subcontractor', label: 'مقاول' },
  { value: 'supplier',      label: 'مورد' }
]

export default function NewPartyDialog() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [form, setForm] = useState({
    arabic_name: '',
    english_name: '',
    tax_number: '',
    commercial_reg: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: '',
  })

  const resetForm = () => {
    setForm({
      arabic_name: '',
      english_name: '',
      tax_number: '',
      commercial_reg: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      notes: '',
    })
    setSelectedRoles([])
    setError(null)
  }

  const openModal = () => setIsOpen(true)
  const closeModal = () => {
    setIsOpen(false)
    resetForm()
  }

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleRole(role: string) {
    setSelectedRoles(r => r.includes(role) ? r.filter(x => x !== role) : [...r, role])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedRoles.length === 0) { setError('يرجى تحديد دور واحد على الأقل'); return }
    setLoading(true); setError(null)

    const supabase = createClient()

    const { data: company } = await supabase.from('companies').select('id').eq('is_active', true).single()
    if (!company) { setError('لا توجد شركة مُعرَّفة'); setLoading(false); return }

    // Insert party
    const { data: party, error: partyErr } = await supabase.from('parties').insert({
      company_id: company.id,
      arabic_name: form.arabic_name.trim(),
      english_name: form.english_name.trim() || null,
      tax_number: form.tax_number.trim() || null,
      commercial_reg: form.commercial_reg.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    }).select('id').single()

    if (partyErr) { setError(partyErr.message); setLoading(false); return }

    // Insert roles
    const roleInserts = selectedRoles.map(role_type => ({ party_id: party.id, role_type }))
    await supabase.from('party_roles').insert(roleInserts)

    // Insert default role accounts (one per role, company-level)
    const accountInserts = selectedRoles.map(role_type => ({
      party_id: party.id, role_type, project_id: null, status: 'active',
    }))
    await supabase.from('party_role_accounts').insert(accountInserts)

    await logClientAction({
      action: 'CREATE',
      entity_type: 'parties',
      entity_id: party.id,
      description: `تم إضافة جهة تعامل جديدة: ${form.arabic_name.trim()}`
    })

    setLoading(false)
    closeModal()
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        + إضافة جهة
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">طرف تعامل جديد</h2>
                <p className="mt-1 text-sm text-white/80">أضف مالكاً أو مقاولاً أو مورداً</p>
              </div>
              <button 
                onClick={closeModal} 
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              <form id="new-party-form" onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
                )}

                {/* Role selection */}
                <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-text-primary">الأدوار التجارية <span className="text-danger">*</span></h3>
                    <p className="mt-1 text-xs text-text-secondary">يمكن للطرف الواحد أن يلعب أدواراً متعددة — لكل دور حساب مستقل</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleRole(opt.value)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                          selectedRoles.includes(opt.value)
                            ? 'border-primary bg-primary text-white shadow-sm'
                            : 'border-border bg-background-secondary text-text-secondary hover:border-primary/50 hover:bg-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic info */}
                <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                  <h3 className="font-semibold text-text-primary border-b border-border pb-2">البيانات الأساسية</h3>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">الاسم بالعربية <span className="text-danger">*</span></label>
                    <input required value={form.arabic_name} onChange={e => set('arabic_name', e.target.value)}
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                      placeholder="شركة النيل للمقاولات" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية</label>
                    <input value={form.english_name} onChange={e => set('english_name', e.target.value)}
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                      placeholder="Nile Contracting Co." dir="ltr" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">الرقم الضريبي</label>
                      <input value={form.tax_number} onChange={e => set('tax_number', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        placeholder="123-456-789" dir="ltr" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">السجل التجاري</label>
                      <input value={form.commercial_reg} onChange={e => set('commercial_reg', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        dir="ltr" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">الهاتف</label>
                      <input value={form.phone} onChange={e => set('phone', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        dir="ltr" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">البريد الإلكتروني</label>
                      <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                        dir="ltr" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">العنوان</label>
                      <input value={form.address} onChange={e => set('address', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text-primary">المدينة</label>
                      <input value={form.city} onChange={e => set('city', e.target.value)}
                        className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-text-primary">ملاحظات</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" />
                  </div>
                </div>
              </form>
            </div>
            
            {/* Footer */}
            <div className="border-t border-border bg-white p-4 shrink-0 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={closeModal}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                form="new-party-form"
                disabled={loading}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
