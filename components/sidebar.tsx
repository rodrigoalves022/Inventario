'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { AppRole } from '@/lib/permissions'
import { getPermissionUser, isOrgAdmin, isOrgOperator, isPlatformAdmin } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { getTenantBasePath, getTenantPath } from '@/lib/tenant-links'
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
  ChevronDown,
  BarChart3,
  Users,
  Shield,
  Building2,
  LogOut,
  ClipboardList,
  BellRing,
} from 'lucide-react'

type TenantShellInfo = {
  name: string
  slug: string
}

export type SidebarUser = {
  name?: string | null
  email?: string | null
  role?: AppRole | null
}

type NavigationItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  ORG_ADMIN: 'Administrador da conta',
  ORG_OPERATOR: 'Operador',
  CLIENT_VIEWER: 'Portal do cliente',
}

function isPathActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getInitials(user: SidebarUser) {
  const source = user.name?.trim() || user.email?.trim() || ''
  if (!source) return '??'
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '' + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2) || source.slice(0, 2).toUpperCase()
}

function NavigationSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavigationItem[]
  pathname: string
}) {
  if (items.length === 0) return null

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

export function Sidebar({ tenant, user }: { tenant?: TenantShellInfo; user?: SidebarUser }) {
  const pathname = usePathname()
  const permissionUser = getPermissionUser({ role: user?.role ?? null })

  const platformAdmin = isPlatformAdmin(permissionUser)
  const orgAdmin = isOrgAdmin(permissionUser)
  const orgOperator = isOrgOperator(permissionUser)
  // Fail-closed: papel desconhecido nao ve nenhum menu. A versao anterior fazia
  // `canAccessGlobalAdmin(user) || !user.role`, ou seja, mostrava o menu
  // administrativo inteiro justamente quando o papel nao era reconhecido.
  const canSeeAccountArea = platformAdmin || orgAdmin
  const canSeeManagement = platformAdmin || orgAdmin || orgOperator

  const inventory: NavigationItem[] = tenant
    ? [
        { name: 'Visão geral', href: getTenantBasePath(tenant.slug), icon: LayoutDashboard, exact: true },
        { name: 'Máquinas', href: getTenantPath(tenant.slug, 'computers'), icon: Monitor },
        { name: 'Servidores', href: getTenantPath(tenant.slug, 'servers'), icon: Server },
        { name: 'Armazenamento', href: getTenantPath(tenant.slug, 'storage'), icon: HardDrive },
        { name: 'Processadores', href: getTenantPath(tenant.slug, 'processors'), icon: Cpu },
        { name: 'Rede', href: getTenantPath(tenant.slug, 'network'), icon: Network },
      ]
    : []

  const management: NavigationItem[] = tenant
    ? [
        ...(canSeeManagement
          ? [
              { name: 'Relatórios', href: getTenantPath(tenant.slug, 'reports'), icon: BarChart3 },
              { name: 'Alertas', href: getTenantPath(tenant.slug, 'alerts'), icon: BellRing },
            ]
          : []),
        ...(canSeeAccountArea
          ? [{ name: 'Auditoria', href: getTenantPath(tenant.slug, 'audit'), icon: ClipboardList }]
          : []),
      ]
    : []

  const account: NavigationItem[] = canSeeAccountArea
    ? [
        { name: 'Clientes', href: '/clients', icon: Building2, exact: true },
        ...(platformAdmin
          ? [
              { name: 'Auditoria global', href: '/clients/audit', icon: ClipboardList, exact: true },
              { name: 'Usuários', href: '/users', icon: Users, exact: true },
              { name: 'Segurança', href: '/security', icon: Shield, exact: true },
            ]
          : []),
      ]
    : []

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Monitor className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">Inventário TI</h1>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {tenant ? (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground" title={tenant.name}>
                {tenant.name}
              </p>
              {canSeeAccountArea && (
                <Link
                  href="/clients"
                  className="mt-1 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-sidebar-foreground hover:underline"
                >
                  Trocar cliente
                </Link>
              )}
            </div>
          ) : (
            canSeeAccountArea && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-xs text-muted-foreground">
                Escolha um cliente em <span className="font-medium text-sidebar-foreground">Clientes</span> para
                abrir o inventário dele.
              </div>
            )
          )}

          <NavigationSection title="Inventário" items={inventory} pathname={pathname} />
          <NavigationSection title="Gestão" items={management} pathname={pathname} />
          <NavigationSection title="Conta" items={account} pathname={pathname} />
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-sidebar-accent">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user ? getInitials(user) : '??'}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {user?.name || user?.email || 'Sessão'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.role ? ROLE_LABELS[user.role] : 'Sem permissões'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-60 border-sidebar-border bg-sidebar">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {user?.email ?? 'Não identificado'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-sidebar-border" />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
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
    if (pathname.startsWith('/clients/audit')) return 'Auditoria global'
    if (pathname.startsWith('/clients/novo')) return 'Novo cliente'
    if (pathname.startsWith('/clients')) return 'Clientes'
    if (pathname.startsWith('/users')) return 'Usuários'
    if (pathname.startsWith('/security')) return 'Segurança'
    return 'Painel'
  }

  const basePath = getTenantBasePath(tenant.slug)
  const titles: Array<{ match: string; title: string }> = [
    { match: `${basePath}/computers`, title: 'Máquinas' },
    { match: `${basePath}/servers`, title: 'Servidores' },
    { match: `${basePath}/storage`, title: 'Armazenamento' },
    { match: `${basePath}/processors`, title: 'Processadores' },
    { match: `${basePath}/network`, title: 'Rede' },
    { match: `${basePath}/reports`, title: 'Relatórios' },
    { match: `${basePath}/alerts`, title: 'Alertas' },
    { match: `${basePath}/audit`, title: 'Auditoria' },
    { match: `${basePath}/assets`, title: 'Detalhe da máquina' },
  ]

  return titles.find((item) => pathname.startsWith(item.match))?.title ?? 'Visão geral'
}

export function Header({
  tenant,
  lastCollectionAt,
}: {
  tenant?: TenantShellInfo
  lastCollectionAt?: string | null
}) {
  const pathname = usePathname()
  const title = getHeaderTitle(pathname, tenant)

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'sem coletas'
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
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {tenant && <p className="text-xs text-muted-foreground">{tenant.name}</p>}
      </div>

      {tenant && (
        <p className="text-sm text-muted-foreground">
          Última coleta: <span className="text-foreground">{formatRelative(lastCollectionAt)}</span>
        </p>
      )}
    </header>
  )
}
