import WorkItemForm from '@/components/forms/WorkItemForm'

export default function NewProjectWorkItemPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">إضافة بند أعمال جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">
          هذا البند سيكون متاحاً للاستخدام في عقود مقاولي الباطن ومستخلصات هذا المشروع فقط.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <WorkItemForm projectId={params.id} />
      </div>
    </div>
  )
}
