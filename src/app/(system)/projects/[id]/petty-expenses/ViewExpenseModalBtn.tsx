'use client'

import { useState } from 'react'
import { StatusActions } from './[doc_id]/StatusActions'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase'
import { updatePettyExpenseAttachment } from '@/actions/petty_expenses'
import { useRouter } from 'next/navigation'

const statusMap: Record<string, { label: string, color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  pm_approved: { label: 'موافقة م. المشروع', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  gm_approved: { label: 'موافقة الإدارة', color: 'bg-green-50 text-green-700 border-green-200' },
  reimbursed: { label: 'تمت التسوية', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected: { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function ViewExpenseModalBtn({ expense }: { expense: any }) {
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [localAttachment, setLocalAttachment] = useState(expense.attachment_url)
    const router = useRouter()

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            const supabase = createClient()
            const ext = file.name.split('.').pop()
            const path = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
            
            const { error: uploadErr } = await supabase.storage.from('petty_expenses').upload(path, file)
            if (uploadErr) throw new Error(uploadErr.message)
            
            const { data } = supabase.storage.from('petty_expenses').getPublicUrl(path)
            
            await updatePettyExpenseAttachment(expense.id, data.publicUrl)
            setLocalAttachment(data.publicUrl)
            router.refresh()
            alert('تم تحديث المرفق بنجاح!')
        } catch (err: any) {
            console.error('Upload Error:', err)
            alert('حدث خطأ أثناء رفع المرفق: ' + (err.message || ''))
        } finally {
            setUploading(false)
            e.target.value = '' // reset input
        }
    }

    // Only render the Modal inside the React Tree if open is true.
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground h-8 w-8 text-muted-foreground"
                title="عرض التفاصيل"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                <span className="sr-only">عرض</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" dir="rtl">
                    <div className="bg-background rounded-xl shadow-lg border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative text-right">
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/20">
                            <div>
                                <h2 className="text-xl font-bold">تفاصيل المصروف النثري</h2>
                                <p className="text-muted-foreground text-xs font-mono mt-1"># {expense.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-md transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            <div className="flex items-center gap-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${statusMap[expense.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                                    الحالة: {statusMap[expense.status]?.label || expense.status}
                                </span>
                                <span className="text-xl font-bold text-red-600 mr-auto" dir="ltr">
                                    {Number(expense.total_amount).toLocaleString()} ج.م
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <div className="text-muted-foreground font-medium">تاريخ المصروف</div>
                                    <div className="font-semibold">{formatDate(expense.expense_date)}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-muted-foreground font-medium">الخزينة المسحوب منها</div>
                                    <div className="font-semibold">{expense.cashbox?.arabic_name || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-muted-foreground font-medium">المجموعة المحاسبية</div>
                                    <div className="font-semibold">{expense.expense_group?.arabic_name || '-'}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-muted-foreground font-medium">بند المصروف التفصيلي</div>
                                    <div className="font-semibold">{expense.expense_item?.arabic_name || '-'}</div>
                                </div>
                            </div>

                            <div>
                                <div className="text-muted-foreground text-sm font-medium mb-1">البيان (التفاصيل المذكورة)</div>
                                <div className="bg-muted p-4 rounded-md text-sm border">
                                    {expense.notes || 'لا يوجد تفاصيل.'}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-muted-foreground text-sm font-medium">المرفقات والإيصالات</div>
                                    <label className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 border border-blue-200 px-3 py-1 rounded-md bg-white shadow-sm transition-colors hover:bg-blue-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                        {uploading ? 'جاري الرفع...' : (localAttachment ? 'تحديث/استبدال المرفق' : 'إضافة المرفق الآن')}
                                        <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                                    </label>
                                </div>
                                
                                {localAttachment ? (
                                    <a 
                                        href={localAttachment} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50/50"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                                        استعراض / تحميل الإيصال المرفق
                                    </a>
                                ) : (
                                    <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                                        لا يوجد إيصال أو صورة مرفقة مع هذا المصروف
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-4 bg-primary/5 p-4 rounded-md border text-center text-xs">
                                <div>
                                    <div className="text-muted-foreground font-medium mb-1">المُنشئ</div>
                                    <div className="font-bold">{expense.creator?.display_name || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground font-medium mb-1">موافقة م. المشروع</div>
                                    <div className="font-bold text-blue-700">{expense.pm_approver?.display_name || '...'}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground font-medium mb-1">اعتماد الإدارة النهائي</div>
                                    <div className="font-bold text-green-700">{expense.gm_approver?.display_name || '...'}</div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="text-sm font-bold mb-3 text-muted-foreground text-center">الإجراءات والاعتمادات المتاحة</h3>
                                <StatusActions expenseId={expense.id} currentStatus={expense.status} />
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
