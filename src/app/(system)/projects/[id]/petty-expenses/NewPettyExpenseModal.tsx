'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { recordPettyExpense } from '@/actions/petty_expenses'

export default function NewPettyExpenseModal({ projectId, accounts, groups, items }: { projectId: string, accounts: any[], groups: any[], items: any[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const router = useRouter()

  const handleOpen = () => {
    setIsOpen(true)
    setError(null)
    setSelectedGroupId('')
  }
  
  const handleClose = () => {
    setIsOpen(false)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)

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
            setError("فشل رفع المرفق: " + uploadErr.message)
            setSaving(false)
            return
        }
    }

    try {
      await recordPettyExpense({
        project_id: projectId,
        financial_account_id,
        expense_group_id,
        expense_item_id,
        total_amount,
        expense_date,
        notes,
        attachment_url: attachment_url || undefined
      })
      handleClose()
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'فشل في الحفظ. يرجى التأكد من تحديث قاعدة البيانات.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        + تسجيل مصروف
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={handleClose} />
          
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div>
                <h2 className="text-xl font-bold text-white">تسجيل مصروف نثري جديد</h2>
              </div>
              <button disabled={saving} onClick={handleClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="financial_account_id" className="text-sm font-medium">خزينة السحب المتوفرة</label>
                  <select 
                    id="financial_account_id" 
                    name="financial_account_id" 
                    required 
                    className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
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
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
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
                      disabled={!selectedGroupId}
                      className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary disabled:opacity-50"
                    >
                      <option value="">-- اختر البند --</option>
                      {items?.filter((i: any) => i.expense_group_id === selectedGroupId).map((i: any) => (
                        <option key={i.id} value={i.id}>{i.arabic_name}</option>
                      ))}
                    </select>
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
                      placeholder="0.00"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus:ring-ring focus-visible:border-primary dir-ltr text-right font-bold text-navy"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="expense_date" className="text-sm font-medium">تاريخ المصروف</label>
                    <input
                      type="date"
                      name="expense_date"
                      id="expense_date"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus:ring-ring focus-visible:border-primary dir-ltr text-right"
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
                    <p className="text-xs text-muted-foreground mt-1">يُفضل إرفاق الإيصال الأصلي. الصيغ المسموحة: الصور (JPG/PNG) وملفات PDF.</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">البيان (تفاصيل المصروف)</label>
                    <textarea 
                      id="notes" 
                      name="notes"
                      rows={2}
                      required
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus:visible:ring-2 focus-visible:ring-ring focus-visible:border-primary"
                      placeholder="مثال: فاتورة استهلاك للموقع..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={saving}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-border/50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'جارٍ الحفظ...' : 'حفظ وإنشاء السجل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
