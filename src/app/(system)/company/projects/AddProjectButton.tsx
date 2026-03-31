'use client'

import { useState } from 'react'
import NewProjectModal from '@/components/modals/NewProjectModal'

export default function AddProjectButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        + إضافة مشروع
      </button>

      <NewProjectModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
