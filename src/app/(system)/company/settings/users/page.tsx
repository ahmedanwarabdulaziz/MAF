import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import Link from 'next/link'

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
        <Link
          href="/company/settings/users/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة مستخدم
        </Link>
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {user.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/company/settings/users/${user.id}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      تعديل
                    </Link>
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
