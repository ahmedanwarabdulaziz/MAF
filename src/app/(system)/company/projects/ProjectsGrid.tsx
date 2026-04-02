'use client'

import { useState } from 'react'
import EditProjectModal from '@/components/modals/EditProjectModal'
import { formatNumber } from '@/lib/format'

const STATUS_LABELS: Record<string, string> = {
  planning:  'تخطيط',
  active:    'نشط',
  on_hold:   'متوقف',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  archived:  'مؤرشف',
}
const STATUS_COLORS: Record<string, string> = {
  planning:  'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  active:    'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
  on_hold:   'bg-amber-500/20 text-amber-200 border border-amber-500/30',
  completed: 'bg-white/10 text-white border border-white/20',
  cancelled: 'bg-red-500/20 text-red-200 border border-red-500/30',
  archived:  'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

export default function ProjectsGrid({ projects }: { projects: any[] }) {
  const [editingProject, setEditingProject] = useState<any | null>(null)

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project: any) => (
          <button
            key={project.id}
            onClick={() => setEditingProject(project)}
            className="group block w-full text-right overflow-hidden rounded-xl border border-border bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <div className="bg-navy px-5 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-fit rounded bg-white/20 px-2.5 py-1 text-xs font-mono font-medium tracking-widest text-white shadow-inner" dir="ltr">
                    {project.project_code}
                  </span>
                  <div className="text-lg font-bold text-white group-hover:text-white/90 transition-colors leading-tight">
                    {project.arabic_name}
                  </div>
                </div>
                {(() => {
                  const computedStatus = project.archived_at ? 'archived' : project.status;
                  return (
                    <span className={`mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[computedStatus] ?? 'bg-white/10 text-white'}`}>
                      {STATUS_LABELS[computedStatus] ?? computedStatus}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div className="p-4 bg-white border-t border-border flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs font-medium text-text-tertiary">التخصيص المخطط</span>
                <span className="text-sm font-bold text-text-primary" dir="ltr">
                  {formatNumber(project.planned_allocation_amount)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <EditProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
      />
    </>
  )
}
