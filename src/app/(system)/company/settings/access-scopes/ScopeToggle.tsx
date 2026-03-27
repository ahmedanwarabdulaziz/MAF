'use client'

import { useTransition } from 'react'
import { toggleAccessScopeAction } from './actions'

interface Props {
  scopeId: string
  isActive: boolean
}

export default function ScopeToggle({ scopeId, isActive }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      await toggleAccessScopeAction(scopeId, !isActive)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={isActive ? 'Deactivate scope' : 'Activate scope'}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-wait ${
        isActive ? 'bg-emerald-500' : 'bg-border'
      }`}
      role="switch"
      aria-checked={isActive}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          isActive ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
