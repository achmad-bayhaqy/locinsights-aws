'use client'

/**
 * Lightweight i18n provider for LocInsights.
 *
 * - Default language: English (en)
 * - User can switch to Indonesian (id) via the language toggle in the header
 * - Choice persisted to localStorage
 * - Falls back to English if a key is missing in the chosen language
 * - `t(key, params?)` interpolates {name} placeholders
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translations, type Lang } from './translations'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'locinsight.lang'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  // Load saved language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (saved === 'en' || saved === 'id') {
        setLangState(saved)
        document.documentElement.lang = saved
      } else {
        // Auto-detect from browser on first visit
        const browserLang = navigator.language.toLowerCase()
        if (browserLang.startsWith('id')) {
          setLangState('id')
          document.documentElement.lang = 'id'
        } else {
          document.documentElement.lang = 'en'
        }
      }
    } catch {
      // localStorage might not be available (SSR, private mode)
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
      document.documentElement.lang = l
    } catch {
      // ignore
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'en' ? 'id' : 'en'
      try {
        localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.lang = next
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = translations[lang] || translations.en
      let str = dict[key] ?? translations.en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
    },
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Hard fallback — should never happen since layout wraps everything,
    // but if it does, we don't want to crash the page.
    return {
      lang: 'en' as Lang,
      setLang: () => {},
      toggleLang: () => {},
      t: (key: string, params?: Record<string, string | number>) => {
        let str = translations.en[key] ?? key
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
          }
        }
        return str
      },
    }
  }
  return ctx
}
