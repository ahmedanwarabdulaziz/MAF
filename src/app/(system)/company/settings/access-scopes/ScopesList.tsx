'use client'

import { useState } from 'react'
import RevokeScopeButton from './RevokeScopeButton'

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

export default function ScopesList({ scopes }: { scopes: Scope[] }) {
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
        <p className="text-sm text-text-secondary">لا توجد تعيينات نطاق بعد</p>
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
            {/* Header row — clickable */}
            <button
              onClick={() => toggle(uid)}
              className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-background-secondary/40 transition-colors"
            >
              {/* Avatar */}
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {user?.display_name?.[0] ?? '؟'}
              </div>

              {/* Name & email */}
              <div className="flex-1 min-w-0 text-right">
                <div className="font-semibold text-text-primary text-sm">
                  {user?.display_name ?? 'مستخدم غير معروف'}
                </div>
                {user?.email && (
                  <div className="text-xs text-text-secondary mt-0.5" dir="ltr">{user.email}</div>
                )}
              </div>

              {/* Scope count badge */}
              <div className="shrink-0 flex items-center gap-3">
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{activeCount}</span> نطاق نشط
                </span>

                {/* Mini scope type chips — collapsed view */}
                {!open && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    {rows.slice(0, 3).map(r => (
                      <span
                        key={r.id}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SCOPE_COLORS[r.scope_type] ?? 'bg-border/30 text-text-secondary border-border'}`}
                      >
                        {r.scope_type === 'selected_project' && r.project
                          ? r.project.project_code
                          : SCOPE_LABELS[r.scope_type]}
                      </span>
                    ))}
                    {rows.length > 3 && (
                      <span className="text-xs text-text-secondary">+{rows.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Chevron */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14" height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 text-text-secondary transition-transform duration-200 ${open ? '-rotate-180' : ''}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </button>

            {/* Expanded scope cards */}
            {open && (
              <div className="px-6 pb-5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map(scope => (
                    <div
                      key={scope.id}
                      className={`rounded-xl border p-4 flex flex-col gap-2 ${scope.is_active ? 'bg-white border-border' : 'bg-background-secondary/50 border-border/50 opacity-60'}`}
                    >
                      {/* Scope type badge */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SCOPE_COLORS[scope.scope_type] ?? 'bg-border/30 text-text-secondary border-border'}`}>
                          {SCOPE_LABELS[scope.scope_type] ?? scope.scope_type}
                        </span>
                        <span className={`text-xs font-medium ${scope.is_active ? 'text-emerald-600' : 'text-text-secondary'}`}>
                          {scope.is_active ? '● نشط' : '○ موقوف'}
                        </span>
                      </div>

                      {/* Project name if selected_project */}
                      {scope.scope_type === 'selected_project' && scope.project && (
                        <div className="text-sm font-medium text-text-primary">
                          {scope.project.arabic_name}
                          <span className="mr-1.5 text-xs text-text-secondary font-mono">({scope.project.project_code})</span>
                        </div>
                      )}

                      {/* Revoke button */}
                      {scope.is_active && (
                        <div className="mt-1">
                          <RevokeScopeButton scopeId={scope.id} />
                        </div>
                      )}
                    </div>
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
