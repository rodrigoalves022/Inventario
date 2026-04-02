'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getTenantBasePath, getTenantPath } from '@/lib/tenant-links'
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
  admin: NavigationItem[]
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
    ],
    admin: [
      { name: 'Clientes', href: '/clients', icon: Building2, exact: true },
      { name: 'Usuários', href: '/users', icon: Users, exact: true },
      { name: 'Segurança', href: '/security', icon: Shield, exact: true },
      { name: 'Configurações', href: '/settings', icon: Settings, exact: true },
    ],
  }
}

const globalAdmin: NavigationItem[] = [
  { name: 'Clientes', href: '/clients', icon: Building2, exact: true },
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

export function Sidebar({ tenant }: { tenant?: TenantShellInfo }) {
  const pathname = usePathname()
  const tenantNavigation = tenant ? getTenantNavigation(tenant.slug) : null

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
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Tenant atual</p>
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{tenant.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{tenant.slug}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-sm text-muted-foreground">
              Selecione um tenant em <span className="font-medium text-sidebar-foreground">Clientes</span> para abrir o painel operacional.
            </div>
          )}

          {tenantNavigation ? (
            <>
              <NavigationSection title="Visão Geral" items={tenantNavigation.navigation} pathname={pathname} />
              <NavigationSection title="Gerenciamento" items={tenantNavigation.management} pathname={pathname} />
              <NavigationSection title="Administração" items={tenantNavigation.admin} pathname={pathname} />
            </>
          ) : (
            <NavigationSection title="Administração" items={globalAdmin} pathname={pathname} />
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-sidebar-accent">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              AD
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-sidebar-foreground">Admin TI</p>
              <p className="text-xs text-muted-foreground">admin@corp.local</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function getHeaderTitle(pathname: string, tenant?: TenantShellInfo) {
  if (!tenant) {
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
    { match: `${basePath}/assets`, title: 'Detalhe do ativo' },
  ]

  const matched = titles.find((item) => pathname.startsWith(item.match))
  return matched?.title ?? 'Dashboard'
}

export function Header({ tenant }: { tenant?: TenantShellInfo }) {
  const pathname = usePathname()
  const title = getHeaderTitle(pathname, tenant)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {tenant ? `${tenant.name} · ${tenant.slug}` : 'Escopo global / administrativo'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 hover:bg-muted">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Última atualização:</span>
          <span className="text-foreground">há 5 minutos</span>
        </div>
      </div>
    </header>
  )
}
