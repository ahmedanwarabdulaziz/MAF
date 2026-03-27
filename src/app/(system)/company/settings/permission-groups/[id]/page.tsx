import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import Link from 'next/link'
import EditPermissionGroupForm from './EditPermissionGroupForm'

interface Props {
  params: { id: string }
}

export default async function PermissionGroupDetailPage({ params }: Props) {
  await requireSuperAdmin()
  const supabase = createClient()

  const { data: group } = await supabase
    .from('permission_groups')
    .select('id, group_key, arabic_name, is_system_group, is_active, notes')
    .eq('id', params.id)
    .single()

  if (!group) return <div className="p-8 text-text-secondary">مجموعة غير موجودة</div>

  // Load all permissions and this group's allowed ones
  const { data: allPermissions } = await supabase
    .from('permissions')
    .select('module_key, module_name_ar, action_key, action_name_ar')
    .order('module_key')

  const { data: groupPerms } = await supabase
    .from('permission_group_permissions')
    .select('module_key, action_key, is_allowed')
    .eq('permission_group_id', params.id)

  const allowedSet = new Set(
    (groupPerms ?? [])
      .filter(p => p.is_allowed)
      .map(p => `${p.module_key}:${p.action_key}`)
  )

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/company/settings/permission-groups"
          className="text-sm text-text-secondary hover:text-primary"
        >
          → مجموعات الصلاحيات
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{group.arabic_name}</h1>
            {group.is_system_group && (
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                مجموعة نظام
              </span>
            )}
            {!group.is_active && (
              <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                موقوفة
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary" dir="ltr">{group.group_key}</p>
        </div>
      </div>

      <EditPermissionGroupForm
        group={group}
        allPermissions={allPermissions ?? []}
        initiallyAllowed={Array.from(allowedSet)}
      />
    </div>
  )
}
