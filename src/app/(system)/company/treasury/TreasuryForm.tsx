'use client'

import { useState } from 'react'
import { createFinancialAccount } from '@/actions/treasury'

const ACCOUNT_TYPES = [
  { value: 'cashbox',    label: 'خزينة نقدية / عهدة' },
  { value: 'bank',       label: 'حساب بنكي' },
  { value: 'deposit',    label: 'وديعة بنكية' },
  { value: 'investment', label: 'شهادة استثمار' },
]

interface TreasuryFormProps {
  projects: any[]
  users: any[]
  treasuryGroupIds: string[]
  onSuccess?: () => void
  onCancel?: () => void
  fixedProjectId?: string
}

export default function TreasuryForm({ projects, users, treasuryGroupIds, onSuccess, onCancel, fixedProjectId }: TreasuryFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const initialForm = {
    arabic_name: '',
    english_name: '',
    account_type: 'cashbox',
    currency: 'EGP',
    opening_balance: '',
    bank_name: '',
    account_number: '',
    notes: '',
    project_id: fixedProjectId || '',
    assigned_user_id: '',
  }
  const [form, setForm] = useState(initialForm)

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      let finalNotes = form.notes.trim()
      if (form.assigned_user_id) {
        const selectedUser = users.find(u => u.id === form.assigned_user_id)
        if (selectedUser) {
          const assignmentNote = `المسؤول / أمين الخزينة: ${selectedUser.display_name}`
          finalNotes = finalNotes ? `${assignmentNote} | ${finalNotes}` : assignmentNote
        }
      }

      await createFinancialAccount({
        arabic_name: form.arabic_name.trim(),
        english_name: form.english_name.trim() || null,
        account_type: form.account_type,
        currency: form.currency,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : undefined,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        notes: finalNotes || null,
        project_id: form.project_id === 'main_company' ? null : form.project_id,
      })
      
      setLoading(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ')
      setLoading(false)
    }
  }

  const isBankType = form.account_type === 'bank' || form.account_type === 'deposit' || form.account_type === 'investment'

  const availableUsers = users.filter((u: any) => {
    if (!form.project_id) return false
    if (u.is_super_admin) return true
    
    const scopes = u.user_access_scopes || []
    return scopes.some((s: any) => {
      let matchesProject = false
      if (form.project_id === 'main_company') {
        matchesProject = s.scope_type === 'main_company' || s.scope_type === 'all_projects'
      } else {
        matchesProject = s.scope_type === 'all_projects' || (s.scope_type === 'selected_project' && s.project_id === form.project_id)
      }
      
      const hasPermission = treasuryGroupIds.includes(s.permission_group_id)
      return matchesProject && hasPermission
    })
  })

  return (
    <div className="bg-white p-6 rounded-b-2xl">
      <form id="treasury-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">نوع الحساب <span className="text-danger">*</span></label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('account_type', t.value)}
                  className={`rounded-lg border-2 px-3 py-3 text-sm text-center font-medium transition-colors ${
                    form.account_type === t.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-background-secondary/50 text-text-secondary hover:border-primary/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {!fixedProjectId && (
              <div className="flex flex-col gap-1.5 focus-within:z-10">
                <label className="text-sm font-semibold text-text-primary">ربط بمشروع <span className="text-danger">*</span></label>
                <select
                  required
                  value={form.project_id}
                  onChange={e => {
                    set('project_id', e.target.value)
                    set('assigned_user_id', '')
                  }}
                  className="rounded-lg border border-border bg-background-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="" disabled>-- حدد تبعية الخزينة --</option>
                  <option value="main_company">حساب مركزي للشركة (غير مرتبط بمشروع)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.arabic_name} ({p.project_code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className={`flex flex-col gap-1.5 focus-within:z-10 ${fixedProjectId ? 'md:col-span-2' : ''}`}>
              <label className="text-sm font-semibold text-text-primary">المسؤول / أمين الخزينة <span className="text-danger">*</span></label>
              <select
                required
                disabled={!form.project_id}
                value={form.assigned_user_id}
                onChange={e => set('assigned_user_id', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
              >
                <option value="" disabled>
                  {!form.project_id ? 'اختر المشروع أولاً...' : '-- حدد المستخدم المسؤول --'}
                </option>
                {availableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              {form.project_id && availableUsers.length === 0 && (
                <p className="text-xs text-danger mt-1">لا يوجد مستخدمين لديهم صلاحية لهذا المسار.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-sm font-semibold text-text-primary">اسم الحساب بالعربية <span className="text-danger">*</span></label>
            <input
              required
              value={form.arabic_name}
              onChange={e => set('arabic_name', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary/30 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
              placeholder="مثال: خزينة عهدة المهندس أحمد - مشروع كذا"
            />
          </div>

          {isBankType && (
            <div className="grid grid-cols-2 gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">اسم البنك</label>
                <input
                  value={form.bank_name}
                  onChange={e => set('bank_name', e.target.value)}
                  className="rounded-lg border border-border bg-background-secondary/30 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                  placeholder="البنك الأهلي المصري"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-primary">رقم الحساب</label>
                <input
                  value={form.account_number}
                  onChange={e => set('account_number', e.target.value)}
                  className="rounded-lg border border-border bg-background-secondary/30 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                  dir="ltr"
                  placeholder="1234567890"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-primary">العملة</label>
              <div className="flex items-center rounded-lg border border-border bg-background-primary px-4 py-2.5 text-sm font-medium text-text-primary" dir="ltr">
                EGP — جنيه مصري
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-primary">الرصيد الافتتاحي</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.opening_balance}
                onChange={e => set('opening_balance', e.target.value)}
                className="rounded-lg border border-border bg-background-secondary/30 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                placeholder="0.00"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-sm font-semibold text-text-primary">ملاحظات <span className="text-text-secondary font-normal text-xs">(اختياري)</span></label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="rounded-lg border border-border bg-background-secondary/30 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t border-navy/10 bg-gray-50/80 px-6 py-4 backdrop-blur rounded-b-2xl">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
            >
              إلغاء والتخطي
            </button>
          )}
          <button 
            type="submit" 
            disabled={loading || !form.arabic_name.trim()}
            className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm ml-auto"
          >
            {loading ? 'جارٍ الحفظ...' : 'استكمال وإنشاء الحساب'}
          </button>
        </div>
      </form>
    </div>
  )
}
