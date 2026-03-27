import { getCompany, getProjects } from '@/lib/projects'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  planning:  'تخطيط',
  active:    'نشط',
  on_hold:   'متوقف',
  completed: 'مكتمل',
  cancelled: 'ملغى',
}
const STATUS_COLORS: Record<string, string> = {
  planning:  'bg-primary/10 text-primary',
  active:    'bg-success/10 text-success',
  on_hold:   'bg-amber-100 text-amber-700',
  completed: 'bg-navy/10 text-navy',
  cancelled: 'bg-danger/10 text-danger',
}

export default async function ProjectsPage() {
  await requirePermission('projects', 'view')
  const projects = await getProjects()

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">المشروعات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {projects.length} مشروع مسجل
          </p>
        </div>
        <Link
          href="/company/projects/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة مشروع
        </Link>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-20">
          <div className="text-4xl mb-4">🏗️</div>
          <h2 className="text-lg font-semibold text-text-primary">لا توجد مشروعات بعد</h2>
          <p className="mt-1 text-sm text-text-secondary">ابدأ بإضافة أول مشروع</p>
          <Link
            href="/company/projects/new"
            className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            + إضافة مشروع
          </Link>
        </div>
      )}

      {/* Projects grid */}
      {projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              href={`/company/projects/${project.id}`}
              className="group block overflow-hidden rounded-xl border border-border bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                      {project.arabic_name}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5" dir="ltr">
                      {project.project_code}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] ?? 'bg-border text-text-secondary'}`}>
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.location && (
                    <span className="inline-flex items-center rounded-full bg-background-secondary px-2 py-0.5 text-xs text-text-secondary">
                      📍 {project.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Financial summary strip */}
              {project.planned_allocation_amount != null && (
                <div className="border-t border-border/50 bg-background-secondary px-5 py-3 flex gap-4">
                  <div>
                    <div className="text-xs text-text-secondary">التخصيص المخطط</div>
                    <div className="text-sm font-semibold text-text-primary">
                      {Number(project.planned_allocation_amount).toLocaleString('en-US')} ج.م
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
