'use client'

import { useState, useTransition } from 'react'
import { postCompanyPurchaseInvoice } from './actions'
import { useRouter } from 'next/navigation'

const ApproveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function ApproveInvoiceButton({ id, status }: { id: string, status: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (status !== 'draft') return null

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await postCompanyPurchaseInvoice(id)
        setIsOpen(false)
        router.refresh()
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1 text-gray-400 hover:text-green-600 transition"
        title="ترحيل واعتماد"
      >
        <ApproveIcon />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className="p-6">
              <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4 border border-green-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">تأكيد الترحيل</h3>
              <p className="text-gray-500 text-sm text-center">
                هل أنت متأكد من ترحيل واعتماد هذه الفاتورة المبدئية؟ سيتم تسجيل القيود المالية والمخزنية ولن تتمكن من التعديل عليها لاحقاً.
              </p>
            </div>
            <div className="border-t border-gray-100 p-4 bg-gray-50 flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-xl font-medium transition text-sm shadow-sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                إلغاء الترحيل
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition disabled:opacity-60 text-sm shadow-sm"
                onClick={handleApprove}
                disabled={isPending}
              >
                {isPending ? 'جاري الترحيل...' : 'تأكيد واعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
