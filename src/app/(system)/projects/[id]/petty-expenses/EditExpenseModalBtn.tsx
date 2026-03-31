'use client'

import { useState } from 'react'
import { updatePettyExpense } from '@/actions/petty_expenses'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function EditExpenseModalBtn({ 
    expense,
    accounts,
    groups,
    items
}: { 
    expense: any,
    accounts: any[],
    groups: any[],
    items: any[]
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Form states
    const [financialAccountId, setFinancialAccountId] = useState(expense.financial_account_id || '')
    const [expenseGroupId, setExpenseGroupId] = useState(expense.expense_group_id || '')
    const [expenseItemId, setExpenseItemId] = useState(expense.expense_item_id || '')
    const [totalAmount, setTotalAmount] = useState(expense.total_amount?.toString() || '')
    const [expenseDate, setExpenseDate] = useState(expense.expense_date || '')
    const [notes, setNotes] = useState(expense.notes || '')
    const [attachmentUrl, setAttachmentUrl] = useState(expense.attachment_url || '')
    const [attachment, setAttachment] = useState<File | null>(null)
    const [errorMsg, setErrorMsg] = useState('')

    // Filter available items by selected group
    const availableItems = items.filter(i => i.expense_group_id === expenseGroupId)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')

        if (!financialAccountId) return setErrorMsg('الرجاء اختيار الخزينة.')
        if (!expenseGroupId) return setErrorMsg('الرجاء اختيار سجل المصروفات الرئيسي.')
        if (!expenseItemId) return setErrorMsg('الرجاء اختيار بند المصروف.')
        if (!totalAmount || Number(totalAmount) <= 0) return setErrorMsg('المبلغ غير صحيح.')

        try {
            setLoading(true)
            
            let finalAttachmentUrl = attachmentUrl
            if (attachment) {
                const supabase = createClient()
                const ext = attachment.name.split('.').pop()
                const path = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
                const { error: uploadErr } = await supabase.storage.from('petty_expenses').upload(path, attachment)
                if (uploadErr) throw new Error("فشل رفع المرفق: " + uploadErr.message)
                
                const { data } = supabase.storage.from('petty_expenses').getPublicUrl(path)
                finalAttachmentUrl = data.publicUrl
            }

            await updatePettyExpense(expense.id, {
                financial_account_id: financialAccountId,
                expense_group_id: expenseGroupId,
                expense_item_id: expenseItemId,
                total_amount: Number(totalAmount),
                expense_date: expenseDate,
                notes,
                attachment_url: finalAttachmentUrl
            })
            setOpen(false)
            router.refresh()
        } catch (err: any) {
            setErrorMsg(err.message || 'حدث خطأ أثناء التعديل')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground h-8 w-8 text-blue-600 hover:text-blue-800"
                title="تعديل"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                <span className="sr-only">تعديل</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" dir="rtl">
                    <div className="bg-background rounded-xl shadow-lg border w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden relative text-right">
                        
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/20">
                            <div>
                                <h2 className="text-xl font-bold">تعديل المصروف النثري</h2>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-md transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {errorMsg && (
                                <div className="p-3 mb-4 text-sm text-red-800 rounded-md bg-red-50 border border-red-200">
                                    {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">تاريخ الصرف</label>
                                    <input 
                                        type="date" 
                                        value={expenseDate} 
                                        onChange={e => setExpenseDate(e.target.value)}
                                        required
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">تُصرف من خزينة (حساب مالي)</label>
                                    <select 
                                        value={financialAccountId} 
                                        onChange={e => setFinancialAccountId(e.target.value)}
                                        required
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                    >
                                        <option value="">-- اختر الخزينة --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.financial_account_id?.toString()} value={acc.financial_account_id?.toString()}>
                                                {acc.arabic_name} (الرصيد: {Number(acc.current_balance || 0).toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">المجموعة المحاسبية</label>
                                    <select 
                                        value={expenseGroupId} 
                                        onChange={e => {
                                            setExpenseGroupId(e.target.value)
                                            setExpenseItemId('') // reset item when group changes
                                        }}
                                        required
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                    >
                                        <option value="">-- اختر المجموعة --</option>
                                        {groups.map(grp => (
                                            <option key={grp.id} value={grp.id}>{grp.arabic_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">البند التفصيلي للمصروف</label>
                                    <select 
                                        value={expenseItemId} 
                                        onChange={e => setExpenseItemId(e.target.value)}
                                        required
                                        disabled={!expenseGroupId}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-50"
                                    >
                                        <option value="">-- اختر البند --</option>
                                        {availableItems.map(item => (
                                            <option key={item.id} value={item.id}>{item.arabic_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">المبلغ المُصرف (ج.م)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        value={totalAmount} 
                                        onChange={e => setTotalAmount(e.target.value)}
                                        required
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">ملاحظات / بيان</label>
                                    <textarea 
                                        value={notes} 
                                        onChange={e => setNotes(e.target.value)}
                                        rows={3}
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                        placeholder="اكتب أي تفاصيل توضيحية هنا..."
                                    />
                                </div>

                                <div className="p-4 bg-muted/40 rounded-lg space-y-3 border">
                                    <label className="text-sm font-semibold flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                            إرفاق الفاتورة أو الإيصال (اختياري)
                                        </span>
                                        {attachmentUrl && !attachment && (
                                            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                                                مشاهدة المرفق الحالي
                                            </a>
                                        )}
                                    </label>
                                    <input 
                                        type="file" 
                                        onChange={e => setAttachment(e.target.files?.[0] || null)}
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        className="flex w-full rounded-md border border-input bg-background file:border-0 file:bg-primary/5 file:text-primary file:font-medium file:px-4 file:py-2 text-sm shadow-sm hover:cursor-pointer"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {attachmentUrl && !attachment ? "اختر ملفاً جديداً لاستبدال المرفق القديم، أو اتركه فارغاً للاحتفاظ به." : "يُفضل إرفاق الإيصال الأصلي. الحد الأقصى 5 ميجابايت."}
                                    </p>
                                </div>

                                <div className="pt-4 border-t flex justify-end gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setOpen(false)}
                                        className="h-10 px-4 rounded-md border border-input bg-background hover:bg-muted text-sm font-medium transition-colors"
                                    >
                                        إلغاء
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="h-10 px-4 rounded-md border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
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
