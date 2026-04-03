'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ColumnFilter({ 
  title, 
  columnKey, 
  options, 
  currentValue 
}: { 
  title: React.ReactNode
  columnKey: string
  options: { label: string; value: string }[]
  currentValue?: string 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  const applyFilter = (val: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set(columnKey, val)
    else params.delete(columnKey)
    router.push(`?${params.toString()}`)
    setIsOpen(false)
  }

  const hasActiveFilter = !!currentValue

  return (
    <div className="inline-flex items-center gap-1.5 relative" ref={ref}>
      <span>{title}</span>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 rounded transition-colors ${hasActiveFilter ? 'text-primary bg-primary/10' : 'text-slate-400 hover:bg-slate-200'}`}
        title="تصفية"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={hasActiveFilter ? 2.5 : 2} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <input 
                type="text" 
                placeholder="بحث للتصفية..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-primary shadow-sm"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            <button 
              onClick={() => applyFilter(null)}
              className={`w-full text-right px-3 py-2 text-xs font-bold rounded-lg transition-colors ${!currentValue ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              الكل (بدون تصفية)
            </button>
            {filtered.map(opt => (
              <button 
                key={opt.value}
                onClick={() => applyFilter(opt.value)}
                className={`w-full text-right px-3 py-2 text-xs font-bold rounded-lg transition-colors flex justify-between items-center ${currentValue === opt.value ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="truncate">{opt.label}</span>
                {currentValue === opt.value && (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">لا توجد نتائج</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
