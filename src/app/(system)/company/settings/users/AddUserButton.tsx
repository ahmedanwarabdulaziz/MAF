'use client'

import { useState } from 'react'
import NewUserModal from '@/components/modals/NewUserModal'

export default function AddUserButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        + إضافة مستخدم
      </button>

      <NewUserModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
