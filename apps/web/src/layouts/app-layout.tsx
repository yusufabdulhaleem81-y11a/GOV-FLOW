import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldAlert,
  UserCircle2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { useNotifications } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown'
import { Avatar } from '@/components/ui/misc'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { formatDateTime, ROLE_LABELS } from '@govflow/types'
import { markAllNotificationsRead, markNotificationRead } from '@/services/endpoints'
import { cn } from '@/lib/utils'
import type { Permission } from '@govflow/types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission?: Permission
}

interface NavSection {
  heading?: string
  items: NavItem[]
}

function navSections(): NavSection[] {
  return [
    {
      items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      heading: 'Work',
      items: [
        { to: '/obligations', label: 'Obligations', icon: ClipboardList },
        { to: '/my-obligations', label: 'My Obligations', icon: UserCircle2 },
        { to: '/reviews', label: 'Reviews', icon: FileCheck2, permission: 'evidence:review' },
        { to: '/evidence', label: 'Evidence', icon: FileCheck2 },
        { to: '/escalations', label: 'Escalations', icon: ShieldAlert },
        { to: '/handovers', label: 'Handovers', icon: Users },
      ],
    },
    {
      heading: 'Organization',
      items: [
        { to: '/departments', label: 'Departments', icon: Building2 },
        { to: '/users', label: 'Users', icon: Users },
        { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'report:view' },
      ],
    },
    {
      heading: 'Activity',
      items: [{ to: '/audit', label: 'Audit History', icon: History, permission: 'audit:view' }],
    },
    {
      items: [{ to: '/settings', label: 'Settings', icon: Settings }],
    },
  ]
}

function OrgSwitcher() {
  const { memberships, organization, setCurrentOrganization, createOrganization, joinWithCode } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (memberships.length === 0) {
    return (
      <div className="rounded-md border border-sidebar-border bg-sidebar-accent p-3 text-xs text-sidebar-foreground">
        No organization yet.
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const organizationName = name.trim()
            if (!organizationName || busy) return
            setBusy(true)
            setError(null)
            void createOrganization(organizationName)
              .then(() => setName(''))
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false))
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            aria-label="Organization name"
            className="h-9 w-full rounded border border-sidebar-border bg-sidebar px-2 text-xs text-white placeholder:text-sidebar-foreground/60 focus-ring"
          />
          {error && <p className="break-words text-xs text-red-300" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="block h-9 w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <Dropdown
      align="start"
      className="w-64"
      trigger={
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/80 focus-ring"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/20 text-xs font-bold text-white">
            {organization?.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{organization?.name}</span>
            <span className="block text-[11px] text-sidebar-foreground">Switch organization</span>
          </span>
        </button>
      }
    >
      <DropdownLabel>Organizations</DropdownLabel>
      {memberships.map((m) => (
        <DropdownItem key={m.organization.id} onClick={() => setCurrentOrganization(m.organization.id)}>
          <span className="flex w-full items-center justify-between">
            <span className="truncate">{m.organization.name}</span>
            {m.organization.id === organization?.id && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </span>
        </DropdownItem>
      ))}
      <DropdownSeparator />
      {!creating && (
        <>
          <DropdownItem onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Create organization
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              setCreating(true)
              setCode('join-code')
            }}
          >
            <Building2 className="h-4 w-4" /> Join with invite code
          </DropdownItem>
        </>
      )}
      {creating && (
        <form
          className="space-y-2 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            const action = code && code !== 'join-code'
              ? joinWithCode(code).then(() => undefined)
              : createOrganization(name).then(() => undefined)
            void action
              .then(() => {
                setCreating(false)
                setName('')
                setCode('')
              })
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false))
          }}
        >
          {code && code !== 'join-code' ? (
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Invite code"
              className="h-8 w-full rounded border border-input bg-card px-2 text-xs text-foreground"
            />
          ) : (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="h-8 w-full rounded border border-input bg-card px-2 text-xs text-foreground"
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              loading={busy}
              disabled={busy || (code && code !== 'join-code' ? code.length === 0 : name.trim().length === 0)}
            >
              Continue
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Dropdown>
  )
}

function NotificationsBell() {
  const query = useNotifications()
  const data = query.data
  const [open, setOpen] = useState(false)
  const unread = data?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-bell-root]')) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" data-bell-root>
      <Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`} onClick={() => setOpen((v) => !v)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-lg border bg-card shadow-popover animate-slide-in">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void markAllNotificationsRead().then(() => void query.refetch())}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(data?.data ?? []).length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">You're all caught up.</p>
            )}
            {(data?.data ?? []).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.read_at) void markNotificationRead(n.id).then(() => void query.refetch())
                }}
                className={cn('block w-full border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted', !n.read_at && 'bg-primary/5')}
              >
                <p className="text-xs font-medium leading-snug">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <Dropdown
      trigger={
        <button type="button" className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-muted focus-ring" aria-label="Account menu">
          <Avatar name={profile?.full_name} />
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-xs font-medium">{profile?.full_name ?? profile?.email}</span>
            <span className="block text-[10px] text-muted-foreground">{role ? ROLE_LABELS[role] : ''}</span>
          </span>
        </button>
      }
    >
      <DropdownLabel>{profile?.email}</DropdownLabel>
      <DropdownItem onClick={() => navigate('/settings')}>
        <Settings className="h-4 w-4" /> Settings
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem
        destructive
        onClick={() => {
          void signOut().then(() => navigate('/login'))
        }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </DropdownItem>
    </Dropdown>
  )
}

export function AppLayout() {
  const { can } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const sections = navSections()

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">G</div>
        <span className="text-base font-semibold tracking-tight text-white">GovFlow</span>
        <button type="button" className="ml-auto rounded p-1 text-sidebar-foreground lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-3 pb-2">
        <OrgSwitcher />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {sections.map((section, i) => {
          const items = section.items.filter((item) => !item.permission || can(item.permission))
          if (items.length === 0) return null
          return (
            <div key={section.heading ?? i}>
              {section.heading && <p className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">{section.heading}</p>}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent font-medium text-white'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[10px] leading-relaxed text-sidebar-foreground/60">
          Accountability platform — who owes what, to whom, by when.
        </p>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 h-full w-64 shadow-popover">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur">
          <button type="button" className="rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationsBell />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
