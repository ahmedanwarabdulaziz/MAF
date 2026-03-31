'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PurchaseInvoiceForm from './PurchaseInvoiceForm'

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

export default function NewPurchaseDialog({ categories, suppliers, warehouses, items, itemGroups, costCenters }: any) {
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
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition font-bold shadow-sm"
      >
        <PlusIcon />
        فاتورة جديدة
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">فاتورة مشتريات جديدة / مصروف</h2>
                <p className="mt-1 text-sm text-white/80">إضافة فاتورة مصروف عام أو شراء مواد ومعدات للمخزن</p>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              <PurchaseInvoiceForm
                categories={categories}
                suppliers={suppliers}
                warehouses={warehouses}
                items={items}
                itemGroups={itemGroups}
                costCenters={costCenters}
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
