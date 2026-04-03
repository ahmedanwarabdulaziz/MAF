import { createClient } from '@/lib/supabase-server'
import { getAuthorizationContext } from '@/lib/authorization-context'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import NewStoreIssueDialog from './NewStoreIssueDialog'
import { StoreIssueRowActions } from './StoreIssueRowActions'

export default async function ProjectStoreIssuesPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  // PERF-06 pilot: getAuthorizationContext() fetches group assignments + full
  // permission set in 2 DB queries total, regardless of how many can() checks follow.
  // Previously: requirePermission (2q) + 3×hasPermission (6q each) = up to 8 queries.
  // Now: 2 queries total for all permission work + getSystemUser() is cached.
  const [authz, projectResult] = await Promise.all([
    getAuthorizationContext({ projectId: params.id }),
    supabase.from('projects').select('id, company_id').eq('id', params.id).single(),
  ])

  authz.require('project_warehouse', 'view')
  const isSuperAdmin = authz.isSuperAdmin
  const canApprovePMPerm = authz.can('project_warehouse', 'approve_pm')
  const canApproveWMPerm = authz.can('project_warehouse', 'approve_wm')
  const canEditPerm = authz.can('project_warehouse', 'edit')
  const project = projectResult.data
  const canCancelPerm = isSuperAdmin || canEditPerm

  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, arabic_name')
    .eq('project_id', params.id)
    .eq('is_active', true)


  const { data: issues } = await supabase
    .from('store_issues')
    .select(`
      id, document_no, issue_date, status, notes,
      pm_status, wm_status, rejection_reason,
      pm_approved_at, wm_approved_at,
      approved_by_pm:approved_by_pm ( display_name ),
      approved_by_wm:approved_by_wm ( display_name ),
      confirmed_by:confirmed_by ( display_name ),
      confirmed_at,
      warehouse:warehouse_id ( id, arabic_name ),
      lines:store_issue_lines (
        id, quantity, unit_cost, total_cost,
        item:item_id ( item_code, arabic_name ),
        unit:unit_id ( arabic_name )
      )
    `)
    .eq('project_id', params.id)
    .order('issue_date', { ascending: false })
    .order('document_no', { ascending: false })

  const confirmedTotal = issues
    ?.filter(i => i.status === 'confirmed')
    .reduce((acc, i) => {
      const lines = Array.isArray(i.lines) ? i.lines : []
      return acc + lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)
    }, 0) ?? 0

  const statusLabel = (status: string, pm: string, wm: string) => {
    if (status === 'confirmed') return { label: 'معتمد', cls: 'bg-success/10 text-success' }
    if (status === 'rejected' || status === 'cancelled')
      return { label: status === 'rejected' ? 'مرفوض' : 'ملغي', cls: 'bg-danger/10 text-danger' }
    // pending_approval — show who approved so far
    const parts = []
    if (pm === 'approved') parts.push('م.مشروع ✓')
    if (wm === 'approved') parts.push('أمين مخزن ✓')
    const label = parts.length ? `بانتظار موافقة (${parts.join(' ')})` : 'بانتظار موافقة'
    return { label, cls: 'bg-warning/10 text-warning' }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أذون الصرف المخزني</h1>
          <p className="mt-1 text-sm text-text-secondary">
            صرف المواد من مخزن المشروع — مصدر تكلفة المشروع
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-left bg-primary/5 rounded-lg px-5 py-2.5 border border-primary/20">
            <div className="text-xs text-text-secondary font-medium mb-0.5">إجمالي المصروف (معتمد)</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(confirmedTotal)}</div>
          </div>
          <NewStoreIssueDialog
            companyId={project?.company_id ?? ''}
            projectId={params.id}
            warehouses={warehouses ?? []}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">رقم الإذن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">التاريخ</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">المخزن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">إجمالي القيمة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary"></th>
            </tr>
          </thead>
          <tbody>
            {!issues?.length && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-text-secondary">
                  لا توجد أذون صرف بعد. أضف أول إذن صرف.
                </td>
              </tr>
            )}
            {issues?.map((issue: any) => {
              const warehouse = Array.isArray(issue.warehouse) ? issue.warehouse[0] : issue.warehouse
              const lines = Array.isArray(issue.lines) ? issue.lines : []
              const total = lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)
              const { label, cls } = statusLabel(issue.status, issue.pm_status, issue.wm_status)

              const canApprovePM = canApprovePMPerm &&
                issue.pm_status === 'pending' &&
                issue.status === 'pending_approval'

              const canApproveWM = canApproveWMPerm &&
                issue.wm_status === 'pending' &&
                issue.status === 'pending_approval'

              const canCancel = canCancelPerm &&
                ['pending_approval'].includes(issue.status ?? '')

              return (
                <tr key={issue.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary" dir="ltr">{issue.document_no}</td>
                  <td className="px-6 py-4 text-text-secondary">{issue.issue_date}</td>
                  <td className="px-6 py-4 font-medium">{warehouse?.arabic_name ?? '—'}</td>
                  <td className="px-6 py-4 font-medium" dir="ltr">
                    {issue.status === 'confirmed' ? formatCurrency(total) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
                      {label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <StoreIssueRowActions
                      issue={issue}
                      projectId={params.id}
                      canApprovePM={canApprovePM}
                      canApproveWM={canApproveWM}
                      canCancel={canCancel}
                    />
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
