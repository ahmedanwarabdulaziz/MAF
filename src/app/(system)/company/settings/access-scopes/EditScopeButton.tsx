'use client'

import { useState, useTransition } from 'react'
import { updateAccessScopeAction } from './actions'

const SCOPE_TYPES = [
  { value: 'main_company', label: 'الشركة الرئيسية' },
  { value: 'all_projects', label: 'جميع المشاريع' },
  { value: 'selected_project', label: 'مشروع محدد' },
]

interface Project {
  id: string
  arabic_name: string
  project_code: string
}

interface Props {
  scopeId: string
  currentScopeType: string
  currentProjectId: string | null
  projects: Project[]
}

export default function EditScopeButton({ scopeId, currentScopeType, currentProjectId, projects }: Props) {
  const [open, setOpen] = useState(false)
  const [scopeType, setScopeType] = useState(currentScopeType)
  const [projectId, setProjectId] = useState(currentProjectId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleOpen = () => {
    setScopeType(currentScopeType)
    setProjectId(currentProjectId ?? '')
    setError(null)
    setOpen(true)
  }

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateAccessScopeAction(
        scopeId,
        scopeType,
        scopeType === 'selected_project' ? projectId || null : null
      )
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <>
      {/* Edit trigger button */}
      <button
        onClick={handleOpen}
        title="تعديل النطاق"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Modal backdrop + dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">تعديل النطاق</h2>
              <button
                onClick={() => !isPending && setOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Scope type */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">نوع النطاق</label>
                <div className="grid grid-cols-1 gap-2">
                  {SCOPE_TYPES.map(st => (
                    <label
                      key={st.value}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        scopeType === st.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope_type_edit"
                        value={st.value}
                        checked={scopeType === st.value}
                        onChange={() => setScopeType(st.value)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">{st.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Project picker — only for selected_project */}
              {scopeType === 'selected_project' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">المشروع</label>
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— اختر مشروع —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.arabic_name} ({p.project_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => !isPending && setOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:border-text-secondary/40 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || (scopeType === 'selected_project' && !projectId)}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'جاري الحفظ…' : 'حفظ التعديل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
