'use client'

import { useActionState, useCallback, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Activity,
  BriefcaseBusiness,
  Check,
  History,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Mail,
  Minus,
  ShieldCheck,
  SlidersHorizontal,
  SunMoon,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import * as accountActions from '@/app/account/actions'
import type { AccountActionState, AccountOverview, AccountPreferences } from '@/app/account/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AppearanceControls, getInitials } from '@/components/sidebar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AUDIT_ACTION_LABEL } from '@/lib/audit-action-labels'
import { ROLE_LABELS, type AppRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export type AccountDialogTab = 'profile' | 'preferences' | 'security' | 'sessions'

export type AccountUser = { name?: string | null; email?: string | null; role?: AppRole | null }

/** Rotulo e icone de cada secao — a barra do modal e o menu vertical de /account. */
export const ACCOUNT_TABS: ReadonlyArray<{ value: AccountDialogTab; label: string; icon: LucideIcon }> = [
  { value: 'profile', label: 'Perfil', icon: UserRound },
  { value: 'preferences', label: 'Preferências', icon: SlidersHorizontal },
  { value: 'security', label: 'Segurança', icon: ShieldCheck },
  { value: 'sessions', label: 'Acessos', icon: History },
]

export function isAccountTab(value: unknown): value is AccountDialogTab {
  return ACCOUNT_TABS.some((tab) => tab.value === value)
}

const IDLE: AccountActionState = { status: 'idle', message: null }

type Action = (previous: AccountActionState, formData: FormData) => Promise<AccountActionState>

/**
 * O Vitest reescreve named imports para acesso a propriedade num Proxy que lanca
 * erro sincrono quando a exportacao falta no `vi.mock` — mocks antigos so trazem
 * as 3 actions da Sprint V21. Le a action de forma defensiva e cai no fallback.
 */
function getAction<K extends keyof typeof accountActions>(
  key: K,
  fallback: (typeof accountActions)[K],
): (typeof accountActions)[K] {
  try {
    return accountActions[key] ?? fallback
  } catch {
    return fallback
  }
}

const unavailableAction: Action = async () => ({ status: 'error', message: 'Ação indisponível no momento.' })
const noOverview = async (): Promise<AccountOverview | null> => null

const DEFAULT_PREFERENCES: AccountPreferences = {
  timezone: 'America/Sao_Paulo',
  dateFormat: '24h',
  notifyOffline: true,
  notifyHardware: true,
  notifySecurity: true,
}

const TIMEZONE_OPTIONS: Array<{ value: AccountPreferences['timezone']; label: string }> = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'UTC', label: 'UTC (Tempo Universal)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0/+1)' },
]

const DATE_FORMAT_OPTIONS: Array<{ value: AccountPreferences['dateFormat']; label: string }> = [
  { value: '24h', label: '24 horas (31/12/2026 14:30)' },
  { value: '12h', label: '12 horas (31/12/2026 02:30 PM)' },
]

const NOTIFICATION_OPTIONS: Array<{
  name: 'notifyOffline' | 'notifyHardware' | 'notifySecurity'
  label: string
}> = [
  { name: 'notifyOffline', label: 'Resumo de máquinas ausentes (>24h)' },
  { name: 'notifyHardware', label: 'Alertas críticos de disco e S.M.A.R.T.' },
  { name: 'notifySecurity', label: 'Avisos de segurança e novos acessos na conta' },
]

/**
 * Resumo do RBAC de `lib/permissions.ts`, em linguagem de usuario.
 * `allowed: false` e restricao explicita do papel — leva traco, nao check.
 */
const ROLE_CAPABILITIES: Record<AppRole, Array<{ label: string; allowed: boolean }>> = {
  PLATFORM_ADMIN: [
    { label: 'Acesso global a todos os clientes (multi-tenant).', allowed: true },
    { label: 'Gestão de clientes, usuários e chaves de provisionamento.', allowed: true },
    { label: 'Configuração de alertas, webhooks e auditoria.', allowed: true },
  ],
  ORG_ADMIN: [
    { label: 'Gestão completa dos clientes da organização.', allowed: true },
    { label: 'Configuração de alertas, webhooks e dados da empresa.', allowed: true },
    { label: 'Comandos remotos e operação do inventário.', allowed: true },
  ],
  ORG_OPERATOR: [
    { label: 'Operação do inventário e consulta de máquinas.', allowed: true },
    { label: 'Disparo de comandos remotos permitidos.', allowed: true },
    { label: 'Sem gestão de usuários, credenciais ou webhooks.', allowed: false },
  ],
  CLIENT_VIEWER: [
    { label: 'Leitura do inventário do próprio cliente.', allowed: true },
    { label: 'Exportação de relatórios.', allowed: true },
    { label: 'Sem alterações de configuração.', allowed: false },
  ],
}

