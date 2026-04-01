import { getCompany, getProjects } from '@/lib/projects'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import AddProjectButton from './AddProjectButton'
import ProjectsGrid from './ProjectsGrid'

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
        <AddProjectButton />
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-20">
          <div className="text-4xl mb-4">🏗️</div>
          <h2 className="text-lg font-semibold text-text-primary">لا توجد مشروعات بعد</h2>
          <p className="mt-1 text-sm text-text-secondary">ابدأ بإضافة أول مشروع</p>
          <div className="mt-6">
            <AddProjectButton />
          </div>
        </div>
      )}

      {/* Projects grid */}
      {projects.length > 0 && (
        <ProjectsGrid projects={projects} />
      )}
    </div>
  )
}
