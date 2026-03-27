'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك', subcontractor: 'مقاول', supplier: 'مورد', consultant: 'مستشار', other: 'آخر',
}

export default function PartiesFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [text, setText] = useState(searchParams.get('q') ?? '')
  const [role, setRole] = useState(searchParams.get('role') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function pushParams(params: { q?: string; role?: string; status?: string }) {
    const p = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) p.set(k, v); else p.delete(k)
    })
    startTransition(() => router.push(`${pathname}?${p.toString()}`))
  }

  function onTextChange(val: string) {
    setText(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => pushParams({ q: val }), 350)
  }

  function onRoleChange(val: string) {
    setRole(val)
    pushParams({ role: val })
  }

  function onStatusChange(val: string) {
    setStatus(val)
    pushParams({ status: val })
  }

  function clearAll() {
    setText(''); setRole(''); setStatus('')
    startTransition(() => router.push(pathname))
  }

  const hasFilters = text || role || status

  return (
    <div className={`mb-6 rounded-xl border border-border bg-white p-4 shadow-sm transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">

        {/* Text search */}
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-background-secondary/40 px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
          <svg className="h-4 w-4 shrink-0 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={text}
            onChange={e => onTextChange(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-secondary"
          />
          {text && (
            <button type="button" onClick={() => onTextChange('')} className="text-text-secondary hover:text-text-primary">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="relative">
          <select
            value={role}
            onChange={e => onRoleChange(e.target.value)}
            className={`h-10 rounded-lg border px-3 pl-8 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary appearance-none ${
              role ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border bg-white text-text-secondary'
            }`}
            style={{ minWidth: 140 }}
          >
            <option value="">كل الأدوار</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {[
            { val: '', label: 'الكل' },
            { val: 'active', label: 'نشط' },
            { val: 'inactive', label: 'موقوف' },
          ].map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => onStatusChange(opt.val)}
              className={`px-3 py-2 transition-colors ${
                status === opt.val
                  ? 'bg-primary text-white font-medium'
                  : 'bg-white text-text-secondary hover:bg-background-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Clear all */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            مسح الفلاتر
          </button>
        )}

        {/* Loading indicator */}
        {isPending && (
          <span className="text-xs text-text-secondary animate-pulse">جاري التحديث...</span>
        )}
      </div>
    </div>
  )
}
