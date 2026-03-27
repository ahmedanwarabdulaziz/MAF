import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createCustodyAccount } from '@/actions/custody'

export const metadata = {
  title: 'تأسيس عهدة جديدة | نظام إدارة المقاولات'
}

export default async function NewCustodyAccountPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  
  // Fetch users for the dropdown (in a real app, this might be filtered by project team)
  const { data: users } = await supabase.from('users').select('id, display_name, email').eq('is_active', true)

  async function handleSubmit(formData: FormData) {
    'use server'
    const employee_user_id = formData.get('employee_user_id') as string
    const account_type = formData.get('account_type') as 'permanent' | 'temporary'
    const limit = Number(formData.get('allowed_negative_limit')) || 0
    const notes = formData.get('notes') as string

    await createCustodyAccount({
      project_id: params.id,
      employee_user_id,
      account_type,
      allowed_negative_limit: limit,
      notes
    })

    redirect(`/projects/${params.id}/custody`)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="pb-4 border-b">
        <h1 className="text-2xl font-bold tracking-tight">تأسيس عهدة جديدة لموظف</h1>
        <p className="text-muted-foreground mt-1">
          قم بربط مهندس أو موظف بعهدة (مؤقتة أو مستديمة) داخل هذا المشروع.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="employee_user_id" className="text-sm font-medium">اسم الموظف / المهندس</label>
          <select 
            id="employee_user_id" 
            name="employee_user_id" 
            required 
            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">-- اختر المهندس --</option>
            {users?.map(u => (
              <option key={u.id} value={u.id}>{u.display_name} ({u.email.split('@')[0]})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="account_type" className="text-sm font-medium">نوع العهدة</label>
          <select 
            id="account_type" 
            name="account_type"
            required
            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="temporary">مؤقتة</option>
            <option value="permanent">مستديمة</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="allowed_negative_limit" className="text-sm font-medium">الحد الأقصى للعجز المسموح (بالسالب)</label>
          <input 
            type="number" 
            id="allowed_negative_limit" 
            name="allowed_negative_limit" 
            defaultValue={0}
            min={0}
            step={0.01}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">صلاحية تتيح للمهندس تسجيل مصروف حتى لو أصبح رصيد العهدة بالسالب، وذلك بحد أقصى هذا المبلغ.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium">ملاحظات (اختياري)</label>
          <textarea 
            id="notes" 
            name="notes"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="مثال: عهدة المهندس أحمد للموقع الأول..."
          />
        </div>

        <div className="pt-4 flex items-center justify-end space-x-2 space-x-reverse">
          <a
            href={`/projects/${params.id}/custody`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            إلغاء
          </a>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            اعتماد العهدة
          </button>
        </div>
      </form>
    </div>
  )
}
