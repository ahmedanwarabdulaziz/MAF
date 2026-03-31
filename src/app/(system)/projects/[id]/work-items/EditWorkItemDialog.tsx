'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WorkItemForm from '@/components/forms/WorkItemForm'

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
  </svg>
)

interface EditWorkItemDialogProps {
  projectId: string
  initialData: any
  onSuccess?: () => void
}

export default function EditWorkItemDialog({ projectId, initialData, onSuccess }: EditWorkItemDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  const handleSuccess = () => {
    closeModal()
    if (onSuccess) {
      onSuccess()
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
      >
        <EditIcon />
        تعديل
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity" onClick={closeModal} />
          
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-background shadow-2xl overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-6 py-4 shrink-0 shadow-sm relative z-10">
              <div className="text-right w-full">
                <h2 className="text-xl font-bold text-white">تعديل بند الأعمال</h2>
                <p className="mt-1 text-sm text-white/80">تعديل التفاصيل سيؤثر على الوصف في العقود والمستخلصات المستقبلية.</p>
              </div>
              <button type="button" onClick={closeModal} className="absolute left-6 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background-secondary/30 text-right">
              <div className="bg-white rounded-xl p-6 border border-border shadow-sm">
                <WorkItemForm
                  projectId={projectId}
                  initialData={initialData}
                  onSuccess={handleSuccess}
                  onCancel={closeModal}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
