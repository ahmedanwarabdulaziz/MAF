import { createClient } from '@/lib/supabase-server'
import { requireSuperAdmin } from '@/lib/auth'
import { formatDateTimeSeconds } from '@/lib/format'
import AuditDateFilter from './AuditDateFilter'
import DeleteAllLogsButton from './DeleteAllLogsButton'

const ACTION_LABELS: Record<string, string> = {
  // Access / Settings
  grant_scope:               'منح نطاق وصول',
  grant_scope_bulk:          'منح نطاقات متعددة',
  revoke_scope:              'إلغاء نطاق وصول',
  create_permission_group:   'إنشاء مجموعة صلاحيات',
  update_permission_matrix:  'تعديل مصفوفة الصلاحيات',
  create_user:               'إنشاء مستخدم',
  update_user:               'تعديل مستخدم',
  deactivate_user:           'إيقاف مستخدم',
  // Procurement
  pr_created:                    'إنشاء طلب شراء',
  pr_submitted:                  'تقديم طلب شراء',
  pr_approved:                   'اعتماد طلب شراء',
  invoice_created:               'إنشاء فاتورة مورد',
  invoice_updated:               'تعديل فاتورة مورد',
  invoice_submitted_for_receipt: 'إرسال الفاتورة للاستلام',
  receipt_confirmed:             'تأكيد استلام بضاعة',
  // Treasury
  account_created:   'إنشاء حساب مالي',
  account_updated:   'تعديل حساب مالي',
  funds_transferred: 'تحويل أموال',
  manual_deposit:    'إيداع يدوي',
  // Certificates / Agreements
  certificate_created:   'إنشاء مستخلص',
  certificate_submitted: 'تقديم مستخلص',
  certificate_approved:  'اعتماد مستخلص',
  agreement_created:     'إنشاء عقد مقاول باطن',
  agreement_updated:     'تعديل عقد مقاول باطن',
  // Warehouse
  item_created:               'إضافة صنف',
  warehouse_transfer_created: 'إنشاء إذن تحويل',
  // Payments & Custody
  payment_created:  'تسجيل دفعة صرف',
  expense_created:  'تسجيل مصروف نثري',
  expense_approved: 'تحديث حالة مصروف',
  // Misc
  system_check: 'فحص النظام',
}

const ACTION_COLORS: Record<string, string> = {
  // green — creation
  pr_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invoice_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  certificate_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  agreement_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  account_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  item_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warehouse_transfer_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  payment_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  grant_scope: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  grant_scope_bulk: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  create_permission_group: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  create_user: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  manual_deposit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // blue — submit / approve
  pr_submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  pr_approved: 'bg-blue-50 text-blue-700 border-blue-200',
  certificate_submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  certificate_approved: 'bg-blue-50 text-blue-700 border-blue-200',
  receipt_confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  invoice_submitted_for_receipt: 'bg-blue-50 text-blue-700 border-blue-200',
  expense_approved: 'bg-blue-50 text-blue-700 border-blue-200',
  // amber — updates / transfers
  invoice_updated: 'bg-amber-50 text-amber-700 border-amber-200',
  account_updated: 'bg-amber-50 text-amber-700 border-amber-200',
  agreement_updated: 'bg-amber-50 text-amber-700 border-amber-200',
  funds_transferred: 'bg-amber-50 text-amber-700 border-amber-200',
  update_permission_matrix: 'bg-amber-50 text-amber-700 border-amber-200',
  update_user: 'bg-amber-50 text-amber-700 border-amber-200',
  // red — revoke / deactivate
  revoke_scope: 'bg-red-50 text-red-700 border-red-200',
  deactivate_user: 'bg-red-50 text-red-700 border-red-200',
  // grey
  system_check: 'bg-slate-50 text-slate-500 border-slate-200',
}

const ENTITY_LABELS: Record<string, string> = {
  purchase_request:          'طلبات الشراء',
  supplier_invoice:          'فواتير الموردين',
  subcontractor_certificate: 'المستخلصات',
  subcontract_agreement:     'عقود المقاولين',
  financial_account:         'الخزينة',
  payment_voucher:           'المدفوعات',
  petty_expense:             'العهد والمصروفات',
  item:                      'المخزن',
  warehouse_transfer:        'أذون التحويل',
  user_access_scope:         'الصلاحيات',
  permission_group:          'مجموعات الصلاحيات',
}

const PERIODS = [
  { value: 'today',      label: 'اليوم' },
  { value: 'this_month', label: 'هذا الشهر' },
  { value: 'last_90',    label: 'آخر 90 يوم' },
  { value: 'this_year',  label: 'هذا العام' },
  { value: 'all',        label: 'الكل' },
  { value: 'custom',     label: 'نطاق مخصص' },
]

