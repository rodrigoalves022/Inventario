'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { signOut } from 'next-auth/react'
import type { AppRole } from '@/lib/permissions'
import { getPermissionUser } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { getTenantBasePath } from '@/lib/tenant-links'
import { ONLINE_PRESENCE_MINUTES } from '@/lib/inventory-alerts'
import {
  buildShellNavigation,
  canAccessClientList,
  getBreadcrumbTrail,
  isPathActive,
  type ShellNavItem,
  type ShellTenant,
} from '@/lib/shell-navigation'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { ShellBreadcrumbs } from '@/components/shell-breadcrumbs'
import {
  CommandPalette,
  CommandPaletteTrigger,
  useCommandPalette,
} from '@/components/command-palette'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Monitor,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Loader2,
  Building2,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

type TenantShellInfo = ShellTenant

type SwitchableClient = {
  id: string
  name: string
  slug: string
}

/**
 * Troca de cliente sem sair pra lista completa em /clients — o brief original
 * (sessao de /shape) previa isso pra ORG_ADMIN/ORG_OPERATOR, escopado a
 * clientes da propria org. Colapsa pro rotulo estatico de sempre quando so ha
 * 1 cliente (orgs DIRECT) — ver o branch em Header.
 *
 * Overhaul visual, Fase 2: o controle SAIU do topo da sidebar e virou uma
 * acao contextual do header, ao lado do perfil. Motivo: o cliente ativo ja e
 * o segundo nivel da trilha de breadcrumbs — manter um cartao inteiro
 * repetindo o mesmo nome no topo do menu era dizer a mesma coisa duas vezes,
 * na coluna mais estreita da tela. Aqui ele e um controle compacto de 36px de
 * altura, alinhado com a busca e o avatar.
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
          aria-label={`Cliente ativo: ${current.name}. Trocar de cliente`}
          className="flex h-9 items-center gap-2 rounded-lg border border-surface-line bg-secondary/50 px-2.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 lg:max-w-[10rem] xl:max-w-[14rem]"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          {/* Abaixo de `lg` o controle vira icone + seta: a trilha ao lado ja
              mostra o nome do cliente nessa largura, e dois nomes do mesmo
              cliente num header de 64px nao cabem. O `aria-label` do botao
              continua carregando o nome para quem usa leitor de tela. */}
          <span className="hidden truncate font-medium lg:inline">{current.name}</span>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1">
        <DropdownMenuLabel className="section-label px-2 pt-1.5 pb-1">Trocar de cliente</DropdownMenuLabel>
        {needsFilter && (
          <div className="p-1 pb-1.5">
            <input
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Buscar cliente..."
              aria-label="Buscar cliente"
              className="w-full rounded-md border border-surface-line bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
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

const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  ORG_ADMIN: 'Administrador da conta',
  ORG_OPERATOR: 'Operador',
  CLIENT_VIEWER: 'Portal do cliente',
}

function getInitials(user: SidebarUser) {
  const source = user.name?.trim() || user.email?.trim() || ''
  if (!source) return '??'
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  // Os parenteses de cada termo sao necessarios: `??` tem precedencia MENOR que
  // `+`, entao `a ?? '' + b` agrupa como `a ?? ('' + b)` — a versao anterior
  // devolvia so a inicial do primeiro nome ("Rodrigo Silva" -> "R", nunca "RS").
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return initials.toUpperCase().slice(0, 2) || source.slice(0, 2).toUpperCase()
}

function NavigationSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: ShellNavItem[]
  pathname: string
}) {
  if (items.length === 0) return null

  return (
    <div>
      <h2 className="section-label mb-2 px-3">{title}</h2>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = isPathActive(pathname, item.href, item.exact)
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg py-2 pr-3 pl-4 text-sm transition-colors duration-150',
                  'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                  isActive
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                )}
              >
                {/* Barra de estado atual. E um elemento posicionado, nao um
                    `border-l-2`: com borda, o item ATIVO ganharia 2px de
                    largura de caixa e todo o texto da linha andaria 2px pro
                    lado ao navegar. O span nao ocupa espaco no fluxo, e ainda
                    aceita raio proprio pra nao brigar com o canto arredondado
                    do item. */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                  />
                )}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-accent-foreground'
                  )}
                />
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Fora do componente de proposito (ver comentario de `now` em Sidebar): assim
 * o `Date.now()` de fallback nao e mais uma chamada impura "durante o render"
 * aos olhos do lint de pureza do React Compiler — `now` deixou de ser
 * capturado por closure e passou a parametro explicito.
 */
