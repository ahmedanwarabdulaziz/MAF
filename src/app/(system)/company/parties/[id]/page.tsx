import { getParty } from '@/lib/projects'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك', subcontractor: 'مقاول', supplier: 'مورد', consultant: 'مستشار', other: 'آخر',
}
const ROLE_COLORS: Record<string, string> = {
  owner:         'bg-navy/10 text-navy',
  subcontractor: 'bg-primary/10 text-primary',
  supplier:      'bg-success/10 text-success',
  consultant:    'bg-amber-100 text-amber-700',
  other:         'bg-border text-text-secondary',
}

interface Props { params: { id: string } }

export default async function PartyShowPage({ params }: Props) {
  await requireAuth()
  const party = await getParty(params.id)
  if (!party) notFound()
  const p = party as any
  const activeRoles = (p.party_roles ?? []).filter((r: any) => r.is_active)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/parties" className="hover:text-primary transition-colors">الأطراف</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">{p.arabic_name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{p.arabic_name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              {p.is_active ? 'نشط' : 'موقوف'}
            </span>
          </div>
          {p.english_name && <div className="mt-1 text-sm text-text-secondary" dir="ltr">{p.english_name}</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeRoles.map((r: any) => (
              <span key={r.id} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[r.role_type] ?? ROLE_COLORS.other}`}>
                {ROLE_LABELS[r.role_type] ?? r.role_type}
              </span>
            ))}
          </div>
        </div>
        <Link
          href={`/company/parties/${p.id}/edit`}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          تعديل
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Contact info */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-text-primary">بيانات التواصل</h2>
          <dl className="space-y-3 text-sm">
            {[
              { label: 'الهاتف',        value: p.phone },
              { label: 'البريد',        value: p.email },
              { label: 'الرقم الضريبي', value: p.tax_number },
              { label: 'السجل التجاري', value: p.commercial_reg },
              { label: 'العنوان',       value: p.address },
              { label: 'المدينة',       value: p.city },
            ].map(item => item.value ? (
              <div key={item.label} className="flex justify-between gap-2">
                <span className="text-text-secondary shrink-0">{item.label}</span>
                <span className="font-medium text-text-primary text-left" dir="ltr">{item.value}</span>
              </div>
            ) : null)}
          </dl>
          {p.notes && <div className="mt-4 rounded-lg bg-background-secondary p-3 text-sm text-text-secondary">{p.notes}</div>}
        </div>

        {/* Role accounts */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-text-primary">الحسابات المستقلة</h2>
          <div className="space-y-2">
            {(p.party_role_accounts ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">لا توجد حسابات</p>
            ) : (p.party_role_accounts ?? []).map((acc: any) => (
              <div key={acc.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ROLE_COLORS[acc.role_type] ?? ROLE_COLORS.other}`}>
                    {ROLE_LABELS[acc.role_type] ?? acc.role_type}
                  </span>
                  <span className={`text-xs ${acc.status === 'active' ? 'text-success' : 'text-text-secondary'}`}>
                    {acc.status === 'active' ? 'نشط' : acc.status}
                  </span>
                </div>
                {acc.account_code && <div className="mt-1 text-xs text-text-secondary" dir="ltr">كود: {acc.account_code}</div>}
                <div className="mt-1 text-xs text-text-secondary">{acc.project_id ? 'مشروع محدد' : 'مستوى الشركة'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-text-primary">جهات الاتصال</h2>
          <div className="space-y-2">
            {(p.party_contacts ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">لا توجد جهات اتصال مسجلة</p>
            ) : (p.party_contacts ?? []).map((c: any) => (
              <div key={c.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm text-text-primary">{c.full_name}</div>
                  {c.is_primary && <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5">رئيسي</span>}
                </div>
                {c.job_title && <div className="text-xs text-text-secondary">{c.job_title}</div>}
                {c.phone && <div className="text-xs text-text-secondary" dir="ltr">{c.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked projects */}
      {(p.project_parties ?? []).length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-text-primary">المشروعات المرتبطة</h2>
          <div className="flex flex-wrap gap-2">
            {(p.project_parties ?? []).map((pp: any) => (
              <Link
                key={pp.id}
                href={`/company/projects/${pp.projects?.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-background-secondary transition-colors"
              >
                <span className="font-medium text-text-primary">{pp.projects?.arabic_name}</span>
                <span className="text-xs text-text-secondary">{ROLE_LABELS[pp.project_role] ?? pp.project_role}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
