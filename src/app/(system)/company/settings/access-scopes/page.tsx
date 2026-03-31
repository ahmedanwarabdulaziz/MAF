import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import GrantScopeForm from './GrantScopeForm'
import ScopesList from './ScopesList'

const SCOPE_LABELS: Record<string, string> = {
  main_company: 'الشركة الرئيسية',
  all_projects: 'جميع المشاريع',
  selected_project: 'مشروع محدد',
  selected_warehouse: 'مخزن محدد',
}

export default async function AccessScopesPage() {
  await requireSuperAdmin()
  const supabase = createClient()

  // Fetch scopes from the unified table
  const { data: rawScopes } = await supabase
    .from('user_permission_group_assignments')
    .select('id, user_id, permission_group_id, scope_type, project_id, warehouse_id, is_active, assigned_at')
    .order('is_active', { ascending: false })
    .order('assigned_at', { ascending: false })

  // Fetch users for lookup
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, display_name, email')

  // Fetch projects for lookup
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')

  // Fetch permission groups (Role Templates)
  const { data: roleTemplates } = await supabase
    .from('permission_groups')
    .select('id, arabic_name')

  // Build lookup maps
  const userMap = Object.fromEntries((allUsers ?? []).map(u => [u.id, u]))
  const projectMap = Object.fromEntries((allProjects ?? []).map(p => [p.id, p]))
  const roleMap = Object.fromEntries((roleTemplates ?? []).map(r => [r.id, r]))

  const scopes = (rawScopes ?? []).map(s => ({
    ...s,
    user: userMap[s.user_id] ?? null,
    project: s.project_id ? projectMap[s.project_id] ?? null : null,
    role: roleMap[s.permission_group_id] ?? null,
    granted_at: s.assigned_at, // mapped for legacy component compatibility
  }))

  // Users list for form — all active non-super-admin users can always add more scopes
  const { data: allUsersForForm } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_active', true)
    .eq('is_super_admin', false)
    .order('display_name')

  const users = allUsersForForm ?? []

  const { data: projects } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')
    .is('archived_at', null)
    .order('arabic_name')


  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">فريق العمل والصلاحيات</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة تعيين المستخدمين في المشاريع وربطهم بالقوالب الوظيفية لتحديد مستوى الصلاحيات بدقة.
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
        <svg className="h-5 w-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-primary font-semibold">قاعدة هامة للوصول</p>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            يجب أن يكون لدى مدير المشروع صلاحية <strong>مشروع محدد</strong> للوصول لمنصة مشروعه. أما مديري الإدارة العليا فيجب منحهم <strong>جميع المشاريع</strong> أو <strong>الشركة الرئيسية</strong> حسب الاختصاص.
          </p>
        </div>
      </div>

      {/* Grant form */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-background-secondary px-6 py-4">
          <h2 className="font-semibold text-text-primary">تعيين موظف وتحديد صلاحياته</h2>
        </div>
        <GrantScopeForm users={users ?? []} projects={projects ?? []} roleTemplates={roleTemplates ?? []} />
      </div>

      {/* Scope table — grouped by user, collapsible */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-background-secondary px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">تعيينات فرق العمل الحالية</h2>
          <span className="text-xs text-text-secondary">{scopes.length} نطاق</span>
        </div>
        <ScopesList scopes={scopes} projects={projects ?? []} roleTemplates={roleTemplates ?? []} />
      </div>
    </div>
  )
}
