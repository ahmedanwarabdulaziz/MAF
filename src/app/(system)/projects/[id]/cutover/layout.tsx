import Link from 'next/link'
import { getCutoverBatch } from '@/actions/cutover'
import { getProject } from '@/lib/projects'
import { notFound, redirect } from 'next/navigation'

interface Props {
  children: React.ReactNode
  params: { id: string }
}

const STEPS = [
  { id: 'setup',           path: '',               label: 'إعداد الترحيل' },
  { id: 'financials',      path: '/financials',    label: 'الأرصدة المالية' },
  { id: 'subcontractors',  path: '/subcontractors',label: 'مقاولي الباطن' },
  { id: 'suppliers',       path: '/suppliers',     label: 'الموردين' },
  { id: 'owner',           path: '/owner',         label: 'المالك' },
  { id: 'warehouse',       path: '/warehouse',     label: 'المستودعات' },
  { id: 'custody',         path: '/custody',       label: 'العهد' },
  { id: 'review',          path: '/review',        label: 'المراجعة' },
]

export default async function CutoverWizardLayout({ children, params }: Props) {
  const project = await getProject(params.id)
  if (!project || (project as any).project_onboarding_type !== 'existing') {
    notFound()
  }

  // If already locked, redirect back to project with a success param or just regular redirect
  if ((project as any).migration_status === 'locked') {
    redirect(`/projects/${params.id}?msg=cutover_locked`)
  }

  const batch = await getCutoverBatch(params.id)
  const isInitialized = !!batch

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
          <Link href="/projects" className="hover:text-primary">المشروعات</Link>
          <span>←</span>
          <Link href={`/projects/${params.id}`} className="hover:text-primary">{(project as any).arabic_name}</Link>
          <span>←</span>
          <span className="text-text-primary font-medium">ترحيل مشروع قائم</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">ترحيل مشروع قائم: {(project as any).arabic_name}</h1>
        <p className="mt-1 text-sm text-text-secondary">أدخل الأرصدة والمواقف التشغيلية لفتح الحسابات للمشروع واعتمادها في النظام.</p>
      </div>

      {/* Stepper Navigation */}
      <div className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {STEPS.map((step, index) => {
            const isFirst = index === 0
            const disabled = !isFirst && !isInitialized

            return (
              <div key={step.id} className="flex items-center">
                <Link
                  href={disabled ? '#' : `/projects/${params.id}/cutover${step.path}`}
                  className={`flex flex-col items-center gap-1.5 px-3 py-1 outline-none transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:opacity-80'
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    disabled ? 'border-border bg-background-secondary text-text-secondary' 
                    : 'border-primary bg-primary/10 text-primary'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`text-xs font-medium ${disabled ? 'text-text-secondary' : 'text-text-primary'}`}>
                    {step.label}
                  </span>
                </Link>
                {index < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-border mx-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  )
}
