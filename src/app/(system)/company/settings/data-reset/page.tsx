import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getResetObjectCounts } from './actions'
import DataResetClient from './DataResetClient'

export const metadata = {
  title: 'إعادة تعيين البيانات | الإعدادات'
}

export default async function DataResetPage() {
  // Super-admin only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    redirect('/company/settings/company')
  }

  const counts = await getResetObjectCounts()

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-text-primary">إعادة تعيين البيانات</h1>
        <p className="text-sm text-text-secondary mt-1">
          حذف فئات محددة من البيانات المُدخلة. متاح للمديرين العامين فقط.
        </p>
      </div>

      <DataResetClient initialCounts={counts} />
    </div>
  )
}