function formatRelative(iso: string | null | undefined, now?: string): string {
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

/**
 * Estado da frota derivado do UNICO dado de coleta que o shell ja tem em
 * maos (`lastCollectionAt`, uma consulta que o layout do tenant ja fazia).
 * Nenhuma consulta nova entra aqui: contar agentes online por faixa seria um
 * agregado por navegacao no layout, custo permanente por uma pilula.
 *
 * O limiar e `ONLINE_PRESENCE_MINUTES` — a MESMA constante de
 * `getDevicePresence`. Sem isso, a pilula poderia dizer "frota ativa"
 * enquanto a tabela ao lado ja mostra todas as maquinas como "ausente".
 */
function getFleetStatus(
  lastCollectionAt: string | null | undefined,
  now?: string
): { tone: StatusPillTone; label: string } {
  if (!lastCollectionAt) return { tone: 'neutral', label: 'Sem coletas' }
  const reference = now ? new Date(now).getTime() : Date.now()
  const ageMinutes = (reference - new Date(lastCollectionAt).getTime()) / 60000
  if (ageMinutes <= ONLINE_PRESENCE_MINUTES) return { tone: 'success', label: 'Frota ativa' }
  return { tone: 'warning', label: 'Coleta atrasada' }
}

export function Sidebar({
  tenant,
  user,
  lastCollectionAt,
  now,
  appVersion,
}: {
  tenant?: TenantShellInfo
  user?: SidebarUser
  /** Ultima coleta do tenant, ja resolvida pelo layout (Server Component). */
  lastCollectionAt?: string | null
  /**
   * Timestamp de referencia calculado pelo Server Component chamador (ver
   * `app/app/[clientSlug]/layout.tsx`) e passado como prop serializada.
   *
   * Sidebar comeca com 'use client', mas como todo componente client ele e
   * renderizado no servidor (SSR) e depois hidratado no browser. Se
   * `formatRelative`/`getFleetStatus` chamassem `Date.now()` direto, o SSR
   * calcularia "ha 17 min" com o relogio do servidor e a hidratacao
   * recalcularia com o relogio do client alguns instantes depois — sempre que
   * essa janela cruzasse uma fronteira de minuto/hora/dia, o texto do
   * servidor nao bateria com o do client, um hydration mismatch classico de
   * "tempo relativo". O React reage a um mismatch de texto descartando e
   * re-renderizando do zero a subarvore inteira a partir dali, o que
   * reatribui os `useId()` que o Radix usa para o `id` dos
   * `DropdownMenuTrigger` mais abaixo — o sintoma visivel (`id` divergente
   * entre server e client) nao era bug do DropdownMenuTrigger em si, e sim
   * esse efeito cascata.
   *
   * A correcao: `now` e calculado uma unica vez no Server Component e flui
   * como prop ja serializada, entao a primeira renderizacao do client (antes
   * de qualquer efeito) usa exatamente o mesmo valor que o SSR usou.
   */
  now?: string
  /** Versao do painel, lida do package.json pelo layout. */
  appVersion?: string
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fecha o drawer mobile a cada navegacao — sem isso o menu ficaria aberto
  // por cima da tela seguinte depois de tocar num link. Ajuste de estado
  // durante o render (em vez de um useEffect) e o padrao recomendado pelo
  // React para "resetar estado quando uma prop muda"; evita o
  // re-render em cascata de um setState sincrono dentro de efeito.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMobileOpen(false)
  }

  const permissionUser = getPermissionUser({ role: user?.role ?? null })
  const sections = buildShellNavigation(tenant, permissionUser)
  const fleet = getFleetStatus(lastCollectionAt, now)

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="fixed top-3 left-3 z-50 flex h-11 w-11 items-center justify-center rounded-lg border border-surface-line bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Vidro na sidebar: e superficie FIXA que se sobrepoe a conteudo — no
        mobile literalmente, como drawer por cima da tela; no desktop, como
        coluna fixa enquanto o conteudo rola. E o caso permitido em DESIGN.md
        §4.1 ("so em superficie que se sobrepoe a conteudo").

        O tom vem de `--sidebar`, nao de `--card`: DESIGN.md §2.2 define a
        sidebar como a segunda camada neutra, um degrau ABAIXO do conteudo.
        Pintar de `bg-card` inverteria essa hierarquia — o menu ficaria mais
        claro que a tela que ele serve.
      */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md transition-transform duration-300 ease-out',
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
              className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            {!tenant && sections.length > 0 && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-3 text-xs text-muted-foreground">
                Escolha um cliente em <span className="font-medium text-sidebar-foreground">Clientes</span> para
                abrir o inventário dele.
              </div>
            )}

            {sections.map((section) => (
              <NavigationSection
                key={section.title}
                title={section.title}
                items={section.items}
                pathname={pathname}
              />
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            {tenant ? (
              /*
                Rodape do tenant: sessao ativa + estado da frota. O menu de
                perfil (sair da conta) migrou pro header nesta fase — ver
                `Header`. As telas administrativas, que nao tem tenant,
                continuam com o menu aqui, no ramo `else`.
              */
              <div className="space-y-2.5 rounded-lg border border-surface-line bg-sidebar-accent/40 px-3 py-2.5">
                <div>
                  <p className="section-label">Sessão</p>
                  <p className="truncate text-sm font-semibold text-sidebar-foreground" title={tenant.name}>
                    {tenant.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.name || user?.email || 'Sessão'}
                    {user?.role ? ` · ${ROLE_LABELS[user.role]}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-surface-line pt-2.5">
                  <StatusPill tone={fleet.tone} label={fleet.label} />
                  {appVersion && (
                    <span
                      className="data-mono text-[11px] text-muted-foreground"
                      title={`Versão do painel: ${appVersion}`}
                    >
                      v{appVersion}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Última coleta {formatRelative(lastCollectionAt, now)}
                </p>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
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
                <DropdownMenuContent side="right" align="end" className="w-60">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {user?.email ?? 'Não identificado'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair da conta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

/** Acoes de perfil no header — so montado quando o chamador passa a sessao. */
function ProfileMenu({ user }: { user: SidebarUser }) {
  const label = user.name || user.email || 'Sessão'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Conta de ${label}`}
          className="flex h-9 items-center gap-1.5 rounded-lg px-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {getInitials(user)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.role ? ROLE_LABELS[user.role] : 'Sem permissões'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header({
  tenant,
  user,
  switchableClients,
}: {
  tenant?: TenantShellInfo
  /**
   * Sessao do usuario. So o shell do tenant passa isto hoje; as telas
   * administrativas (`/admin/clients`, `/users`, `/security`) chamam
   * `<Header />` sem props e mantem o menu de perfil no rodape da sidebar.
   * Sem essa prop o header nao monta perfil nem paleta — nao existe nada pra
   * buscar sem saber o papel de quem busca.
   */
  user?: SidebarUser
  /** So passado quando o papel pode trocar de cliente (ver o layout do tenant). */
  switchableClients?: SwitchableClient[]
}) {
  const pathname = usePathname()
  const { open, setOpen } = useCommandPalette()

  const permissionUser = getPermissionUser({ role: user?.role ?? null })
  const trail = getBreadcrumbTrail(pathname, tenant, {
    // RBAC vazando pela navegacao e RBAC quebrado: quem nao abre
    // /admin/clients recebe "Clientes" como TEXTO, nunca como link.
    canAccessClientList: canAccessClientList(permissionUser),
  })
  const sections = user ? buildShellNavigation(tenant, permissionUser) : []
  const hasPalette = sections.some((section) => section.items.length > 0)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-surface-line bg-background/80 pr-4 pl-16 backdrop-blur-md lg:gap-4 lg:px-6">
      <ShellBreadcrumbs trail={trail} className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2">
        {hasPalette && (
          <CommandPaletteTrigger onOpen={() => setOpen(true)} canSearchDevices={Boolean(tenant)} />
        )}
        {tenant && switchableClients && switchableClients.length > 1 && (
          <ClientSwitcher current={tenant} clients={switchableClients} />
        )}
        {user && <ProfileMenu user={user} />}
      </div>

      {hasPalette && (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          sections={sections}
          tenantSlug={tenant?.slug ?? null}
        />
      )}
    </header>
  )
}
