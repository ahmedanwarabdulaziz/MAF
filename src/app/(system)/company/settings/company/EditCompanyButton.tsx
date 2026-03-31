'use client'

import { useState } from 'react'
import EditCompanyModal from '@/components/modals/EditCompanyModal'

interface Props {
  company: any
}

export default function EditCompanyButton({ company }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        تعديل بيانات الشركة
      </button>

      <EditCompanyModal isOpen={isOpen} onClose={() => setIsOpen(false)} company={company} />
    </>
  )
}
