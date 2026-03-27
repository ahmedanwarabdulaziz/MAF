import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { recordPettyExpense } from '@/actions/custody'
import DatePicker from '@/components/DatePicker'

export const metadata = {
  title: 'تسجيل مصروف نثري | نظام إدارة المقاولات'
}

export default async function NewPettyExpensePage({ params, searchParams }: { params: { id: string }, searchParams?: { account_id?: string } }) {
  const supabase = createClient()
  
  const { data: accountsRaw } = await supabase
    .from('employee_custody_balances_view')
    .select('custody_account_id, current_balance, employee_user_id')
    .eq('project_id', params.id)

  const { data: users } = await supabase.from('users').select('id, display_name')
  
  const accounts = accountsRaw?.map((acc: any) => ({
    ...acc,
    employee: users?.find(u => u.id === acc.employee_user_id) || null
  })) || []
    
  // 2. Fetch Expense Taxonomy
  const { data: groups } = await supabase.from('expense_groups').select('id, arabic_name')
  const { data: items } = await supabase.from('expense_items').select('id, expense_group_id, arabic_name')

  async function handleSubmit(formData: FormData) {
    'use server'
    const expense_group_id = formData.get('expense_group_id') as string
    const expense_item_id = formData.get('expense_item_id') as string
    const total_amount = Number(formData.get('total_amount'))
    const expense_date = formData.get('expense_date') as string
    const notes = formData.get('notes') as string
    const employee_custody_account_id = formData.get('employee_custody_account_id') as string

    // Insert as Draft (which does NOT deduct the ledger yet; GM approval deducts ledger, 
    // OR depending on P16 trigger logic, if we wanted it to lock... actually P16 trigger is ONLY on `employee_custody_transactions`, 
    // which happens during `gm_approve`. Thus, draft creation always succeeds. The limit checks out when PM->GM approves.)
    const doc = await recordPettyExpense({
      project_id: params.id,
      employee_custody_account_id,
      expense_group_id,
      expense_item_id,
      total_amount,
      expense_date,
      notes
    })

    redirect(`/projects/${params.id}/custody/expenses/${doc.id}`)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 flex flex-col items-center w-full">
      <div className="pb-4 border-b w-full">
        <h1 className="text-2xl font-bold tracking-tight">تسجيل مصروف نثري جديد</h1>
        <p className="text-muted-foreground mt-1">
          تسجيل المشتريات والمصروفات النقدية الجارية من رصيد العهدة.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4 w-full">
        
        <div className="space-y-2">
          <label htmlFor="employee_custody_account_id" className="text-sm font-medium">العهدة المسحوب منها</label>
          <select 
            id="employee_custody_account_id" 
            name="employee_custody_account_id" 
            required 
            defaultValue={searchParams?.account_id || ''}
            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">-- اختر العهدة --</option>
            {accounts?.map((acc: any) => (
              <option key={acc.custody_account_id} value={acc.custody_account_id}>
                عهدة {acc.employee?.display_name || 'س'} (متبقي: {Number(acc.current_balance).toLocaleString()} ج.م)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="expense_group_id" className="text-sm font-medium">مجموعة المصروف</label>
            <select 
              id="expense_group_id" 
              name="expense_group_id" 
              required 
              className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">-- اختر المجموعة --</option>
              {groups?.map((g: any) => (
                <option key={g.id} value={g.id}>{g.arabic_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="expense_item_id" className="text-sm font-medium">بند المصروف تفصيلاً</label>
            <select 
              id="expense_item_id" 
              name="expense_item_id" 
              required 
              className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">-- اختر البند --</option>
              {items?.map((i: any) => (
                <option key={i.id} value={i.id}>{i.arabic_name}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">تظهر جميع البنود هنا مؤقتاً للتبسيط.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="total_amount" className="text-sm font-medium">القيمة (ج.م)</label>
            <input 
              type="number" 
              id="total_amount" 
              name="total_amount" 
              min={1}
              step={0.01}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="expense_date" className="text-sm font-medium">تاريخ المصروف</label>
            <DatePicker
              name="expense_date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium">البيان (تفاصيل المصروف)</label>
          <textarea 
            id="notes" 
            name="notes"
            rows={2}
            required
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="مثال: فاتورة تاكسي لموقع رقم 1..."
          />
        </div>

        <div className="pt-4 flex items-center justify-end space-x-2 space-x-reverse">
          <a
            href={`/projects/${params.id}/custody/expenses`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            إلغاء
          </a>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            إنشاء مسودة الاعتماد
          </button>
        </div>
      </form>
    </div>
  )
}
