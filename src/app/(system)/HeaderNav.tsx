'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserScope } from '@/lib/permissions'

type Project = {
  id: string
  arabic_name: string
  project_code: string
}

type Props = {
  projects: Project[]
  userScopes: UserScope[]
  isSuperAdmin: boolean
  companyName?: string
}

export default function HeaderNav({ projects, userScopes, isSuperAdmin, companyName }: Props) {
  const pathname = usePathname()

  // Determine active context
  const isCompanyActive =
    !pathname?.includes('/projects/') ||
    pathname?.startsWith('/company')

  // Which project is currently active (if any)
  const activeProjectId = (() => {
    const match = pathname?.match(/\/projects\/([^/]+)/)
    return match?.[1] ?? null
  })()

  // Determine which projects this user can access based on their scopes
  const visibleProjects = (() => {
    // Super admins see all projects
    if (isSuperAdmin) return projects

    // Check scope types
    const hasAllProjects = userScopes.some(s => s.scope_type === 'all_projects')
    if (hasAllProjects) return projects

    // Filter by selected_project scopes
    const selectedProjectIds = new Set(
      userScopes
        .filter(s => s.scope_type === 'selected_project' && s.project_id)
        .map(s => s.project_id!)
    )

    if (selectedProjectIds.size === 0) return []
    return projects.filter(p => selectedProjectIds.has(p.id))
  })()

  // Check if user has main_company scope (or is super admin)
  const hasCompanyScope = isSuperAdmin || userScopes.some(
    s => s.scope_type === 'main_company' || s.scope_type === 'all_projects'
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Company Tag — show always (every user has at least dashboard) */}
      <Link
        href="/company"
        className={`
          inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold
          border transition-all duration-150 whitespace-nowrap
          ${isCompanyActive && !activeProjectId
            ? 'bg-navy text-white border-navy shadow-sm'
            : 'bg-white text-navy border-border hover:border-navy/40 hover:bg-navy/5'
          }
        `}
      >
        <span className="text-[10px] opacity-60 font-mono">◉</span>
        {companyName || 'الشركة الرئيسية'}
      </Link>

      {/* Divider */}
      {visibleProjects.length > 0 && (
        <span className="text-border select-none mx-1 text-sm">|</span>
      )}

      {/* Project Tags */}
      {visibleProjects.map((project) => {
        const isActive = activeProjectId === project.id
        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            title={project.arabic_name}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold
              border transition-all duration-150 whitespace-nowrap max-w-[200px]
              ${isActive
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-text-primary border-border hover:border-primary/40 hover:bg-primary/5'
              }
            `}
          >
            <span
              className={`text-[9px] font-mono shrink-0 ${isActive ? 'text-white/70' : 'text-text-secondary'}`}
            >
              {project.project_code}
            </span>
            <span className="truncate">{project.arabic_name}</span>
          </Link>
        )
      })}

      {/* Empty state — no visible projects */}
      {visibleProjects.length === 0 && !isSuperAdmin && (
        <span className="text-xs text-text-secondary italic px-2">
          لا توجد مشاريع مخصصة
        </span>
      )}

      {/* Super admin empty state */}
      {visibleProjects.length === 0 && isSuperAdmin && (
        <span className="text-xs text-text-secondary italic px-2">
          لا توجد مشاريع مضافة
        </span>
      )}
    </div>
  )
}
