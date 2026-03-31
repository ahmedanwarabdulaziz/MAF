'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const ROLE_OPTIONS = [
  { value: 'owner',         label: 'مالك' },
  { value: 'subcontractor', label: 'مقاول من الباطن' },
  { value: 'supplier',      label: 'مورد' }
]

export default function NewPartyPage() {
  const router = useRouter()
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

    router.push(`/company/parties/${party.id}`)
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">طرف جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">أضف مالكاً أو مقاولاً أو مورداً</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {/* Role selection */}
        <div className="rounded-xl border border-border bg-white p-5">
          <label className="mb-3 block text-sm font-semibold text-text-primary">
            الأدوار التجارية <span className="text-danger">*</span>
          </label>
          <p className="mb-3 text-xs text-text-secondary">يمكن للطرف الواحد أن يلعب أدواراً متعددة — لكل دور حساب مستقل</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleRole(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedRoles.includes(opt.value)
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-background-secondary text-text-secondary hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Basic info */}
        <div className="rounded-xl border border-border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-text-primary">البيانات الأساسية</h2>

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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {loading ? 'جارٍ الحفظ...' : 'إضافة الطرف'}
          </button>
          <a href="/company/parties"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
            إلغاء
          </a>
        </div>
      </form>
    </div>
  )
}
