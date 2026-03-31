import { getProject } from '@/lib/projects'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EditProjectOwner from './EditProjectOwner'

const STATUS_LABELS: Record<string, string> = {
  planning: 'تخطيط', active: 'نشط', on_hold: 'متوقف', completed: 'مكتمل', cancelled: 'ملغى',
}
const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-primary/10 text-primary', active: 'bg-success/10 text-success',
  on_hold: 'bg-amber-100 text-amber-700', completed: 'bg-navy/10 text-navy',
  cancelled: 'bg-danger/10 text-danger',
}
const MIGRATION_LABELS: Record<string, string> = {
  not_required: 'غير مطلوب', draft: 'مسودة', in_progress: 'جارٍ',
  ready_for_review: 'جاهز للمراجعة', approved: 'معتمد', locked: 'مقفل',
}
const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك', subcontractor: 'مقاول', supplier: 'مورد', consultant: 'مستشار', other: 'آخر',
}

interface Props { params: { id: string } }

export default async function ProjectDetailPage({ params }: Props) {
  await requirePermission('projects', 'view')
  const project = await getProject(params.id)
  if (!project) notFound()


  const parties = (project as any).project_parties ?? []

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/projects" className="hover:text-primary">المشروعات</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{(project as any).arabic_name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{(project as any).arabic_name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[(project as any).status] ?? 'bg-border text-text-secondary'}`}>
              {STATUS_LABELS[(project as any).status] ?? (project as any).status}
            </span>
            <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
              {(project as any).project_onboarding_type === 'existing' ? 'مشروع قائم' : 'مشروع جديد'}
            </span>
          </div>
          <div className="mt-1 text-sm text-text-secondary" dir="ltr">
            {(project as any).project_code}
            {(project as any).english_name && ` — ${(project as any).english_name}`}
          </div>
        </div>
      </div>

      {/* Cutover Banner */}
      {(project as any).project_onboarding_type === 'existing' && (project as any).migration_status !== 'locked' && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold text-text-primary text-lg">إكمال إعدادات المشروع القائم (ترحيل البيانات)</h3>
            <p className="mt-1 text-sm text-text-secondary">
              هذا المشروع مسجل كـ "مشروع قائم". يجب إكمال معالج ترحيل البيانات لتسجيل الأرصدة الافتتاحية والمواقف المالية والتشغيلية قبل البدء في استخدام النظام بالكامل.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/cutover`}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors whitespace-nowrap mr-4"
          >
            البدء في الترحيل
          </Link>
        </div>
      )}

      {/* Cards row */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
          <div className="text-xs text-text-secondary mb-1">الجهة المالكة</div>
          <EditProjectOwner 
            projectId={project.id}
            currentOwnerId={(project as any).owner_party_id}
            currentOwnerName={(project as any).owner_party?.arabic_name}
          />
        </div>

        {[
          { label: 'التخصيص المخطط', value: (project as any).planned_allocation_amount != null ? `${Number((project as any).planned_allocation_amount).toLocaleString('en-US')} ج.م` : '—' },
          { label: 'تاريخ البداية', value: (project as any).start_date ?? '—' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
            <div className="text-xs text-text-secondary">{card.label}</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{card.value}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
