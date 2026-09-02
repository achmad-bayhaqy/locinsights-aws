'use client'

/**
 * Settings page — overall website settings + AI assistant configuration.
 *
 * Three tabs:
 *   1. General  — language, theme (placeholder), map tile provider, reset
 *   2. AI       — base URL, API key, model, token, user ID, chat ID,
 *                 temperature, max_tokens; test-connection + save/clear
 *   3. About    — version, build, developer credit
 *
 * All settings persist to localStorage (key: locinsight.settings.*).
 * The AI tab's settings are read by the AI chat client on each request
 * and forwarded to /api/locinsight/chat, which uses them in lieu of
 * server env vars — this is what makes AI chat work on Vercel without
 * requiring dashboard access.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Settings as SettingsIcon, Brain, Globe, Palette, Save, Trash2, TestTube2,
  CheckCircle2, XCircle, Loader2, Info, RotateCcw, Shield, Key, Server,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-provider'

// ============================================================================
// Settings storage helpers — localStorage with a versioned key
// ============================================================================

const SETTINGS_KEY = 'locinsight.settings.ai'
const GENERAL_KEY = 'locinsight.settings.general'

export interface AISettings {
  enabled: boolean
  base_url: string
  api_key: string
  model: string
  token: string
  user_id: string
  chat_id: string
  temperature: number
  max_tokens: number
}

const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  base_url: 'https://internal-api.z.ai/v1',
  api_key: '',
  model: 'glm-4-plus',
  token: '',
  user_id: '',
  chat_id: '',
  temperature: 0.3,
  max_tokens: 1024,
}

interface GeneralSettings {
  language: 'en' | 'id' | 'auto'
  theme: 'light' | 'dark'
  map_tile: 'light' | 'dark' | 'satellite'
}

const DEFAULT_GENERAL: GeneralSettings = {
  language: 'auto',
  theme: 'light',
  map_tile: 'light',
}

function loadAI(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_AI_SETTINGS
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

function loadGeneral(): GeneralSettings {
  if (typeof window === 'undefined') return DEFAULT_GENERAL
  try {
    const raw = localStorage.getItem(GENERAL_KEY)
    if (!raw) return DEFAULT_GENERAL
    return { ...DEFAULT_GENERAL, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_GENERAL
  }
}

function saveAI(s: AISettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function saveGeneral(s: GeneralSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(GENERAL_KEY, JSON.stringify(s))
}

// ============================================================================
// Component
// ============================================================================

export function Settings() {
  const { t, lang, setLang } = useLanguage()
  const [ai, setAi] = useState<AISettings>(DEFAULT_AI_SETTINGS)
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setAi(loadAI())
    setGeneral(loadGeneral())
    setLoaded(true)
  }, [])

  const updateAI = useCallback(<K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setAi(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateGeneral = useCallback(<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setGeneral(prev => {
      const next = { ...prev, [key]: value }
      saveGeneral(next)
      return next
    })
  }, [])

  function saveAISettings() {
    saveAI(ai)
    toast.success(t('settings.ai.saved'))
    // Dispatch an event so the AI chat client can re-read the settings
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('locinsight:ai-settings-changed'))
    }
  }

  function clearAISettings() {
    setAi({ ...DEFAULT_AI_SETTINGS, enabled: false })
    saveAI({ ...DEFAULT_AI_SETTINGS, enabled: false })
    setTestResult(null)
    toast.info(t('settings.ai.cleared'))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('locinsight:ai-settings-changed'))
    }
  }

  async function testConnection() {
    if (!ai.base_url || !ai.api_key) {
      toast.error('Base URL and API Key are required')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/locinsight/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Reply with just the word OK.' }],
          lang,
          clientConfig: {
            base_url: ai.base_url,
            api_key: ai.api_key,
            model: ai.model,
            token: ai.token,
            user_id: ai.user_id,
            chat_id: ai.chat_id,
            temperature: ai.temperature,
            max_tokens: 50,
          },
        }),
      })
      const data = await res.json()
      if (data.source === 'zai') {
        setTestResult({ ok: true, message: t('settings.ai.test_success', { model: ai.model }) })
      } else {
        setTestResult({
          ok: false,
          message: t('settings.ai.test_failed', { error: data.note || 'Server used fallback (not the custom endpoint)' }),
        })
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: t('settings.ai.test_failed', { error: e.message }) })
    } finally {
      setTesting(false)
    }
  }

  function resetAll() {
    if (!confirm(t('settings.general.reset.confirm'))) return
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_KEY)
      localStorage.removeItem(GENERAL_KEY)
    }
    setAi(DEFAULT_AI_SETTINGS)
    setGeneral(DEFAULT_GENERAL)
    toast.success(t('settings.general.reset.done'))
    window.dispatchEvent(new CustomEvent('locinsight:ai-settings-changed'))
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-red)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[var(--brand-red)]" />
          {t('settings.title')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('settings.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="text-[12px]">
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            {t('settings.tab.general')}
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-[12px]">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            {t('settings.tab.ai')}
            {ai.enabled && (
              <Badge variant="outline" className="ml-2 text-[9px] h-4 bg-green-50 text-green-700 border-green-300">
                ON
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="about" className="text-[12px]">
            <Info className="w-3.5 h-3.5 mr-1.5" />
            {t('settings.tab.about')}
          </TabsTrigger>
        </TabsList>

        {/* ============== General tab ============== */}
        <TabsContent value="general" className="space-y-4 mt-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                {t('settings.general.section')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default language */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-[12px] font-medium text-[var(--brand-ink)] block">
                    {t('settings.general.language')}
                  </Label>
                  <div className="text-[10.5px] text-[var(--brand-ink)]/55 mt-0.5">
                    {t('settings.general.language.hint')}
                  </div>
                </div>
                <Select
                  value={general.language}
                  onValueChange={(v) => {
                    updateGeneral('language', v as any)
                    if (v === 'en' || v === 'id') setLang(v)
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (browser)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Theme (placeholder for future) */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-[12px] font-medium text-[var(--brand-ink)] block">
                    {t('settings.general.theme')}
                  </Label>
                  <div className="text-[10.5px] text-[var(--brand-ink)]/55 mt-0.5">
                    Currently only Light theme is supported. Dark theme is coming soon.
                  </div>
                </div>
                <Select
                  value={general.theme}
                  onValueChange={(v) => updateGeneral('theme', v as any)}
                  disabled
                >
                  <SelectTrigger className="w-[180px] h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('settings.general.theme.light')}</SelectItem>
                    <SelectItem value="dark">{t('settings.general.theme.dark')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Map tile provider */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-[12px] font-medium text-[var(--brand-ink)] block">
                    {t('settings.general.map_tile')}
                  </Label>
                  <div className="text-[10.5px] text-[var(--brand-ink)]/55 mt-0.5">
                    {t('settings.general.map_tile.hint')}
                  </div>
                </div>
                <Select
                  value={general.map_tile}
                  onValueChange={(v) => updateGeneral('map_tile', v as any)}
                >
                  <SelectTrigger className="w-[180px] h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('settings.general.map_tile.light')}</SelectItem>
                    <SelectItem value="dark">{t('settings.general.map_tile.dark')}</SelectItem>
                    <SelectItem value="satellite">{t('settings.general.map_tile.satellite')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset all */}
              <div className="pt-3 border-t border-[var(--brand-border)]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  className="text-[var(--brand-red)] border-[var(--brand-red)]/30 hover:bg-[var(--brand-red)]/10"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('settings.general.reset')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== AI tab ============== */}
        <TabsContent value="ai" className="space-y-4 mt-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                {t('settings.ai.section')}
                <span className="ml-auto text-[10px] normal-case tracking-normal font-normal">
                  {ai.enabled ? (
                    <Badge variant="outline" className="text-[9px] h-4 bg-green-50 text-green-700 border-green-300">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                      {t('settings.ai.status.configured')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4 bg-gray-50 text-gray-700 border-gray-300">
                      {t('settings.ai.status.fallback')}
                    </Badge>
                  )}
                </span>
              </CardTitle>
              <p className="text-[11px] text-[var(--brand-ink)]/60 leading-relaxed mt-1">
                {t('settings.ai.subtitle')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable custom AI */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-[var(--brand-cream)] border border-[var(--brand-border)]">
                <div className="flex-1">
                  <Label className="text-[12px] font-medium text-[var(--brand-ink)] block">
                    {t('settings.ai.enabled')}
                  </Label>
                  <div className="text-[10.5px] text-[var(--brand-ink)]/55 mt-0.5">
                    {t('settings.ai.enabled.hint')}
                  </div>
                </div>
                <Switch
                  checked={ai.enabled}
                  onCheckedChange={(v) => updateAI('enabled', v)}
                />
              </div>

              {/* Base URL */}
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  {t('settings.ai.base_url')}
                </Label>
                <Input
                  value={ai.base_url}
                  onChange={(e) => updateAI('base_url', e.target.value)}
                  placeholder="https://internal-api.z.ai/v1"
                  className="h-9 text-[12px] font-mono"
                />
                <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('settings.ai.base_url.hint')}</div>
              </div>

              {/* API Key */}
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {t('settings.ai.api_key')}
                </Label>
                <Input
                  type="password"
                  value={ai.api_key}
                  onChange={(e) => updateAI('api_key', e.target.value)}
                  placeholder="sk-... or Z.ai"
                  className="h-9 text-[12px] font-mono"
                />
                <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('settings.ai.api_key.hint')}</div>
              </div>

              {/* Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                    {t('settings.ai.model')}
                  </Label>
                  <Input
                    value={ai.model}
                    onChange={(e) => updateAI('model', e.target.value)}
                    placeholder="glm-4-plus"
                    className="h-9 text-[12px] font-mono"
                  />
                  <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('settings.ai.model.hint')}</div>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 mb-1.5 block">
                    {t('settings.ai.max_tokens')}
                  </Label>
                  <Input
                    type="number"
                    value={ai.max_tokens}
                    onChange={(e) => updateAI('max_tokens', Number(e.target.value) || 1024)}
                    min={128}
                    max={8192}
                    step={128}
                    className="h-9 text-[12px]"
                  />
                  <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('settings.ai.max_tokens.hint')}</div>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                    {t('settings.ai.temperature')}: <strong className="text-[var(--brand-red)] num-tabular ml-1">{ai.temperature.toFixed(2)}</strong>
                  </Label>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ai.temperature}
                  onChange={(e) => updateAI('temperature', Number(e.target.value))}
                  className="w-full accent-[var(--brand-red)]"
                />
                <div className="text-[10px] text-[var(--brand-ink)]/50 mt-1">{t('settings.ai.temperature.hint')}</div>
              </div>

              {/* Optional: token, user_id, chat_id */}
              <details className="group">
                <summary className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 cursor-pointer hover:text-[var(--brand-red)] flex items-center gap-1 select-none">
                  <Shield className="w-3 h-3" />
                  Optional Z.AI Headers (token / user_id / chat_id)
                  <span className="ml-auto text-[9px] normal-case tracking-normal text-[var(--brand-ink)]/40 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label className="text-[10.5px] text-[var(--brand-ink)]/60 mb-1 block">{t('settings.ai.token')}</Label>
                    <Input
                      type="password"
                      value={ai.token}
                      onChange={(e) => updateAI('token', e.target.value)}
                      placeholder="eyJhbGc..."
                      className="h-8 text-[11px] font-mono"
                    />
                    <div className="text-[9px] text-[var(--brand-ink)]/50 mt-0.5">{t('settings.ai.token.hint')}</div>
                  </div>
                  <div>
                    <Label className="text-[10.5px] text-[var(--brand-ink)]/60 mb-1 block">{t('settings.ai.user_id')}</Label>
                    <Input
                      value={ai.user_id}
                      onChange={(e) => updateAI('user_id', e.target.value)}
                      placeholder="50b70903-..."
                      className="h-8 text-[11px] font-mono"
                    />
                    <div className="text-[9px] text-[var(--brand-ink)]/50 mt-0.5">{t('settings.ai.user_id.hint')}</div>
                  </div>
                  <div>
                    <Label className="text-[10.5px] text-[var(--brand-ink)]/60 mb-1 block">{t('settings.ai.chat_id')}</Label>
                    <Input
                      value={ai.chat_id}
                      onChange={(e) => updateAI('chat_id', e.target.value)}
                      placeholder="chat-..."
                      className="h-8 text-[11px] font-mono"
                    />
                    <div className="text-[9px] text-[var(--brand-ink)]/50 mt-0.5">{t('settings.ai.chat_id.hint')}</div>
                  </div>
                </div>
              </details>

              {/* Test result */}
              {testResult && (
                <div
                  className={`text-[11px] px-3 py-2 rounded-md flex items-start gap-2 ${
                    testResult.ok
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {testResult.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--brand-border)]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testing || !ai.base_url || !ai.api_key}
                  className="h-8 text-[11px]"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <TestTube2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {testing ? t('settings.ai.testing') : t('settings.ai.test')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAISettings}
                  className="h-8 text-[11px] text-[var(--brand-red)] border-[var(--brand-red)]/30 hover:bg-[var(--brand-red)]/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('settings.ai.clear')}
                </Button>
                <Button
                  size="sm"
                  onClick={saveAISettings}
                  className="h-8 text-[11px] ml-auto bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)]"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {t('settings.ai.save')}
                </Button>
              </div>

              {/* Security note */}
              <div className="text-[10px] text-[var(--brand-ink)]/55 leading-relaxed bg-[var(--brand-cream)] border border-[var(--brand-border)] rounded p-2.5 flex items-start gap-2">
                <Shield className="w-3 h-3 flex-shrink-0 mt-0.5 text-[var(--brand-ink)]/40" />
                <span>{t('settings.ai.security_note')}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== About tab ============== */}
        <TabsContent value="about" className="space-y-4 mt-3">
          <Card className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-[12px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[var(--brand-red)]" />
                {t('settings.about.section')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[var(--brand-ink)]/60">{t('settings.about.version')}</span>
                <strong className="num-tabular">2.4.0</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--brand-ink)]/60">{t('settings.about.build')}</span>
                <strong className="num-tabular">{new Date().toISOString().slice(0, 10)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--brand-ink)]/60">{t('settings.about.developer')}</span>
                <a
                  href="https://bayhaqy.my.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand-red)] hover:underline"
                >
                  Achmad Bayhaqy
                </a>
              </div>
              <div className="pt-3 mt-2 border-t border-[var(--brand-border)] text-[11px] text-[var(--brand-ink)]/60 leading-relaxed">
                {t('settings.about.developer_note')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
