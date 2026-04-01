'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import SupplierInvoiceView from './SupplierInvoiceView'

export default function SupplierInvoiceDialog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const invoiceId = searchParams.get('view_invoice')
  const projectId = searchParams.get('projectId')

  if (!invoiceId || !projectId) return null

  function closeModal() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('view_invoice')
    params.delete('projectId')
    
    // Check if params is empty after deletion
    const queryString = params.toString()
    router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-navy/60 backdrop-blur-sm transition-opacity">
      <div 
        className="fixed inset-0" 
        onClick={closeModal}
      />
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background-secondary/50">
          <h2 className="text-xl font-bold text-navy flex items-center gap-2">
            تفاصيل ومطابقة الفاتورة
          </h2>
          <button
            onClick={closeModal}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors shadow-sm border border-border/50"
            title="إغلاق التقرير (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-background-primary">
          <SupplierInvoiceView 
            projectId={projectId} 
            invoiceId={invoiceId} 
            hideBreadcrumbs={true}
          />
        </div>
      </div>
    </div>
  )
}
