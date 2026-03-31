import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import Link from 'next/link'
import DeleteUserButton from './DeleteUserButton'
import ToggleUserButton from './ToggleUserButton'
import AddUserButton from './AddUserButton'

export default async function UsersPage() {
  await requireSuperAdmin()
  const supabase = createClient()

  const { data: users } = await supabase
    .from('users')
    .select(`
      id, display_name, email, is_active, is_super_admin,
      user_permission_group_assignments!user_permission_group_assignments_user_id_fkey (
        permission_group_id,
        is_active,
        permission_groups ( arabic_name )
      ),
      user_role_assignments!user_role_assignments_user_id_fkey (
        is_active,
        roles ( arabic_name )
      )
    `)
    .order('display_name')

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">إدارة المستخدمين</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إضافة المستخدمين وتعيين مجموعات الصلاحيات ونطاق الوصول
          </p>
        </div>
        <AddUserButton />
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">الاسم</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">البريد الإلكتروني</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">مجموعات الصلاحيات</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {!users?.length && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-text-secondary">
                  لا يوجد مستخدمون بعد
                </td>
              </tr>
            )}
            {users?.map(user => {
              const activeGroups = user.user_permission_group_assignments
                ?.filter((a: any) => a.is_active)
                .map((a: any) => a.permission_groups?.arabic_name)
                .filter(Boolean) ?? []

              return (
                <tr key={user.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {user.display_name?.[0] ?? 'U'}
                      </div>
                      <div>
                        <div className="font-medium text-text-primary">{user.display_name}</div>
                        {user.is_super_admin && (
                          <div className="text-xs text-primary">مدير النظام</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {activeGroups.length === 0 && (
                        <span className="text-text-secondary text-xs">غير معين</span>
                      )}
                      {activeGroups.map((name: string) => (
                        <span
                          key={name}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ToggleUserButton userId={user.id} isActive={user.is_active ?? false} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/company/settings/users/${user.id}`}
                        title="تعديل"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </Link>
                      <DeleteUserButton userId={user.id} userName={user.display_name ?? user.email ?? ''} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
