import { getProjectDashboardMetrics } from '@/actions/dashboards'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import ProjectDashboardClient from '@/components/dashboards/ProjectDashboardClient'

export const metadata = {
  title: 'لوحة تحكم المشروع | نظام إدارة المقاولات'
}

export default async function ProjectDashboard({ params }: { params: { id: string } }) {
  // 1. Get Project Basic details
  const supabase = createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('arabic_name, project_code')
    .eq('id', params.id)
    .single()
  
  if (!project) notFound()

  // 2. Fetch Live Aggregate Metrics
  const metrics = await getProjectDashboardMetrics(params.id)

  return (
    <ProjectDashboardClient 
      projectId={params.id} 
      project={project} 
      initialMetrics={metrics} 
    />
  )
}
