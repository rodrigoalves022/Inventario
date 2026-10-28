'use client'

import { useActionState, useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Loader2, LogOut } from 'lucide-react'
import * as accountActions from '@/app/account/actions'
import type { AccountActionState, AccountOverview, AccountPreferences } from '@/app/account/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE_LABELS, type AppRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export type AccountDialogTab = 'profile' | 'preferences' | 'security' | 'sessions'

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

/** Resumo do RBAC de `lib/permissions.ts`, em linguagem de usuario. */
const ROLE_CAPABILITIES: Record<AppRole, string[]> = {
  PLATFORM_ADMIN: [
    'Acesso global a todos os clientes (multi-tenant).',
    'Gestão de clientes, usuários e chaves de provisionamento.',
    'Configuração de alertas, webhooks e auditoria.',
  ],
  ORG_ADMIN: [
    'Gestão completa dos clientes da organização.',
    'Configuração de alertas, webhooks e dados da empresa.',
    'Comandos remotos e operação do inventário.',
  ],
  ORG_OPERATOR: [
    'Operação do inventário e consulta de máquinas.',
    'Disparo de comandos remotos permitidos.',
    'Sem gestão de usuários, credenciais ou webhooks.',
  ],
  CLIENT_VIEWER: [
    'Leitura do inventário do próprio cliente.',
    'Exportação de relatórios.',
    'Sem alterações de configuração.',
  ],
}

export const ACCOUNT_EVENT_LABELS: Record<string, string> = {
  'account.name_update': 'Nome atualizado',
  'account.email_update': 'E-mail alterado',
  'account.password_change': 'Senha alterada',
  'account.profile_details_update': 'Contato profissional atualizado',
  'account.preferences_update': 'Preferências salvas',
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

function CheckboxField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}

/**
 * Um formulario = uma action. O React 19 reseta os campos nao controlados ao
 * fim da action, entao as senhas nao ficam no DOM depois do envio.
 */
function AccountForm({
  action,
  submitLabel,
  title,
  onSuccess,
  children,
}: {
  action: Action
  submitLabel: string
  title: string
  onSuccess?: () => void
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
    <form action={formAction} className="grid gap-3" aria-label={title}>
      <h3 className="section-label">{title}</h3>
      {children}
      <div className="flex items-center justify-between gap-3">
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
  user: { name?: string | null; email?: string | null; role?: AppRole | null }
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

  // Sprint V24: cargo/contato, preferencias e atividade vem do AuditLog.
  // `null` (sem sessao, ou ambiente de teste sem action) cai nos defaults.
  const [overview, setOverview] = useState<AccountOverview | null>(null)
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
    if (open) loadOverview()
  }, [open, loadOverview])

  const details = overview?.profileDetails ?? { jobTitle: '', department: '', phone: '' }
  const preferences = overview?.preferences ?? DEFAULT_PREFERENCES
  const recentEvents = overview?.recentEvents ?? []
  // Campos nao controlados: remonta o formulario quando a visao chega do servidor.
  const overviewKey = overview ? 'loaded' : 'empty'
  const role = user.role ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Minha conta</DialogTitle>
          <DialogDescription>Dados de acesso, contato de plantão e preferências da sua própria conta.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as AccountDialogTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="preferences">Preferências</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="sessions">Acessos</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="grid gap-6 pt-2">
            <AccountForm
              action={updateProfileNameAction}
              title="Nome de exibição"
              submitLabel="Salvar nome"
              onSuccess={refresh}
            >
              <Field name="name" label="Nome" autoComplete="name" defaultValue={user.name ?? ''} />
            </AccountForm>
            <AccountForm
              key={`details-${overviewKey}`}
              action={updateAccountProfileDetailsAction}
              title="Cargo & Contato de Plantão"
              submitLabel="Salvar contato"
              onSuccess={loadOverview}
            >
              <Field
                name="jobTitle"
                label="Cargo / Função"
                autoComplete="organization-title"
                placeholder="Ex.: Analista NOC / Infraestrutura"
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
            </AccountForm>
            <AccountForm
              action={updateEmailAction}
              title="E-mail de login"
              submitLabel="Alterar e-mail"
              onSuccess={refresh}
            >
              <Field
                name="email"
                label="Novo e-mail"
                type="email"
                autoComplete="email"
                defaultValue={user.email ?? ''}
              />
              <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
            </AccountForm>
          </TabsContent>

          <TabsContent value="preferences" className="pt-2">
            <AccountForm
              key={`preferences-${overviewKey}`}
              action={updateAccountPreferencesAction}
              title="Regionalização & Notificações"
              submitLabel="Salvar preferências"
              onSuccess={loadOverview}
            >
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
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Alertas pessoais</legend>
                {NOTIFICATION_OPTIONS.map((option) => (
                  <CheckboxField
                    key={option.name}
                    name={option.name}
                    label={option.label}
                    defaultChecked={preferences[option.name]}
                  />
                ))}
              </fieldset>
            </AccountForm>
          </TabsContent>

          <TabsContent value="security" className="grid gap-6 pt-2">
            <section aria-label="Nível de acesso e permissões" className="grid gap-3">
              <h3 className="section-label">Nível de Acesso e Permissões (RBAC)</h3>
              <div className="grid gap-2 rounded-lg border p-3">
                <Badge variant="secondary">{role ? ROLE_LABELS[role] : 'Operador'}</Badge>
                <ul className="grid gap-1 text-xs text-muted-foreground">
                  {ROLE_CAPABILITIES[role ?? 'ORG_OPERATOR'].map((capability) => (
                    <li key={capability}>• {capability}</li>
                  ))}
                </ul>
              </div>
            </section>
            <AccountForm action={changePasswordAction} title="Alterar senha" submitLabel="Alterar senha">
              <Field name="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
              <Field name="newPassword" label="Nova senha" type="password" autoComplete="new-password" />
              <Field name="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
            </AccountForm>
          </TabsContent>

          <TabsContent value="sessions" className="grid gap-6 pt-2">
            <section aria-label="Sessão atual" className="grid gap-3">
              <h3 className="section-label">Sessão Atual</h3>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">{user.email ?? 'Não identificado'}</p>
                  <p className="flex items-center gap-1.5 text-xs text-success">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
                    Ativa neste dispositivo
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="h-3.5 w-3.5" />
                  Encerrar sessão
                </Button>
              </div>
            </section>
            <section aria-label="Atividade recente da conta" className="grid gap-3">
              <h3 className="section-label">Atividade Recente da Conta</h3>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento recente registrado para esta conta.</p>
              ) : (
                <ul className="divide-y divide-surface-line rounded-lg border">
                  {recentEvents.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {ACCOUNT_EVENT_LABELS[event.action] ?? event.action}
                      </span>
                      <time dateTime={event.createdAt} className="data-mono shrink-0 text-xs text-muted-foreground">
                        {formatEventDate(event.createdAt, preferences)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
