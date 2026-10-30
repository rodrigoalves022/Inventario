import type * as React from 'react'
import {
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  Cpu,
  HardDrive,
  LayoutDashboard,
  Monitor,
  Network,
  Package,
  Server,
  Settings,
  Shield,
  Usb,
  UserCheck,
  Users,
} from 'lucide-react'
import { isOrgAdmin, isOrgOperator, isPlatformAdmin, type PermissionUser } from '@/lib/permissions'
import { getTenantBasePath, getTenantPath } from '@/lib/tenant-links'

/**
 * FONTE DE VERDADE UNICA de rota -> nome no shell da aplicacao (sidebar,
 * breadcrumbs e paleta de comando).
 *
 * Antes do overhaul visual (Fase 2) existiam DOIS mapas desincronizaveis
 * dentro de `components/sidebar.tsx`: os `NavigationItem[]` montados no
 * `Sidebar` (nome + icone + permissao) e a tabela `titles` do
 * `getHeaderTitle` (nome do titulo do header). Eram as mesmas palavras
 * escritas duas vezes — renomear "Maquinas" num lugar deixava o header
 * mostrando o nome antigo.
 *
 * Aqui a tabela e uma so: `TENANT_ROUTES` alimenta o menu, a trilha de
 * breadcrumbs e a busca da paleta. O que difere entre eles e o FILTRO
 * (`inNav`, `access`), nunca o rotulo.
 */

export type ShellIcon = React.ComponentType<{ className?: string }>

export type ShellTenant = {
  name: string
  slug: string
}

export type ShellNavItem = {
  name: string
  href: string
  icon: ShellIcon
  exact?: boolean
}

export type ShellNavSection = {
  title: string
  items: ShellNavItem[]
}

/**
 * Quem enxerga a rota. Espelha os gates que o `Sidebar` ja aplicava:
 * - `tenant`     — qualquer papel que consegue abrir o shell do tenant;
 * - `management` — PLATFORM_ADMIN, ORG_ADMIN ou ORG_OPERATOR;
 * - `account`    — PLATFORM_ADMIN ou ORG_ADMIN (area administrativa).
 *
 * Isto NAO e autorizacao: e apenas navegacao. O gate real de cada rota
 * continua server-side (`requireTenantContext` + guards de
 * `lib/permissions.ts`). Esconder um link nunca protegeu nada — o que este
 * filtro evita e oferecer ao usuario um caminho que vai terminar em 403.
 */
type ShellAccess = 'tenant' | 'management' | 'account'

type TenantRouteDef = {
  /** `undefined` = raiz do tenant (`/app/<slug>`). */
  segment?: string
  name: string
  icon: ShellIcon
  section: 'Inventário' | 'Gestão'
  exact?: boolean
  access: ShellAccess
  /** Rotas fora do menu lateral, mas que ainda precisam de nome na trilha. */
  inNav?: boolean
  /** Nome do nivel filho (`/assets/<id>`), quando a rota tem detalhe. */
  detailLabel?: string
}

const TENANT_ROUTES: readonly TenantRouteDef[] = [
  { name: 'Visão geral', icon: LayoutDashboard, section: 'Inventário', exact: true, access: 'tenant' },
  { segment: 'computers', name: 'Máquinas', icon: Monitor, section: 'Inventário', access: 'tenant' },
  { segment: 'servers', name: 'Servidores', icon: Server, section: 'Inventário', access: 'tenant' },
  { segment: 'storage', name: 'Armazenamento', icon: HardDrive, section: 'Inventário', access: 'tenant' },
  { segment: 'processors', name: 'Processadores', icon: Cpu, section: 'Inventário', access: 'tenant' },
  { segment: 'network', name: 'Rede', icon: Network, section: 'Inventário', access: 'tenant' },
  { segment: 'software', name: 'Softwares', icon: Package, section: 'Inventário', access: 'tenant' },
  { segment: 'peripherals', name: 'Periféricos', icon: Usb, section: 'Inventário', access: 'tenant' },
  { segment: 'local-accounts', name: 'Contas locais', icon: UserCheck, section: 'Inventário', access: 'tenant' },
  {
    // Listagem unificada: nao entra no menu (o dashboard ja e a porta de
    // entrada dela), mas e o pai de `/assets/<id>` na trilha.
    segment: 'assets',
    name: 'Todos os dispositivos',
    icon: Boxes,
    section: 'Inventário',
    exact: true,
    access: 'tenant',
    inNav: false,
    detailLabel: 'Detalhe da máquina',
  },
  { segment: 'reports', name: 'Relatórios', icon: BarChart3, section: 'Gestão', access: 'management' },
  { segment: 'alerts', name: 'Alertas', icon: BellRing, section: 'Gestão', access: 'management' },
  { segment: 'settings', name: 'Configurações', icon: Settings, section: 'Gestão', access: 'management' },
  { segment: 'audit', name: 'Auditoria', icon: ClipboardList, section: 'Gestão', access: 'account' },
]

type AccountRouteDef = {
  href: string
  name: string
  icon: ShellIcon
  access: 'account' | 'platform'
}

const ACCOUNT_ROUTES: readonly AccountRouteDef[] = [
  { href: '/admin/clients', name: 'Clientes', icon: Building2, access: 'account' },
  { href: '/admin/clients/audit', name: 'Auditoria global', icon: ClipboardList, access: 'platform' },
  { href: '/users', name: 'Usuários', icon: Users, access: 'platform' },
  { href: '/security', name: 'Segurança', icon: Shield, access: 'platform' },
  { href: '/docs', name: 'Documentação', icon: BookOpen, access: 'account' },
]