function parseDateInput(val: string | undefined): Date | null {
  if (!val) return null
  // Support dd-mm-yyyy (from text input)
  const dmyMatch = val.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`)
  // Support yyyy-mm-dd fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function getDateRange(period: string, dateFrom?: string, dateTo?: string): { from?: string; to?: string } {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'last_90') {
    const start = new Date(now)
    start.setDate(start.getDate() - 90)
    return { from: start.toISOString() }
  }
  if (period === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { from: start.toISOString() }
  }
  if (period === 'custom') {
    const fromD = parseDateInput(dateFrom)
    const toD = parseDateInput(dateTo)
    if (toD) toD.setHours(23, 59, 59)
    return {
      from: fromD ? fromD.toISOString() : undefined,
      to: toD ? toD.toISOString() : undefined,
    }
  }
  return {}
}

function MetaDetail({ meta }: { meta: Record<string, unknown> }) {
  const LABELS: Record<string, string> = {
    // Access / Settings
    target_user:    'المستخدم المستهدف',
    granted_count:  'النطاقات الممنوحة',
    skipped_count:  'تم تخطيها',
    scopes:         'النطاقات',
    scope_type:     'نوع النطاق',
    project:        'المشروع',
    group_key:      'مفتاح المجموعة',
    arabic_name:    'الاسم',
    assigned_count: 'عدد الصلاحيات',
    scope_id:       'معرف النطاق',
    // Procurement
    request_no:        'رقم الطلب',
    invoice_no:        'رقم الفاتورة',
    lines_count:       'عدد البنود',
    role_type:         'دور المعتمد',
    supplier_party_id: 'معرف المورد',
    // Treasury / Financial
    amount:            'المبلغ',
    total_amount:      'إجمالي المبلغ',
    gross_amount:      'إجمالي قبل الخصم',
    net_amount:        'الصافي',
    payment_method:    'طريقة الدفع',
    account_type:      'نوع الحساب',
    currency:          'العملة',
    opening_balance:   'الرصيد الافتتاحي',
    transfer_date:     'تاريخ التحويل',
    from_account_id:   'الحساب المُرسِل',
    to_account_id:     'الحساب المستلم',
    allocations_count: 'عدد التوزيعات',
    // Certificates / Agreements
    certificate_no:         'رقم المستخلص',
    agreement_code:         'رقم العقد',
    subcontractor_party_id: 'معرف المقاول',
    // Warehouse / Custody
    expense_date: 'تاريخ المصروف',
    transfer_id:  'معرف إذن التحويل',
    item_code:    'كود الصنف',
    action:       'الإجراء',
  }
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined)
  if (!entries.length) return null

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-background-secondary/60 px-4 py-3 text-xs space-y-1.5">
      {entries.map(([k, v]) => {
        const label = LABELS[k] ?? k
        if (Array.isArray(v)) {
          return (
            <div key={k} className="flex gap-2">
              <span className="font-semibold text-text-secondary min-w-[120px] shrink-0">{label}:</span>
              <ul className="space-y-0.5">
                {v.map((item, i) => (
                  <li key={i} className="text-text-primary before:content-['•'] before:ml-1">{String(item)}</li>
                ))}
              </ul>
            </div>
          )
        }
        return (
          <div key={k} className="flex gap-2">
            <span className="font-semibold text-text-secondary min-w-[120px] shrink-0">{label}:</span>
            <span className="text-text-primary">{String(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: {
    action?: string
    user_id?: string
    entity_type?: string
    page?: string
    period?: string
    date_from?: string
    date_to?: string
  }
}) {
  await requireSuperAdmin()
  const supabase = createClient()

  const PAGE_SIZE = 50
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const rowFrom = (page - 1) * PAGE_SIZE
  const rowTo = rowFrom + PAGE_SIZE - 1
  const period = searchParams.period ?? 'today'

  // Compute date range
  const dateRange = getDateRange(period, searchParams.date_from, searchParams.date_to)

  let query = supabase
    .from('audit_logs')
    .select('id, performed_by, action, entity_type, entity_id, description, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(rowFrom, rowTo)

  if (searchParams.action)      query = query.eq('action', searchParams.action)
  if (searchParams.user_id)     query = query.eq('performed_by', searchParams.user_id)
  if (searchParams.entity_type) query = query.eq('entity_type', searchParams.entity_type)
  if (dateRange.from) query = query.gte('created_at', dateRange.from)
  if (dateRange.to)   query = query.lte('created_at', dateRange.to)

  const { data: logs, count } = await query

  const { data: users } = await supabase.from('users').select('id, display_name, email')
  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Stats
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())
  const uniqueActors = new Set((logs ?? []).map(l => l.performed_by).filter(Boolean)).size

  const statCards = [
    { label: 'السجلات في الفترة', value: (count ?? 0).toLocaleString('en-US') },
    { label: 'أحداث اليوم', value: (todayCount ?? 0).toLocaleString('en-US') },
    { label: 'مستخدمون نشطون في الفترة', value: uniqueActors.toLocaleString('en-US') },
    { label: 'نوع الأحداث المدعومة', value: Object.keys(ACTION_LABELS).length.toLocaleString('en-US') },
  ]

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">سجل النشاط والتدقيق</h1>
          <p className="mt-1 text-sm text-text-secondary">سجل كامل بجميع العمليات مع التفاصيل الدقيقة لكل تغيير.</p>
        </div>
        <DeleteAllLogsButton />
      </div>

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
            <div className="text-2xl font-bold text-text-primary">{s.value}</div>
            <div className="mt-0.5 text-xs text-text-secondary">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" className="mb-6 space-y-4">
        {/* Period presets — links, not submit buttons, to avoid form value collision */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => {
            const params = new URLSearchParams()
            if (searchParams.action)      params.set('action', searchParams.action)
            if (searchParams.user_id)     params.set('user_id', searchParams.user_id)
            if (searchParams.entity_type) params.set('entity_type', searchParams.entity_type)
            params.set('period', p.value)
            return (
              <a
                key={p.value}
                href={`?${params.toString()}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  period === p.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-secondary border-border hover:border-primary/50 hover:text-primary'
                }`}
              >
                {p.label}
              </a>
            )
          })}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <AuditDateFilter
              currentAction={searchParams.action}
              currentUserId={searchParams.user_id}
              currentPeriod={period}
              currentDateFrom={searchParams.date_from}
              currentDateTo={searchParams.date_to}
            />
        )}

        {/* Action + user filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">الوحدة</label>
            <select name="entity_type" defaultValue={searchParams.entity_type ?? ''} className="rounded-lg border border-border bg-white px-3 py-2 text-sm min-w-[150px]">
              <option value="">— الكل —</option>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">نوع العملية</label>
            <select name="action" defaultValue={searchParams.action ?? ''} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <option value="">— الكل —</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">المستخدم</label>
            <select name="user_id" defaultValue={searchParams.user_id ?? ''} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <option value="">— الكل —</option>
              {(users ?? []).map(u => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>
          {/* Preserve current period when submitting action/user filter */}
          <input type="hidden" name="period" value={period} />
          {period === 'custom' && searchParams.date_from && <input type="hidden" name="date_from" value={searchParams.date_from} />}
          {period === 'custom' && searchParams.date_to   && <input type="hidden" name="date_to"   value={searchParams.date_to} />}
          <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
            تصفية
          </button>
          <a href="/company/settings/audit-log" className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-text-secondary hover:bg-background-secondary transition-colors">
            إعادة ضبط
          </a>
        </div>
      </form>

      {/* Log entries */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-background-secondary px-6 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-sm">
            السجلات{' '}
            {count !== null && <span className="text-text-secondary font-normal">({count} إجمالي)</span>}
          </h2>
          <span className="text-xs text-text-secondary">صفحة {page} من {totalPages || 1}</span>
        </div>

        {!logs?.length ? (
          <div className="px-6 py-14 text-center text-sm text-text-secondary">لا توجد سجلات في الفترة المحددة</div>
        ) : (
          <div className="divide-y divide-border/50">
            {logs.map(log => {
              const actor = userMap[log.performed_by ?? '']
              const meta = log.metadata as Record<string, unknown> | null
              const SCOPE_ACTIONS = ['grant_scope', 'grant_scope_bulk']
              const targetUserName: string | null =
                (meta?.target_user as string | undefined) ??
                (SCOPE_ACTIONS.includes(log.action) && log.entity_id
                  ? userMap[log.entity_id]?.display_name ?? null
                  : null)

              const dt = formatDateTimeSeconds(log.created_at)

              return (
                <div key={log.id} className="px-6 py-4 hover:bg-background-secondary/20 transition-colors">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  {log.entity_type && ENTITY_LABELS[log.entity_type] && (
                    <span className="inline-flex items-center rounded-full border border-border bg-background-secondary px-2.5 py-0.5 text-xs text-text-secondary">
                      {ENTITY_LABELS[log.entity_type]}
                    </span>
                  )}
                  <span className="text-xs text-text-secondary" dir="ltr">{dt}</span>
                </div>

                  <div className="text-sm font-semibold text-text-primary mb-2">{log.description}</div>

                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-secondary">بواسطة:</span>
                      <span className="font-semibold text-text-primary">
                        {actor?.display_name ?? <span className="italic text-text-secondary">النظام</span>}
                      </span>
                      {actor?.email && <span className="text-text-secondary" dir="ltr">({actor.email})</span>}
                    </div>
                    {targetUserName && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-secondary">على المستخدم:</span>
                        <span className="font-bold text-primary">{targetUserName}</span>
                      </div>
                    )}
                  </div>

                  {meta && Object.keys(meta).length > 0 && (
                    <MetaDetail meta={Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'target_user'))} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <a
              href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`}
              className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-text-secondary opacity-40' : 'text-primary hover:underline'}`}
            >
              → السابق
            </a>
            <span className="text-xs text-text-secondary">
              {rowFrom + 1}–{Math.min(rowTo + 1, count ?? 0)} من {count}
            </span>
            <a
              href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`}
              className={`text-sm font-medium ${page >= totalPages ? 'pointer-events-none text-text-secondary opacity-40' : 'text-primary hover:underline'}`}
            >
              التالي ←
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
