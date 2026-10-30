'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, Bot, Building2, CheckCircle2, Eye, Loader2, Search, X } from 'lucide-react'
import {
  initialProvisioningState,
  type ProvisioningActionState,
  type ProvisioningCredentialsResponse,
  type ProvisioningPackage,
} from './types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { AgentInstallPackage } from '@/components/agent-install-package'
import { getTenantBasePath } from '@/lib/tenant-links'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from '@/lib/table-styles'
import { cn } from '@/lib/utils'

type ClientRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  /**
   * AgentAuth com isActive: true. Coluna "Agentes" (RN020: revogados nao
   * contam) e maquinas que seguem funcionando depois de uma rotacao sem revogacao.
   */
  activeAgentCount: number
}

type ClientFilter = 'all' | 'active' | 'with_agents' | 'without_agents'

const FILTER_PILLS: Array<{ value: ClientFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'with_agents', label: 'Com agentes' },
  { value: 'without_agents', label: 'Sem agentes' },
]

type ClientsPanelProps = {
  clients: ClientRow[]
  serverUrl: string
  rotateEnrollmentKeyAction: (
    state: ProvisioningActionState,
    payload: FormData
  ) => Promise<ProvisioningActionState>
}

/**
 * Credenciais ativas consultadas por "Ver credenciais". `client: null` = nada
 * aberto. Sprint A2, E6 (decisao 1 = C): deixou de ser Dialog e virou Panel
 * inline no mesmo espaco do resultado da rotacao.
 */
type CredentialsState =
  | { client: null; loading: false; error: null; data: null }
  | {
      client: ClientRow
      loading: boolean
      error: string | null
      data: ProvisioningCredentialsResponse | null
    }

const emptyCredentialsState: CredentialsState = {
  client: null,
  loading: false,
  error: null,
  data: null,
}

const credentialsLoadError = 'Falha ao carregar credenciais ativas.'

const rotationDoneMessage = 'Chave de instalação rotacionada. Revise os instaladores antigos.'

/** Resultado de uma rotacao bem-sucedida: o pacote novo, com a chave nova. */
function PackagePanel({
  pkg,
  message,
}: {
  pkg: ProvisioningPackage
  message?: string | null
}) {
  return (
    <Panel className="border-primary/40">
      <PanelHeader
        className="pr-14"
        title={`Novo pacote emitido: ${pkg.clientName}`}
        description={message || rotationDoneMessage}
      />
      <PanelBody>
        <AgentInstallPackage pkg={pkg} keyIsFresh />
      </PanelBody>
    </Panel>
  )
}

/** Conteudo de "Ver credenciais": carregando, erro, indisponivel ou disponivel. */
function CredentialsPanel({ state }: { state: Exclude<CredentialsState, { client: null }> }) {
  return (
    <Panel className={cn(state.error && 'border-destructive/40')}>
      <PanelHeader
        className="pr-14"
        title="Credenciais ativas"
        description={`Pacote ativo de ${state.client.name}, sem rotacionar a chave atual.`}
      />
      <PanelBody>
        {state.loading ? (
          <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando credenciais ativas...
          </p>
        ) : state.error ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">Falha ao consultar credenciais</p>
            <p className="text-muted-foreground">{state.error}</p>
          </div>
        ) : state.data?.status === 'unavailable' ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Pacote ativo indisponível</p>
            <p className="text-muted-foreground">{state.data.message}</p>
          </div>
        ) : state.data?.status === 'available' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {state.data.generatedAt
                ? `Último pacote persistido em ${new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(state.data.generatedAt))}.`
                : 'Pacote ativo persistido sem carimbo de data disponível.'}
            </p>
            <AgentInstallPackage pkg={state.data.package} keyIsFresh={false} />
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  )
}

/** Texto do dialogo: quantas maquinas ja registradas seguem fazendo check-in. */
function machinesThatKeepWorking(count: number) {
  if (count <= 0) return 'Nenhuma máquina está registrada neste cliente no momento.'
  if (count === 1) {
    return '1 máquina já registrada continua funcionando: ela usa a própria credencial, que a rotação não altera.'
  }
  return `${count} máquinas já registradas continuam funcionando: elas usam a própria credencial, que a rotação não altera.`
}

/** Rotulo do checkbox de RN019: quantos agentes ativos serao revogados. */
function revokeActiveAgentsLabel(count: number) {
  return count === 1 ? 'Revogar também o agente ativo' : `Revogar também os ${count} agentes ativos`
}

