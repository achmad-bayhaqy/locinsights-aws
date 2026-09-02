'use client'

/**
 * AIChat — floating bottom-right chat widget with CRUD history.
 *
 * Features:
 *   • Floating button (bottom-right) visible on ALL tabs
 *   • Click to open chat panel
 *   • Chat history sidebar: list of past conversations (Create / Read / Update / Delete)
 *   • New chat button starts fresh conversation
 *   • Each conversation persisted to localStorage (key: locinsight.chat.history)
 *   • Send/receive messages via POST /api/locinsight/chat
 *   • Markdown-style rendering for code blocks and bullet lists
 *   • Guardrailed responses (server-side) — only LocInsights topics
 *   • Online/offline detection (disables send when offline)
 *   • Mobile-responsive (full-screen on small viewports)
 *
 * Storage shape (localStorage):
 *   locinsight.chat.history = [
 *     { id, title, createdAt, updatedAt, messages: [{role, content, ts}] }
 *   ]
 *   locinsight.chat.active_id = "<conversation id>"
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, X, Send, Plus, Trash2, Edit2, MessageCircle, WifiOff, ChevronLeft, Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const HISTORY_KEY = 'locinsight.chat.history'
const ACTIVE_KEY = 'locinsight.chat.active_id'
const OPEN_KEY = 'locinsight.chat.open'
const AI_SETTINGS_KEY = 'locinsight.settings.ai'
const MAX_HISTORY = 50 // keep at most 50 conversations

/**
 * Read the user's AI config from localStorage (set via the Settings page).
 * Returns null if no config or `enabled` is false — in which case the server
 * will fall back to env vars or the rule-based help bot.
 */
function loadClientConfig(): any | null {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw)
    if (!cfg.enabled) return null
    // Only forward if required fields are present
    if (!cfg.base_url || !cfg.api_key) return null
    return {
      base_url: cfg.base_url,
      api_key: cfg.api_key,
      model: cfg.model || undefined,
      token: cfg.token || undefined,
      user_id: cfg.user_id || undefined,
      chat_id: cfg.chat_id || undefined,
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : undefined,
      max_tokens: typeof cfg.max_tokens === 'number' ? cfg.max_tokens : undefined,
    }
  } catch {
    return null
  }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadHistory(): Conversation[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(c => c && c.id && Array.isArray(c.messages))
  } catch {
    return []
  }
}

function saveHistory(convs: Conversation[]) {
  try {
    // Cap to last MAX_HISTORY conversations (most recent first)
    const sorted = [...convs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted))
  } catch {
    // localStorage may be full or unavailable
  }
}