/**
 * Fail-closed: papel desconhecido (`role: null`) nao satisfaz nenhum nivel e
 * portanto nao ve menu nenhum. A versao anterior deste calculo, no `Sidebar`,
 * fazia `canAccessGlobalAdmin(user) || !user.role` — ou seja, mostrava o menu
 * administrativo inteiro justamente quando o papel nao era reconhecido.
 */
function hasAccess(user: PermissionUser, access: ShellAccess | 'platform') {
  const platformAdmin = isPlatformAdmin(user)
  const orgAdmin = isOrgAdmin(user)
  const orgOperator = isOrgOperator(user)

  switch (access) {
    case 'platform':
      return platformAdmin
    case 'account':
      return platformAdmin || orgAdmin
    case 'management':
      return platformAdmin || orgAdmin || orgOperator
    case 'tenant':
      return true
  }
}

/** `true` quando o papel pode abrir a listagem de clientes (`/admin/clients`). */
export function canAccessClientList(user: PermissionUser) {
  return isPlatformAdmin(user) || isOrgAdmin(user)
}

/**
 * Secoes do menu lateral. Tambem alimenta a paleta de comando — a paleta
 * navega exatamente para onde o menu navega, nunca para uma rota que o papel
 * nao veria no menu.
 */
export function buildShellNavigation(
  tenant: ShellTenant | undefined,
  user: PermissionUser
): ShellNavSection[] {
  const sections: ShellNavSection[] = []

  if (tenant) {
    for (const title of ['Inventário', 'Gestão'] as const) {
      const items = TENANT_ROUTES.filter(
        (route) => route.section === title && route.inNav !== false && hasAccess(user, route.access)
      ).map((route) => ({
        name: route.name,
        href: getTenantPath(tenant.slug, route.segment),
        icon: route.icon,
        exact: route.exact,
      }))
      if (items.length > 0) sections.push({ title, items })
    }
  }

  const account = ACCOUNT_ROUTES.filter((route) => hasAccess(user, route.access)).map((route) => ({
    name: route.name,
    href: route.href,
    icon: route.icon,
    exact: true,
  }))
  if (account.length > 0) sections.push({ title: 'Conta', items: account })

  return sections
}

export function isPathActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export type ShellCrumb = {
  label: string
  /** Sem `href` = texto simples (nivel atual, ou nivel que o papel nao acessa). */
  href?: string
}

/**
 * Trilha do header: `Clientes > <Cliente> > <Página ativa>`.
 *
 * O primeiro nivel e o ponto sensivel: `/admin/clients` e area de
 * PLATFORM_ADMIN / ORG_ADMIN. Para ORG_OPERATOR (e qualquer papel sem essa
 * area) o rotulo permanece — a trilha continua explicando ONDE o usuario esta
 * — mas SEM link, porque oferecer um caminho que termina em 403 e RBAC
 * vazando pela navegacao. Quem decide e `canAccessClientList`, o mesmo
 * predicado que governa a secao "Conta" do menu.
 */
export function getBreadcrumbTrail(
  pathname: string,
  tenant: ShellTenant | undefined,
  options: { canAccessClientList?: boolean } = {}
): ShellCrumb[] {
  if (!tenant) {
    // Nas telas administrativas o usuario JA esta dentro de /admin/clients,
    // entao o link para a listagem nao revela nada que ele nao possa abrir.
    if (pathname.startsWith('/admin/clients/audit')) {
      return [{ label: 'Clientes', href: '/admin/clients' }, { label: 'Auditoria global' }]
    }
    if (pathname.startsWith('/admin/clients/novo')) {
      return [{ label: 'Clientes', href: '/admin/clients' }, { label: 'Novo cliente' }]
    }
    if (pathname.startsWith('/admin/clients')) return [{ label: 'Clientes' }]
    if (pathname.startsWith('/users')) return [{ label: 'Usuários' }]
    if (pathname.startsWith('/security')) return [{ label: 'Segurança' }]
    if (pathname.startsWith('/account')) return [{ label: 'Minha conta' }]
    if (pathname.startsWith('/docs')) return [{ label: 'Documentação' }]
    return [{ label: 'Painel' }]
  }

  const basePath = getTenantBasePath(tenant.slug)
  const trail: ShellCrumb[] = [
    { label: 'Clientes', href: options.canAccessClientList ? '/admin/clients' : undefined },
    { label: tenant.name, href: basePath },
  ]

  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : ''
  const segments = rest.split('/').filter(Boolean)

  if (segments.length === 0) {
    trail.push({ label: 'Visão geral' })
    return trail
  }

  const route = TENANT_ROUTES.find((item) => item.segment === segments[0])
  if (!route) {
    // Rota desconhecida: nao inventa rotulo a partir do slug da URL.
    trail.push({ label: 'Visão geral' })
    return trail
  }

  const detailLabel = segments.length > 1 ? route.detailLabel : undefined
  trail.push({
    label: route.name,
    href: detailLabel ? getTenantPath(tenant.slug, route.segment) : undefined,
  })
  if (detailLabel) trail.push({ label: detailLabel })

  return trail
}

/** Nome da pagina atual = ultimo nivel da trilha. Um mapa so, nao dois. */
export function getShellPageTitle(pathname: string, tenant: ShellTenant | undefined) {
  const trail = getBreadcrumbTrail(pathname, tenant)
  return trail[trail.length - 1]?.label ?? 'Painel'
}
