import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import ItemGroupTree from './ItemGroupTree'

export default async function ItemGroupsPage() {
  await requireAuth()
  const supabase = createClient()

  const { data: groups } = await supabase
    .from('item_groups')
    .select('id, group_code, arabic_name, english_name, is_active, parent_group_id')
    .order('group_code')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مجموعات الأصناف</h1>
          <p className="mt-1 text-sm text-text-secondary">إدارة فئات ومجموعات الأصناف المخزنية</p>
        </div>
        <Link
          href="/company/main_warehouse/item-groups/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة مجموعة
        </Link>
      </div>

      {!groups?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-20">
          <div className="text-4xl mb-4">🗂️</div>
          <p className="text-text-secondary text-sm">لا توجد مجموعات أصناف بعد</p>
          <Link href="/company/main_warehouse/item-groups/new" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
            + إضافة أول مجموعة
          </Link>
        </div>
      ) : (
        <ItemGroupTree groups={groups} />
      )}
    </div>
  )
}
