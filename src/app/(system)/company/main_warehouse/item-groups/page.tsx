import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import ItemGroupTree from './ItemGroupTree'
import { getMainCompanyId } from '@/actions/warehouse'

export default async function ItemGroupsPage() {
  await requirePermission('main_warehouse', 'view')
  const supabase = createClient()
  const companyId = await getMainCompanyId()

  const { data: groups } = await supabase
    .from('item_groups')
    .select('id, group_code, arabic_name, english_name, is_active, parent_group_id')
    .order('group_code')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">شجرة مجموعات الأصناف</h1>
          <p className="mt-1 text-sm text-text-secondary">إدارة فئات ومجموعات الأصناف الرئيسية والفرعية</p>
        </div>
      </div>

        <ItemGroupTree initialGroups={groups || []} companyId={companyId} />
    </div>
  )
}
