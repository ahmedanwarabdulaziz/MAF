'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SETTINGS_LINKS: { href: string; label: string; danger?: boolean }[] = [
  { href: '/company/settings/company',           label: 'بيانات الشركة' },
  { href: '/company/settings/users',             label: 'إدارة المستخدمين' },
  { href: '/company/settings/permission-groups', label: 'مجموعات الصلاحيات' },
  { href: '/company/settings/access-scopes',     label: 'نطاق الوصول' },
  { href: '/company/settings/audit-log',         label: 'سجل النشاط والتدقيق' },
  { href: '/company/settings/data-reset',        label: '⚠️ إعادة تعيين البيانات', danger: true },
]

export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isSettingsActive = pathname?.startsWith('/company/settings')

  return (
    <div className="relative px-4 pb-2">
      {/* Flyup panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Menu */}
          <div className="absolute bottom-full left-4 right-4 mb-2 z-20 rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm shadow-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                الإعدادات والصلاحيات
              </span>
            </div>
            <nav className="flex flex-col py-1">
              {SETTINGS_LINKS.map((link, i) => {
                const active = pathname?.startsWith(link.href)
                const prevIsDanger = i > 0 && !SETTINGS_LINKS[i-1].danger && link.danger
                return (
                  <div key={link.href}>
                    {prevIsDanger && (
                      <div className="mx-4 my-1 border-t border-white/10" />
                    )}
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`
                        block px-4 py-2.5 text-sm font-medium transition-colors
                        focus:outline-none focus-visible:bg-white/10 focus-visible:text-white
                        ${link.danger
                          ? active
                            ? 'bg-red-500/30 text-red-200'
                            : 'text-red-300/80 hover:bg-red-500/20 hover:text-red-200 focus-visible:bg-red-500/20 focus-visible:text-red-200'
                          : active
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white'
                        }
                      `}
                    >
                      {link.label}
                    </Link>
                  </div>
                )
              })}
            </nav>
          </div>
        </>
      )}

      {/* Gear button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
          transition-colors border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50
          ${isSettingsActive || open
            ? 'bg-white/15 text-white border-white/20'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        {/* Gear SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>الإعدادات والصلاحيات</span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`mr-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </button>
    </div>
  )
}
