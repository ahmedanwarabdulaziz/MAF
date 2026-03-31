'use client'

import { useState } from 'react'
import { approvePettyExpense } from '@/actions/petty_expenses'
import { useRouter } from 'next/navigation'

export default function QuickApproveBtn({ expenseId, currentStatus }: { expenseId: string, currentStatus: string }) {
    const [loading, setLoading] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const router = useRouter()

    if (currentStatus !== 'draft' && currentStatus !== 'pm_approved') {
        return null
    }

    const action = currentStatus === 'draft' ? 'pm_approve' : 'gm_approve'
    const label = currentStatus === 'draft' ? 'اعتماد' : 'اعتماد نهائي'
    const btnColor = currentStatus === 'draft' 
        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200'
        : 'bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 border-green-200'
    const msg = action === 'pm_approve' 
        ? 'هل أنت متأكد من اعتماد هذه المسودة والموافقة عليها؟'
        : 'هل أنت متأكد من الاعتماد النهائي وتأكيد خصم المبلغ من الخزينة فعلياً؟'

    async function handleApprove() {
        try {
            setErrorMsg(null)
            setLoading(true)
            await approvePettyExpense(expenseId, action)
            setConfirmOpen(false)
            router.refresh()
        } catch (error: any) {
            setErrorMsg(error.message || 'حدث خطأ')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold shadow-sm transition-colors border disabled:opacity-50 ${btnColor}`}
                title="تحويل وتمرير الاعتماد"
            >
                {label}
            </button>

            {confirmOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-right" dir="rtl">
                    <div 
                        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
                        style={{ animation: 'selectDropdown 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
                    >
                        <div className={`px-5 py-4 border-b flex items-center gap-3 ${action === 'pm_approve' ? 'bg-blue-50/50 border-blue-100' : 'bg-green-50/50 border-green-100'}`}>
                            <div className={`p-2 rounded-full ${action === 'pm_approve' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                            <h3 className="font-bold text-text-primary">تأكيد الاعتماد والموافقة</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-sm font-medium text-text-primary leading-relaxed">
                                {msg}
                            </p>
                            {errorMsg && (
                                <div className="p-3 mt-4 text-xs font-bold text-danger bg-danger/10 border border-danger/20 rounded-lg">
                                    {errorMsg}
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 bg-background-secondary/50 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-semibold text-text-secondary bg-white border border-border rounded-lg shadow-sm hover:bg-background-secondary transition-colors disabled:opacity-50"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={loading}
                                className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 ${action === 'pm_approve' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {loading ? 'جارٍ الاعتماد...' : 'نعم، أوافق متأكد'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
