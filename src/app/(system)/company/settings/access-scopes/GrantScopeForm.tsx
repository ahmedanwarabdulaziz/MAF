'use client'

import { useState } from 'react'
import { grantBulkScopesAction } from './actions'
import CustomSelect from '@/components/CustomSelect'

interface User { id: string; display_name: string }
interface Project { id: string; arabic_name: string; project_code: string }

export default function GrantScopeForm({
  users,
  projects,
}: {
  users: User[]
  projects: Project[]
}) {
  const [userId, setUserId] = useState('')
  const [giveCompany, setGiveCompany] = useState(false)
  const [giveAllProjects, setGiveAllProjects] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const toggleProject = (id: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!userId) return setError('Please select a user')
    if (!giveCompany && !giveAllProjects && selectedProjects.size === 0)
      return setError('Please select at least one scope')

    setLoading(true)

    const scopes: { scope_type: string; project_id?: string }[] = []
    if (giveCompany) scopes.push({ scope_type: 'main_company' })
    if (giveAllProjects) scopes.push({ scope_type: 'all_projects' })
    selectedProjects.forEach(pid =>
      scopes.push({ scope_type: 'selected_project', project_id: pid })
    )

    const result = await grantBulkScopesAction(userId, scopes)
    setLoading(false)

    if (result.error) return setError(result.error)

    setSuccess(`تم منح ${result.granted} نطاق${result.skipped ? ` (${result.skipped} موجود مسبقاً)` : ''}`)
    setUserId('')
    setGiveCompany(false)
    setGiveAllProjects(false)
    setSelectedProjects(new Set())
    window.location.reload()
  }

  // ── Empty state: all users already have scopes ────────────────
  if (users.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <svg className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-700">All users already have access scopes</p>
            <p className="mt-1 text-sm text-amber-600">
              Use the <strong>toggle</strong>, <strong>edit</strong>, or <strong>delete</strong> controls in the list below to modify existing access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-success/10 p-3 text-sm text-success border border-success/20">✓ {success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* User selector */}
        <div className="flex flex-col gap-1.5 max-w-sm">
          <label className="text-sm font-semibold text-text-primary">
            User <span className="text-danger">*</span>
          </label>
          <CustomSelect
            value={userId}
            onChange={setUserId}
            placeholder="— Select a user —"
            options={users.map(u => ({ value: u.id, label: u.display_name }))}
          />
        </div>

        {/* Scope selection */}
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Main company toggle */}
          <label className="flex items-center gap-4 px-5 py-3.5 border-b border-border cursor-pointer hover:bg-background-secondary/50 transition-colors">
            <input
              type="checkbox"
              checked={giveCompany}
              onChange={e => setGiveCompany(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            <div>
              <div className="text-sm font-semibold text-text-primary">الشركة الرئيسية</div>
              <div className="text-xs text-text-secondary">Company dashboard and central data</div>
            </div>
          </label>

          {/* All projects toggle */}
          <label className="flex items-center gap-4 px-5 py-3.5 border-b border-border cursor-pointer hover:bg-background-secondary/50 transition-colors">
            <input
              type="checkbox"
              checked={giveAllProjects}
              onChange={e => {
                setGiveAllProjects(e.target.checked)
                if (e.target.checked) setSelectedProjects(new Set())
              }}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            <div>
              <div className="text-sm font-semibold text-text-primary">جميع المشاريع</div>
              <div className="text-xs text-text-secondary">Access to all current and future projects</div>
            </div>
          </label>

          {/* Individual projects — shown when "all" is NOT checked */}
          {!giveAllProjects && (
            <div>
              <div className="px-5 py-2 bg-background-secondary/40 border-b border-border">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Selected projects
                </span>
              </div>
              {projects.length === 0 ? (
                <div className="px-5 py-4 text-sm text-text-secondary italic">No projects available</div>
              ) : (
                <div className="divide-y divide-border/50 max-h-56 overflow-y-auto">
                  {projects.map(p => (
                    <label
                      key={p.id}
                      className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-background-secondary/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="h-4 w-4 rounded border-border text-primary accent-primary"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-secondary bg-background-secondary px-1.5 py-0.5 rounded">
                          {p.project_code}
                        </span>
                        <span className="text-sm font-medium text-text-primary">{p.arabic_name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Granting…' : 'Grant selected scopes'}
          </button>
        </div>
      </form>
    </div>
  )
}
