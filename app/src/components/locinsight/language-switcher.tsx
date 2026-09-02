'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import { LANGUAGES } from '@/lib/i18n/translations'
import { cn } from '@/lib/utils'

/**
 * LanguageSwitcher — compact EN/ID toggle in the header.
 *
 * Two modes:
 *   • Compact (default): pill showing [EN | ID], click to toggle
 *   • Expanded (dropdown): globe icon + dropdown menu
 *
 * Default mode is the pill toggle — fast and obvious. Click directly toggles
 * between EN and ID. If we add more languages later, swap to the dropdown.
 */
export function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'dropdown' }) {
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (variant === 'pill') {
    return (
      <div
        className="flex items-center bg-[var(--brand-cream)] rounded-md p-0.5 text-[11px] font-medium select-none"
        role="group"
        aria-label={t('header.language')}
      >
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              lang === l.code
                ? 'bg-[var(--brand-red)] text-white shadow-sm'
                : 'text-[var(--brand-ink)]/60 hover:text-[var(--brand-ink)]'
            )}
            aria-pressed={lang === l.code}
            title={l.label}
          >
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>
    )
  }

  // Dropdown variant
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/70 hover:text-[var(--brand-ink)] transition-colors text-[12px]"
        title={t('header.language')}
        aria-label={t('header.language')}
        aria-expanded={open}
      >
        <Globe className="w-4 h-4" />
        <span className="font-medium">{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-[var(--brand-border)] rounded-md shadow-lg z-50 py-1">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-[12px] hover:bg-[var(--brand-cream)] transition-colors',
                lang === l.code ? 'text-[var(--brand-red)] font-medium' : 'text-[var(--brand-ink)]/80'
              )}
            >
              <span className="flex items-center gap-2">
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </span>
              {lang === l.code && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
