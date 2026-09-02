'use client'

/**
 * InstallPrompt — APK download button for the header.
 *
 * Per user request (Aug 2026):
 *   • Download apps should be Android-only (APK)
 *   • No mention of download in About page
 *   • Just a button next to the language switcher (top-right)
 *
 * The button:
 *   • Triggers a direct download of /locinsights.apk
 *   • On Android, the browser will offer to install after download
 *   • On desktop, the file just downloads
 *
 * Also listens for `beforeinstallprompt` (Chrome/Edge/Android) and offers
 * the native PWA install when available — the button morphs to "Install"
 * in that case (better UX than just downloading the APK).
 */

import { useState, useEffect } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Detect if already running as installed PWA
    const checkStandalone = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setInstalled(true)
      }
      if ((window.navigator as any).standalone === true) {
        setInstalled(true)
      }
    }
    checkStandalone()

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Already installed as PWA → no button needed
  if (installed) return null

  // Native PWA install prompt available → prefer that path
  if (deferredPrompt) {
    const handleInstall = async () => {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
      }
      setDeferredPrompt(null)
    }
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--brand-red)] text-white text-[12px] font-medium hover:bg-[var(--brand-red-dark)] transition-colors flex-shrink-0"
        title={t('header.install_app')}
        aria-label={t('header.install_app')}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('common.install_app')}</span>
      </button>
    )
  }

  // No native install prompt → offer direct APK download (Android-first)
  return (
    <a
      href="/locinsights.apk"
      download="locinsights.apk"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--brand-red)] text-white text-[12px] font-medium hover:bg-[var(--brand-red-dark)] transition-colors flex-shrink-0"
      title={t('header.download_apk_tooltip')}
      aria-label={t('header.download_apk')}
    >
      <Smartphone className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t('header.download_apk')}</span>
    </a>
  )
}
