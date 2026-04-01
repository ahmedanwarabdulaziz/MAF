'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PurchaseRequestView from './PurchaseRequestView'

export default function PurchaseRequestDialog() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prId = searchParams.get('view_pr')
  const projectId = searchParams.get('projectId')

  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(!!prId && !!projectId)
  }, [prId, projectId])

  function onClose() {
    // Remove query params related to the PR without losing other params
    const params = new URLSearchParams(searchParams.toString())
    params.delete('view_pr')
    params.delete('projectId')
    
    // Replace current URL to avoid history bloat, or push if you want 'back' button to work
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  if (!isOpen || !prId || !projectId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 min-h-screen" dir="rtl">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-navy px-6 py-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">تفاصيل طلب الشراء</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <PurchaseRequestView 
            prId={prId} 
            projectId={projectId} 
            hideBreadcrumbs={true}
            onActionSuccess={() => {
              // Optionally do something on success, e.g. reload data or close
            }}
          />
        </div>
      </div>
    </div>
  )
}
