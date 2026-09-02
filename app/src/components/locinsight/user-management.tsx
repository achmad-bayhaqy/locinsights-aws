'use client'

/**
 * LocInsights — User Management (3-tab UI)
 *
 * Tabs:
 *   1. Tenants   (superadmin only — hidden for tenant_admin/admin)
 *   2. Users     (superadmin: all tenants; tenant_admin/admin: own tenant)
 *   3. Roles     (system roles + own tenant-scoped roles)
 *
 * Fetches from /api/admin/{tenants,users,roles,audit-logs} via fetch().
 * Uses sonner toast for notifications, lucide-react for icons, and the
 * existing shadcn/ui component set.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction,
} from '@/components/ui/card'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Users as UsersIcon, Building2, Shield, Plus, Pencil, Trash2, KeyRound, Lock, Unlock,
  Search, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Save, X, Filter,
  UserCog, Crown, Building, Globe, Mail, Phone, Palette, Activity, Clock, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  MENUS, ACTIONS, MENU_LABELS, type Permissions, type MenuId, type ActionId,
  sanitizePermissions,
} from '@/lib/permissions'

// =====================================================
// Types — mirror the API response shapes
// =====================================================
interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  region_scope: string[]
  app_name?: string
  logo_url?: string | null
  primary_color?: string
  accent_color?: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string
  max_users: number
  max_api_calls_per_day: number
  trial_ends_at?: string | null
  suspended_at?: string | null
  terminated_at?: string | null
  data_residency?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  user_count?: number
  addon_count?: number
}

interface TenantDetail extends Tenant {
  stats?: {
    users: number
    addons: number
    brands: number
    stores: number
    malls: number
    competitors: number
    pois: number
  }
  addons?: any[]
  recent_users?: Array<{
    id: string
    username: string
    display_name: string | null
    email: string | null
    role: string
    is_active: boolean
    last_login_at: string | null
    created_at: string
  }>
}

interface User {
  id: string
  username: string
  email: string | null
  display_name: string | null
  role: string
  is_active: boolean
  failed_login_count: number
  locked_until: string | null
  last_login_at: string | null
  tenant_id: string | null
  default_tenant_id: string | null
  created_at: string
  updated_at: string
  tenant?: { id: string; name: string; slug: string } | null
}

interface Role {
  id: string
  name: string
  description: string | null
  permissions: Permissions
  is_system: boolean
  tenant_id: string | null
  is_tenant_scoped: boolean
  created_at: string
  updated_at: string
  user_count?: number
}

interface AuditLog {
  id: string
  user_id: string
  actor_id: string | null
  actor_username?: string | null
  actor_display_name?: string | null
  action: string
  details: any
  ip_address: string | null
  created_at: string
  user?: {
    id: string
    username: string
    display_name: string | null
    tenant_id: string | null
    tenant?: { id: string; name: string; slug: string } | null
  } | null
}

// =====================================================
// Constants
// =====================================================
const PLAN_OPTIONS = [
  { value: 'saas_monthly', label: 'SaaS Monthly' },
  { value: 'saas_yearly', label: 'SaaS Yearly' },
  { value: 'enterprise_onprem', label: 'Enterprise On-Prem' },
  { value: 'trial', label: 'Trial' },
  { value: 'internal', label: 'Internal' },
]
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'provisioning', label: 'Provisioning' },
]
const REGION_OPTIONS = ['bali', 'jakarta', 'java', 'sumatra', 'kalimantan', 'sulawesi', 'papua', 'national']

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  tenant_admin: 'Tenant Admin',
  data: 'Data',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

const PLAN_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  saas_monthly: 'secondary',
  saas_yearly: 'secondary',
  enterprise_onprem: 'default',
  trial: 'outline',
  internal: 'outline',
}
const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  suspended: 'destructive',
  terminated: 'destructive',
  provisioning: 'secondary',
}

// =====================================================
// Helpers
// =====================================================
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return iso
  }
}

function roleLabel(roleId: string): string {
  return ROLE_LABELS[roleId] || roleId
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json
}

// =====================================================
// Main component
// =====================================================
export function UserManagement() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const isSuperadmin = role === 'superadmin'
  const isTenantAdminLike = role === 'superadmin' || role === 'tenant_admin' || role === 'admin'

  const [activeTab, setActiveTab] = useState<string>(isSuperadmin ? 'tenants' : 'users')

  if (!isTenantAdminLike) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="font-display text-[20px] font-bold mb-2">Access denied</h2>
          <p className="text-[13px] text-muted-foreground max-w-md">
            You need <strong>tenant admin</strong> or higher privileges to access User Management.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {isSuperadmin && (
              <TabsTrigger value="tenants" className="gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Tenants
              </TabsTrigger>
            )}
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="w-3.5 h-3.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Roles
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Audit
            </TabsTrigger>
          </TabsList>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            {isSuperadmin ? (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-500" /> Superadmin · platform-wide
              </>
            ) : (
              <>
                <Building className="w-3.5 h-3.5" /> {session?.user?.tenant_id || 'No tenant'}
              </>
            )}
          </div>
        </div>

        {isSuperadmin && (
          <TabsContent value="tenants" className="mt-4">
            <TenantsTab />
          </TabsContent>
        )}
        <TabsContent value="users" className="mt-4">
          <UsersTab isSuperadmin={isSuperadmin} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab isSuperadmin={isSuperadmin} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab isSuperadmin={isSuperadmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// TAB 1: Tenants
// =====================================================
function TenantsTab() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState<Tenant | null>(null)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ stats: 'true' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const json = await apiFetch(`/api/admin/tenants?${params.toString()}`)
      setTenants(json.data || [])
    } catch (e: any) {
      toast.error('Failed to load tenants', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const json = await apiFetch(`/api/admin/tenants/${id}`)
      setDetail(json.data)
    } catch (e: any) {
      toast.error('Failed to load tenant detail', { description: e.message })
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
    } else {
      setExpandedId(id)
      setDetail(null)
      fetchDetail(id)
    }
  }

  const toggleStatus = async (t: Tenant) => {
    const newStatus = t.status === 'active' ? 'suspended' : 'active'
    try {
      await apiFetch(`/api/admin/tenants/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(`Tenant ${newStatus === 'active' ? 'activated' : 'suspended'}`, {
        description: t.name,
      })
      fetchTenants()
      if (expandedId === t.id) fetchDetail(t.id)
    } catch (e: any) {
      toast.error('Failed to update tenant status', { description: e.message })
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await apiFetch(`/api/admin/tenants/${deleting.id}`, { method: 'DELETE' })
      toast.success('Tenant deleted', { description: deleting.name })
      setDeleting(null)
      if (expandedId === deleting.id) {
        setExpandedId(null)
        setDetail(null)
      }
      fetchTenants()
    } catch (e: any) {
      toast.error('Failed to delete tenant', { description: e.message })
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants
    const s = search.toLowerCase()
    return tenants.filter(t =>
      t.name.toLowerCase().includes(s) ||
      t.slug.toLowerCase().includes(s) ||
      (t.contact_name || '').toLowerCase().includes(s) ||
      (t.contact_email || '').toLowerCase().includes(s)
    )
  }, [tenants, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Building2 className="w-4 h-4" /> Tenants
        </CardTitle>
        <CardDescription>Manage all customer tenants on the LocInsights platform.</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Create Tenant
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchTenants} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                    Loading tenants…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No tenants found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(t => (
                  <>
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(t.id)}>
                      <TableCell className="text-muted-foreground">
                        {expandedId === t.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-[12px]">{t.slug}</TableCell>
                      <TableCell>
                        <Badge variant={PLAN_BADGE_VARIANT[t.plan] || 'outline'}>
                          {(PLAN_OPTIONS.find(p => p.value === t.plan)?.label) || t.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[t.status] || 'outline'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{t.user_count ?? '—'}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{t.max_users}</TableCell>
                      <TableCell className="text-muted-foreground text-[12px]">
                        {(t.region_scope || []).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[12px]">{fmtDateShort(t.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setEditing(t)}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => toggleStatus(t)}
                            title={t.status === 'active' ? 'Suspend' : 'Activate'}
                          >
                            {t.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleting(t)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === t.id && (
                      <TableRow key={`${t.id}-detail`} className="bg-muted/30">
                        <TableCell colSpan={10} className="p-4">
                          {detailLoading ? (
                            <div className="text-center text-muted-foreground py-6">
                              <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                              Loading detail…
                            </div>
                          ) : detail ? (
                            <TenantDetailPanel detail={detail} />
                          ) : (
                            <div className="text-center text-muted-foreground py-6">No detail available.</div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {showCreate && (
        <TenantFormDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            fetchTenants()
          }}
        />
      )}
      {editing && (
        <TenantFormDialog
          mode="edit"
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchTenants()
            if (expandedId === editing.id) fetchDetail(editing.id)
          }}
        />
      )}
      <AlertDialog
        open={!!deleting}
        title="Delete tenant"
        description={
          <>
            Are you sure you want to delete <strong>{deleting?.name}</strong>?
            This will <strong className="text-destructive">permanently cascade-delete</strong> all
            its users, roles, stores, malls, competitors, POIs, and all other tenant data.
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </Card>
  )
}

function TenantDetailPanel({ detail }: { detail: TenantDetail }) {
  const stats = detail.stats
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Users" value={stats?.users ?? 0} icon={UsersIcon} />
        <StatBox label="Addons" value={stats?.addons ?? 0} icon={Shield} />
        <StatBox label="Stores" value={stats?.stores ?? 0} icon={Building} />
        <StatBox label="Malls" value={stats?.malls ?? 0} icon={Building2} />
        <StatBox label="Brands" value={stats?.brands ?? 0} icon={Globe} />
        <StatBox label="Competitors" value={stats?.competitors ?? 0} icon={Activity} />
        <StatBox label="POIs" value={stats?.pois ?? 0} icon={Globe} />
        <StatBox label="Max users" value={detail.max_users} icon={UserCog} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-md border p-3 bg-background">
          <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Contact & branding
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
            <dt className="text-muted-foreground">App name</dt><dd>{detail.app_name || '—'}</dd>
            <dt className="text-muted-foreground">Contact</dt><dd>{detail.contact_name || '—'}</dd>
            <dt className="text-muted-foreground">Email</dt><dd>{detail.contact_email || '—'}</dd>
            <dt className="text-muted-foreground">Phone</dt><dd>{detail.contact_phone || '—'}</dd>
            <dt className="text-muted-foreground">Primary color</dt>
            <dd className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded border" style={{ background: detail.primary_color || '#7A0A1A' }} />
              {detail.primary_color || '—'}
            </dd>
            <dt className="text-muted-foreground">Accent color</dt>
            <dd className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded border" style={{ background: detail.accent_color || '#C8102E' }} />
              {detail.accent_color || '—'}
            </dd>
            <dt className="text-muted-foreground">API calls/day</dt><dd>{detail.max_api_calls_per_day.toLocaleString()}</dd>
            {detail.trial_ends_at && (
              <>
                <dt className="text-muted-foreground">Trial ends</dt><dd>{fmtDateShort(detail.trial_ends_at)}</dd>
              </>
            )}
            {detail.suspended_at && (
              <>
                <dt className="text-muted-foreground">Suspended</dt><dd>{fmtDateShort(detail.suspended_at)}</dd>
              </>
            )}
          </dl>
          {detail.notes && (
            <div className="mt-2 pt-2 border-t text-[12px] text-muted-foreground">{detail.notes}</div>
          )}
        </div>

        <div className="rounded-md border p-3 bg-background">
          <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" /> Recent users
          </div>
          {(!detail.recent_users || detail.recent_users.length === 0) ? (
            <div className="text-[12px] text-muted-foreground py-3 text-center">No users yet.</div>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-y-auto pr-1 text-[12px]">
              {detail.recent_users.map(u => (
                <li key={u.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.display_name || u.username}</div>
                    <div className="text-muted-foreground text-[11px]">@{u.username} · {roleLabel(u.role)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.is_active ? (
                      <Badge variant="outline" className="text-[10px]">active</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">inactive</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {detail.addons && detail.addons.length > 0 && (
        <div className="rounded-md border p-3 bg-background">
          <div className="text-[12px] font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Add-ons ({detail.addons.length})
          </div>
          <ul className="grid sm:grid-cols-2 gap-1 text-[12px]">
            {detail.addons.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                <span className="font-mono">{a.addon_type}</span>
                {a.is_active
                  ? <Badge variant="outline" className="text-[10px]">active</Badge>
                  : <Badge variant="destructive" className="text-[10px]">inactive</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="rounded-md border p-2.5 bg-background">
      <div className="flex items-center justify-between text-muted-foreground text-[11px] mb-0.5">
        <span>{label}</span>
        <Icon className="w-3 h-3" />
      </div>
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function TenantFormDialog({
  mode,
  tenant,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  tenant?: Tenant
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: tenant?.name || '',
    slug: tenant?.slug || '',
    plan: tenant?.plan || 'trial',
    status: tenant?.status || 'provisioning',
    region_scope: tenant?.region_scope || [],
    app_name: tenant?.app_name || 'LocInsights',
    primary_color: tenant?.primary_color || '#7A0A1A',
    accent_color: tenant?.accent_color || '#C8102E',
    contact_name: tenant?.contact_name || '',
    contact_email: tenant?.contact_email || '',
    contact_phone: tenant?.contact_phone || '',
    notes: tenant?.notes || '',
    max_users: tenant?.max_users ?? 10,
    max_api_calls_per_day: tenant?.max_api_calls_per_day ?? 10000,
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const toggleRegion = (r: string) => {
    setForm(prev => ({
      ...prev,
      region_scope: prev.region_scope.includes(r)
        ? prev.region_scope.filter(x => x !== r)
        : [...prev.region_scope, r],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required')
      return
    }
    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/admin/tenants' : `/api/admin/tenants/${tenant!.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      await apiFetch(url, { method, body: JSON.stringify(form) })
      toast.success(mode === 'create' ? 'Tenant created' : 'Tenant updated', { description: form.name })
      onSaved()
    } catch (e: any) {
      toast.error('Failed to save tenant', { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create tenant' : `Edit ${tenant?.name}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Provision a new customer tenant on the platform.'
              : 'Update tenant configuration. Changes take effect immediately.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="ACME Retail" />
          </Field>
          <Field label="Slug" required>
            <Input value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="acme-retail" className="font-mono" />
          </Field>
          <Field label="Plan">
            <Select value={form.plan} onValueChange={v => set('plan', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Region scope" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {REGION_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className={`px-2 py-1 rounded-md border text-[12px] transition-colors ${
                    form.region_scope.includes(r)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-accent'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <Field label="App name">
            <Input value={form.app_name} onChange={e => set('app_name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Primary color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.primary_color} onChange={e => set('primary_color', e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
                <Input value={form.primary_color} onChange={e => set('primary_color', e.target.value)} className="font-mono" />
              </div>
            </Field>
            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color} onChange={e => set('accent_color', e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
                <Input value={form.accent_color} onChange={e => set('accent_color', e.target.value)} className="font-mono" />
              </div>
            </Field>
          </div>
          <Field label="Contact name">
            <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
          </Field>
          <Field label="Max users">
            <Input type="number" min={1} value={form.max_users} onChange={e => set('max_users', Number(e.target.value))} />
          </Field>
          <Field label="Max API calls/day">
            <Input type="number" min={0} value={form.max_api_calls_per_day} onChange={e => set('max_api_calls_per_day', Number(e.target.value))} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// TAB 2: Users
// =====================================================
function UsersTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.user_id || session?.user?.id

  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState<string>(isSuperadmin ? 'all' : (session?.user?.tenant_id || 'all'))
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '50',
      })
      if (isSuperadmin && tenantFilter !== 'all') params.set('tenant_id', tenantFilter)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (activeFilter !== 'all') params.set('active', activeFilter)
      if (search.trim()) params.set('search', search.trim())
      const json = await apiFetch(`/api/admin/users?${params.toString()}`)
      setUsers(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 1)
    } catch (e: any) {
      toast.error('Failed to load users', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [page, isSuperadmin, tenantFilter, roleFilter, activeFilter, search])

  const fetchTenantsAndRoles = useCallback(async () => {
    try {
      const [tJson, rJson] = await Promise.all([
        apiFetch('/api/admin/tenants'),
        apiFetch('/api/admin/roles'),
      ])
      setTenants(tJson.data || [])
      setRoles(rJson.data || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetchTenantsAndRoles()
  }, [fetchTenantsAndRoles])

  const handleResetLockout = async (u: User) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}/reset-lockout`, { method: 'POST' })
      toast.success('Lockout reset', { description: `@${u.username} can now sign in again.` })
      fetchUsers()
    } catch (e: any) {
      toast.error('Failed to reset lockout', { description: e.message })
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await apiFetch(`/api/admin/users/${deleting.id}`, { method: 'DELETE' })
      toast.success('User deleted', { description: `@${deleting.username}` })
      setDeleting(null)
      fetchUsers()
    } catch (e: any) {
      toast.error('Failed to delete user', { description: e.message })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <UsersIcon className="w-4 h-4" /> Users
        </CardTitle>
        <CardDescription>
          {isSuperadmin
            ? 'Manage user accounts across all tenants.'
            : 'Manage user accounts within your tenant.'}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Create User
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search username / name / email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8 h-9"
            />
          </div>
          {isSuperadmin && (
            <Select value={tenantFilter} onValueChange={v => { setTenantFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                <SelectItem value="platform">Platform (no tenant)</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={v => { setActiveFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Active only</SelectItem>
              <SelectItem value="false">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isSuperadmin && <TableHead>Tenant</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-center">Fails</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isSuperadmin ? 9 : 8} className="text-center text-muted-foreground py-8">
                    <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperadmin ? 9 : 8} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : users.map(u => {
                const isLocked = u.locked_until && new Date(u.locked_until) > new Date()
                const isSelf = u.id === currentUserId
                return (
                  <TableRow key={u.id} className={isSelf ? 'bg-amber-50/40' : ''}>
                    <TableCell className="font-mono text-[12px]">
                      {u.username}
                      {isSelf && <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>}
                    </TableCell>
                    <TableCell>{u.display_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-[12px]">{u.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'superadmin' ? 'default' : 'secondary'} className="text-[11px]">
                        {roleLabel(u.role)}
                      </Badge>
                    </TableCell>
                    {isSuperadmin && (
                      <TableCell className="text-muted-foreground text-[12px]">
                        {u.tenant?.name || <span className="italic">Platform</span>}
                      </TableCell>
                    )}
                    <TableCell>
                      {isLocked ? (
                        <Badge variant="destructive" className="text-[11px] gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </Badge>
                      ) : u.is_active ? (
                        <Badge variant="outline" className="text-[11px]">active</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[11px]">inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[12px]">{fmtDate(u.last_login_at)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {u.failed_login_count > 0 ? (
                        <span className={u.failed_login_count >= 5 ? 'text-destructive font-medium' : ''}>
                          {u.failed_login_count}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(u)} title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResetPasswordUser(u)} title="Reset password">
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        {((u.failed_login_count > 0) || isLocked) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetLockout(u)} title="Reset lockout">
                            <Unlock className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(u)}
                          disabled={isSelf}
                          title={isSelf ? 'You cannot delete your own account' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <div>{total} user{total === 1 ? '' : 's'} total</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7">Prev</Button>
            <span className="px-2">Page {page} / {Math.max(totalPages, 1)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7">Next</Button>
          </div>
        </div>
      </CardContent>

      {showCreate && (
        <UserFormDialog
          mode="create"
          isSuperadmin={isSuperadmin}
          tenants={tenants}
          roles={roles}
          defaultTenantId={session?.user?.tenant_id || undefined}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchUsers() }}
        />
      )}
      {editing && (
        <UserFormDialog
          mode="edit"
          user={editing}
          isSuperadmin={isSuperadmin}
          tenants={tenants}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchUsers() }}
        />
      )}
      {resetPasswordUser && (
        <ResetPasswordDialog
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSaved={() => { setResetPasswordUser(null); fetchUsers() }}
        />
      )}
      <AlertDialog
        open={!!deleting}
        title="Delete user"
        description={
          <>
            Are you sure you want to delete <strong>@{deleting?.username}</strong>?
            All their audit logs will also be removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </Card>
  )
}

function UserFormDialog({
  mode, user, isSuperadmin, tenants, roles, defaultTenantId, onClose, onSaved,
}: {
  mode: 'create' | 'edit'
  user?: User
  isSuperadmin: boolean
  tenants: Tenant[]
  roles: Role[]
  defaultTenantId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    display_name: user?.display_name || '',
    password: '',
    role: user?.role || 'viewer',
    tenant_id: user?.tenant_id || defaultTenantId || '',
    is_active: user?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (mode === 'create') {
      if (!form.username.trim() || form.username.trim().length < 3) {
        toast.error('Username is required (min 3 chars)'); return
      }
      if (!form.password || form.password.length < 4) {
        toast.error('Password is required (min 4 chars)'); return
      }
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const payload: any = {
          username: form.username,
          email: form.email || undefined,
          display_name: form.display_name || undefined,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
        }
        if (isSuperadmin) {
          payload.tenant_id = form.tenant_id || null
        }
        await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('User created', { description: `@${form.username}` })
      } else {
        const payload: any = {
          email: form.email || null,
          display_name: form.display_name,
          role: form.role,
          is_active: form.is_active,
        }
        if (isSuperadmin) {
          payload.tenant_id = form.tenant_id || null
        }
        await apiFetch(`/api/admin/users/${user!.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('User updated', { description: `@${form.username}` })
      }
      onSaved()
    } catch (e: any) {
      toast.error('Failed to save user', { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create user' : `Edit @${user?.username}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new user account.'
              : 'Update user profile. Password is not changed here — use the Reset Password action.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {mode === 'create' && (
            <Field label="Username" required>
              <Input value={form.username} onChange={e => set('username', e.target.value)} className="font-mono" />
            </Field>
          )}
          <Field label="Display name">
            <Input value={form.display_name} onChange={e => set('display_name', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </Field>
          {mode === 'create' && (
            <Field label="Password" required>
              <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Role">
              <Select value={form.role} onValueChange={v => set('role', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}{r.is_system ? '' : ' (tenant)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {isSuperadmin && (
              <Field label="Tenant">
                <Select value={form.tenant_id || 'platform'} onValueChange={v => set('tenant_id', v === 'platform' ? '' : v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Platform (no tenant)</SelectItem>
                    {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-[13px] font-medium">Active</div>
              <div className="text-[11px] text-muted-foreground">Inactive users cannot sign in.</div>
            </div>
            <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!password || password.length < 4) {
      toast.error('Password must be at least 4 chars'); return
    }
    setSaving(true)
    try {
      await apiFetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      toast.success('Password reset', { description: `@${user.username}` })
      onSaved()
    } catch (e: any) {
      toast.error('Failed to reset password', { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>@{user.username}</strong>.
            Their failed-login counter will also be reset.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="New password" required>
            <div className="flex items-center gap-2">
              <Input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button variant="outline" size="icon" type="button" onClick={() => setShow(s => !s)}>
                {show ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </Button>
            </div>
          </Field>
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Communicate the new password to the user out-of-band. It is not stored in plaintext.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// TAB 3: Roles
// =====================================================
function RolesTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Role | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const json = await apiFetch('/api/admin/roles')
      setRoles(json.data || [])
    } catch (e: any) {
      toast.error('Failed to load roles', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await apiFetch(`/api/admin/roles/${deleting.id}`, { method: 'DELETE' })
      toast.success('Role deleted', { description: deleting.name })
      setDeleting(null)
      fetchRoles()
    } catch (e: any) {
      toast.error('Failed to delete role', { description: e.message })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Shield className="w-4 h-4" /> Roles & Permissions
        </CardTitle>
        <CardDescription>
          {isSuperadmin
            ? 'Manage system roles and create tenant-scoped custom roles.'
            : 'Create custom roles for your tenant. System roles can be viewed but not modified.'}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Create Role
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
            Loading roles…
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No roles found.</div>
        ) : (
          <div className="space-y-3">
            {roles.map(r => (
              <RoleCard
                key={r.id}
                role={r}
                isSuperadmin={isSuperadmin}
                onEdit={() => setEditing(r)}
                onDelete={() => setDeleting(r)}
              />
            ))}
          </div>
        )}
      </CardContent>

      {showCreate && (
        <RoleFormDialog
          isSuperadmin={isSuperadmin}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchRoles() }}
        />
      )}
      {editing && (
        <RoleEditDialog
          role={editing}
          isSuperadmin={isSuperadmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchRoles() }}
        />
      )}
      <AlertDialog
        open={!!deleting}
        title="Delete role"
        description={
          <>
            Are you sure you want to delete the <strong>{deleting?.name}</strong> role?
            You can only delete tenant-scoped roles that have no users assigned.
          </>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </Card>
  )
}

function RoleCard({
  role, isSuperadmin, onEdit, onDelete,
}: {
  role: Role
  isSuperadmin: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const canEdit = isSuperadmin || (!role.is_system && role.tenant_id !== null)
  const canDelete = !role.is_system && (isSuperadmin || role.tenant_id !== null)

  // Count enabled perms for summary
  const enabledCount = useMemo(() => {
    let n = 0
    for (const m of MENUS) {
      for (const a of ACTIONS) {
        if (role.permissions?.[m]?.[a]) n++
      }
    }
    return n
  }, [role.permissions])
  const totalPerms = MENUS.length * ACTIONS.length

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[14px]">{role.name}</span>
              {role.is_system ? (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Crown className="w-3 h-3" /> system
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Building className="w-3 h-3" /> tenant-scoped
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {role.user_count ?? 0} user{(role.user_count ?? 0) === 1 ? '' : 's'}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {enabledCount}/{totalPerms} perms
              </Badge>
            </div>
            {role.description && (
              <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{role.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={!canEdit} className="gap-1.5 h-8">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete} disabled={!canDelete}
            title={role.is_system ? 'System roles cannot be deleted' : 'Delete'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 py-3 bg-muted/20">
          <PermissionMatrixView permissions={role.permissions} />
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated {fmtDate(role.updated_at)}
            <span className="mx-1">·</span>
            <span>ID: <code className="font-mono">{role.id}</code></span>
            {role.tenant_id && (<><span className="mx-1">·</span><span>Tenant: {role.tenant_id}</span></>)}
          </div>
        </div>
      )}
    </div>
  )
}

function PermissionMatrixView({ permissions }: { permissions: Permissions }) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-[12px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10">Menu</TableHead>
            {ACTIONS.map(a => (
              <TableHead key={a} className="text-center capitalize">{a}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MENUS.map(menu => (
            <TableRow key={menu}>
              <TableCell className="font-medium capitalize sticky left-0 bg-background z-10">
                {MENU_LABELS[menu]?.replace('nav.', '') || menu}
              </TableCell>
              {ACTIONS.map(a => {
                const checked = Boolean(permissions?.[menu]?.[a])
                return (
                  <TableCell key={a} className="text-center">
                    {checked ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 inline" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-muted-foreground/40 inline" />
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RoleFormDialog({
  isSuperadmin, onClose, onSaved,
}: {
  isSuperadmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_system: false,
    tenant_id: '',
    permissions: sanitizePermissions(null) as Permissions, // start with all-off
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Role name is required (min 2 chars)'); return
    }
    setSaving(true)
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
        is_system: isSuperadmin ? form.is_system : false,
      }
      if (isSuperadmin && !form.is_system && form.tenant_id) {
        payload.tenant_id = form.tenant_id
      }
      await apiFetch('/api/admin/roles', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Role created', { description: form.name })
      onSaved()
    } catch (e: any) {
      toast.error('Failed to create role', { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>
            {isSuperadmin
              ? 'Create a system role (visible to all tenants) or a tenant-scoped role.'
              : 'Create a custom role scoped to your tenant.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Role name" required>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Marketing Lead" />
            </Field>
            {isSuperadmin && (
              <Field label="Scope">
                <Select value={form.is_system ? 'system' : 'tenant'} onValueChange={v => set('is_system', v === 'system')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System (all tenants)</SelectItem>
                    <SelectItem value="tenant">Tenant-scoped</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Description">
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="What can this role do?" />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[13px] font-medium">Permissions matrix</Label>
              <span className="text-[11px] text-muted-foreground">17 menus × 5 actions = 85 cells</span>
            </div>
            <PermissionMatrixEditor
              initialPermissions={form.permissions}
              onChange={p => set('permissions', p)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleEditDialog({
  role, isSuperadmin, onClose, onSaved,
}: {
  role: Role
  isSuperadmin: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(role.name)
  const [description, setDescription] = useState(role.description || '')
  const [perms, setPerms] = useState<Permissions>(sanitizePermissions(role.permissions))
  const [saving, setSaving] = useState(false)

  const canEditNameDesc = isSuperadmin || !role.is_system
  const canEditPerms = isSuperadmin || !role.is_system

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = { permissions: perms }
      if (canEditNameDesc) {
        payload.name = name
        payload.description = description
      }
      await apiFetch(`/api/admin/roles/${role.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      toast.success('Role updated', { description: name })
      onSaved()
    } catch (e: any) {
      toast.error('Failed to update role', { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit role: {role.name}</DialogTitle>
          <DialogDescription>
            {role.is_system
              ? 'System role. Permissions can be edited by superadmin. Role cannot be deleted.'
              : 'Tenant-scoped role. Full edit + delete available.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Role name">
              <Input value={name} onChange={e => setName(e.target.value)} disabled={!canEditNameDesc} />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!canEditNameDesc} />
            </Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[13px] font-medium">Permissions matrix</Label>
              <span className="text-[11px] text-muted-foreground">
                {canEditPerms ? '17 menus × 5 actions = 85 cells' : 'Read-only (system role)'}
              </span>
            </div>
            {canEditPerms ? (
              <PermissionMatrixEditor initialPermissions={perms} onChange={setPerms} />
            ) : (
              <PermissionMatrixView permissions={perms} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canEditPerms} className="gap-1.5">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Permission Matrix Editor
// =====================================================
function PermissionMatrixEditor({
  initialPermissions, onChange,
}: {
  initialPermissions: Permissions
  onChange: (perms: Permissions) => void
}) {
  const [perms, setPerms] = useState<Permissions>(() => sanitizePermissions(initialPermissions))

  // Push changes up
  useEffect(() => {
    onChange(perms)
  }, [perms, onChange])

  const toggleCell = (menu: MenuId, action: ActionId) => {
    setPerms(prev => ({
      ...prev,
      [menu]: { ...prev[menu], [action]: !prev[menu]?.[action] },
    }))
  }

  const toggleRow = (menu: MenuId) => {
    const allOn = ACTIONS.every(a => perms[menu]?.[a])
    setPerms(prev => ({
      ...prev,
      [menu]: ACTIONS.reduce((acc, a) => ({ ...acc, [a]: !allOn }), {} as any),
    }))
  }

  const toggleCol = (action: ActionId) => {
    const allOn = MENUS.every(m => perms[m]?.[action])
    setPerms(prev => {
      const next = { ...prev }
      for (const m of MENUS) {
        next[m] = { ...next[m], [action]: !allOn }
      }
      return next
    })
  }

  const toggleAll = () => {
    const allOn = MENUS.every(m => ACTIONS.every(a => perms[m]?.[a]))
    const val = !allOn
    setPerms(prev => {
      const next = { ...prev }
      for (const m of MENUS) {
        next[m] = ACTIONS.reduce((acc, a) => ({ ...acc, [a]: val }), {} as any)
      }
      return next
    })
  }

  const allOn = MENUS.every(m => ACTIONS.every(a => perms[m]?.[a]))

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="text-[12px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">
              <div className="flex items-center gap-2">
                <Checkbox checked={allOn} onCheckedChange={toggleAll} aria-label="Select all" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">All</span>
              </div>
            </TableHead>
            {ACTIONS.map(a => {
              const colAllOn = MENUS.every(m => perms[m]?.[a])
              return (
                <TableHead key={a} className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <Checkbox checked={colAllOn} onCheckedChange={() => toggleCol(a)} aria-label={`Select all ${a}`} />
                    <span className="text-[11px] capitalize">{a}</span>
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MENUS.map(menu => {
            const rowAllOn = ACTIONS.every(a => perms[menu]?.[a])
            return (
              <TableRow key={menu}>
                <TableCell className="font-medium sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={rowAllOn} onCheckedChange={() => toggleRow(menu)} aria-label={`Select all ${menu}`} />
                    <span className="capitalize">{MENU_LABELS[menu]?.replace('nav.', '') || menu}</span>
                  </div>
                </TableCell>
                {ACTIONS.map(a => {
                  const checked = Boolean(perms[menu]?.[a])
                  return (
                    <TableCell key={a} className="text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCell(menu, a)}
                        aria-label={`${menu} ${a}`}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// =====================================================
// TAB 4: Audit Log
// =====================================================
function AuditTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '50' })
      if (actionFilter !== 'all') params.set('action', actionFilter)
      const json = await apiFetch(`/api/admin/audit-logs?${params.toString()}`)
      setLogs(json.data || [])
      setTotal(json.total || 0)
      setTotalPages(json.totalPages || 1)
    } catch (e: any) {
      toast.error('Failed to load audit logs', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const s = search.toLowerCase()
    return logs.filter(l =>
      (l.user?.username || '').toLowerCase().includes(s) ||
      (l.actor_username || '').toLowerCase().includes(s) ||
      (l.action || '').toLowerCase().includes(s) ||
      (l.ip_address || '').toLowerCase().includes(s)
    )
  }, [logs, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Activity className="w-4 h-4" /> Audit log
        </CardTitle>
        <CardDescription>
          {isSuperadmin
            ? 'Every user-related mutation across all tenants.'
            : 'Audit log for users within your tenant.'}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user / actor / action / IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="login">login</SelectItem>
              <SelectItem value="logout">logout</SelectItem>
              <SelectItem value="user.create">user.create</SelectItem>
              <SelectItem value="user.update">user.update</SelectItem>
              <SelectItem value="user.delete">user.delete</SelectItem>
              <SelectItem value="user.reset_password">user.reset_password</SelectItem>
              <SelectItem value="user.reset_lockout">user.reset_lockout</SelectItem>
              <SelectItem value="role.create">role.create</SelectItem>
              <SelectItem value="role.update">role.update</SelectItem>
              <SelectItem value="role.delete">role.delete</SelectItem>
              <SelectItem value="tenant.create">tenant.create</SelectItem>
              <SelectItem value="tenant.update">tenant.update</SelectItem>
              <SelectItem value="tenant.delete">tenant.delete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Subject</TableHead>
                {isSuperadmin && <TableHead>Tenant</TableHead>}
                <TableHead>IP</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isSuperadmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                    <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperadmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                    No audit log entries.
                  </TableCell>
                </TableRow>
              ) : filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground text-[12px] whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] font-mono">{l.action}</Badge>
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {l.actor_username ? (
                      <span>@{l.actor_username}</span>
                    ) : l.actor_id ? (
                      <span className="text-muted-foreground font-mono">{l.actor_id.slice(0, 8)}…</span>
                    ) : (
                      <span className="text-muted-foreground italic">system</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {l.user ? (
                      <span>@{l.user.username}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono">{l.user_id.slice(0, 8)}…</span>
                    )}
                  </TableCell>
                  {isSuperadmin && (
                    <TableCell className="text-muted-foreground text-[12px]">
                      {l.user?.tenant?.name || (l.user?.tenant_id ? l.user.tenant_id.slice(0, 8) + '…' : '—')}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground text-[12px] font-mono">{l.ip_address || '—'}</TableCell>
                  <TableCell className="text-[12px] max-w-[300px]">
                    {l.details && Object.keys(l.details).length > 0 ? (
                      <code className="font-mono text-[11px] text-muted-foreground break-all">
                        {JSON.stringify(l.details).slice(0, 200)}
                      </code>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <div>{total} entr{total === 1 ? 'y' : 'ies'} total</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7">Prev</Button>
            <span className="px-2">Page {page} / {Math.max(totalPages, 1)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7">Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// Shared small components
// =====================================================
function Field({
  label, required, children, className,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1 text-[12px] text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

function AlertDialog({
  open, title, description, confirmLabel = 'Confirm', confirmVariant = 'default',
  onCancel, onConfirm,
}: {
  open: boolean
  title: string
  description: React.ReactNode
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${confirmVariant === 'destructive' ? 'text-destructive' : 'text-amber-500'}`} />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-[13px] leading-relaxed">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
