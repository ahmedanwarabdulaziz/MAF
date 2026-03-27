'use client'

import { useState, useTransition } from 'react'
import EditScopeButton from './EditScopeButton'
import { toggleAccessScopeAction, deleteAccessScopeAction } from './actions'
import AddScopeButton from './AddScopeButton'

const SCOPE_LABELS: Record<string, string> = {
  main_company: 'الشركة الرئيسية',
  all_projects: 'جميع المشاريع',
  selected_project: 'مشروع محدد',
  selected_warehouse: 'مخزن محدد',
}

const SCOPE_COLORS: Record<string, string> = {
  main_company: 'bg-navy/10 text-navy border-navy/20',
  all_projects: 'bg-primary/10 text-primary border-primary/20',
  selected_project: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  selected_warehouse: 'bg-amber-50 text-amber-700 border-amber-200',
}

interface Project {
  id: string
  arabic_name: string
  project_code: string
}

interface Scope {
  id: string
  user_id: string
  scope_type: string
  project_id: string | null
  is_active: boolean
  granted_at: string | null
  user: { display_name: string; email?: string } | null
  project: { arabic_name: string; project_code: string } | null
}

interface ScopeCardProps {
  scope: Scope
  projects: Project[]
}

function ScopeCard({ scope, projects }: ScopeCardProps) {
  const [isPendingToggle, startToggle] = useTransition()
  const [isPendingDelete, startDelete] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleToggle = () => {
    startToggle(async () => {
      await toggleAccessScopeAction(scope.id, !scope.is_active)
    })
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startDelete(async () => {
      await deleteAccessScopeAction(scope.id)
    })
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-opacity ${
      scope.is_active ? 'bg-white border-border' : 'bg-background-secondary/50 border-border/50'
    } ${(isPendingToggle || isPendingDelete) ? 'opacity-50' : ''}`}>

      {/* Top row: badge + toggle */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          SCOPE_COLORS[scope.scope_type] ?? 'bg-border/30 text-text-secondary border-border'
        } ${!scope.is_active ? 'opacity-60' : ''}`}>
          {SCOPE_LABELS[scope.scope_type] ?? scope.scope_type}
        </span>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={isPendingToggle || isPendingDelete}
          title={scope.is_active ? 'Deactivate' : 'Activate'}
          role="switch"
          aria-checked={scope.is_active}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait ${
            scope.is_active ? 'bg-emerald-500' : 'bg-border'
          }`}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
            scope.is_active ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Project name if selected_project */}
      {scope.scope_type === 'selected_project' && scope.project && (
        <div className="text-sm font-medium text-text-primary">
          {scope.project.arabic_name}
          <span className="mr-1.5 text-xs text-text-secondary font-mono">({scope.project.project_code})</span>
        </div>
      )}

      {/* Actions row: edit + delete */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <EditScopeButton
          scopeId={scope.id}
          currentScopeType={scope.scope_type}
          currentProjectId={scope.project_id}
          projects={projects}
        />

        {/* Delete button — shows confirm on first click */}
        <button
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          disabled={isPendingDelete || isPendingToggle}
          className={`text-xs font-medium transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'text-danger font-semibold'
              : 'text-text-secondary hover:text-danger'
          }`}
        >
          {isPendingDelete ? 'Deleting…' : confirmDelete ? 'Confirm delete?' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  scopes: Scope[]
  projects: Project[]
}

export default function ScopesList({ scopes, projects }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Group by user_id
  const groups: { uid: string; user: Scope['user']; rows: Scope[] }[] = []
  const seen: Record<string, number> = {}
  for (const s of scopes) {
    if (seen[s.user_id] === undefined) {
      seen[s.user_id] = groups.length
      groups.push({ uid: s.user_id, user: s.user, rows: [] })
    }
    groups[seen[s.user_id]].rows.push(s)
  }

  const toggle = (uid: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })

  if (!scopes.length) {
    return (
      <div className="px-6 py-14 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-background-secondary flex items-center justify-center">
          <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-text-secondary">No scope assignments yet</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {groups.map(({ uid, user, rows }) => {
        const open = expanded.has(uid)
        const activeCount = rows.filter(r => r.is_active).length

        return (
          <div key={uid} className={open ? 'bg-background-secondary/20' : ''}>
            {/* Header row */}
            <button
              onClick={() => toggle(uid)}
              className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-background-secondary/40 transition-colors"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {user?.display_name?.[0] ?? '؟'}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="font-semibold text-text-primary text-sm">{user?.display_name ?? 'Unknown user'}</div>
                {user?.email && <div className="text-xs text-text-secondary mt-0.5" dir="ltr">{user.email}</div>}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <AddScopeButton userId={uid} userName={user?.display_name ?? 'Unknown'} projects={projects} />
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{activeCount}</span> / {rows.length} active
                </span>
                {!open && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    {rows.slice(0, 3).map(r => (
                      <span key={r.id} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        SCOPE_COLORS[r.scope_type] ?? 'bg-border/30 text-text-secondary border-border'
                      } ${!r.is_active ? 'opacity-40' : ''}`}>
                        {r.scope_type === 'selected_project' && r.project ? r.project.project_code : SCOPE_LABELS[r.scope_type]}
                      </span>
                    ))}
                    {rows.length > 3 && <span className="text-xs text-text-secondary">+{rows.length - 3}</span>}
                  </div>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`shrink-0 text-text-secondary transition-transform duration-200 ${open ? '-rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </button>

            {/* Expanded scope cards */}
            {open && (
              <div className="px-6 pb-5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map(scope => (
                    <ScopeCard key={scope.id} scope={scope} projects={projects} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
