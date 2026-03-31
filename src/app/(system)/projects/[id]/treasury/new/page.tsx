import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import NewProjectAccountForm from './NewProjectAccountForm'

export const metadata = { title: 'خزينة جديدة للمشروع' }

export default async function NewProjectTreasuryPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('arabic_name, project_code')
    .eq('id', params.id)
    .single()

  if (!project) notFound()

  return (
    <div className="max-w-xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href={`/projects/${params.id}/treasury`} className="hover:text-primary transition-colors">
          خزائن المشروع
        </Link>
        <span>←</span>
        <span className="text-text-primary font-medium">خزينة جديدة</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">إضافة خزينة للمشروع</h1>
        <p className="text-sm text-text-secondary mt-1">
          إنشاء خزينة نقدية أو حساب بنكي مخصص لمشروع
          <span className="font-semibold text-primary mr-1">{project.arabic_name}</span>
        </p>
      </div>

      <NewProjectAccountForm projectId={params.id} />
    </div>
  )
}
