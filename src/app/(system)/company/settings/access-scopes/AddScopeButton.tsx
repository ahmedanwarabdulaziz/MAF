'use client'

import { useState, useTransition } from 'react'
import { grantBulkScopesAction } from './actions'

const SCOPE_TYPES = [
  { value: 'main_company', label: 'الشركة الرئيسية', desc: 'Company dashboard & central data' },
  { value: 'all_projects', label: 'جميع المشاريع', desc: 'All current and future projects' },
  { value: 'selected_project', label: 'مشروع محدد', desc: 'A specific project only' },
]

interface Project {
  id: string
  arabic_name: string
  project_code: string
}

interface Props {
  userId: string
  userName: string
  projects: Project[]
}

export default function AddScopeButton({ userId, userName, projects }: Props) {
  const [open, setOpen] = useState(false)
  const [giveCompany, setGiveCompany] = useState(false)
  const [giveAllProjects, setGiveAllProjects] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleProject = (id: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation() // don't toggle the user row
    setGiveCompany(false)
    setGiveAllProjects(false)
    setSelectedProjects(new Set())
    setError(null)
    setOpen(true)
  }

  const handleSubmit = () => {
    if (!giveCompany && !giveAllProjects && selectedProjects.size === 0) {
      setError('Select at least one scope')
      return
    }
    setError(null)

    const scopes: { scope_type: string; project_id?: string }[] = []
    if (giveCompany) scopes.push({ scope_type: 'main_company' })
    if (giveAllProjects) scopes.push({ scope_type: 'all_projects' })
    selectedProjects.forEach(pid => scopes.push({ scope_type: 'selected_project', project_id: pid }))

    startTransition(async () => {
      const result = await grantBulkScopesAction(userId, scopes)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add scope
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && setOpen(false)} />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Add scope</h2>
                <p className="text-xs text-text-secondary mt-0.5">{userName}</p>
              </div>
              <button onClick={() => !isPending && setOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-3">
              {/* Main company */}
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${giveCompany ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <input type="checkbox" checked={giveCompany} onChange={e => setGiveCompany(e.target.checked)} className="accent-primary h-4 w-4" />
                <div>
                  <div className="text-sm font-semibold text-text-primary">الشركة الرئيسية</div>
                  <div className="text-xs text-text-secondary">Company dashboard & central data</div>
                </div>
              </label>

              {/* All projects */}
              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${giveAllProjects ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                <input type="checkbox" checked={giveAllProjects} onChange={e => {
                  setGiveAllProjects(e.target.checked)
                  if (e.target.checked) setSelectedProjects(new Set())
                }} className="accent-primary h-4 w-4" />
                <div>
                  <div className="text-sm font-semibold text-text-primary">جميع المشاريع</div>
                  <div className="text-xs text-text-secondary">All current and future projects</div>
                </div>
              </label>

              {/* Selected projects */}
              {!giveAllProjects && projects.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2 bg-background-secondary/40 border-b border-border">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Selected projects</span>
                  </div>
                  <div className="divide-y divide-border/50 max-h-44 overflow-y-auto">
                    {projects.map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-background-secondary/50 transition-colors">
                        <input type="checkbox" checked={selectedProjects.has(p.id)} onChange={() => toggleProject(p.id)} className="accent-primary h-4 w-4" />
                        <span className="text-xs font-mono text-text-secondary bg-background-secondary px-1.5 py-0.5 rounded">{p.project_code}</span>
                        <span className="text-sm font-medium text-text-primary">{p.arabic_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{error}</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={() => !isPending && setOpen(false)} disabled={isPending} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:border-text-secondary/40 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isPending} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                {isPending ? 'Saving…' : 'Grant scopes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
