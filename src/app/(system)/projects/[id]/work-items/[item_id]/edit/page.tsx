import WorkItemForm from '@/components/forms/WorkItemForm'
import { createClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export default async function EditProjectWorkItemPage({ params }: { params: { id: string, "item_id": string } }) {
  const supabase = createClient()
  const { data: item } = await supabase
    .from('project_work_items')
    .select('*')
    .eq('id', params.item_id)
    .single()

  if (!item) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">تعديل بند الأعمال</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تعديل التفاصيل سيؤثر على الوصف في العقود والمستخلصات المستقبلية.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <WorkItemForm projectId={params.id} initialData={item} />
      </div>
    </div>
  )
}
