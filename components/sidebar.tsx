'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
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
  ChevronDown,
  ChevronsUpDown,
  Check,
  Loader2,
  BarChart3,
  Users,
  Shield,
  Building2,
  LogOut,
  ClipboardList,
  BellRing,
  Menu,
  X,
} from 'lucide-react'

type TenantShellInfo = {
  name: string
  slug: string
}

type SwitchableClient = {
  id: string
  name: string
  slug: string
}

/**
 * Troca de cliente sem sair pra lista completa em /clients — o brief original
 * (sessao de /shape) previa isso pra ORG_ADMIN/ORG_OPERATOR, escopado a
 * clientes da propria org. Colapsa pro rotulo estatico de sempre quando so ha
 * 1 cliente (orgs DIRECT) — ver o branch em Sidebar.
 */
function ClientSwitcher({ current, clients }: { current: TenantShellInfo; clients: SwitchableClient[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const needsFilter = clients.length > 8
  const visible = needsFilter
    ? clients.filter((client) => client.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : clients

  function handleSelect(slug: string) {
    setOpen(false)
    if (slug === current.slug) return
    startTransition(() => {
      router.push(getTenantBasePath(slug))
    })
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setFilter('')
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/70 disabled:cursor-wait"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground" title={current.name}>
                {current.name}
              </p>
            </div>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 border-sidebar-border bg-sidebar p-1">
        {needsFilter && (
          <div className="p-1 pb-1.5">
            <input
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Buscar cliente..."
              className="w-full rounded-md border border-sidebar-border bg-transparent px-2 py-1.5 text-sm text-sidebar-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-sidebar-ring"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            visible.map((client) => (
              <DropdownMenuItem
                key={client.id}
                className="cursor-pointer justify-between gap-2"
                onSelect={(event) => {
                  event.preventDefault()
                  handleSelect(client.slug)
                }}
              >
                <span className="truncate">{client.name}</span>
                {client.slug === current.slug && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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

export function Sidebar({
  tenant,
  user,
  switchableClients,
}: {
  tenant?: TenantShellInfo
  user?: SidebarUser
  /** So passado quando o papel pode trocar de cliente (ver app/tenant/[clientSlug]/layout.tsx). */
  switchableClients?: SwitchableClient[]
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fecha o drawer mobile a cada navegacao — sem isso o menu ficaria aberto
  // por cima da tela seguinte depois de tocar num link.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Monitor className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="flex-1 text-sm font-semibold text-sidebar-foreground">Inventário TI</h1>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {tenant ? (
            switchableClients && switchableClients.length > 1 ? (
              <ClientSwitcher current={tenant} clients={switchableClients} />
            ) : (
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
            )
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
    </>
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
  const titles: Array<{ match: string; title: string; exact?: boolean }> = [
    { match: `${basePath}/computers`, title: 'Máquinas' },
    { match: `${basePath}/servers`, title: 'Servidores' },
    { match: `${basePath}/storage`, title: 'Armazenamento' },
    { match: `${basePath}/processors`, title: 'Processadores' },
    { match: `${basePath}/network`, title: 'Rede' },
    { match: `${basePath}/reports`, title: 'Relatórios' },
    { match: `${basePath}/alerts`, title: 'Alertas' },
    { match: `${basePath}/audit`, title: 'Auditoria' },
    // Listagem unificada (exata) vem antes do detalhe (prefixo `/assets/<id>`)
    // — sem essa ordem, `startsWith` faria a listagem cair no titulo do detalhe.
    { match: `${basePath}/assets`, title: 'Todos os dispositivos', exact: true },
    { match: `${basePath}/assets/`, title: 'Detalhe da máquina' },
  ]

  return (
    titles.find((item) => (item.exact ? pathname === item.match : pathname.startsWith(item.match)))?.title ??
    'Visão geral'
  )
}

export function Header({
  tenant,
  lastCollectionAt,
  now,
}: {
  tenant?: TenantShellInfo
  lastCollectionAt?: string | null
  /**
   * Timestamp de referencia calculado pelo Server Component chamador (ver
   * `app/tenant/[clientSlug]/layout.tsx`) e passado como prop serializada.
   *
   * Header comeca com 'use client', mas como todo componente client ele e
   * renderizado no servidor (SSR) e depois hidratado no browser. Antes,
   * `formatRelative` chamava `Date.now()` direto: o SSR calculava "ha 17
   * min" com o relogio do servidor, e a hidratacao recalculava com o
   * relogio do client alguns instantes depois — sempre que essa janela
   * cruzava uma fronteira de minuto/hora/dia, o texto renderizado no
   * servidor nao batia com o do client, um hydration mismatch classico de
   * "tempo relativo". O React reage a um mismatch de texto descartando e
   * re-renderizando do zero a subarvore inteira a partir dali, o que
   * reatribui os `useId()` que o Radix usa para o `id` do
   * `DropdownMenuTrigger` mais abaixo na Sidebar — o sintoma visivel
   * (`id` divergente entre server e client) nao era um bug no
   * DropdownMenuTrigger em si, e sim esse efeito cascata.
   *
   * A correcao: `now` e calculado uma unica vez no Server Component (que
   * so roda no servidor) e flui como prop ja serializada, entao a primeira
   * renderizacao do client (antes de qualquer efeito) usa exatamente o
   * mesmo valor que o SSR usou — sem essa segunda leitura de relogio, nao
   * ha mais como os dois lados divergirem.
   */
  now?: string
}) {
  const pathname = usePathname()
  const title = getHeaderTitle(pathname, tenant)

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'sem coletas'
    const reference = now ? new Date(now).getTime() : Date.now()
    const diffMs = reference - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'agora mesmo'
    if (mins < 60) return `há ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `há ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `há ${days} dia${days > 1 ? 's' : ''}`
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 pl-16 pr-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
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
