'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Project = {
  id: string
  arabic_name: string
  project_code: string
}

export default function HeaderNav({ projects }: { projects: Project[] }) {
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Company Tag */}
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
        الشركة الرئيسية
      </Link>

      {/* Divider */}
      {projects.length > 0 && (
        <span className="text-border select-none mx-1 text-sm">|</span>
      )}

      {/* Project Tags */}
      {projects.map((project) => {
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

      {/* Empty state — no projects yet */}
      {projects.length === 0 && (
        <span className="text-xs text-text-secondary italic px-2">
          لا توجد مشاريع مضافة
        </span>
      )}
    </div>
  )
}
