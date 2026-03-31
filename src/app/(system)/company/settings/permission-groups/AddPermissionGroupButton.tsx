'use client'

import { useState } from 'react'
import NewPermissionGroupModal from '@/components/modals/NewPermissionGroupModal'

export default function AddPermissionGroupButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        + قالب جديد
      </button>

      <NewPermissionGroupModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
