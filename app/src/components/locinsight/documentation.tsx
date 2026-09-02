'use client'

/**
 * LocInsights — Documentation Hub
 *
 * Full DB-backed documentation browser with markdown rendering, TOC,
 * edit/create/delete (admin roles), live preview, and localStorage drafts.
 *
 * Architecture:
 *   • Sidebar (left):   file tree grouped by `category`, search box, New Doc button
 *   • Main panel:       markdown rendered with react-markdown + remark-gfm + rehype-highlight
 *   • Right rail:       auto-generated Table of Contents (sticky)
 *   • Edit mode:        split-pane editor + live preview, auto-save draft to localStorage
 *   • Create dialog:    full create-doc form
 *   • Delete dialog:    confirmation with constraints
 *
 * Storage: all docs are stored in PostgreSQL via the Prisma `Doc` model.
 * Filesystem is NEVER touched (Vercel serverless FS is read-only).
 *
 * Auth model:
 *   • Read: any authenticated user
 *   • Create/Edit/Delete: superadmin + admin + tenant_admin
 *   • System docs (tenant_id=NULL): only superadmin can edit/delete
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  FileText, Search, Plus, Edit, Trash2, Save, X, Eye, Printer, BookOpen,
  ChevronDown, ChevronRight, Folder, File, RefreshCw, Loader2, ExternalLink,
  History, Hash, ListTree, AlertCircle, Check, Cloud, FileEdit,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/language-provider'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import 'highlight.js/styles/github.css'

// =====================================================
// Types
// =====================================================
interface DocMeta {
  id: string
  slug: string
  title: string
  category: string
  order: number
  owner: string
  tenant_id: string | null
  is_published: boolean
  last_updated: string
  excerpt?: string
}

interface DocFull extends DocMeta {
  content: string
  created_at: string
  updated_at: string
}

interface TocItem {
  level: number
  text: string
  anchor: string
}

// =====================================================
// Helpers
// =====================================================

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Generate a URL-safe anchor from heading text. */
function anchorFromHeading(text: string): string {
  return slugify(text)
}

/** Parse markdown for ^## and ^### headings → TOC entries. */
function buildToc(markdown: string): TocItem[] {
  const lines = markdown.split(/\r?\n/)
  const items: TocItem[] = []
  let inCodeBlock = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const m2 = line.match(/^##\s+(.+?)\s*$/)
    if (m2) {
      const text = m2[1].replace(/[`*_~]/g, '').trim()
      items.push({ level: 2, text, anchor: anchorFromHeading(text) })
      continue
    }
    const m3 = line.match(/^###\s+(.+?)\s*$/)
    if (m3) {
      const text = m3[1].replace(/[`*_~]/g, '').trim()
      items.push({ level: 3, text, anchor: anchorFromHeading(text) })
    }
  }
  return items
}

/** Format ISO date string → "Aug 9, 2026". */
function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Defensive JSON parse — guards against empty/non-JSON responses. */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return { success: false, error: 'Empty response from server' }
  try {
    return JSON.parse(text)
  } catch {
    return { success: false, error: `Invalid JSON response: ${text.slice(0, 200)}` }
  }
}

