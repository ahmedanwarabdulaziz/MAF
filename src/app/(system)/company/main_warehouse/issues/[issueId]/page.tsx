import { createClient } from '@/lib/supabase-server'
import { getAuthorizationContext } from '@/lib/authorization-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import IssueApprovalActions from '@/components/StoreIssueApprovalActions'

export default async function MainWarehouseIssueDetailPage({
  params,
}: {
  params: { issueId: string }
}) {
  // AG-PERF-09: single getAuthorizationContext() call — 2 DB queries total.
  // Replaces requirePermission (2q) + dynamic import + 3×hasPermission (6q) = 8 queries.
  const authz = await getAuthorizationContext()
  authz.require('main_warehouse', 'view')
  const canApprovePMPerm = authz.can('main_warehouse', 'approve_pm')
  const canApproveWMPerm = authz.can('main_warehouse', 'approve_wm')
  const canEditPerm = authz.can('main_warehouse', 'edit')

  const supabase = createClient()
  const { data: issue } = await supabase
    .from('store_issues')
    .select(`
      id, document_no, issue_date, status, notes,
      pm_status, wm_status, rejection_reason,
      pm_approved_at, wm_approved_at, confirmed_at,
      approved_by_pm:approved_by_pm ( display_name ),
      approved_by_wm:approved_by_wm ( display_name ),
      warehouse:warehouse_id ( arabic_name ),
      project:project_id ( arabic_name ),
      lines:store_issue_lines (
        id, quantity, unit_cost, total_cost,
        item:item_id ( item_code, arabic_name ),
        unit:unit_id ( arabic_name )
      )
    `)
    .eq('id', params.issueId)
    .single()

  if (!issue) redirect('/company/main_warehouse/issues')

  const warehouse = Array.isArray(issue.warehouse) ? issue.warehouse[0] : issue.warehouse
  const project = Array.isArray(issue.project) ? issue.project[0] : issue.project
  const lines = Array.isArray(issue.lines) ? issue.lines : []
  const totalCost = lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)

  const canApprovePM = canApprovePMPerm && issue.pm_status === 'pending' && issue.status === 'pending_approval'
  const canApproveWM = canApproveWMPerm && issue.wm_status === 'pending' && issue.status === 'pending_approval'
  const canCancel = canEditPerm && ['pending_approval'].includes(issue.status)

  const statusStyle = {
    confirmed: 'bg-success/10 text-success border-success/30',
    pending_approval: 'bg-warning/10 text-warning border-warning/30',
    rejected: 'bg-danger/10 text-danger border-danger/30',
    cancelled: 'bg-secondary/10 text-secondary border-secondary/30',
  } as Record<string, string>

  const statusAr = {
    confirmed: 'معتمد', pending_approval: 'بانتظار الموافقة',
    rejected: 'مرفوض', cancelled: 'ملغي',
  } as Record<string, string>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/company/main_warehouse/issues" className="text-text-secondary hover:text-primary text-sm">
            ← أذون الصرف
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mt-1" dir="ltr">{issue.document_no}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {warehouse?.arabic_name} · {project?.arabic_name ?? 'الشركة الرئيسية'} · {issue.issue_date}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium border ${statusStyle[issue.status] ?? ''}`}>
          {statusAr[issue.status] ?? issue.status}
        </span>
      </div>

      {/* Approval Timeline */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-text-primary mb-4">حالة الموافقة المزدوجة</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: 'pm_status', label: 'موافقة المفوض (Super Admin - 1)', statusVal: issue.pm_status, at: issue.pm_approved_at, by: issue.approved_by_pm },
            { key: 'wm_status', label: 'موافقة أمين المخزن (Super Admin - 2)', statusVal: issue.wm_status, at: issue.wm_approved_at, by: issue.approved_by_wm },
          ].map(({ label, statusVal, at, by }) => (
            <div key={label} className={`rounded-lg p-4 border-2 ${statusVal === 'approved' ? 'border-success/40 bg-success/5' : statusVal === 'rejected' ? 'border-danger/40 bg-danger/5' : 'border-warning/30 bg-warning/5'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${statusVal === 'approved' ? 'text-success' : statusVal === 'rejected' ? 'text-danger' : 'text-warning'}`}>
                  {statusVal === 'approved' ? '✓' : statusVal === 'rejected' ? '✗' : '◷'}
                </span>
                <span className="font-semibold text-text-primary text-sm">{label}</span>
              </div>
              {statusVal === 'approved' && (
                <div className="text-xs text-text-secondary">
                  <div>{(Array.isArray(by) ? (by as any)[0] : by)?.display_name ?? '—'}</div>
                  <div dir="ltr">{at?.split('T')[0]}</div>
                </div>
              )}
              {statusVal === 'pending' && <div className="text-xs text-warning">بانتظار الموافقة</div>}
            </div>
          ))}
        </div>

        {issue.status === 'confirmed' && (
          <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success text-center font-medium">
            ✓ تم تأكيد الصرف وتحديث رصيد المخزون
          </div>
        )}
        {issue.rejection_reason && (
          <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            السبب: {issue.rejection_reason}
          </div>
        )}

        {(canApprovePM || canApproveWM || canCancel) && (
          <div className="mt-6 pt-4 border-t border-border">
            <IssueApprovalActions
              issueId={issue.id}
              projectId="main"
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
            <span className="text-sm font-bold text-primary">الإجمالي: {formatCurrency(totalCost)}</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">كود الصنف</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الصنف</th>
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
                  <td className="px-6 py-4 text-text-secondary" dir="ltr">{Number(line.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 font-medium" dir="ltr">
                    {issue.status === 'confirmed' ? formatCurrency(Number(line.total_cost)) : <span className="text-text-secondary text-xs">يُحدد عند الاعتماد</span>}
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
