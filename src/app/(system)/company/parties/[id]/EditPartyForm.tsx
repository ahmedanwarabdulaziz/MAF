'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { logClientAction } from '@/actions/audit'

const ROLE_OPTIONS = [
  { value: 'owner',         label: 'مالك' },
  { value: 'subcontractor', label: 'مقاول' },
  { value: 'supplier',      label: 'مورد' }
]

interface Party {
  id: string
  arabic_name: string
  english_name: string | null
  tax_number: string | null
  commercial_reg: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  notes: string | null
  is_active: boolean
  party_roles: { id: string; role_type: string; is_active: boolean }[]
}

export default function EditPartyForm({ party, backHref = '/company/parties' }: { party: Party; backHref?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRoleTypes = party.party_roles
    .filter(r => r.is_active)
    .map(r => r.role_type)

  const [selectedRoles, setSelectedRoles] = useState<string[]>(activeRoleTypes)
  const [isActive, setIsActive] = useState(party.is_active)

  const [form, setForm] = useState({
    arabic_name:    party.arabic_name,
    english_name:   party.english_name ?? '',
    tax_number:     party.tax_number ?? '',
    commercial_reg: party.commercial_reg ?? '',
    phone:          party.phone ?? '',
    email:          party.email ?? '',
    address:        party.address ?? '',
    city:           party.city ?? '',
    notes:          party.notes ?? '',
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

    // Update party fields
    const { error: updateErr } = await supabase
      .from('parties')
      .update({
        arabic_name:    form.arabic_name.trim(),
        english_name:   form.english_name.trim() || null,
        tax_number:     form.tax_number.trim() || null,
        commercial_reg: form.commercial_reg.trim() || null,
        phone:          form.phone.trim() || null,
        email:          form.email.trim() || null,
        address:        form.address.trim() || null,
        city:           form.city.trim() || null,
        notes:          form.notes.trim() || null,
        is_active:      isActive,
      })
      .eq('id', party.id)

    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    // Sync roles: deactivate removed, activate/insert new
    const existingByType = Object.fromEntries(
      party.party_roles.map(r => [r.role_type, r.id])
    )

    // Deactivate roles that were removed
    const removedRoles = activeRoleTypes.filter(r => !selectedRoles.includes(r))
    for (const role of removedRoles) {
      await supabase.from('party_roles').update({ is_active: false }).eq('id', existingByType[role])
    }

    // Add new roles
    const newRoles = selectedRoles.filter(r => !existingByType[r])
    if (newRoles.length > 0) {
      await supabase.from('party_roles').insert(
        newRoles.map(role_type => ({ party_id: party.id, role_type, is_active: true }))
      )
      await supabase.from('party_role_accounts').insert(
        newRoles.map(role_type => ({ party_id: party.id, role_type, project_id: null, status: 'active' }))
      )
    }

    // Re-activate roles that existed before but were deactivated
    const reactivateRoles = selectedRoles.filter(r => existingByType[r] && removedRoles.length === 0 ? false : existingByType[r] && !activeRoleTypes.includes(r))
    for (const role of reactivateRoles) {
      await supabase.from('party_roles').update({ is_active: true }).eq('id', existingByType[role])
    }

    await logClientAction({
      action: 'UPDATE',
      entity_type: 'parties',
      entity_id: party.id,
      description: `تم تعديل بيانات جهة التعامل: ${form.arabic_name.trim()} (${isActive ? 'نشط' : 'موقوف'})`
    })

    setLoading(false)
    router.push(backHref)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}


      {/* Roles */}
      <div className="rounded-xl border border-border bg-white p-5">
        <label className="mb-1 block text-sm font-semibold text-text-primary">
          الأدوار التجارية <span className="text-danger">*</span>
        </label>
        <p className="mb-3 text-xs text-text-secondary">يمكن للطرف الواحد أن يلعب أدواراً متعددة</p>
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
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">الاسم بالإنجليزية</label>
          <input value={form.english_name} onChange={e => set('english_name', e.target.value)}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
            dir="ltr" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الرقم الضريبي</label>
            <input value={form.tax_number} onChange={e => set('tax_number', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
              dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">السجل التجاري</label>
            <input value={form.commercial_reg} onChange={e => set('commercial_reg', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
              dir="ltr" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">الهاتف</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
              dir="ltr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">البريد الإلكتروني</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
              dir="ltr" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">العنوان</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">المدينة</label>
            <input value={form.city} onChange={e => set('city', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-colors" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">ملاحظات</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="rounded-lg border border-border bg-background-secondary px-3 py-2.5 text-sm outline-none focus:border-primary resize-none transition-colors" />
        </div>
      </div>

      {/* Status toggle */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="mb-3 font-semibold text-text-primary">الحالة</h2>
        <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
          <div
            onClick={() => setIsActive(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-success' : 'bg-border'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-text-primary">{isActive ? 'نشط' : 'موقوف'}</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </button>
        <Link href={backHref}
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors">
          إلغاء
        </Link>
      </div>
    </form>
  )
}
