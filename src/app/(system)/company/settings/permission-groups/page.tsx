import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import Link from 'next/link'
import DeletePermissionGroupButton from './DeletePermissionGroupButton'

export default async function PermissionGroupsPage() {
  await requireSuperAdmin()
  const supabase = createClient()

  const { data: groups } = await supabase
    .from('permission_groups')
    .select('id, group_key, arabic_name, is_system_group, is_active')
    .order('arabic_name')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">مجموعات الصلاحيات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة مجموعات الوصول وتحرير مصفوفة الصلاحيات لكل مجموعة
          </p>
        </div>
        <Link
          href="/company/settings/permission-groups/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + مجموعة جديدة
        </Link>
      </div>

      {/* Groups grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups?.map(group => (
          <div
            key={group.id}
            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary truncate">{group.arabic_name}</h3>
                  <p className="mt-0.5 text-xs text-text-secondary" dir="ltr">{group.group_key}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {group.is_system_group && (
                    <span className="inline-flex items-center rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                      نظام
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      group.is_active
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {group.is_active ? 'نشطة' : 'موقوفة'}
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t border-border/50 bg-background-secondary px-5 py-3 flex items-center justify-between">
              {/* Edit icon */}
              <Link
                href={`/company/settings/permission-groups/${group.id}`}
                title={group.is_system_group ? 'عرض الصلاحيات' : 'تحرير الصلاحيات'}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </Link>
              {/* Delete icon */}
              <DeletePermissionGroupButton
                groupId={group.id}
                groupName={group.arabic_name}
                isSystemGroup={group.is_system_group ?? false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