function RotateConfirmDialog({
  client,
  open,
  revokeActiveAgents,
  onRevokeActiveAgentsChange,
  onOpenChange,
  onConfirm,
  onCloseAutoFocus,
}: {
  client: ClientRow | null
  open: boolean
  revokeActiveAgents: boolean
  onRevokeActiveAgentsChange: (checked: boolean) => void
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const activeAgentCount = client?.activeAgentCount ?? 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {client ? `Emitir novo pacote para ${client.name}?` : 'Emitir novo pacote?'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Uma nova chave de instalação será gerada. Instaladores, comandos e pacotes emitidos
                antes desta rotação param de funcionar para instalar em máquinas novas.
              </p>
              <p className="font-medium text-foreground">
                {revokeActiveAgents
                  ? 'Nenhuma máquina já registrada continua funcionando: as credenciais ativas serão revogadas junto com a chave.'
                  : machinesThatKeepWorking(activeAgentCount)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Sprint A3, RN019 (N4): contencao opcional, desmarcada por padrao.
            Sem agente ativo nao ha o que revogar, entao o controle nao aparece. */}
        {activeAgentCount > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-surface-line p-3">
            <Checkbox
              id="rotate-revoke-active-agents"
              className="mt-0.5"
              checked={revokeActiveAgents}
              onCheckedChange={(checked) => onRevokeActiveAgentsChange(checked === true)}
              aria-describedby="rotate-revoke-active-agents-help"
            />
            <div className="space-y-1 text-sm">
              <label htmlFor="rotate-revoke-active-agents" className="font-medium text-foreground">
                {revokeActiveAgentsLabel(activeAgentCount)}
              </label>
              <p id="rotate-revoke-active-agents-help" className="text-muted-foreground">
                Marcado, as máquinas já registradas param de enviar dados no próximo ciclo e só voltam
                reinstalando o agente com o pacote novo. Comandos pendentes são cancelados; máquinas e
                histórico não são apagados. A revogação não pode ser desfeita.
              </p>
            </div>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {/* Acao destrutiva (invalida os instaladores emitidos): estilo
              destrutivo, mesmo rotulo (contrato de teste da A1). */}
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onConfirm}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ClientsPanel({
  clients,
  serverUrl,
  rotateEnrollmentKeyAction,
}: ClientsPanelProps) {
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateEnrollmentKeyAction,
    initialProvisioningState
  )
  // Cliente alvo do dialogo de confirmacao. Fica separado de `rotateDialogOpen`
  // para o conteudo nao sumir durante a animacao de fechamento.
  const [rotateTarget, setRotateTarget] = useState<ClientRow | null>(null)
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false)
  // RN019: volta a desmarcado a cada abertura do dialogo (no handler do clique).
  const [revokeActiveAgents, setRevokeActiveAgents] = useState(false)
  // O botao "X" dispensa o resultado exibido. Estado derivado: guarda a
  // referencia dispensada em vez de copiar `rotateState` para outro estado.
  // Uma rotacao nova devolve outro objeto e volta a aparecer.
  const [dismissedState, setDismissedState] = useState<ProvisioningActionState | null>(null)
  const result = rotateState === dismissedState ? initialProvisioningState : rotateState
  // Um resultado por vez no espaco acima da tabela, e a acao mais recente
  // substitui a anterior: "Ver credenciais" dispensa o resultado da rotacao, e
  // confirmar uma rotacao fecha as credenciais.
  const [credentials, setCredentials] = useState<CredentialsState>(emptyCredentialsState)
  const credentialsRequestId = useRef(0)
  // O dialogo e controlado e nao tem AlertDialogTrigger, entao o Radix nao sabe
  // para onde devolver o foco ao fechar. Guardamos o botao que o abriu.
  const rotateTriggerRef = useRef<HTMLButtonElement | null>(null)
  const rotationConfirmedRef = useRef(false)
  const resultRef = useRef<HTMLDivElement | null>(null)

  function confirmRotation() {
    if (!rotateTarget) return
    const formData = new FormData()
    formData.set('serverUrl', serverUrl)
    formData.set('clientId', rotateTarget.id)
    // So vai no FormData quando marcado; ausente = rotacao sem revogacao.
    if (revokeActiveAgents && rotateTarget.activeAgentCount > 0) {
      formData.set('revokeActiveAgents', 'true')
    }
    rotationConfirmedRef.current = true
    setRotateDialogOpen(false)
    closeCredentials()
    startTransition(() => rotateAction(formData))
  }

  function closeCredentials() {
    // Invalida uma consulta ainda em voo: a resposta tardia nao reabre o painel.
    credentialsRequestId.current += 1
    setCredentials(emptyCredentialsState)
  }

  function handleRotateDialogCloseAutoFocus(event: Event) {
    event.preventDefault()
    // Confirmado: o foco vai para o resultado quando ele chegar (efeito abaixo);
    // o botao fica desabilitado enquanto a rotacao corre.
    if (!rotationConfirmedRef.current) rotateTriggerRef.current?.focus()
    rotationConfirmedRef.current = false
  }

  // Cada rotacao devolve um objeto novo; leva o foco ao resultado (sucesso ou erro).
  useEffect(() => {
    if (rotateState.package || rotateState.error) resultRef.current?.focus()
  }, [rotateState])

  // Credenciais: o foco vai para o painel quando o conteudo (ou o erro) chega.
  useEffect(() => {
    if (credentials.client && !credentials.loading) resultRef.current?.focus()
  }, [credentials])

  const rotationAnnouncement = result.package
    ? `Novo pacote emitido para ${result.package.clientName}. ${result.message || rotationDoneMessage}`
    : result.error
      ? `Falha ao emitir novo pacote: ${result.error}`
      : ''

  const credentialsAnnouncement = !credentials.client
    ? ''
    : credentials.loading
      ? `Carregando credenciais ativas de ${credentials.client.name}.`
      : credentials.error
        ? `Falha ao consultar credenciais: ${credentials.error}`
        : `Credenciais ativas de ${credentials.client.name} exibidas.`

  const sortedClients = useMemo(
    () => [...clients].sort((left, right) => left.name.localeCompare(right.name)),
    [clients]
  )

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('all')
  const activeClients = clients.filter((c) => c.isActive).length
  const totalAgents = clients.reduce((sum, c) => sum + c.activeAgentCount, 0)
  const withoutAgents = clients.filter((c) => c.activeAgentCount === 0).length
  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sortedClients.filter((c) => {
      if (term && !c.name.toLowerCase().includes(term) && !c.slug.toLowerCase().includes(term)) return false
      if (filter === 'active') return c.isActive
      if (filter === 'with_agents') return c.activeAgentCount > 0
      if (filter === 'without_agents') return c.activeAgentCount === 0
      return true
    })
  }, [sortedClients, search, filter])

  async function handleViewCredentials(client: ClientRow) {
    const requestId = credentialsRequestId.current + 1
    credentialsRequestId.current = requestId
    setDismissedState(rotateState)
    setCredentials({ client, loading: true, error: null, data: null })

    try {
      const response = await fetch(
        `/api/clients/${client.id}/credentials?serverUrl=${encodeURIComponent(serverUrl)}`,
        {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as ProvisioningCredentialsResponse | { error?: string }

      if (!response.ok) {
        throw new Error(payload && 'error' in payload && payload.error ? payload.error : credentialsLoadError)
      }

      if (credentialsRequestId.current !== requestId) {
        return
      }

      setCredentials({
        client,
        loading: false,
        error: null,
        data: payload as ProvisioningCredentialsResponse,
      })
    } catch (error) {
      if (credentialsRequestId.current !== requestId) {
        return
      }

      setCredentials({
        client,
        loading: false,
        error: error instanceof Error ? error.message : credentialsLoadError,
        data: null,
      })
    }
  }

  return (
    <div className="space-y-6">
      <RotateConfirmDialog
        client={rotateTarget}
        open={rotateDialogOpen}
        revokeActiveAgents={revokeActiveAgents}
        onRevokeActiveAgentsChange={setRevokeActiveAgents}
        onOpenChange={setRotateDialogOpen}
        onConfirm={confirmRotation}
        onCloseAutoFocus={handleRotateDialogCloseAutoFocus}
      />

      {/* Regiao viva sempre montada: leitores de tela so anunciam mudancas em
          regioes que ja existiam antes do conteudo chegar. */}
      <div role="status" aria-live="polite" className="sr-only">
        {credentials.client ? credentialsAnnouncement : rotationAnnouncement}
      </div>

      {/* Espaco unico de resultado: credenciais consultadas OU o resultado da
          ultima rotacao. Mesmo elemento, foco programatico e "Dispensar". */}
      {(credentials.client || result.package || result.error) && (
        <div
          ref={resultRef}
          tabIndex={-1}
          data-testid={credentials.client ? 'credentials-result' : 'rotation-result'}
          className="relative rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {credentials.client ? (
            <CredentialsPanel state={credentials} />
          ) : result.package ? (
            <PackagePanel pkg={result.package} message={result.message} />
          ) : (
            <Panel className="border-destructive/40">
              <PanelHeader className="pr-14" title="Falha ao emitir novo pacote" description={result.error} />
            </Panel>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3"
            aria-label="Dispensar"
            onClick={() => (credentials.client ? closeCredentials() : setDismissedState(rotateState))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Building2 />}
          label="Total de Clientes"
          value={clients.length}
          subtitle="empresas cadastradas"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <KpiCard
          icon={<CheckCircle2 />}
          label="Clientes Ativos"
          value={activeClients}
          subtitle="com operação liberada"
          tone="success"
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <KpiCard
          icon={<Bot />}
          label="Agentes Ativos"
          value={totalAgents}
          subtitle="conectados na base"
          active={filter === 'with_agents'}
          onClick={() => setFilter('with_agents')}
        />
        <KpiCard
          icon={<AlertCircle />}
          label="Sem Agentes"
          value={withoutAgents}
          subtitle="aguardando instalação"
          tone={withoutAgents > 0 ? 'warning' : 'neutral'}
          emphasizeValue={withoutAgents > 0}
          active={filter === 'without_agents'}
          onClick={() => setFilter('without_agents')}
        />
      </div>

      {sortedClients.length === 0 ? (
        <Panel>
          <PanelBody className="space-y-2 pt-5">
            <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado nesta conta.</p>
            <p className="text-sm text-muted-foreground">
              Cada cliente é uma empresa atendida, com o próprio painel e o próprio instalador do agente.
              Cadastre um para gerar o instalador e acompanhar a primeira máquina.
            </p>
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/admin/clients/novo">Cadastrar o primeiro cliente</Link>
            </Button>
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-line px-5 py-3.5">
            <div className="relative w-full sm:max-w-xs">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente por nome ou slug..."
                aria-label="Buscar cliente"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_PILLS.map((pill) => (
                <Button
                  key={pill.value}
                  type="button"
                  size="sm"
                  variant={filter === pill.value ? 'secondary' : 'ghost'}
                  aria-pressed={filter === pill.value}
                  onClick={() => setFilter(pill.value)}
                >
                  {pill.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {visibleClients.length} de {sortedClients.length} visíveis
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CLASS}>Cliente</th>
                <th className={TABLE_HEAD_CLASS}>Agentes</th>
                <th className={TABLE_HEAD_CLASS}>Status</th>
                <th className={TABLE_HEAD_CLASS}>Identificador (Slug)</th>
                <th className={TABLE_HEAD_CLASS}>Criado em</th>
                <th className={cn(TABLE_HEAD_CLASS, 'text-right')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client) => (
                <tr key={client.id} className={cn('border-b border-surface-line last:border-0', STATIC_ROW_HOVER_CLASS)}>
                  <td className={cn(TABLE_CELL_CLASS, 'font-medium text-foreground')}>
                    <Building2 aria-hidden className="mr-2 inline h-4 w-4 text-primary" />
                    {client.name}
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    {/* RN020: so AgentAuth ativos. Leva a lista de agentes do
                        cliente com affordance clara (badge com icone e hover). */}
                    <Link
                      href={`/admin/clients/${client.id}/agents`}
                      aria-label={`${client.activeAgentCount} ${
                        client.activeAgentCount === 1 ? 'agente ativo' : 'agentes ativos'
                      } de ${client.name}: ver agentes`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-surface-line bg-secondary/50 px-2 py-0.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer group"
                    >
                      <Bot className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span>{client.activeAgentCount}</span>
                    </Link>
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    <StatusPill
                      tone={client.isActive ? 'success' : 'neutral'}
                      label={client.isActive ? 'Ativo' : 'Inativo'}
                    />
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    <span className="data-mono rounded border border-surface-line bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground">
                      {client.slug}
                    </span>
                  </td>
                  <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(client.createdAt))}
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    {/* Hierarquia: "Abrir painel" e a acao principal da linha
                        (unica com preenchimento); consultar agentes, credenciais e
                        rotacionar a chave vem depois, com menos peso. */}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={getTenantBasePath(client.slug)}>
                          <ArrowUpRight className="h-4 w-4" />
                          Abrir painel
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/clients/${client.id}/agents`}>
                          <Bot className="h-4 w-4" />
                          Agentes
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleViewCredentials(client)}>
                        <Eye className="h-4 w-4" />
                        Ver credenciais
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={rotatePending}
                        onClick={(event) => {
                          rotateTriggerRef.current = event.currentTarget
                          setRevokeActiveAgents(false)
                          setRotateTarget(client)
                          setRotateDialogOpen(true)
                        }}
                      >
                        {rotatePending && rotateTarget?.id === client.id ? 'Emitindo...' : 'Emitir novo pacote'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
