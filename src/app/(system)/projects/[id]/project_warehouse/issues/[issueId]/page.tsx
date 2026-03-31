import { createClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import IssueApprovalActions from '@/components/StoreIssueApprovalActions'

export default async function ProjectStoreIssueDetailPage({
  params,
}: {
  params: { id: string; issueId: string }
}) {
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(params.issueId);
  if (!params.issueId || !isUUID) notFound();

  await requirePermission('project_warehouse', 'view')
  const supabase = createClient()

  const { data: issue, error: issueError } = await supabase
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
    .eq('id', params.issueId)
    .single()

  if (issueError || !issue) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
        <p className="text-danger font-medium mb-2">تعذّر تحميل بيانات إذن الصرف</p>
        <p className="text-sm text-text-secondary mb-4">{issueError?.message ?? 'Issue not found'}</p>
        <a href={`/projects/${params.id}/project_warehouse/issues`} className="text-sm text-primary underline">
          ← العودة لقائمة أذون الصرف
        </a>
      </div>
    )
  }

  // Check exact permission actions — each button only shows if the user's
  // permission group explicitly grants that specific action.
  const { hasPermission } = await import('@/lib/auth')

  const [canApprovePMPerm, canApproveWMPerm, canEditPerm, isSuperAdminCheck] = await Promise.all([
    hasPermission('project_warehouse', 'approve_pm'),
    hasPermission('project_warehouse', 'approve_wm'),
    hasPermission('project_warehouse', 'edit'),
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      const { data: cu } = await supabase.from('users').select('is_super_admin').eq('id', u?.id ?? '').single()
      return cu?.is_super_admin ?? false
    })(),
  ])

  const isSuperAdmin = isSuperAdminCheck

  const canApprovePM = canApprovePMPerm &&
    (issue as any).pm_status === 'pending' &&
    (issue as any).status === 'pending_approval'

  const canApproveWM = canApproveWMPerm &&
    (issue as any).wm_status === 'pending' &&
    (issue as any).status === 'pending_approval'

  const canCancel = (isSuperAdmin || canEditPerm) &&
    ['pending_approval'].includes((issue as any).status ?? '')


  const warehouse = Array.isArray(issue.warehouse) ? issue.warehouse[0] : issue.warehouse
  const lines = Array.isArray(issue.lines) ? issue.lines : []
  const totalCost = lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)

  const statusStyle = {
    confirmed: 'bg-success/10 text-success border-success/30',
    pending_approval: 'bg-warning/10 text-warning border-warning/30',
    rejected: 'bg-danger/10 text-danger border-danger/30',
    cancelled: 'bg-secondary/10 text-secondary border-secondary/30',
    draft: 'bg-secondary/10 text-secondary border-secondary/30',
  } as Record<string, string>

  const statusAr = {
    confirmed: 'معتمد',
    pending_approval: 'بانتظار الموافقة',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
    draft: 'مسودة',
  } as Record<string, string>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href={`/projects/${params.id}/project_warehouse/issues`}
              className="text-text-secondary hover:text-primary text-sm"
            >
              ← أذون الصرف
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-text-primary" dir="ltr">
            {issue.document_no}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {warehouse?.arabic_name} · {issue.issue_date}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium border ${statusStyle[issue.status] ?? ''}`}
        >
          {statusAr[issue.status] ?? issue.status}
        </span>
      </div>

      {/* Approval Timeline */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-text-primary mb-6">حالة الموافقة المزدوجة</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* PM Approval */}
          <div
            className={`rounded-lg p-4 border-2 ${
              issue.pm_status === 'approved'
                ? 'border-success/40 bg-success/5'
                : issue.pm_status === 'rejected'
                ? 'border-danger/40 bg-danger/5'
                : 'border-warning/30 bg-warning/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-lg ${
                  issue.pm_status === 'approved'
                    ? 'text-success'
                    : issue.pm_status === 'rejected'
                    ? 'text-danger'
                    : 'text-warning'
                }`}
              >
                {issue.pm_status === 'approved' ? '✓' : issue.pm_status === 'rejected' ? '✗' : '◷'}
              </span>
              <span className="font-semibold text-text-primary">موافقة مدير المشروع</span>
            </div>
            {issue.pm_status === 'approved' && (
              <div className="text-xs text-text-secondary">
                <div>
                  {(Array.isArray(issue.approved_by_pm)
                    ? (issue.approved_by_pm as any)[0]
                    : issue.approved_by_pm)?.display_name ?? '—'}
                </div>
                <div dir="ltr">{issue.pm_approved_at?.split('T')[0]}</div>
              </div>
            )}
            {issue.pm_status === 'pending' && (
              <div className="text-xs text-warning">بانتظار موافقة مدير المشروع</div>
            )}
          </div>

          {/* WM Approval */}
          <div
            className={`rounded-lg p-4 border-2 ${
              issue.wm_status === 'approved'
                ? 'border-success/40 bg-success/5'
                : issue.wm_status === 'rejected'
                ? 'border-danger/40 bg-danger/5'
                : 'border-warning/30 bg-warning/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-lg ${
                  issue.wm_status === 'approved'
                    ? 'text-success'
                    : issue.wm_status === 'rejected'
                    ? 'text-danger'
                    : 'text-warning'
                }`}
              >
                {issue.wm_status === 'approved' ? '✓' : issue.wm_status === 'rejected' ? '✗' : '◷'}
              </span>
              <span className="font-semibold text-text-primary">موافقة أمين المخزن</span>
            </div>
            {issue.wm_status === 'approved' && (
              <div className="text-xs text-text-secondary">
                <div>
                  {(Array.isArray(issue.approved_by_wm)
                    ? (issue.approved_by_wm as any)[0]
                    : issue.approved_by_wm)?.display_name ?? '—'}
                </div>
                <div dir="ltr">{issue.wm_approved_at?.split('T')[0]}</div>
              </div>
            )}
            {issue.wm_status === 'pending' && (
              <div className="text-xs text-warning">بانتظار موافقة أمين المخزن</div>
            )}
          </div>
        </div>

        {issue.status === 'confirmed' && (
          <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success text-center font-medium">
            ✓ تم تأكيد الصرف وتحديث رصيد المخزون بالمتوسط الموزون
          </div>
        )}
        {issue.rejection_reason && (
          <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            سبب الرفض / الإلغاء: {issue.rejection_reason}
          </div>
        )}

        {/* Approval action buttons */}
        {(canApprovePM || canApproveWM || canCancel) && (
          <div className="mt-6 pt-4 border-t border-border">
            <IssueApprovalActions
              issueId={issue.id}
              projectId={params.id}
              canApprovePM={canApprovePM}
              canApproveWM={canApproveWM}
              canCancel={canCancel}
            />
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-background-secondary flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">الأصناف المصروفة</h2>
          {issue.status === 'confirmed' && (
            <span className="text-sm font-bold text-primary">
              الإجمالي: {formatCurrency(totalCost)}
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">اسم الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الوحدة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الكمية</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">متوسط التكلفة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line: any) => {
              const item = Array.isArray(line.item) ? line.item[0] : line.item
              const unit = Array.isArray(line.unit) ? line.unit[0] : line.unit
              return (
                <tr key={line.id} className="border-b border-border/50 hover:bg-background/50">
                  <td className="px-6 py-4 font-mono text-xs text-primary" dir="ltr">{item?.item_code}</td>
                  <td className="px-6 py-4 font-medium">{item?.arabic_name}</td>
                  <td className="px-6 py-4 text-text-secondary">{unit?.arabic_name}</td>
                  <td className="px-6 py-4 font-bold" dir="ltr">{Number(line.quantity).toLocaleString()}</td>
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">
                    {Number(line.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 font-medium" dir="ltr">
                    {issue.status === 'confirmed'
                      ? formatCurrency(Number(line.total_cost))
                      : <span className="text-text-secondary text-xs">يُحدد عند الاعتماد</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {issue.notes && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-text-primary mb-2">ملاحظات</h2>
          <p className="text-sm text-text-secondary">{issue.notes}</p>
        </div>
      )}
    </div>
  )
}
