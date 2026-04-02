'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getWorkInboxCount } from '@/actions/work-inbox'
import WorkInboxDrawer from './WorkInboxDrawer'

export default function TopbarInboxButton() {
  const [count, setCount]         = useState<number | null>(null)
  const [drawerOpen, setDrawer]   = useState(false)

  // Lightweight count fetch — runs once on mount, then every 2 minutes
  useEffect(() => {
    let cancelled = false
    const fetchCount = async () => {
      try {
        const n = await getWorkInboxCount()
        if (!cancelled) setCount(n)
      } catch {
        // Silent fail — badge simply stays hidden
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 2 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

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

        {/* Badge */}
        {count != null && count > 0 && (
          <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 animate-pulse">
            {count > 99 ? '99+' : count}
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
