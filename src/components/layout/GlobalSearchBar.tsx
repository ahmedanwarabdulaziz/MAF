'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { globalSearch, SearchResult, SearchResultType } from '@/actions/search'

const RESULT_ICONS: Record<SearchResultType, ReactNode> = {
  project:          <span className="text-blue-500 text-lg">🏢</span>,
  party:            <span className="text-indigo-500 text-lg">👥</span>,
  purchase_request: <span className="text-emerald-500 text-lg">📄</span>,
  supplier_invoice: <span className="text-amber-500 text-lg">🧾</span>,
  goods_receipt:    <span className="text-purple-500 text-lg">📦</span>,
}

const RESULT_LABELS: Record<SearchResultType, string> = {
  project:          'المشاريع',
  party:            'الجهات',
  purchase_request: 'طلبات الشراء',
  supplier_invoice: 'فواتير الموردين',
  goods_receipt:    'أذون الاستلام',
}

// Custom hook to debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export default function GlobalSearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 10)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Close on Escape or click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Run search query
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await globalSearch(debouncedQuery)
        if (!cancelled) {
          setResults(res)
          setSelectedIndex(-1)
        }
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
    }
  }, [open])

  // Handle arrow key navigation in results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      }
    }
  }

  const handleSelect = (item: SearchResult) => {
    setOpen(false)
    router.push(item.href)
  }

  // Pre-expand view if they focus the closed input
  const handleFocus = () => {
    if (!open) setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm hidden md:block" dir="rtl">
      {/* Input Box */}
      <div 
        className={`relative flex items-center transition-all duration-200 ease-out bg-background-secondary border rounded-lg hover:border-black/20 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${open && query.length > 0 ? 'bg-white rounded-b-none' : ''}`}
      >
        <span className="absolute right-3 text-text-secondary">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="ابحث عن مشاريع، جهات، مستندات... (Ctrl+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-none outline-none pl-3 pr-10 py-2 text-sm text-text-primary placeholder:text-text-secondary/70 h-10"
        />
        {loading && (
          <span className="absolute left-3">
             <span className="block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
          </span>
        )}
      </div>

      {/* Results Dropdown */}
      {open && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-t-0 border-border rounded-b-lg shadow-xl overflow-hidden z-50">
          <div className="max-h-[360px] overflow-y-auto">
            {results.length === 0 && !loading && query.length >= 2 ? (
              <div className="py-6 text-center text-sm text-text-secondary flex flex-col items-center gap-2">
                <span className="text-2xl">🧐</span>
                لم يتم العثور على نتائج
              </div>
            ) : query.length < 2 && !loading ? (
               <div className="py-4 text-center text-xs text-text-secondary">
                  اكتب حرفين على الأقل للبحث...
               </div>
            ) : (
              <div className="py-1 flex flex-col">
                {results.map((item, index) => {
                  const isSelected = index === selectedIndex
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors
                        ${isSelected ? 'bg-primary/5' : 'hover:bg-background-secondary/50'}
                      `}
                    >
                      <div className="shrink-0">
                        {RESULT_ICONS[item.type]}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                        <div className={`text-sm select-none ${isSelected ? 'font-bold text-primary' : 'font-semibold text-text-primary truncate'}`}>
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary w-full">
                          <span>{RESULT_LABELS[item.type]}</span>
                          {item.subtitle && (
                            <>
                              <span className="text-border">·</span>
                              <span className="truncate max-w-[150px] font-mono">{item.subtitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {item.status && (
                        <div className="shrink-0 text-[10px] bg-background-secondary text-text-secondary px-2 py-0.5 rounded font-medium">
                          {item.status}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {/* Footer prompt */}
          <div className="bg-background-secondary/40 border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] text-text-secondary font-medium">
            <span className="flex items-center gap-1.5">
                <kbd className="bg-white border text-[9px] rounded px-1.5 font-sans">↑</kbd>
                <kbd className="bg-white border text-[9px] rounded px-1.5 font-sans">↓</kbd>
                للتنقل
            </span>
            <span className="flex items-center gap-1">
                <kbd className="bg-white border text-[9px] rounded px-1.5 font-sans">↵</kbd>
                للاختيار
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
