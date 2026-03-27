import { getParty } from '@/lib/projects'
import { requirePermission } from '@/lib/auth'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EditPartyForm from '../EditPartyForm'

interface Props { params: { id: string } }

export default async function EditPartyPage({ params }: Props) {
  await requirePermission('party_masters', 'view')
  const party = await getParty(params.id)
  if (!party) notFound()

  const p = party as any

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/company/parties" className="hover:text-primary transition-colors">الأطراف</Link>
        <span>←</span>
        <Link href={`/company/parties/${p.id}`} className="hover:text-primary transition-colors">{p.arabic_name}</Link>
        <span>←</span>
        <span className="text-text-primary font-medium">تعديل</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">تعديل بيانات الطرف</h1>
        <p className="mt-1 text-sm text-text-secondary">تحديث بيانات {p.arabic_name}</p>
      </div>

      <EditPartyForm
        party={{
          id:             p.id,
          arabic_name:    p.arabic_name,
          english_name:   p.english_name ?? null,
          tax_number:     p.tax_number ?? null,
          commercial_reg: p.commercial_reg ?? null,
          phone:          p.phone ?? null,
          email:          p.email ?? null,
          address:        p.address ?? null,
          city:           p.city ?? null,
          notes:          p.notes ?? null,
          is_active:      p.is_active,
          party_roles:    p.party_roles ?? [],
        }}
        backHref={`/company/parties/${p.id}`}
      />
    </div>
  )
}
