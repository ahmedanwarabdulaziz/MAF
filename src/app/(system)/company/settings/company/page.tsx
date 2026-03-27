import { getCompany } from '@/lib/projects'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function CompanySettingsPage() {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('is_super_admin').eq('id', authUser.id).single()
  if (!profile?.is_super_admin) redirect('/company')

  const company = await getCompany()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">بيانات الشركة</h1>
        <p className="mt-1 text-sm text-text-secondary">بيانات الكيان القانوني للشركة</p>
      </div>

      {!company ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <p className="text-text-secondary text-sm">لم يتم تسجيل بيانات الشركة بعد</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {(company as any).arabic_name?.[0] ?? 'ش'}
            </div>
            <div>
              <div className="text-xl font-bold text-text-primary">{(company as any).arabic_name}</div>
              {(company as any).english_name && (
                <div className="text-sm text-text-secondary" dir="ltr">{(company as any).english_name}</div>
              )}
              <span className="inline-flex mt-1 items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                نشطة
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              { label: 'الرمز المختصر', value: (company as any).short_code },
              { label: 'الدولة', value: (company as any).country },
              { label: 'الرقم الضريبي', value: (company as any).tax_number },
              { label: 'السجل التجاري', value: (company as any).commercial_reg },
              { label: 'الهاتف', value: (company as any).phone },
              { label: 'البريد الإلكتروني', value: (company as any).email },
              { label: 'المدينة', value: (company as any).city },
              { label: 'العنوان', value: (company as any).address },
            ].map(item => (
              <div key={item.label}>
                <dt className="text-xs text-text-secondary">{item.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-text-primary" dir={item.label.includes('رمز') || item.label.includes('رقم') || item.label.includes('سجل') ? 'ltr' : 'rtl'}>
                  {item.value ?? <span className="text-text-secondary/50">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-text-secondary">
              لتعديل بيانات الشركة يرجى التواصل مع فريق الإدارة
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
