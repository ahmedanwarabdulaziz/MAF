import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import Link from 'next/link'
import EditUserForm from './EditUserForm'
import { notFound } from 'next/navigation'

interface Props {
  params: { id: string }
}

export default async function EditUserPage({ params }: Props) {
  await requireSuperAdmin()
  const supabase = createClient()

  // Fetch the user
  const { data: user } = await supabase
    .from('users')
    .select(`
      id, display_name, email, is_active, is_super_admin,
      user_permission_group_assignments!user_permission_group_assignments_user_id_fkey (
        permission_group_id
      )
    `)
    .eq('id', params.id)
    .single()

  if (!user) {
    notFound()
  }

  // Fetch all active permission groups
  const { data: permissionGroups } = await supabase
    .from('permission_groups')
    .select('id, group_key, arabic_name')
    .eq('is_active', true)
    .order('arabic_name')

  const assignedGroupIds = (user.user_permission_group_assignments ?? []).map(
    (a: any) => a.permission_group_id
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/company/settings/users"
          className="text-sm text-text-secondary hover:text-primary transition-colors"
        >
          → العودة للمستخدمين
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">تعديل ملف المستخدم</h1>
        <p className="mt-1 text-sm text-text-secondary" dir="ltr">
          {user.email}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <EditUserForm
          user={user}
          permissionGroups={permissionGroups ?? []}
          assignedGroupIds={assignedGroupIds}
        />
      </div>
    </div>
  )
}
