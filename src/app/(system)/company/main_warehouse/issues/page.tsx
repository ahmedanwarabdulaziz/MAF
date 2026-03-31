import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import NewIssueDialog from './NewIssueDialog'
import ViewIssueDialog from './ViewIssueDialog'
import IssueApprovalActions from '@/components/StoreIssueApprovalActions'

export default async function MainWarehouseIssuesPage() {
  await requirePermission('main_warehouse', 'view')
  const { hasPermission } = await import('@/lib/auth')
  const [canApprovePMPerm, canApproveWMPerm, canEditPerm] = await Promise.all([
    hasPermission('main_warehouse', 'approve_pm'),
    hasPermission('main_warehouse', 'approve_wm'),
    hasPermission('main_warehouse', 'edit'),
  ])

  const supabase = createClient()

  const supabaseAdmin = createAdminClient()
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('id')
    .limit(1)
    .single()

  const { data: mainWarehouse } = await supabase
    .from('warehouses')
    .select('id, arabic_name, company_id')
    .eq('warehouse_type', 'main_company')
    .single()

  const { data: issues } = mainWarehouse
    ? await supabase
        .from('store_issues')
        .select(`
          id, document_no, issue_date, status, issue_type,
          pm_status, wm_status,
          project:project_id ( arabic_name ),
          cost_center:cost_center_id ( arabic_name, cost_center_code ),
          lines:store_issue_lines ( total_cost )
        `)
        .eq('warehouse_id', mainWarehouse.id)
        .order('issue_date', { ascending: false })
        .order('document_no', { ascending: false })
    : { data: [] }

  const confirmedTotal = issues
    ?.filter(i => i.status === 'confirmed')
    .reduce((acc, i) => {
      const lines = Array.isArray(i.lines) ? i.lines : []
      return acc + lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)
    }, 0) ?? 0

  const internalCount = issues?.filter(i => (i as any).issue_type === 'internal').length ?? 0
  const projectCount = issues?.filter(i => (i as any).issue_type === 'project').length ?? 0

  const statusStyle = (status: string) => {
    if (status === 'confirmed') return 'bg-success/10 text-success'
    if (['rejected', 'cancelled'].includes(status)) return 'bg-danger/10 text-danger'
    return 'bg-warning/10 text-warning'
  }

  const statusAr = (status: string) =>
    ({ confirmed: 'معتمد', pending_approval: 'بانتظار الموافقة', rejected: 'مرفوض', cancelled: 'ملغي', draft: 'مسودة' }[status] ?? status)

  return (
    <div dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">أذون الصرف — المخزن الرئيسي</h1>
          <p className="mt-1 text-sm text-text-secondary">
            صرف المواد من المخزن الرئيسي — داخلي للشركة أو لمشاريع
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right bg-primary/5 rounded-lg px-5 py-2.5 border border-primary/20">
            <div className="text-xs text-text-secondary font-medium mb-0.5">إجمالي المصروف (معتمد)</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(confirmedTotal)}</div>
          </div>
          <NewIssueDialog
            companyId={company?.id ?? ''}
            warehouseId={mainWarehouse?.id ?? ''}
            warehouseName={mainWarehouse?.arabic_name ?? 'المخزن الرئيسي'}
          />
        </div>
      </div>

      {/* Type summary chips */}
      {issues && issues.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-full text-xs font-medium text-primary">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            داخلي للشركة: {internalCount}
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-medium text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            للمشاريع: {projectCount}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-secondary text-right">
              <th className="px-6 py-3 font-semibold text-text-secondary">رقم الإذن</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">التاريخ</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">النوع</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الجهة المستفيدة</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">القيمة الإجمالية</th>
              <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {!issues?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>لا توجد أذون صرف بعد</p>
                  </div>
                </td>
              </tr>
            )}
            {issues?.map((issue: any) => {
              const lines = Array.isArray(issue.lines) ? issue.lines : []
              const total = lines.reduce((s: number, l: any) => s + (Number(l.total_cost) || 0), 0)
              const project = Array.isArray(issue.project) ? issue.project[0] : issue.project
              const costCenter = Array.isArray(issue.cost_center) ? issue.cost_center[0] : issue.cost_center
              const canApprovePM = canApprovePMPerm && issue.pm_status === 'pending' && issue.status === 'pending_approval'
              const canApproveWM = canApproveWMPerm && issue.wm_status === 'pending' && issue.status === 'pending_approval'
              const canCancel = canEditPerm && ['pending_approval'].includes(issue.status)

              const isInternal = issue.issue_type === 'internal'
              const beneficiary = isInternal
                ? costCenter ? `${costCenter.cost_center_code} — ${costCenter.arabic_name}` : 'الشركة الرئيسية'
                : project?.arabic_name ?? 'مشروع غير محدد'

              return (
                <tr key={issue.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary" dir="ltr">{issue.document_no}</td>
                  <td className="px-6 py-4 text-text-secondary">{issue.issue_date}</td>
                  <td className="px-6 py-4">
                    {isInternal ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">داخلي</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">مشروع</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium">{beneficiary}</td>
                  <td className="px-6 py-4 font-medium" dir="ltr">
                    {issue.status === 'confirmed' ? formatCurrency(total) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(issue.status)}`}>
                      {statusAr(issue.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 relative">
                      <ViewIssueDialog 
                        issueId={issue.id} 
                        issue={issue} 
                        canApprovePM={canApprovePM} 
                        canApproveWM={canApproveWM} 
                        canCancel={canCancel} 
                      />
                      {(canApprovePM || canApproveWM || canCancel) && (
                        <div className="shrink-0 whitespace-nowrap">
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
