'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AppRole } from '@/lib/permissions'
import { canAccessGlobalAdmin, canViewTenantAdminNavigation, getPermissionUser } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { getTenantBasePath, getTenantPath } from '@/lib/tenant-links'
import { signOut } from 'next-auth/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  Monitor,
  Server,
  HardDrive,
  Cpu,
  Network,
  Settings,
  Search,
  Bell,
  ChevronDown,
  BarChart3,
  Users,
  Shield,
  Building2,
  MapPinned,
  LogOut,
  User,
  ClipboardList,
} from 'lucide-react'

type TenantShellInfo = {
  name: string
  slug: string
}

type NavigationItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

function isPathActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getTenantNavigation(clientSlug: string): {
  navigation: NavigationItem[]
  management: NavigationItem[]
} {
  return {
    navigation: [
      { name: 'Dashboard', href: getTenantBasePath(clientSlug), icon: LayoutDashboard, exact: true },
      { name: 'Computadores', href: getTenantPath(clientSlug, 'computers'), icon: Monitor },
      { name: 'Servidores', href: getTenantPath(clientSlug, 'servers'), icon: Server },
      { name: 'Armazenamento', href: getTenantPath(clientSlug, 'storage'), icon: HardDrive },
    ],
    management: [
      { name: 'Processadores', href: getTenantPath(clientSlug, 'processors'), icon: Cpu },
      { name: 'Rede', href: getTenantPath(clientSlug, 'network'), icon: Network },
      { name: 'Relatórios', href: getTenantPath(clientSlug, 'reports'), icon: BarChart3 },
      { name: 'Auditoria', href: getTenantPath(clientSlug, 'audit'), icon: ClipboardList },
    ],
  }
}

const globalAdmin: NavigationItem[] = [
  { name: 'Clientes', href: '/clients', icon: Building2, exact: true },
  { name: 'Auditoria', href: '/clients/audit', icon: ClipboardList, exact: true },
  { name: 'Usuários', href: '/users', icon: Users, exact: true },
  { name: 'Segurança', href: '/security', icon: Shield, exact: true },
  { name: 'Configurações', href: '/settings', icon: Settings, exact: true },
]

function NavigationSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavigationItem[]
  pathname: string
}) {
  return (
    <div>
      <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = isPathActive(pathname, item.href, item.exact)
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({ tenant, userRole }: { tenant?: TenantShellInfo; userRole?: AppRole | null }) {
  const pathname = usePathname()
  const tenantNavigation = tenant ? getTenantNavigation(tenant.slug) : null
  const user = getPermissionUser({ role: userRole ?? null })
  const filteredTenantNavigation = tenantNavigation
    ? {
        navigation: tenantNavigation.navigation,
        management: tenantNavigation.management.filter((item) =>
          item.href.endsWith('/audit') ? canViewTenantAdminNavigation(user) : true
        ),
      }
    : null
  const filteredGlobalAdmin = canAccessGlobalAdmin(user) || !user.role ? globalAdmin : []

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Monitor className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-foreground">Inventário TI</h1>
            <p className="text-xs text-muted-foreground">v2.0.0</p>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              name="search"
              autoComplete="off"
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="rounded bg-sidebar-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {tenant ? (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
                  <MapPinned className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Cliente atual</p>
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{tenant.name}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-sm text-muted-foreground">
              Selecione uma empresa em <span className="font-medium text-sidebar-foreground">Clientes</span> para abrir o painel dela.
            </div>
          )}

          {tenantNavigation ? (
            <>
              <NavigationSection title="Visão Geral" items={filteredTenantNavigation?.navigation ?? []} pathname={pathname} />
              {(filteredTenantNavigation?.management.length ?? 0) > 0 ? (
                <NavigationSection title="Gerenciamento" items={filteredTenantNavigation?.management ?? []} pathname={pathname} />
              ) : null}
              <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-xs text-muted-foreground">
                A área administrativa global permanece separada e pode ser acessada a partir de <span className="font-medium text-sidebar-foreground">/clients</span>.
              </div>
            </>
          ) : (
            <NavigationSection title="Administração" items={filteredGlobalAdmin} pathname={pathname} />
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-sidebar-accent">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground shadow-sm">
                  AD
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground">Admin TI</p>
                  <p className="text-xs text-muted-foreground">admin@corp.local</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56 bg-sidebar border-sidebar-border">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-sidebar-border" />
              <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-sidebar-border" />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}

function getHeaderTitle(pathname: string, tenant?: TenantShellInfo) {
  if (!tenant) {
    if (pathname.startsWith('/clients/audit')) return 'Auditoria'
    if (pathname.startsWith('/clients')) return 'Clientes'
    if (pathname.startsWith('/users')) return 'Usuários'
    if (pathname.startsWith('/security')) return 'Segurança'
    if (pathname.startsWith('/settings')) return 'Configurações'
    return 'Painel administrativo'
  }

  const basePath = getTenantBasePath(tenant.slug)
  const titles: Array<{ match: string; title: string }> = [
    { match: `${basePath}/computers`, title: 'Computadores' },
    { match: `${basePath}/servers`, title: 'Servidores' },
    { match: `${basePath}/storage`, title: 'Armazenamento' },
    { match: `${basePath}/processors`, title: 'Processadores' },
    { match: `${basePath}/network`, title: 'Rede' },
    { match: `${basePath}/reports`, title: 'Relatórios' },
    { match: `${basePath}/audit`, title: 'Auditoria' },
    { match: `${basePath}/assets`, title: 'Detalhe do ativo' },
  ]

  const matched = titles.find((item) => pathname.startsWith(item.match))
  return matched?.title ?? 'Dashboard'
}

export function Header({ tenant, lastCollectionAt }: { tenant?: TenantShellInfo; lastCollectionAt?: string | null }) {
  const pathname = usePathname()
  const title = getHeaderTitle(pathname, tenant)

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'Sem coletas'
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'agora mesmo'
    if (mins < 60) return `há ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `há ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `há ${days} dia${days > 1 ? 's' : ''}`
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {tenant ? tenant.name : 'Escopo global / administrativo'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 hover:bg-muted">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Última coleta:</span>
          <span className="text-sm text-foreground">{formatRelative(lastCollectionAt)}</span>
        </div>
      </div>
    </header>
  )
}
