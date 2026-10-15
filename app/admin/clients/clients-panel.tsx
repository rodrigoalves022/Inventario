'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Eye, Loader2, X } from 'lucide-react'
import {
  initialProvisioningState,
  type ProvisioningActionState,
  type ProvisioningCredentialsResponse,
  type ProvisioningPackage,
} from './types'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { AgentInstallPackage } from '@/components/agent-install-package'
import { getTenantBasePath } from '@/lib/tenant-links'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'
import { cn } from '@/lib/utils'

type ClientRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  agentCount: number
  /** AgentAuth com isActive: true: maquinas que seguem funcionando depois da rotacao. */
  activeAgentCount: number
}

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

function RotateConfirmDialog({
  client,
  open,
  onOpenChange,
  onConfirm,
  onCloseAutoFocus,
}: {
  client: ClientRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
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
                {machinesThatKeepWorking(client?.activeAgentCount ?? 0)}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
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
        <div className={cn(TABLE_SHELL_CLASS, 'overflow-x-auto')}>
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CLASS}>Cliente</th>
                <th className={TABLE_HEAD_CLASS}>Agentes</th>
                <th className={TABLE_HEAD_CLASS}>Status</th>
                <th className={TABLE_HEAD_CLASS}>Criado em</th>
                <th className={TABLE_HEAD_CLASS}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client) => (
                <tr key={client.id} className={cn('border-b border-surface-line last:border-0', STATIC_ROW_HOVER_CLASS)}>
                  <td className={cn(TABLE_CELL_CLASS, 'font-medium text-foreground')}>{client.name}</td>
                  <td className={TABLE_CELL_CLASS}>{client.agentCount}</td>
                  <td className={TABLE_CELL_CLASS}>
                    <StatusPill
                      tone={client.isActive ? 'success' : 'neutral'}
                      label={client.isActive ? 'Ativo' : 'Inativo'}
                    />
                  </td>
                  <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(client.createdAt))}
                  </td>
                  <td className={TABLE_CELL_CLASS}>
                    {/* Hierarquia: "Abrir painel" e a acao principal da linha
                        (unica com preenchimento); consultar e rotacionar a
                        chave vem depois, com menos peso. */}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={getTenantBasePath(client.slug)}>
                          <ArrowUpRight className="h-4 w-4" />
                          Abrir painel
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
      )}
    </div>
  )
}
