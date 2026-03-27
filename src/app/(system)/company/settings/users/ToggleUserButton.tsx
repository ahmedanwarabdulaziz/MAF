'use client'

import { useState, useTransition } from 'react'
import { toggleUserActiveAction } from './actions'

interface Props {
  userId: string
  isActive: boolean
}

export default function ToggleUserButton({ userId, isActive: initialValue }: Props) {
  const [isActive, setIsActive] = useState(initialValue)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newValue = !isActive
    setIsActive(newValue) // optimistic update
    startTransition(async () => {
      const result = await toggleUserActiveAction(userId, newValue)
      if (result.error) {
        setIsActive(!newValue) // revert on error
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isActive ? 'إيقاف المستخدم' : 'تفعيل المستخدم'}
      className="group flex items-center gap-2 disabled:opacity-60"
    >
      {/* Track */}
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          isActive ? 'bg-success' : 'bg-border'
        }`}
      >
        {/* Thumb */}
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            isActive ? '-translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      {/* Label */}
      <span
        className={`text-xs font-medium transition-colors ${
          isActive ? 'text-success' : 'text-text-secondary'
        }`}
      >
        {isActive ? 'نشط' : 'موقوف'}
      </span>
    </button>
  )
}