const ROLE_SCOPE: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Escopo: todos os clientes da plataforma.',
  ORG_ADMIN: 'Escopo: clientes da sua organização.',
  ORG_OPERATOR: 'Escopo: clientes da sua organização.',
  CLIENT_VIEWER: 'Escopo: somente o seu cliente.',
}

export const ACCOUNT_EVENT_LABELS: Record<string, string> = {
  'account.name_update': 'Nome atualizado',
  'account.email_update': 'E-mail alterado',
  'account.password_change': 'Senha alterada',
  'account.profile_details_update': 'Contato profissional atualizado',
  'account.preferences_update': 'Preferências salvas',
}

/** Evento fora deste mapa (acao em outro modulo) cai em `Activity`. */
const ACCOUNT_EVENT_ICONS: Record<string, LucideIcon> = {
  'account.name_update': UserRound,
  'account.email_update': Mail,
  'account.password_change': KeyRound,
  'account.profile_details_update': BriefcaseBusiness,
  'account.preferences_update': SlidersHorizontal,
}

function formatEventDate(iso: string, preferences: AccountPreferences) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: preferences.timezone,
    hour12: preferences.dateFormat === '12h',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const BROWSERS: Array<[string, RegExp]> = [
  ['Edge', /Edg\//],
  ['Opera', /OPR\//],
  ['Firefox', /Firefox\//],
  ['Chrome', /Chrome\//],
  ['Safari', /Safari\//],
]

const SYSTEMS: Array<[string, RegExp]> = [
  ['Windows', /Windows/],
  ['Android', /Android/],
  ['iOS', /iPhone|iPad/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
]

/** "Chrome · Windows" a partir do user-agent; `null` quando nada casa. */
function describeBrowser(userAgent: string) {
  const match = (list: Array<[string, RegExp]>) => list.find(([, pattern]) => pattern.test(userAgent))?.[0]
  return [match(BROWSERS), match(SYSTEMS)].filter(Boolean).join(' · ') || null
}

function subscribeNoop() {
  return () => {}
}

function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  defaultValue,
  placeholder,
  required = true,
}: {
  name: string
  label: string
  type?: string
  autoComplete?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string
  label: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>option]:bg-popover [&>option]:text-popover-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Linha inteira clicavel: o `<label>` envolve o checkbox. Vive num grupo com `divide-y`. */
function CheckboxField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const id = useId()
  return (
    <Label
      htmlFor={id}
      className="cursor-pointer gap-3 px-3.5 py-3 leading-snug font-normal transition-colors hover:bg-surface-hover"
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      {label}
    </Label>
  )
}

/** Linha termo/valor. Valor ausente cai no `fallback` em tom apagado — e texto, nao dado, entao sem mono. */
function SummaryRow({
  term,
  value,
  fallback,
  mono = false,
}: {
  term: string
  value: string
  fallback?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd
        title={value || undefined}
        className={cn(
          'min-w-0 truncate text-right',
          value ? 'text-foreground' : 'text-muted-foreground',
          value && mono && 'data-mono'
        )}
      >
        {value || fallback}
      </dd>
    </div>
  )
}

/**
 * Bloco de configuracao. Na pagina /account (`wide`) vira um Panel com
 * cabecalho de icone e corpo em coluna: o rodape do formulario desce ate a
 * base, entao paineis lado a lado terminam na mesma linha com os botoes
 * alinhados. `@container` no corpo: os pares de campo quebram pela largura do
 * painel, nao da janela. No modal mantem o rotulo de secao em linha.
 */
function SettingsBlock({
  wide,
  icon,
  title,
  description,
  ariaLabel,
  flush = false,
  className,
  children,
}: {
  wide: boolean
  icon: React.ReactNode
  title: string
  description: string
  ariaLabel?: string
  flush?: boolean
  className?: string
  children: React.ReactNode
}) {
  const titleId = useId()
  if (wide) {
    return (
      <Panel aria-labelledby={titleId} className={className}>
        <PanelHeader titleId={titleId} icon={icon} title={title} description={description} />
        <PanelBody flush={flush} className="@container flex flex-col">
          {children}
        </PanelBody>
      </Panel>
    )
  }
  if (!ariaLabel) return <>{children}</>
  return (
    <section aria-label={ariaLabel} className="grid gap-3">
      <h3 className="section-label">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Um formulario = uma action. O React 19 reseta os campos nao controlados ao
 * fim da action, entao as senhas nao ficam no DOM depois do envio.
 *
 * `inPanel`: o titulo ja esta no PanelHeader (o form so leva `aria-label`) e o
 * rodape vira faixa separada por linha, empurrada para a base do painel.
 */
function AccountForm({
  action,
  submitLabel,
  title,
  onSuccess,
  inPanel = false,
  children,
}: {
  action: Action
  submitLabel: string
  title: string
  onSuccess?: () => void
  inPanel?: boolean
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, IDLE)

  // So `state` na dependencia: `onSuccess` e recriado a cada render do pai e
  // dispararia router.refresh() em laco enquanto o estado for 'success'.
  useEffect(() => {
    if (state.status === 'success') onSuccess?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} aria-label={title} className={inPanel ? 'flex flex-1 flex-col gap-3' : 'grid gap-3'}>
      {!inPanel && <h3 className="section-label">{title}</h3>}
      {children}
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          inPanel && 'mt-auto border-t border-surface-line pt-3'
        )}
      >
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={cn('min-h-5 text-xs', state.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {state.message}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Cartao de identidade da coluna mestre de /account. */
function OperatorIdentity({
  user,
  details,
  timezone,
}: {
  user: AccountUser
  details: AccountOverview['profileDetails']
  timezone: string
}) {
  const label = user.name || user.email || 'Sessão'
  const position = [details.jobTitle, details.department].filter(Boolean).join(' · ')

  return (
    <Panel aria-label="Identidade do operador">
      <PanelBody className="space-y-4 pt-5">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-base font-bold text-primary"
          >
            {getInitials(user)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground" title={label}>
              {label}
            </p>
            {user.email && (
              <p className="data-mono truncate text-xs text-muted-foreground" title={user.email}>
                {user.email}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role && <StatusPill tone="neutral" label={ROLE_LABELS[user.role]} />}
          <StatusPill tone="success" label="Sessão ativa" />
        </div>
        <dl className="divide-y divide-surface-line border-t border-surface-line text-xs">
          <SummaryRow term="Cargo / Depto" value={position} fallback="Não informado" />
          <SummaryRow term="Plantão" value={details.phone} fallback="Não cadastrado" mono />
          <SummaryRow term="Fuso horário" value={timezone} mono />
        </dl>
      </PanelBody>
    </Panel>
  )
}

function RoleSummary({ role }: { role: AppRole | null }) {
  const key = role ?? 'ORG_OPERATOR'
  return (
    <div className="grid gap-3">
      <div className="space-y-1">
        <p className="section-label">Papel atual</p>
        <p className="text-base font-semibold text-foreground">{ROLE_LABELS[key]}</p>
        <p className="text-xs text-muted-foreground">{ROLE_SCOPE[key]}</p>
      </div>
      <ul aria-label="Permissões do papel" className="divide-y divide-surface-line border-t border-surface-line">
        {ROLE_CAPABILITIES[key].map(({ label, allowed }) => (
          <li key={label} className="flex items-start gap-2.5 py-2.5 text-sm">
            {allowed ? (
              <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <Minus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={allowed ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CurrentSession({ email, inPanel }: { email?: string | null; inPanel: boolean }) {
  // O user-agent so existe no client; ate hidratar, a linha fica sem valor.
  const browser = useSyncExternalStore(subscribeNoop, () => describeBrowser(navigator.userAgent), () => null)

  return (
    <div className="flex flex-1 flex-col gap-3">
      <dl
        className={cn(
          'divide-y divide-surface-line text-sm',
          !inPanel && 'rounded-lg border border-surface-line px-3'
        )}
      >
        <SummaryRow term="Conta" value={email ?? ''} fallback="Não identificada" mono />
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-muted-foreground">Estado</dt>
          <dd className="flex items-center gap-1.5 text-success">
            <span aria-hidden className="status-dot" />
            Ativa neste dispositivo
          </dd>
        </div>
        <SummaryRow term="Navegador" value={browser ?? ''} fallback="Não identificado" />
      </dl>
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          inPanel && 'mt-auto border-t border-surface-line pt-3'
        )}
      >
        <p className="text-xs text-muted-foreground">Encerrar exige novo login neste navegador.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
          <LogOut className="h-3.5 w-3.5" />
          Encerrar sessão
        </Button>
      </div>
    </div>
  )
}

function RecentEvents({
  events,
  preferences,
  inPanel,
}: {
  events: AccountOverview['recentEvents']
  preferences: AccountPreferences
  inPanel: boolean
}) {
  if (events.length === 0) {
    return (
      <div className={cn('space-y-1', inPanel && 'px-5 pb-5')}>
        <p className="text-sm text-muted-foreground">Nenhum evento recente registrado para esta conta.</p>
        <p className="text-xs text-muted-foreground">
          Trocas de nome, e-mail, senha, contato e preferências aparecem aqui.
        </p>
      </div>
    )
  }

  return (
    <ol
      className={cn(
        'divide-y divide-surface-line',
        inPanel ? 'border-t border-surface-line' : 'rounded-lg border border-surface-line'
      )}
    >
      {events.map((event) => {
        const Icon = ACCOUNT_EVENT_ICONS[event.action] ?? Activity
        // A trilha traz tudo em que a conta e autora (credenciais, comandos...),
        // nao so `account.*`: cai no catalogo geral de acoes auditadas.
        const label = ACCOUNT_EVENT_LABELS[event.action] ?? AUDIT_ACTION_LABEL[event.action]
        return (
          <li key={event.id} className={cn('flex items-center gap-3 py-2.5', inPanel ? 'px-5' : 'px-3')}>
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            {/* Acao sem rotulo traduzido e identificador tecnico: mostra cru, em mono. */}
            <span
              title={label ? undefined : event.action}
              className={cn('min-w-0 flex-1 truncate text-foreground', label ? 'text-sm' : 'data-mono text-xs')}
            >
              {label ?? event.action}
            </span>
            <time dateTime={event.createdAt} className="data-mono shrink-0 text-xs text-muted-foreground">
              {formatEventDate(event.createdAt, preferences)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}

export function AccountSettingsContent({
  user,
  initialTab = 'profile',
  initialOverview = null,
  tab: controlledTab,
  onTabChange,
  loadOnMount = initialOverview === null,
  wide = false,
}: {
  user: AccountUser
  initialTab?: AccountDialogTab
  initialOverview?: AccountOverview | null
  tab?: AccountDialogTab
  onTabChange?: (tab: AccountDialogTab) => void
  loadOnMount?: boolean
  /** Pagina /account: layout mestre-detalhe com Panels. Sem isto, layout do modal. */
  wide?: boolean
}) {
  const router = useRouter()
  const updateProfileNameAction = getAction('updateProfileNameAction', unavailableAction)
  const updateEmailAction = getAction('updateEmailAction', unavailableAction)
  const changePasswordAction = getAction('changePasswordAction', unavailableAction)
  const updateAccountProfileDetailsAction = getAction('updateAccountProfileDetailsAction', unavailableAction)
  const updateAccountPreferencesAction = getAction('updateAccountPreferencesAction', unavailableAction)
  const getAccountOverviewAction = getAction('getAccountOverviewAction', noOverview)
  // Nome/e-mail vem do layout (Server Component) — refresh relê a sessao reemitida.
  const refresh = () => router.refresh()

  const [localTab, setLocalTab] = useState<AccountDialogTab>(initialTab)
  const tab = controlledTab ?? localTab
  const setTab = (next: AccountDialogTab) => {
    setLocalTab(next)
    onTabChange?.(next)
  }

  // Sprint V24: cargo/contato, preferencias e atividade vem do AuditLog.
  // `null` (sem sessao, ou ambiente de teste sem action) cai nos defaults.
  const [overview, setOverview] = useState<AccountOverview | null>(initialOverview)
  const loadOverview = useCallback(() => {
    // try/catch sincrono tambem: um mock com `vi.fn()` sem retorno pode lancar
    // antes da Promise existir.
    try {
      Promise.resolve(getAccountOverviewAction())
        .then((next) => setOverview(next ?? null))
        .catch((error) => console.error('[Account] Falha ao carregar visão da conta:', error))
    } catch (error) {
      console.error('[Account] Falha ao carregar visão da conta:', error)
    }
  }, [getAccountOverviewAction])

  useEffect(() => {
    if (loadOnMount) loadOverview()
  }, [loadOnMount, loadOverview])

  const details = overview?.profileDetails ?? { jobTitle: '', department: '', phone: '' }
  const preferences = overview?.preferences ?? DEFAULT_PREFERENCES
  const recentEvents = overview?.recentEvents ?? []
  // Campos nao controlados: remonta o formulario quando a visao chega do servidor.
  const overviewKey = overview ? 'loaded' : 'empty'
  const role = user.role ?? null

  // No modal os wrappers somem (`contents`) e os campos empilham no grid do form.
  const pair = wide ? 'grid gap-3 @md:grid-cols-2' : 'contents'
  const contentClass = wide ? 'grid gap-6 xl:grid-cols-2' : 'grid gap-6 pt-2'

  const sections = (
    <>
      <TabsContent value="profile" className={contentClass}>
        <SettingsBlock
          wide={wide}
          icon={<UserRound />}
          title="Nome de exibição"
          description="Como seu nome aparece no painel e na trilha de auditoria."
        >
          <AccountForm
            action={updateProfileNameAction}
            title="Nome de exibição"
            submitLabel="Salvar nome"
            onSuccess={refresh}
            inPanel={wide}
          >
            <Field name="name" label="Nome" autoComplete="name" defaultValue={user.name ?? ''} />
          </AccountForm>
        </SettingsBlock>
        <SettingsBlock
          wide={wide}
          icon={<Mail />}
          title="E-mail de login"
          description="Credencial principal de acesso. A troca exige a senha atual."
        >
          <AccountForm
            action={updateEmailAction}
            title="E-mail de login"
            submitLabel="Alterar e-mail"
            onSuccess={refresh}
            inPanel={wide}
          >
            <Field name="email" label="Novo e-mail" type="email" autoComplete="email" defaultValue={user.email ?? ''} />
            <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
          </AccountForm>
        </SettingsBlock>
        <SettingsBlock
          wide={wide}
          className="xl:col-span-2"
          icon={<BriefcaseBusiness />}
          title="Cargo & Contato de Plantão"
          description="Dados operacionais exibidos para a equipe NOC em escalonamentos."
        >
          <AccountForm
            key={`details-${overviewKey}`}
            action={updateAccountProfileDetailsAction}
            title="Cargo & Contato de Plantão"
            submitLabel="Salvar contato"
            onSuccess={loadOverview}
            inPanel={wide}
          >
            <div className={wide ? 'grid gap-3 @md:grid-cols-2 @2xl:grid-cols-3' : 'contents'}>
              <Field
                name="jobTitle"
                label="Cargo / Função"
                autoComplete="organization-title"
                placeholder="Ex.: Analista NOC"
                defaultValue={details.jobTitle}
                required={false}
              />
              <Field
                name="department"
                label="Departamento"
                placeholder="Ex.: Operações de TI"
                defaultValue={details.department}
                required={false}
              />
              <Field
                name="phone"
                label="Telefone / WhatsApp de plantão"
                type="tel"
                autoComplete="tel"
                placeholder="Ex.: +55 11 99999-0000"
                defaultValue={details.phone}
                required={false}
              />
            </div>
          </AccountForm>
        </SettingsBlock>
      </TabsContent>

      <TabsContent value="preferences" className={contentClass}>
        <SettingsBlock
          wide={wide}
          icon={<SunMoon />}
          title="Aparência & Cor de Destaque"
          description="Aplicadas na hora e guardadas só neste navegador."
          ariaLabel="Aparência e cor de destaque"
        >
          <AppearanceControls />
        </SettingsBlock>
        <SettingsBlock
          wide={wide}
          icon={<SlidersHorizontal />}
          title="Regionalização & Notificações"
          description="Fuso e formato das datas exibidas, e os alertas pessoais da conta."
        >
          <AccountForm
            key={`preferences-${overviewKey}`}
            action={updateAccountPreferencesAction}
            title="Regionalização & Notificações"
            submitLabel="Salvar preferências"
            onSuccess={loadOverview}
            inPanel={wide}
          >
            <div className={pair}>
              <SelectField
                name="timezone"
                label="Fuso horário"
                defaultValue={preferences.timezone}
                options={TIMEZONE_OPTIONS}
              />
              <SelectField
                name="dateFormat"
                label="Formato de data e hora"
                defaultValue={preferences.dateFormat}
                options={DATE_FORMAT_OPTIONS}
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-foreground">Alertas pessoais</legend>
              <div className="divide-y divide-surface-line overflow-hidden rounded-lg border border-surface-line bg-secondary/20">
                {NOTIFICATION_OPTIONS.map((option) => (
                  <CheckboxField
                    key={option.name}
                    name={option.name}
                    label={option.label}
                    defaultChecked={preferences[option.name]}
                  />
                ))}
              </div>
            </fieldset>
          </AccountForm>
        </SettingsBlock>
      </TabsContent>

      <TabsContent value="security" className={contentClass}>
        <SettingsBlock
          wide={wide}
          icon={<ShieldCheck />}
          title="Nível de Acesso e Permissões (RBAC)"
          description="Papel atribuído à sua conta e o que ele permite."
          ariaLabel="Nível de acesso e permissões"
        >
          <RoleSummary role={role} />
        </SettingsBlock>
        <SettingsBlock
          wide={wide}
          icon={<KeyRound />}
          title="Alterar senha"
          description="Confirme a senha atual antes de definir a nova."
        >
          <AccountForm action={changePasswordAction} title="Alterar senha" submitLabel="Alterar senha" inPanel={wide}>
            <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
            <div className={pair}>
              <Field name="newPassword" label="Nova senha" type="password" autoComplete="new-password" />
              <Field name="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" />
            </div>
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
          </AccountForm>
        </SettingsBlock>
      </TabsContent>

      <TabsContent value="sessions" className={contentClass}>
        <SettingsBlock
          wide={wide}
          icon={<Laptop />}
          title="Sessão Atual"
          description="Sessão autenticada neste navegador."
          ariaLabel="Sessão atual"
        >
          <CurrentSession email={user.email} inPanel={wide} />
        </SettingsBlock>
        <SettingsBlock
          wide={wide}
          flush
          icon={<History />}
          title="Atividade Recente da Conta"
          description="Últimos eventos da sua conta na trilha de auditoria."
          ariaLabel="Atividade recente da conta"
        >
          <RecentEvents events={recentEvents} preferences={preferences} inPanel={wide} />
        </SettingsBlock>
      </TabsContent>
    </>
  )

  if (!wide) {
    return (
      <Tabs value={tab} onValueChange={(value) => setTab(value as AccountDialogTab)}>
        <TabsList className="w-full">
          {ACCOUNT_TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections}
      </Tabs>
    )
  }

  /*
    Mestre-detalhe. Coluna mestre de largura fixa (18rem), nao fracao do grid:
    em 1280-1440px uma fracao de 3/12 dava ~230px, e a pilula "Administrador da
    plataforma" (~220px) quebrava em duas linhas dentro do cartao de
    identidade. `lg:top-22` = header de 64px + respiro de 24px do <main>.
    `items-start` em toda largura, nao so no `lg`: esticada, a coluna mestre
    vira altura definida e os dois Panels (`h-full`) herdariam 100% dela cada
    um — no celular o menu de secoes ia parar debaixo do painel seguinte.
  */
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as AccountDialogTab)}
      orientation="vertical"
      className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <div className="space-y-5 lg:sticky lg:top-22">
        <OperatorIdentity user={user} details={details} timezone={preferences.timezone} />
        <Panel>
          <TabsList
            aria-label="Seções da conta"
            className="grid h-auto w-full grid-cols-2 items-stretch gap-1 bg-transparent p-2 lg:grid-cols-1"
          >
            {ACCOUNT_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} variant="nav">
                <Icon />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Panel>
      </div>
      <div className="min-w-0">{sections}</div>
    </Tabs>
  )
}

export function AccountDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: AccountDialogTab
  onTabChange: (tab: AccountDialogTab) => void
  user: AccountUser
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Minha conta</DialogTitle>
          <DialogDescription>Dados de acesso, contato de plantão e preferências da sua própria conta.</DialogDescription>
        </DialogHeader>
        <AccountSettingsContent user={user} tab={tab} onTabChange={onTabChange} />
      </DialogContent>
    </Dialog>
  )
}