// =====================================================
// Main Component
// =====================================================
export function Documentation() {
  const { t } = useLanguage()
  const { data: session, status: sessionStatus } = useSession()

  const [docs, setDocs] = useState<DocMeta[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [search, setSearch] = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({})

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [currentDoc, setCurrentDoc] = useState<DocFull | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)

  const [mode, setMode] = useState<'view' | 'edit'>('view')

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editOwner, setEditOwner] = useState('')
  const [editOrder, setEditOrder] = useState(100)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false)

  // Delete dialog state
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Permissions
  // Per user request (Aug 14 2026): only superadmin can create/edit/delete docs.
  // All other roles (admin, tenant_admin, data, analyst, viewer) are read-only.
  const role = session?.user?.role as string | undefined
  const isSuperadmin = role === 'superadmin'
  const canCreate = isSuperadmin
  const canUpdate = isSuperadmin
  const canDelete = isSuperadmin

  // ---------- Load doc list ----------
  const loadDocs = useCallback(async () => {
    setLoadingList(true)
    try {
      const url = new URL('/api/docs', window.location.origin)
      if (search.trim()) url.searchParams.set('search', search.trim())
      const res = await fetch(url.toString(), { cache: 'no-store' })
      const j = await safeJson(res)
      if (j.success) {
        setDocs(j.data || [])
      } else {
        toast.error(j.error || 'Failed to load docs')
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error loading docs')
    } finally {
      setLoadingList(false)
    }
  }, [search])

  // ---------- Load categories ----------
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/docs/categories', { cache: 'no-store' })
      const j = await safeJson(res)
      if (j.success) setCategories(j.data || [])
    } catch {
      // silent — categories are a nice-to-have
    }
  }, [])

  // Initial load
  useEffect(() => {
    if (sessionStatus !== 'loading') loadDocs()
  }, [sessionStatus, loadDocs])

  // Categories load once
  useEffect(() => {
    if (sessionStatus !== 'loading') loadCategories()
  }, [sessionStatus, loadCategories])

  // ---------- Load single doc ----------
  const loadDoc = useCallback(async (slug: string) => {
    setLoadingDoc(true)
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const j = await safeJson(res)
      if (j.success) {
        setCurrentDoc(j.data)
        setMode('view')
      } else {
        toast.error(j.error || 'Failed to load doc')
        setCurrentDoc(null)
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error loading doc')
      setCurrentDoc(null)
    } finally {
      setLoadingDoc(false)
    }
  }, [])

  // ---------- Auto-select first doc ----------
  useEffect(() => {
    if (!selectedSlug && docs.length > 0 && !loadingList) {
      setSelectedSlug(docs[0].slug)
    }
  }, [docs, selectedSlug, loadingList])

  // ---------- Load doc when slug changes ----------
  useEffect(() => {
    if (selectedSlug) loadDoc(selectedSlug)
    else setCurrentDoc(null)
  }, [selectedSlug, loadDoc])

  // ---------- Edit mode: load draft from localStorage ----------
  const draftKey = currentDoc ? `locinsights.doc.draft.${currentDoc.slug}` : null
  const [hasDraft, setHasDraft] = useState(false)

  const enterEditMode = useCallback(() => {
    if (!currentDoc) return
    // Check for existing draft
    let draftContent = currentDoc.content
    if (draftKey) {
      const saved = localStorage.getItem(draftKey)
      if (saved && saved !== currentDoc.content) {
        if (confirm('A saved draft was found for this doc. Restore it? (Cancel to discard and use the saved version.)')) {
          draftContent = saved
          toast.info('Draft restored from localStorage')
        } else {
          localStorage.removeItem(draftKey)
        }
      }
    }
    setEditTitle(currentDoc.title)
    setEditCategory(currentDoc.category)
    setEditContent(draftContent)
    setEditOwner(currentDoc.owner)
    setEditOrder(currentDoc.order)
    setMode('edit')
  }, [currentDoc, draftKey])

  const cancelEdit = useCallback(() => {
    if (draftKey) {
      const saved = localStorage.getItem(draftKey)
      if (saved && saved !== (currentDoc?.content || '')) {
        if (!confirm('Discard the unsaved draft for this doc?')) return
        localStorage.removeItem(draftKey)
        setHasDraft(false)
      }
    }
    setMode('view')
    // Reset edit state
    if (currentDoc) {
      setEditTitle(currentDoc.title)
      setEditContent(currentDoc.content)
    }
  }, [draftKey, currentDoc])

  // ---------- Auto-save draft every 5s ----------
  useEffect(() => {
    if (mode !== 'edit' || !draftKey) return
    const interval = setInterval(() => {
      if (editContent) {
        localStorage.setItem(draftKey, editContent)
        setDraftSavedAt(new Date())
        setHasDraft(true)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [mode, draftKey, editContent])

  // ---------- Check for draft on doc change ----------
  useEffect(() => {
    if (draftKey) {
      const saved = localStorage.getItem(draftKey)
      setHasDraft(!!saved && saved !== (currentDoc?.content || ''))
    } else {
      setHasDraft(false)
    }
  }, [draftKey, currentDoc])

  // ---------- Save doc (PUT) ----------
  const saveDoc = useCallback(async () => {
    if (!currentDoc) return
    if (!editTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(currentDoc.slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory.trim() || 'General',
          content: editContent,
          owner: editOwner.trim() || 'Data Team',
          order: editOrder,
        }),
      })
      const j = await safeJson(res)
      if (j.success) {
        // Clear draft
        if (draftKey) {
          localStorage.removeItem(draftKey)
          setHasDraft(false)
        }
        toast.success('Document saved')
        setCurrentDoc(j.data)
        setMode('view')
        // Refresh list (title/category may have changed)
        loadDocs()
        loadCategories()
      } else {
        toast.error(j.error || 'Failed to save doc')
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error saving doc')
    } finally {
      setSaving(false)
    }
  }, [currentDoc, editTitle, editCategory, editContent, editOwner, editOrder, draftKey, loadDocs, loadCategories])

  // ---------- Delete doc ----------
  const deleteDoc = useCallback(async () => {
    if (!currentDoc) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(currentDoc.slug)}`, {
        method: 'DELETE',
      })
      const j = await safeJson(res)
      if (j.success) {
        toast.success('Document deleted')
        // Clear draft
        if (draftKey) {
          localStorage.removeItem(draftKey)
        }
        setShowDelete(false)
        setSelectedSlug(null)
        setCurrentDoc(null)
        loadDocs()
        loadCategories()
      } else {
        toast.error(j.error || 'Failed to delete doc')
      }
    } catch (e: any) {
      toast.error(e.message || 'Network error deleting doc')
    } finally {
      setDeleting(false)
    }
  }, [currentDoc, draftKey, loadDocs, loadCategories])

  // ---------- Group docs by category ----------
  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocMeta[]> = {}
    for (const d of docs) {
      const cat = d.category || 'Uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(d)
    }
    // Sort categories alphabetically, but pin "Meta" last
    const sortedCats = Object.keys(groups).sort((a, b) => {
      if (a === 'Meta' && b !== 'Meta') return 1
      if (b === 'Meta' && a !== 'Meta') return -1
      return a.localeCompare(b)
    })
    return sortedCats.map(cat => ({ category: cat, items: groups[cat] }))
  }, [docs])

  // ---------- TOC from current doc ----------
  const toc = useMemo(() => {
    if (mode === 'edit') return buildToc(editContent)
    if (currentDoc) return buildToc(currentDoc.content)
    return []
  }, [currentDoc, mode, editContent])

  // ---------- Scroll to anchor ----------
  const scrollToAnchor = useCallback((anchor: string) => {
    const el = document.getElementById(anchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // ---------- Render ----------
  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-red)]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--brand-red)]" />
            Documentation
          </h1>
          <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
            Guides, references, and technical docs. Stored in DB, edited live.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadDocs(); loadCategories() }}
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5" />
              New Doc
            </Button>
          )}
        </div>
      </div>

      {/* 3-column layout: sidebar | main | toc */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_220px] gap-4 items-start">
        {/* ===================================================== */}
        {/* Sidebar — file tree */}
        {/* ===================================================== */}
        <Card className="card-premium lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] flex flex-col">
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--brand-ink)]/40" />
              <Input
                placeholder="Search docs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-[12px]"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 overflow-hidden p-0">
            <div className="max-h-[60vh] lg:max-h-[calc(100vh-12rem)] overflow-y-auto scroll-styled px-3 pb-3">
              {loadingList ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-ink)]/40" />
                </div>
              ) : groupedDocs.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[var(--brand-ink)]/50">
                  {search ? 'No docs match your search.' : 'No docs found.'}
                </div>
              ) : (
                groupedDocs.map(group => {
                  const isCollapsed = collapsedCats[group.category]
                  return (
                    <div key={group.category} className="mb-2">
                      <button
                        onClick={() => setCollapsedCats(c => ({ ...c, [group.category]: !c[group.category] }))}
                        className="w-full flex items-center gap-1.5 px-1.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--brand-ink)]/55 hover:text-[var(--brand-ink)] transition-colors"
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                        }
                        <Folder className="w-3 h-3" />
                        <span className="flex-1 text-left">{group.category}</span>
                        <span className="text-[var(--brand-ink)]/35 normal-case font-normal">{group.items.length}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="ml-1 mt-0.5 space-y-0.5">
                          {group.items.map(doc => {
                            const isActive = selectedSlug === doc.slug
                            const isSystem = doc.tenant_id === null
                            return (
                              <button
                                key={doc.slug}
                                onClick={() => setSelectedSlug(doc.slug)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-md transition-all group ${
                                  isActive
                                    ? 'bg-[var(--brand-red)] text-white'
                                    : 'hover:bg-[var(--brand-cream)] text-[var(--brand-ink)]/80'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <FileText className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[var(--brand-ink)]/40'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-medium leading-tight truncate">
                                      {doc.title}
                                    </div>
                                    <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-[var(--brand-ink)]/40'}`}>
                                      {formatDate(doc.last_updated)}
                                      {isSystem ? ' · system' : ''}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===================================================== */}
        {/* Main panel — doc content / editor */}
        {/* ===================================================== */}
        <div className="min-w-0">
          {loadingDoc ? (
            <Card className="card-premium">
              <CardContent className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-red)]" />
                <span className="ml-2 text-[12px] text-[var(--brand-ink)]/60">Loading doc...</span>
              </CardContent>
            </Card>
          ) : !currentDoc ? (
            <Card className="card-premium">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-10 h-10 text-[var(--brand-ink)]/30 mb-3" />
                <div className="text-[14px] font-medium text-[var(--brand-ink)]/70 mb-1">
                  Select a doc to view
                </div>
                <div className="text-[12px] text-[var(--brand-ink)]/50">
                  Choose a document from the sidebar.
                </div>
              </CardContent>
            </Card>
          ) : mode === 'view' ? (
            <ViewMode
              doc={currentDoc}
              toc={toc}
              onEdit={canUpdate ? enterEditMode : undefined}
              onDelete={canDelete ? () => setShowDelete(true) : undefined}
              onPrint={() => window.print()}
              onAnchorClick={scrollToAnchor}
              isSuperadmin={isSuperadmin}
              canUpdate={canUpdate}
              canDelete={canDelete}
              hasDraft={hasDraft}
            />
          ) : (
            <EditMode
              title={editTitle}
              category={editCategory}
              content={editContent}
              owner={editOwner}
              order={editOrder}
              categories={categories}
              toc={toc}
              draftSavedAt={draftSavedAt}
              saving={saving}
              onTitleChange={setEditTitle}
              onCategoryChange={setEditCategory}
              onContentChange={setEditContent}
              onOwnerChange={setEditOwner}
              onOrderChange={(v) => setEditOrder(Number(v) || 0)}
              onSave={saveDoc}
              onCancel={cancelEdit}
              onAnchorClick={scrollToAnchor}
            />
          )}
        </div>

        {/* ===================================================== */}
        {/* TOC rail (sticky, hidden on small screens) */}
        {/* ===================================================== */}
        <div className="hidden lg:block">
          <Card className="card-premium lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 flex items-center gap-1.5">
                <ListTree className="w-3 h-3" />
                On this page
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {toc.length === 0 ? (
                <div className="text-[11px] text-[var(--brand-ink)]/40 px-1">No headings.</div>
              ) : (
                <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto scroll-styled">
                  {toc.map((item, i) => (
                    <button
                      key={`${item.anchor}-${i}`}
                      onClick={() => scrollToAnchor(item.anchor)}
                      className={`block w-full text-left text-[11px] leading-snug px-1.5 py-1 rounded hover:bg-[var(--brand-cream)] hover:text-[var(--brand-red)] transition-colors ${
                        item.level === 2
                          ? 'text-[var(--brand-ink)]/70 font-medium'
                          : 'text-[var(--brand-ink)]/55 pl-4'
                      }`}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===================================================== */}
      {/* Create dialog */}
      {/* ===================================================== */}
      <CreateDocDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        categories={categories}
        isSuperadmin={isSuperadmin}
        onCreated={(newDoc) => {
          setShowCreate(false)
          loadDocs()
          loadCategories()
          setSelectedSlug(newDoc.slug)
          toast.success(`Created "${newDoc.title}"`)
        }}
      />

      {/* ===================================================== */}
      {/* Delete confirmation */}
      {/* ===================================================== */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--brand-red)]">
              <AlertCircle className="w-4 h-4" />
              Delete document
            </DialogTitle>
            <DialogDescription>
              You are about to delete <strong>{currentDoc?.title}</strong> ({currentDoc?.slug}).
              {currentDoc?.tenant_id === null && !isSuperadmin && (
                <span className="block mt-2 text-[var(--brand-red)]">
                  System docs can only be deleted by superadmin.
                </span>
              )}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteDoc}
              disabled={deleting || (currentDoc?.tenant_id === null && !isSuperadmin)}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// View Mode — read-only markdown render
// =====================================================
interface ViewModeProps {
  doc: DocFull
  toc: TocItem[]
  onEdit?: () => void
  onDelete?: () => void
  onPrint: () => void
  onAnchorClick: (anchor: string) => void
  isSuperadmin: boolean
  canUpdate: boolean
  canDelete: boolean
  hasDraft: boolean
}

function ViewMode({ doc, toc, onEdit, onDelete, onPrint, isSuperadmin, canUpdate, canDelete, hasDraft }: ViewModeProps) {
  const canEditThis = doc.tenant_id === null
    ? isSuperadmin && canUpdate
    : canUpdate

  const canDeleteThis = doc.tenant_id === null
    ? isSuperadmin && canDelete
    : canDelete

  return (
    <Card className="card-premium print:border-0 print:shadow-none">
      {/* Header */}
      <CardHeader className="border-b border-[var(--brand-border)] pb-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                {doc.category}
              </Badge>
              {doc.tenant_id === null ? (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                  System
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">
                  Tenant
                </Badge>
              )}
              {!doc.is_published && (
                <Badge className="text-[10px] uppercase tracking-wider bg-amber-500 hover:bg-amber-500">
                  Draft
                </Badge>
              )}
              {hasDraft && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-amber-600 border-amber-300">
                  <Cloud className="w-2.5 h-2.5" />
                  Unsaved draft
                </Badge>
              )}
            </div>
            <h1 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
              {doc.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11.5px] text-[var(--brand-ink)]/55">
              <span className="flex items-center gap-1">
                <History className="w-3 h-3" />
                Updated {formatDate(doc.last_updated)}
              </span>
              <span className="flex items-center gap-1">
                <FileEdit className="w-3 h-3" />
                {doc.owner}
              </span>
              <span className="flex items-center gap-1 text-[var(--brand-ink)]/40">
                <Hash className="w-3 h-3" />
                {doc.slug}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEditThis && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
            {canDeleteThis && (
              <Button variant="outline" size="sm" onClick={onDelete} className="text-[var(--brand-red)] hover:text-[var(--brand-red)]">
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onPrint} title="Print or save as PDF">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Body */}
      <CardContent className="pt-4 print:pt-0">
        {/* Add hidden H1 for anchor compat */}
        <h1 id={anchorFromHeading(doc.title)} className="sr-only">{doc.title}</h1>

        <article className="prose-doc max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
            components={{
              h1: ({ node, children, ...props }) => <h1 className="sr-only" {...props}>{children}</h1>,
              h2: ({ node, children, ...props }) => {
                const text = String(children)
                return (
                  <h2
                    id={anchorFromHeading(text)}
                    className="font-display text-[20px] font-bold text-[var(--brand-ink)] mt-6 mb-2.5 pb-1.5 border-b border-[var(--brand-border)] scroll-mt-20"
                    {...props}
                  >
                    {children}
                  </h2>
                )
              },
              h3: ({ node, children, ...props }) => {
                const text = String(children)
                return (
                  <h3
                    id={anchorFromHeading(text)}
                    className="font-display text-[15px] font-semibold text-[var(--brand-ink)] mt-4 mb-1.5 scroll-mt-20"
                    {...props}
                  >
                    {children}
                  </h3>
                )
              },
              h4: ({ node, children, ...props }) => (
                <h4 className="font-display text-[13px] font-semibold text-[var(--brand-ink)] mt-3 mb-1" {...props}>{children}</h4>
              ),
              p: ({ node, children, ...props }) => (
                <p className="text-[13px] leading-relaxed text-[var(--brand-ink)]/85 my-2.5" {...props}>{children}</p>
              ),
              ul: ({ node, children, ...props }) => (
                <ul className="text-[13px] leading-relaxed text-[var(--brand-ink)]/85 my-2.5 list-disc pl-5 space-y-1" {...props}>{children}</ul>
              ),
              ol: ({ node, children, ...props }) => (
                <ol className="text-[13px] leading-relaxed text-[var(--brand-ink)]/85 my-2.5 list-decimal pl-5 space-y-1" {...props}>{children}</ol>
              ),
              li: ({ node, children, ...props }) => <li className="text-[13px]" {...props}>{children}</li>,
              a: ({ node, children, ...props }) => (
                <a className="text-[var(--brand-red)] underline underline-offset-2 hover:text-[var(--brand-red-dark)]" target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                  <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 opacity-60" />
                </a>
              ),
              code: ({ node, className, children, ...props }: any) => {
                const isInline = !className || !className.includes('language-')
                if (isInline) {
                  return <code className="text-[12px] bg-[var(--brand-cream)] text-[var(--brand-red)] px-1 py-0.5 rounded font-mono" {...props}>{children}</code>
                }
                return <code className={className} {...props}>{children}</code>
              },
              pre: ({ node, children, ...props }) => (
                <pre className="bg-[var(--brand-ink)] text-white p-3 rounded-md overflow-x-auto my-3 text-[12px] leading-relaxed font-mono" {...props}>{children}</pre>
              ),
              blockquote: ({ node, children, ...props }) => (
                <blockquote className="border-l-2 border-[var(--brand-red)] pl-3 py-1 my-3 text-[12.5px] italic text-[var(--brand-ink)]/70 bg-[var(--brand-cream)]/50 rounded-r" {...props}>{children}</blockquote>
              ),
              table: ({ node, children, ...props }) => (
                <div className="overflow-x-auto my-3 border border-[var(--brand-border)] rounded-md">
                  <table className="w-full text-[12px]" {...props}>{children}</table>
                </div>
              ),
              thead: ({ node, children, ...props }) => (
                <thead className="bg-[var(--brand-cream)]" {...props}>{children}</thead>
              ),
              th: ({ node, children, ...props }) => (
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--brand-ink)] border-b border-[var(--brand-border)]" {...props}>{children}</th>
              ),
              td: ({ node, children, ...props }) => (
                <td className="px-2 py-1.5 text-[var(--brand-ink)]/80 border-b border-[var(--brand-border)]" {...props}>{children}</td>
              ),
              hr: ({ node, ...props }) => <hr className="border-[var(--brand-border)] my-4" {...props} />,
              img: ({ node, src, alt, ...props }) => (
                <img src={typeof src === 'string' ? src : ''} alt={alt || ''} className="max-w-full h-auto rounded-md my-3" {...props} />
              ),
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </article>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Edit Mode — split editor + preview
// =====================================================
interface EditModeProps {
  title: string
  category: string
  content: string
  owner: string
  order: number
  categories: string[]
  toc: TocItem[]
  draftSavedAt: Date | null
  saving: boolean
  onTitleChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onContentChange: (v: string) => void
  onOwnerChange: (v: string) => void
  onOrderChange: (v: string | number) => void
  onSave: () => void
  onCancel: () => void
  onAnchorClick: (anchor: string) => void
}

function EditMode({
  title, category, content, owner, order, categories, toc, draftSavedAt, saving,
  onTitleChange, onCategoryChange, onContentChange, onOwnerChange, onOrderChange,
  onSave, onCancel,
}: EditModeProps) {
  return (
    <Card className="card-premium">
      {/* Header — metadata fields */}
      <CardHeader className="border-b border-[var(--brand-border)] pb-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label htmlFor="doc-title" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
              Title
            </Label>
            <Input
              id="doc-title"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Document title"
              className="text-[14px]"
            />
          </div>
          <div className="min-w-[140px]">
            <Label htmlFor="doc-cat" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
              Category
            </Label>
            <Input
              id="doc-cat"
              value={category}
              onChange={e => onCategoryChange(e.target.value)}
              placeholder="Technical / User / Meta"
              list="doc-categories"
              className="text-[13px]"
            />
            <datalist id="doc-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="min-w-[140px]">
            <Label htmlFor="doc-owner" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
              Owner
            </Label>
            <Input
              id="doc-owner"
              value={owner}
              onChange={e => onOwnerChange(e.target.value)}
              placeholder="Data Team"
              className="text-[13px]"
            />
          </div>
          <div className="w-[80px]">
            <Label htmlFor="doc-order" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
              Order
            </Label>
            <Input
              id="doc-order"
              type="number"
              value={order}
              onChange={e => onOrderChange(e.target.value)}
              className="text-[13px]"
            />
          </div>
        </div>
        {draftSavedAt && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--brand-ink)]/50 mt-2">
            <Cloud className="w-2.5 h-2.5" />
            Draft auto-saved at {draftSavedAt.toLocaleTimeString()}
          </div>
        )}
      </CardHeader>

      {/* Split editor + preview */}
      <CardContent className="pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[60vh]">
          {/* Editor */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-[10.5px] uppercase tracking-wider text-[var(--brand-ink)]/55 flex items-center gap-1">
                <Edit className="w-3 h-3" />
                Editor (Markdown)
              </Label>
              <span className="text-[10px] text-[var(--brand-ink)]/40">{content.length} chars</span>
            </div>
            <Textarea
              value={content}
              onChange={e => onContentChange(e.target.value)}
              placeholder="# Heading&#10;&#10;Write your markdown here..."
              className="flex-1 font-mono text-[12px] leading-relaxed resize-none min-h-0"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col min-h-0 border border-[var(--brand-border)] rounded-md">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--brand-border)] bg-[var(--brand-cream)]">
              <Label className="text-[10.5px] uppercase tracking-wider text-[var(--brand-ink)]/55 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Live Preview
              </Label>
              <span className="text-[10px] text-[var(--brand-ink)]/40">{toc.length} headings</span>
            </div>
            <div className="flex-1 overflow-y-auto scroll-styled p-3 prose-doc max-w-none min-h-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                  h1: ({ node, children, ...props }) => <h1 className="sr-only" {...props}>{children}</h1>,
                  h2: ({ node, children, ...props }) => {
                    const text = String(children)
                    return (
                      <h2
                        id={anchorFromHeading(text)}
                        className="font-display text-[17px] font-bold text-[var(--brand-ink)] mt-3 mb-2 pb-1 border-b border-[var(--brand-border)]"
                        {...props}
                      >
                        {children}
                      </h2>
                    )
                  },
                  h3: ({ node, children, ...props }) => (
                    <h3 className="font-display text-[14px] font-semibold text-[var(--brand-ink)] mt-2.5 mb-1" {...props}>{children}</h3>
                  ),
                  p: ({ node, children, ...props }) => (
                    <p className="text-[12px] leading-relaxed text-[var(--brand-ink)]/85 my-2" {...props}>{children}</p>
                  ),
                  ul: ({ node, children, ...props }) => (
                    <ul className="text-[12px] leading-relaxed text-[var(--brand-ink)]/85 my-2 list-disc pl-4 space-y-0.5" {...props}>{children}</ul>
                  ),
                  ol: ({ node, children, ...props }) => (
                    <ol className="text-[12px] leading-relaxed text-[var(--brand-ink)]/85 my-2 list-decimal pl-4 space-y-0.5" {...props}>{children}</ol>
                  ),
                  a: ({ node, children, ...props }) => (
                    <a className="text-[var(--brand-red)] underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                  ),
                  code: ({ node, className, children, ...props }: any) => {
                    const isInline = !className || !className.includes('language-')
                    if (isInline) {
                      return <code className="text-[11px] bg-[var(--brand-cream)] text-[var(--brand-red)] px-1 py-0.5 rounded font-mono" {...props}>{children}</code>
                    }
                    return <code className={className} {...props}>{children}</code>
                  },
                  pre: ({ node, children, ...props }) => (
                    <pre className="bg-[var(--brand-ink)] text-white p-2 rounded overflow-x-auto my-2 text-[11px] leading-relaxed font-mono" {...props}>{children}</pre>
                  ),
                  blockquote: ({ node, children, ...props }) => (
                    <blockquote className="border-l-2 border-[var(--brand-red)] pl-2 py-0.5 my-2 text-[11.5px] italic text-[var(--brand-ink)]/70 bg-[var(--brand-cream)]/50 rounded-r" {...props}>{children}</blockquote>
                  ),
                  table: ({ node, children, ...props }) => (
                    <div className="overflow-x-auto my-2 border border-[var(--brand-border)] rounded">
                      <table className="w-full text-[11px]" {...props}>{children}</table>
                    </div>
                  ),
                  thead: ({ node, children, ...props }) => (
                    <thead className="bg-[var(--brand-cream)]" {...props}>{children}</thead>
                  ),
                  th: ({ node, children, ...props }) => (
                    <th className="px-1.5 py-1 text-left font-semibold border-b border-[var(--brand-border)]" {...props}>{children}</th>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td className="px-1.5 py-1 border-b border-[var(--brand-border)]" {...props}>{children}</td>
                  ),
                  hr: ({ node, ...props }) => <hr className="border-[var(--brand-border)] my-3" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Footer */}
      <CardContent className="border-t border-[var(--brand-border)] pt-3 flex items-center justify-between gap-2">
        <div className="text-[11px] text-[var(--brand-ink)]/50">
          Tip: drafts auto-save to localStorage every 5 seconds.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Create Doc Dialog
// =====================================================
interface CreateDocDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  isSuperadmin: boolean
  onCreated: (doc: DocFull) => void
}

function CreateDocDialog({ open, onOpenChange, categories, isSuperadmin, onCreated }: CreateDocDialogProps) {
  const { t } = useLanguage()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('Technical')
  const [content, setContent] = useState('')
  const [owner, setOwner] = useState('Data Team')
  const [order, setOrder] = useState(100)
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setTitle('')
      setSlug('')
      setCategory('Technical')
      setContent('')
      setOwner('Data Team')
      setOrder(100)
      setSlugEdited(false)
      setError(null)
    }
  }, [open])

  // Auto-generate slug from title (unless user has manually edited slug)
  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title))
    }
  }, [title, slugEdited])

  const handleSlugChange = (v: string) => {
    setSlug(v)
    setSlugEdited(true)
  }

  const handleCreate = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug must be lowercase, hyphens, and alphanumeric only')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          category: category.trim() || 'General',
          content,
          owner: owner.trim() || 'Data Team',
          order: Number(order) || 100,
          tenant_id: null, // superadmin only → system doc; tenant_admin gets forced in API
        }),
      })
      const j = await safeJson(res)
      if (j.success) {
        onCreated(j.data)
      } else {
        setError(j.error || 'Failed to create doc')
      }
    } catch (e: any) {
      setError(e.message || 'Network error creating doc')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--brand-red)]" />
            New Document
          </DialogTitle>
          <DialogDescription>
            Create a new doc. {isSuperadmin
              ? 'As superadmin, this will be a system doc (visible to all tenants).'
              : 'This will be a tenant-scoped doc (visible only within your tenant).'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-styled pr-1">
          {error && (
            <div className="flex items-start gap-2 text-[12px] text-[var(--brand-red)] bg-[var(--brand-red)]/5 px-3 py-2 rounded-md border border-[var(--brand-red)]/20">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="new-title" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
                Title
              </Label>
              <Input
                id="new-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Architecture Overview"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="new-slug" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
                Slug
              </Label>
              <Input
                id="new-slug"
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="auto-from-title"
                className="font-mono text-[12px]"
              />
            </div>
            <div>
              <Label htmlFor="new-cat" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
                Category
              </Label>
              <Input
                id="new-cat"
                value={category}
                onChange={e => setCategory(e.target.value)}
                list="new-categories"
                className="text-[13px]"
              />
              <datalist id="new-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="new-owner" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
                Owner
              </Label>
              <Input
                id="new-owner"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="new-order" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
                Order
              </Label>
              <Input
                id="new-order"
                type="number"
                value={order}
                onChange={e => setOrder(Number(e.target.value) || 0)}
                className="text-[13px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="new-content" className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">
              Content (Markdown)
            </Label>
            <Textarea
              id="new-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={'# Heading\n\nWrite your markdown here...'}
              className="font-mono text-[12px] min-h-[200px]"
              spellCheck={false}
            />
            <div className="text-[10.5px] text-[var(--brand-ink)]/40 mt-1">
              You can edit content later. Tip: GitHub-flavored Markdown is supported (tables, task lists, code blocks).
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Create Doc
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
