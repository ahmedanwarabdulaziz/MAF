'use client'

import { useState } from 'react'
import WorkInboxDrawer from './WorkInboxDrawer'

// PERF-02 / PERF-03: initialCount is now passed from the server layout.
// No mount-time client fetch. No polling interval.
// The badge reflects the server-rendered count and updates on navigation.
type Props = {
  initialCount?: number
}

export default function TopbarInboxButton({ initialCount = 0 }: Props) {
  const [drawerOpen, setDrawer] = useState(false)

  return (
    <>
      <button
        id="inbox-topbar-button"
        onClick={() => setDrawer(o => !o)}
        className="relative flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg px-2 py-1"
        aria-label="مركز العمل الموحد"
        title="مركز العمل الموحد"
      >
        <span className="text-base">⚡</span>
        <span className="hidden sm:inline">الإجراءات</span>

        {/* Badge — rendered from server-passed count, no client fetch */}
        {initialCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
            {initialCount > 99 ? '99+' : initialCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      {drawerOpen && (
        <WorkInboxDrawer onClose={() => setDrawer(false)} />
      )}
    </>
  )
}

