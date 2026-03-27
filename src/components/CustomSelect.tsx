'use client'

import { useState, useRef, useEffect, useId } from 'react'

export interface SelectOption {
  value: string
  label: string
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
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [searchQuery, setSearchQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  
  const filteredOptions = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options
  const id = useId()

  const value = controlledValue !== undefined ? controlledValue : internalValue
  const selected = options.find(o => o.value === value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (val: string) => {
    if (controlledValue === undefined) setInternalValue(val)
    onChange?.(val)
    setSearchQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`} id={id}>
      {/* Hidden input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
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
        <span className={`flex-1 text-right ${!selected ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron */}
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

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl border border-border bg-white shadow-lg overflow-hidden"
          style={{
            animation: 'selectDropdown 120ms cubic-bezier(0.16, 1, 0.3, 1) both',
            transformOrigin: 'top center',
          }}
        >
          {searchable && (
            <div className="p-2 border-b border-border bg-background-secondary/30">
              <input
                type="text"
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors font-medium"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {/* Empty/placeholder option */}
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
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => pick(opt.value)}
                  className={`
                    px-3 py-2 text-sm cursor-pointer
                    hover:bg-background-secondary transition-colors duration-75
                    ${opt.value === value
                      ? 'bg-primary/8 text-primary font-semibold'
                      : 'text-text-primary'
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
