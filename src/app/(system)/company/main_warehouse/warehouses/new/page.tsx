import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import WarehouseForm from './warehouse-form'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function NewWarehousePage() {
  await requirePermission('main_warehouse', 'view')
  
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, arabic_name')
    .eq('company_id', companyId)
    .order('arabic_name')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">إضافة مخزن جديد</h1>
        <p className="mt-1 text-sm text-text-secondary">
          تسجيل مخزن جديد، رئيسي أو تابع لمشروع
        </p>
      </div>

      <WarehouseForm 
        companyId={companyId} 
        projects={projects || []}
      />
    </div>
  )
}
