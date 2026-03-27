import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import WarehouseForm from '../new/warehouse-form'
import { getMainCompanyId } from '@/actions/warehouse'
import { notFound } from 'next/navigation'

export default async function EditWarehousePage({
  params
}: {
  params: { id: string }
}) {
  await requireAuth()
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!warehouse) {
    return notFound()
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .order('arabic_name')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">تعديل بيانات المخزن</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تحديث معلومات وإعدادات المخزن
        </p>
      </div>

      <WarehouseForm 
        companyId={companyId} 
        projects={projects || []}
        initialData={warehouse}
      />
    </div>
  )
}
