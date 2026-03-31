'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function updateCompanyAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'غير مصرح لك بالقيام بهذا الإجراء' }

  // Check super admin
  const { data: profile } = await supabase
    .from('users').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return { error: 'صلاحيات غير كافية' }

  const companyId = formData.get('id') as string

  const payload = {
    arabic_name: formData.get('arabic_name') as string,
    english_name: (formData.get('english_name') as string) || null,
    short_code: (formData.get('short_code') as string) || null,
    country: (formData.get('country') as string) || null,
    city: (formData.get('city') as string) || null,
    address: (formData.get('address') as string) || null,
    tax_number: (formData.get('tax_number') as string) || null,
    commercial_reg: (formData.get('commercial_reg') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
  }

  const { error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', companyId)

  if (error) {
    console.error('Update company error:', error)
    return { error: 'حدث خطأ أثناء تحديث بيانات الشركة' }
  }

  revalidatePath('/company/settings/company')
  return { success: true }
}
