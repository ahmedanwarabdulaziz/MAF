'use client'

import { useState, useRef, useEffect, useId } from 'react'

export interface SelectOption {
  value: string
  label: string
  isHeader?: boolean
  disabled?: boolean
}

interface CustomSelectProps {
  name?: string
  value?: string
  defaultValue?: string
  options: SelectOption[]
  placeholder?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  searchable?: boolean
  className?: string
  dropdownMinWidth?: number
}

export default function CustomSelect({
  name,
  value: controlledValue,
  defaultValue = '',
  options,
  placeholder = '— اختر —',
  onChange,
  required,
  disabled,
  searchable = false,
  className = '',
  dropdownMinWidth = 220,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const filteredOptions = searchable
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  const value = controlledValue !== undefined ? controlledValue : internalValue
  const selected = options.find(o => o.value === value)

  const computeStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {}
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, dropdownMinWidth)
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 280
    const above = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    return {
      position: 'fixed',
      top: above ? rect.top - dropdownHeight : rect.bottom + 4,
      left: rect.left,
      width,
      zIndex: 9999,
    }
  }

  const openDropdown = () => {
    if (disabled) return
    if (!open) {
      setDropdownStyle(computeStyle())
      setOpen(true)
    } else {
      setOpen(false)
      setSearchQuery('')
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const dropdownEl = document.getElementById(`cs-dropdown-${id}`)
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(dropdownEl?.contains(target))
      ) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [id])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    const update = () => setDropdownStyle(computeStyle())
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pick = (val: string) => {
    if (controlledValue === undefined) setInternalValue(val)
    onChange?.(val)
    setSearchQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          rounded-lg border border-border bg-white
          px-3 py-2.5 text-sm text-right
          transition-all duration-150
          ${open
            ? 'border-primary ring-2 ring-primary/15 shadow-sm'
            : 'hover:border-border/80 hover:bg-background-secondary/40'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-background-secondary' : 'cursor-pointer'}
        `}
      >
        <span className={`flex-1 text-right truncate ${!selected ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown — fixed position to escape overflow containers */}
      {open && (
        <div
          id={`cs-dropdown-${id}`}
          style={{
            ...dropdownStyle,
            animation: 'selectDropdown 120ms cubic-bezier(0.16, 1, 0.3, 1) both',
            transformOrigin: 'top center',
          }}
          className="rounded-xl border border-border bg-white shadow-xl overflow-hidden"
        >
          {searchable && (
            <div className="p-2 border-b border-border bg-background-secondary/30">
              <input
                type="text"
                autoFocus
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {placeholder && !searchQuery && (
              <li
                role="option"
                aria-selected={!value}
                onClick={() => pick('')}
                className={`
                  px-3 py-2 text-sm cursor-pointer text-text-secondary italic
                  hover:bg-background-secondary transition-colors duration-75
                  ${!value ? 'bg-primary/5 text-primary font-medium not-italic' : ''}
                `}
              >
                {placeholder}
              </li>
            )}
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-text-secondary italic">
                لا توجد نتائج مطابقة
              </li>
            ) : (
              filteredOptions.map(opt => (
                <li
                  key={opt.isHeader ? `header-${opt.label}-${opt.value}` : opt.value}
                  role={opt.isHeader ? "presentation" : "option"}
                  aria-selected={opt.value === value}
                  onClick={(e) => {
                    if (opt.isHeader || opt.disabled) e.stopPropagation();
                    else pick(opt.value);
                  }}
                  className={`
                    px-3 py-2 text-sm 
                    ${opt.isHeader 
                      ? 'font-bold bg-background-secondary text-text-primary cursor-default border-y border-border/50 sticky top-0 z-10' 
                      : opt.disabled 
                        ? 'opacity-50 cursor-not-allowed text-text-secondary' 
                        : 'cursor-pointer hover:bg-background-secondary transition-colors duration-75 text-text-primary'}
                    ${opt.value === value && !opt.isHeader
                      ? 'bg-primary/8 text-primary font-semibold'
                      : ''
                    }
                  `}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
