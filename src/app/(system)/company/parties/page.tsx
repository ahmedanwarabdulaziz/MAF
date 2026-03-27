import { getParties, PartyRoleType } from '@/lib/projects'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import PartiesFilterBar from './PartiesFilterBar'

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

export default async function PartiesPage(props: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>
}) {
  await requireAuth()
  const searchParams = await props.searchParams
  const parties = await getParties({
    q: searchParams.q,
    role_type: searchParams.role as PartyRoleType | undefined,
    status: searchParams.status,
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">الأطراف</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {parties.length} طرف مسجل — ملاك، مقاولون، موردون
          </p>
        </div>
        <Link
          href="/company/parties/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          + إضافة طرف
        </Link>
      </div>

      <PartiesFilterBar />

      {/* Empty state */}
      {parties.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-20">
          <div className="text-4xl mb-4">🤝</div>
          <h2 className="text-lg font-semibold text-text-primary">لا توجد أطراف مسجلة بعد</h2>
          <p className="mt-1 text-sm text-text-secondary">أضف الملاك والمقاولين والموردين هنا</p>
          <Link
            href="/company/parties/new"
            className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            + إضافة طرف
          </Link>
        </div>
      )}

      {/* Table */}
      {parties.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-secondary text-right">
                <th className="px-6 py-3 font-semibold text-text-secondary">الاسم</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">الأدوار</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">الهاتف</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">الحالة</th>
                <th className="px-6 py-3 font-semibold text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party: any) => {
                const activeRoles = party.party_roles?.filter((r: any) => r.is_active) ?? []
                return (
                  <tr key={party.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/company/parties/${party.id}`} className="hover:text-primary transition-colors">
                        <div className="font-medium text-text-primary">{party.arabic_name}</div>
                        {party.english_name && (
                          <div className="text-xs text-text-secondary" dir="ltr">{party.english_name}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {activeRoles.map((r: any) => (
                          <span key={r.role_type}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r.role_type] ?? ROLE_COLORS.other}`}>
                            {ROLE_LABELS[r.role_type] ?? r.role_type}
                          </span>
                        ))}
                        {activeRoles.length === 0 && <span className="text-xs text-text-secondary">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary text-sm" dir="ltr">
                      {party.phone ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${party.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {party.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/company/parties/${party.id}/edit`}
                        title="تعديل"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
