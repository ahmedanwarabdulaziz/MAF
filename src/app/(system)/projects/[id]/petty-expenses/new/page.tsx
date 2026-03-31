import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { recordPettyExpense } from '@/actions/petty_expenses'
import DatePicker from '@/components/DatePicker'

export const metadata = {
  title: 'تسجيل مصروف نثري | نظام إدارة المقاولات'
}

export default async function NewPettyExpensePage({ params, searchParams }: { params: { id: string }, searchParams?: { account_id?: string } }) {
  const supabase = createClient()
  
  const { data: accountsRaw } = await supabase
    .from('financial_account_balances_view')
    .select('financial_account_id, current_balance, arabic_name, is_active')
    .eq('project_id', params.id)
    .eq('account_type', 'cashbox')

  const accounts = accountsRaw || []
    
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
    const financial_account_id = formData.get('financial_account_id') as string

    // -- File Upload Logic --
    const file = formData.get('attachment') as File | null
    let attachment_url = null
    
    if (file && file.size > 0 && file.name !== 'undefined') {
        const supabase = createClient()
        const ext = file.name.split('.').pop()
        const path = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        
        const { error: uploadErr } = await supabase.storage.from('petty_expenses').upload(path, file)
        if (!uploadErr) {
            const { data } = supabase.storage.from('petty_expenses').getPublicUrl(path)
            attachment_url = data.publicUrl
        } else {
            throw new Error("فشل رفع المرفق: " + uploadErr.message)
        }
    }

    let docId = null;
    try {
      const doc = await recordPettyExpense({
        project_id: params.id,
        financial_account_id,
        expense_group_id,
        expense_item_id,
        total_amount,
        expense_date,
        notes,
        attachment_url: attachment_url || undefined
      })
      docId = doc.id;
    } catch (e: any) {
      console.error(e)
      // Normally we use useFormState, but here we can just throw a simpler error that might bypass boundary
      throw new Error(e?.message || 'فشل في الحفظ. يرجى التأكد من تحديث قاعدة البيانات.');
    }

    if (docId) {
      redirect(`/projects/${params.id}/petty-expenses`)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 flex flex-col items-center w-full">
      <div className="pb-4 border-b w-full">
        <h1 className="text-2xl font-bold tracking-tight">تسجيل مصروف نثري جديد</h1>
        <p className="text-muted-foreground mt-1">
          تسجيل المشتريات والمصروفات النقدية الجارية من خزينة المشروع المخصصة.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4 w-full">
        
        <div className="space-y-2">
          <label htmlFor="financial_account_id" className="text-sm font-medium">خزينة السحب المتوفرة</label>
          <select 
            id="financial_account_id" 
            name="financial_account_id" 
            required 
            defaultValue={searchParams?.account_id || ''}
            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">-- اختر الخزينة --</option>
            {accounts?.map((acc: any) => (
              <option key={acc.financial_account_id} value={acc.financial_account_id} disabled={!acc.is_active}>
                {acc.arabic_name} (متاح: {Number(acc.current_balance).toLocaleString('en-US')} ج.م) {!acc.is_active && '(معطل)'}
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

        <div className="space-y-4 pt-4 border-t w-full">
          <div className="p-4 bg-muted/40 rounded-lg space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              المرفقات (اختياري)
            </label>
            <input 
              type="file" 
              name="attachment" 
              accept=".jpg,.jpeg,.png,.pdf"
              className="flex w-full rounded-md border border-input bg-background file:border-0 file:bg-primary/5 file:text-primary file:font-medium file:px-4 file:py-2 text-sm shadow-sm hover:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">يُفضل إرفاق الإيصال الأصلي. الصيغ المسموحة: الصور (JPG/PNG) وملفات PDF. الحد الأقصى 5 ميجابايت.</p>
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
        </div>

        <div className="pt-4 flex items-center justify-end space-x-2 space-x-reverse">
          <a
            href={`/projects/${params.id}/petty-expenses`}
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
