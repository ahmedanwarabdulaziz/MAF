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

  // Fetch scopes without relying on implicit FK joins
  const { data: rawScopes } = await supabase
    .from('user_access_scopes')
    .select('id, user_id, scope_type, project_id, warehouse_id, is_active, granted_at')
    .order('is_active', { ascending: false })
    .order('granted_at', { ascending: false })

  // Fetch users for lookup
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, display_name, email')

  // Fetch projects for lookup
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, arabic_name, project_code')

  // Build lookup maps
  const userMap = Object.fromEntries((allUsers ?? []).map(u => [u.id, u]))
  const projectMap = Object.fromEntries((allProjects ?? []).map(p => [p.id, p]))

  const scopes = (rawScopes ?? []).map(s => ({
    ...s,
    user: userMap[s.user_id] ?? null,
    project: s.project_id ? projectMap[s.project_id] ?? null : null,
  }))

  // Users list for form (active, non-super-admin)
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_active', true)
    .eq('is_super_admin', false)
    .order('display_name')

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
          <h1 className="text-2xl font-bold text-text-primary">نطاق الوصول</h1>
          <p className="mt-1 text-sm text-text-secondary">
            إدارة صلاحيات وصول المستخدمين للشركة والمشروعات. بدون النطاق الصحيح لن يتمكن المستخدم من الوصول لبيانات المشاريع حتى لو كان يمتلك الصلاحية الخاصة بها.
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
          <h2 className="font-semibold text-text-primary">منح تفويض نطاق وصول جديد</h2>
        </div>
        <GrantScopeForm users={users ?? []} projects={projects ?? []} />
      </div>

      {/* Scope table — grouped by user, collapsible */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-background-secondary px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">النطاقات الممنوحة الحالية</h2>
          <span className="text-xs text-text-secondary">{scopes.length} نطاق</span>
        </div>
        <ScopesList scopes={scopes} />
      </div>
    </div>
  )
}
