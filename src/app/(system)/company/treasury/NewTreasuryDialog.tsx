'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TreasuryForm from './TreasuryForm'

export default function NewTreasuryDialog({ projects, users, treasuryGroupIds }: { projects: any[], users: any[], treasuryGroupIds: string[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  const handleSuccess = () => {
    closeModal()
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        + حساب جديد
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div>
                <h2 className="text-xl font-bold text-white">إضافة حساب / خزينة جديدة</h2>
                <p className="mt-1 text-sm text-white/80">سجّل حساباً بنكياً، أو خزينة نقدية جديدة للموقع واربطها بمشروع معين</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-background-secondary/30">
              <TreasuryForm 
                projects={projects}
                users={users}
                treasuryGroupIds={treasuryGroupIds}
                onSuccess={handleSuccess}
                onCancel={closeModal}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