export function AIChat() {
  const { t, lang } = useLanguage()
  // Restore panel open state after an unexpected full reload (session-scoped).
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const [clientConfigEnabled, setClientConfigEnabled] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ---- Initial load ----
  useEffect(() => {
    const hist = loadHistory()
    setConversations(hist)
    const savedActive = localStorage.getItem(ACTIVE_KEY)
    if (savedActive && hist.find(c => c.id === savedActive)) {
      setActiveId(savedActive)
    } else if (hist.length > 0) {
      setActiveId(hist[0].id)
    }
    // Online status
    setOnline(navigator.onLine)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    // Track client-config state from Settings page
    const refreshClientConfig = () => {
      const cfg = loadClientConfig()
      setClientConfigEnabled(!!cfg)
    }
    refreshClientConfig()
    window.addEventListener('locinsight:ai-settings-changed', refreshClientConfig)
    window.addEventListener('storage', refreshClientConfig)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('locinsight:ai-settings-changed', refreshClientConfig)
      window.removeEventListener('storage', refreshClientConfig)
    }
  }, [])

  // ---- Persist conversations on change ----
  useEffect(() => {
    if (conversations.length > 0) {
      saveHistory(conversations)
    } else {
      localStorage.removeItem(HISTORY_KEY)
    }
  }, [conversations])

  // ---- Persist active ID ----
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  // ---- Persist panel open state (survives unexpected reloads within session) ----
  useEffect(() => {
    try {
      if (open) sessionStorage.setItem(OPEN_KEY, '1')
      else sessionStorage.removeItem(OPEN_KEY)
    } catch {
      // sessionStorage unavailable — ignore
    }
  }, [open])

  // ---- Auto-scroll on new message ----
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversations, activeId, open])

  const activeConv = conversations.find(c => c.id === activeId) || null

  // ---- Create new conversation ----
  const newChat = useCallback(() => {
    // If there's already an empty conversation, just activate it
    const existingEmpty = conversations.find(c => c.messages.length === 0)
    if (existingEmpty) {
      setActiveId(existingEmpty.id)
      setShowHistory(false)
      setTimeout(() => inputRef.current?.focus(), 100)
      return
    }
    const conv: Conversation = {
      id: uid(),
      title: lang === 'id' ? 'Percakapan Baru' : 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
    setShowHistory(false)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [conversations, lang])

  // ---- Delete conversation ----
  const deleteConv = useCallback((id: string) => {
    if (!confirm(t('chat.delete_confirm'))) return
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
  }, [activeId, t])

  // ---- Rename conversation ----
  const startRename = useCallback((c: Conversation) => {
    setEditingId(c.id)
    setEditTitle(c.title)
  }, [])

  const commitRename = useCallback(() => {
    if (!editingId) return
    const newTitle = editTitle.trim() || (lang === 'id' ? 'Percakapan' : 'Chat')
    setConversations(prev =>
      prev.map(c => c.id === editingId ? { ...c, title: newTitle, updatedAt: Date.now() } : c)
    )
    setEditingId(null)
    setEditTitle('')
  }, [editingId, editTitle, lang])

  // ---- Clear all history ----
  const clearAll = useCallback(() => {
    if (!confirm(t('chat.clear_confirm'))) return
    setConversations([])
    setActiveId(null)
    localStorage.removeItem(HISTORY_KEY)
    localStorage.removeItem(ACTIVE_KEY)
  }, [t])

  // ---- Send message ----
  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    if (!online) {
      setError(t('chat.offline_warning'))
      return
    }

    // Ensure we have an active conversation
    let convId = activeId
    if (!convId) {
      const newConv: Conversation = {
        id: uid(),
        title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(newConv.id)
      convId = newConv.id
    }

    const userMsg: ChatMessage = { role: 'user', content: text, ts: Date.now() }
    setInput('')
    setSending(true)
    setError(null)

    // Optimistically add user message
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== convId) return c
        const updated = {
          ...c,
          messages: [...c.messages, userMsg],
          updatedAt: Date.now(),
          title: c.messages.length === 0
            ? (text.slice(0, 40) + (text.length > 40 ? '…' : ''))
            : c.title,
        }
        return updated
      })
    )

    try {
      // Build message history for the API (last 10 messages + new one)
      const currentConv = conversations.find(c => c.id === convId)
      const history = (currentConv?.messages || []).slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))
      history.push({ role: 'user', content: text })

      const res = await fetch('/api/locinsight/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          lang,
          // Forward the user's AI config from Settings so the server can
          // call the LLM endpoint on the user's behalf. This makes AI chat
          // work on Vercel even when server env vars aren't set.
          clientConfig: loadClientConfig(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      const reply: string = data.reply || ''
      if (!reply) throw new Error('Empty reply')
      // Track whether we're in fallback mode (rule-based) or full AI mode
      setFallbackMode(data.source === 'fallback')

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, ts: Date.now() }
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
          : c
        )
      )
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      // If it looks like a network error, show offline message
      const isNetwork = /fetch|network|timeout/i.test(errMsg)
      setError(isNetwork ? t('chat.offline_warning') : t('chat.error'))
      // Remove the optimistic user message if it was a total failure
      // (keeps the conversation consistent — user can retry)
    } finally {
      setSending(false)
    }
  }, [input, sending, online, activeId, conversations, lang, t])

  // ---- Keyboard: Enter to send, Shift+Enter for newline ----
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ---- Render message content (basic markdown: code blocks, bullets, bold) ----
  const renderContent = (content: string) => {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '')
        return (
          <pre key={i} className="bg-[var(--brand-ink)] text-white/90 text-[11px] p-2.5 rounded-md overflow-x-auto my-1.5 font-mono">
            <code>{code}</code>
          </pre>
        )
      }
      // Render text with basic line breaks and bullet support
      const lines = part.split('\n')
      return (
        <div key={i}>
          {lines.map((line, j) => {
            const isBullet = /^\s*[-*]\s+/.test(line)
            const isNumbered = /^\s*\d+\.\s+/.test(line)
            if (isBullet) {
              return (
                <div key={j} className="flex gap-1.5 my-0.5">
                  <span className="text-[var(--brand-red)] flex-shrink-0">•</span>
                  <span>{renderInline(line.replace(/^\s*[-*]\s+/, ''))}</span>
                </div>
              )
            }
            if (isNumbered) {
              const match = line.match(/^\s*(\d+)\.\s+(.*)$/)
              if (match) {
                return (
                  <div key={j} className="flex gap-1.5 my-0.5">
                    <span className="text-[var(--brand-red)] flex-shrink-0 font-medium">{match[1]}.</span>
                    <span>{renderInline(match[2])}</span>
                  </div>
                )
              }
            }
            return <div key={j} className={line.trim() === '' ? 'h-2' : ''}>{renderInline(line)}</div>
          })}
        </div>
      )
    })
  }

  const renderInline = (text: string) => {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={i}>{p.slice(2, -2)}</strong>
      }
      return <span key={i}>{p}</span>
    })
  }

  // ---- Render ----
  return (
    <>
      {/* Floating button (always visible) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[var(--brand-red)] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          title={t('chat.expand')}
          aria-label={t('chat.expand')}
        >
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full bg-[var(--brand-red)] opacity-40 animate-ping" style={{ animationDuration: '2.5s' }} />
          <MessageSquare className="w-6 h-6 relative z-10" />
          {/* Unread badge (if any conversations exist) */}
          {conversations.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--brand-ink)] text-white text-[10px] font-bold flex items-center justify-center z-20">
              {conversations.length > 9 ? '9+' : conversations.length}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed z-50 bg-white shadow-2xl flex flex-col border border-[var(--brand-border)]',
            // Mobile: full-screen; Desktop: 400px wide panel
            'inset-2 sm:inset-auto sm:bottom-5 sm:right-5',
            showHistory
              ? 'sm:w-[640px] sm:h-[600px]'
              : 'sm:w-[400px] sm:h-[600px]'
          )}
          style={{ borderRadius: showHistory ? 12 : 12 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--brand-border)] bg-[var(--brand-ink)] text-white rounded-t-xl">
            <div className="flex items-center gap-2 min-w-0">
              {showHistory && (
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                  title={t('common.back')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <img src="/logo-white.png" alt="" className="w-6 h-6 object-contain flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-tight truncate flex items-center gap-1.5">
                  {t('chat.title')}
                  {/* Status pill: shows whether the chat is using the user's
                      custom AI config (green) or the rule-based fallback (amber). */}
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${clientConfigEnabled ? 'bg-green-400' : 'bg-amber-400'}`}
                    title={clientConfigEnabled
                      ? 'Using your custom AI endpoint (Settings → AI)'
                      : 'Using built-in rule-based help bot — configure AI in Settings for full LLM responses'}
                  />
                </div>
                <div className="text-[10px] text-white/50 leading-tight truncate">
                  {clientConfigEnabled ? 'AI · custom endpoint' : (fallbackMode ? 'AI · help bot' : t('chat.subtitle'))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!online && (
                <span className="text-[10px] text-amber-300 flex items-center gap-1 mr-1" title={t('chat.offline_warning')}>
                  <WifiOff className="w-3 h-3" />
                </span>
              )}
              <button
                onClick={() => setShowHistory(s => !s)}
                className={cn(
                  'p-1.5 hover:bg-white/10 rounded transition-colors',
                  showHistory && 'bg-white/10'
                )}
                title={t('chat.history')}
                aria-label={t('chat.history')}
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={newChat}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title={t('chat.new_chat')}
                aria-label={t('chat.new_chat')}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title={t('common.close')}
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: chat OR history list */}
          {showHistory ? (
            /* History list */
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-[var(--brand-ink)]/50">
                  {t('chat.empty')}
                </div>
              ) : (
                <>
                  <div className="px-3 py-2 border-b border-[var(--brand-border)] flex justify-between items-center">
                    <span className="text-[11px] font-medium text-[var(--brand-ink)]/70 uppercase tracking-wider">
                      {t('chat.history')} ({conversations.length})
                    </span>
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-[var(--brand-red)] hover:underline"
                    >
                      {t('chat.clear_all')}
                    </button>
                  </div>
                  {conversations
                    .slice()
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(conv => (
                      <div
                        key={conv.id}
                        className={cn(
                          'border-b border-[var(--brand-border)] px-3 py-2.5 cursor-pointer hover:bg-[var(--brand-cream)] transition-colors group',
                          activeId === conv.id && 'bg-[var(--brand-cream)]'
                        )}
                        onClick={() => {
                          setActiveId(conv.id)
                          setShowHistory(false)
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {editingId === conv.id ? (
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitRename()
                                  if (e.key === 'Escape') { setEditingId(null); setEditTitle('') }
                                }}
                                className="w-full text-[12px] font-medium px-1 py-0.5 border border-[var(--brand-red)] rounded outline-none"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-[12.5px] font-medium text-[var(--brand-ink)] truncate">
                                {conv.title}
                              </div>
                            )}
                            <div className="text-[10.5px] text-[var(--brand-ink)]/50 mt-0.5">
                              {new Date(conv.updatedAt).toLocaleString()} · {conv.messages.length} {t('chat.token_usage', { count: conv.messages.length }).split(' ').pop()}
                            </div>
                            {conv.messages.length > 0 && (
                              <div className="text-[11px] text-[var(--brand-ink)]/60 mt-1 line-clamp-1">
                                {conv.messages[conv.messages.length - 1].content.slice(0, 80)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                startRename(conv)
                              }}
                              className="p-1 hover:bg-white rounded"
                              title={t('common.rename')}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                deleteConv(conv.id)
                              }}
                              className="p-1 hover:bg-white rounded text-[var(--brand-red)]"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          ) : (
            /* Chat view */
            <>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-styled"
              >
                {(!activeConv || activeConv.messages.length === 0) && (
                  <div className="text-center py-8 px-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--brand-cream)] flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-[var(--brand-red)]" />
                    </div>
                    <div className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
                      {t('chat.welcome')}
                    </div>
                  </div>
                )}

                {activeConv?.messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-2',
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-[var(--brand-ink)] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <img src="/logo-white.png" alt="" className="w-5 h-5 object-contain" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] px-3 py-2 rounded-lg text-[12.5px] leading-relaxed',
                        m.role === 'user'
                          ? 'bg-[var(--brand-red)] text-white rounded-br-sm'
                          : 'bg-[var(--brand-cream)] text-[var(--brand-ink)] rounded-bl-sm'
                      )}
                    >
                      {renderContent(m.content)}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-[var(--brand-ink)] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                      <img src="/logo-white.png" alt="" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="bg-[var(--brand-cream)] px-3 py-2.5 rounded-lg rounded-bl-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-ink)]/40 animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-ink)]/40 animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-ink)]/40 animate-bounce" style={{ animationDelay: '0.3s' }} />
                        <span className="text-[11px] text-[var(--brand-ink)]/50 ml-1">{t('chat.thinking')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-center text-[11px] text-[var(--brand-red)] bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                    {error}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-[var(--brand-border)] p-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('chat.placeholder')}
                    rows={1}
                    className="flex-1 resize-none border border-[var(--brand-border)] rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:border-[var(--brand-red)] focus:ring-1 focus:ring-[var(--brand-red)]/20 max-h-24 overflow-y-auto"
                    style={{ minHeight: '38px' }}
                    disabled={sending}
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || sending || !online}
                    className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
                      input.trim() && !sending && online
                        ? 'bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red-dark)]'
                        : 'bg-[var(--brand-cream)] text-[var(--brand-ink)]/30 cursor-not-allowed'
                    )}
                    title={t('chat.send')}
                    aria-label={t('chat.send')}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-[var(--brand-ink)]/40 mt-1.5 text-center">
                  {fallbackMode
                    ? (lang === 'id' ? 'Mode bantuan · Aktifkan AI penuh di Vercel' : 'Help mode · Set ZAI env vars for full AI')
                    : 'LocInsights AI · Guardrailed to location intelligence topics'}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
