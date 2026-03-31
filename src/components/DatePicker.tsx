'use client'

import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  name?: string
  value?: string           // yyyy-mm-dd (same API as native <input type="date">)
  defaultValue?: string    // yyyy-mm-dd
  placeholder?: string
  onChange?: (val: string) => void   // emits yyyy-mm-dd
  required?: boolean
  className?: string
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
const DAYS_AR = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']

/** yyyy-mm-dd → Date */
function fromISO(iso: string | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00') // noon to avoid TZ shift
  return isNaN(d.getTime()) ? null : d
}

/** Date → yyyy-mm-dd */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** yyyy-mm-dd → dd-mm-yyyy for display */
function displayDMY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function DatePicker({
  name,
  value: controlledISO,
  defaultValue = '',
  placeholder = 'dd-mm-yyyy',
  onChange,
  required,
  className = '',
}: DatePickerProps) {
  const [internalISO, setInternalISO] = useState(defaultValue)
  const iso = controlledISO !== undefined ? controlledISO : internalISO

  const parsed = fromISO(iso)
  const [viewDate, setViewDate] = useState<Date>(parsed ?? new Date())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync controlled value → viewDate
  useEffect(() => {
    const d = fromISO(controlledISO)
    if (d) setViewDate(d)
  }, [controlledISO])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    const isoVal = toISO(d)
    if (controlledISO === undefined) setInternalISO(isoVal)
    onChange?.(isoVal)
    setOpen(false)
  }

  const prev = () => setViewDate(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))
  const next = () => setViewDate(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const isSelected = (d: number) =>
    !!parsed && d === parsed.getDate() && month === parsed.getMonth() && year === parsed.getFullYear()

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Hidden input — submits yyyy-mm-dd (same as native date input) */}
      {name && <input type="hidden" name={name} value={iso} required={required} />}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm w-full bg-white
          transition-all duration-150 cursor-pointer
          ${open ? 'border-primary ring-2 ring-primary/15 shadow-sm' : 'border-border hover:border-border/80 hover:bg-background-secondary/30'}
          ${!iso ? 'text-text-secondary' : 'text-text-primary font-medium'}
        `}
        dir="ltr"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 text-text-secondary">
          <rect width="18" height="18" x="3" y="4" rx="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
        <span className="flex-1 text-left">{iso ? displayDMY(iso) : placeholder}</span>
      </button>

      {/* Calendar popup */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl border border-border bg-white shadow-xl overflow-hidden"
          style={{ animation: 'selectDropdown 120ms cubic-bezier(0.16,1,0.3,1) both', transformOrigin: 'top center', minWidth: '280px' }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background-secondary/40">
            <button type="button" onClick={prev} className="p-1 rounded hover:bg-border/40 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">{MONTHS_AR[month]} {year}</span>
            <button type="button" onClick={next} className="p-1 rounded hover:bg-border/40 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-3 pt-2">
            {DAYS_AR.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-text-secondary py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button
                    type="button"
                    onClick={() => pick(day)}
                    className={`
                      w-8 h-8 rounded-full text-xs font-medium transition-colors
                      ${isSelected(day) ? 'bg-primary text-white shadow-sm' : ''}
                      ${isToday(day) && !isSelected(day) ? 'border border-primary text-primary font-semibold' : ''}
                      ${!isSelected(day) && !isToday(day) ? 'hover:bg-background-secondary text-text-primary' : ''}
                    `}
                  >
                    {day}
                  </button>
                ) : <div className="w-8 h-8" />}
              </div>
            ))}
          </div>

          {/* Today shortcut */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { pick(today.getDate()); setViewDate(new Date()) }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              اليوم
            </button>
            {iso && (
              <button
                type="button"
                onClick={() => {
                  if (controlledISO === undefined) setInternalISO('')
                  onChange?.('')
                  setOpen(false)
                }}
                className="text-xs text-danger hover:underline"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
