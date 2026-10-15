'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Eye, Loader2, Terminal, X } from 'lucide-react'
import {
  initialProvisioningState,
  type ProvisioningActionState,
  type ProvisioningCredentialsResponse,
  type ProvisioningPackage,
} from './types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { AgentInstallPackage } from '@/components/agent-install-package'
import { getTenantBasePath } from '@/lib/tenant-links'

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

type CredentialsDialogState =
  | { open: false; client: null; loading: false; error: null; data: null }
  | {
      open: true
      client: ClientRow
      loading: boolean
      error: string | null
      data: ProvisioningCredentialsResponse | null
    }

const emptyCredentialsDialogState: CredentialsDialogState = {
  open: false,
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
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="pr-14">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Novo pacote emitido</Badge>
          <CardTitle>{pkg.clientName}</CardTitle>
        </div>
        <CardDescription>{message || rotationDoneMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AgentInstallPackage pkg={pkg} keyIsFresh />
      </CardContent>
    </Card>
  )
}

function CredentialsDialog({
  state,
  onOpenChange,
}: {
  state: CredentialsDialogState
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Credenciais ativas</DialogTitle>
          <DialogDescription>
            {state.open && state.client
              ? `Pacote ativo do cliente ${state.client.name} sem rotacionar a chave atual.`
              : 'Pacote ativo do cliente.'}
          </DialogDescription>
        </DialogHeader>

        {!state.open ? null : state.loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando credenciais ativas...
          </div>
        ) : state.error ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Falha ao consultar credenciais</CardTitle>
              <CardDescription>{state.error}</CardDescription>
            </CardHeader>
          </Card>
        ) : state.data?.status === 'unavailable' ? (
          <Card className="border-border/60 bg-muted/30">
            <CardHeader>
              <CardTitle>Pacote ativo indisponível</CardTitle>
              <CardDescription>{state.data.message}</CardDescription>
            </CardHeader>
          </Card>
        ) : state.data?.status === 'available' ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {state.data.generatedAt
                ? `Último pacote persistido em ${new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(state.data.generatedAt))}.`
                : 'Pacote ativo persistido sem carimbo de data disponível.'}
            </div>
            <AgentInstallPackage pkg={state.data.package} keyIsFresh={false} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
          <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
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
  const [credentialsDialog, setCredentialsDialog] = useState<CredentialsDialogState>(
    emptyCredentialsDialogState
  )
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
    startTransition(() => rotateAction(formData))
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

  const rotationAnnouncement = result.package
    ? `Novo pacote emitido para ${result.package.clientName}. ${result.message || rotationDoneMessage}`
    : result.error
      ? `Falha ao emitir novo pacote: ${result.error}`
      : ''

  const sortedClients = useMemo(
    () => [...clients].sort((left, right) => left.name.localeCompare(right.name)),
    [clients]
  )

  async function handleViewCredentials(client: ClientRow) {
    const requestId = credentialsRequestId.current + 1
    credentialsRequestId.current = requestId
    setCredentialsDialog({ open: true, client, loading: true, error: null, data: null })

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

      setCredentialsDialog({
        open: true,
        client,
        loading: false,
        error: null,
        data: payload as ProvisioningCredentialsResponse,
      })
    } catch (error) {
      if (credentialsRequestId.current !== requestId) {
        return
      }

      setCredentialsDialog({
        open: true,
        client,
        loading: false,
        error: error instanceof Error ? error.message : credentialsLoadError,
        data: null,
      })
    }
  }

  return (
    <div className="space-y-6">
      <CredentialsDialog
        state={credentialsDialog}
        onOpenChange={(open) => {
          if (!open) {
            credentialsRequestId.current += 1
            setCredentialsDialog(emptyCredentialsDialogState)
          }
        }}
      />

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
        {rotationAnnouncement}
      </div>

      {(result.package || result.error) && (
        <div
          ref={resultRef}
          tabIndex={-1}
          data-testid="rotation-result"
          className="relative rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {result.package ? (
            <PackagePanel pkg={result.package} message={result.message} />
          ) : (
            <Card className="border-destructive/40">
              <CardHeader className="pr-14">
                <CardTitle>Falha ao emitir novo pacote</CardTitle>
                <CardDescription>{result.error}</CardDescription>
              </CardHeader>
            </Card>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3"
            aria-label="Dispensar"
            onClick={() => setDismissedState(rotateState)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {sortedClients.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum cliente cadastrado. Clique em <strong>Novo cliente</strong> para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">Agentes</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Painel</th>
                    <th className="px-4 py-3 text-left font-medium">Criado em</th>
                    <th className="px-4 py-3 text-left font-medium">Instalação</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((client) => (
                    <tr key={client.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                      <td className="px-4 py-3">{client.agentCount}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            client.isActive
                              ? 'border-success/40 bg-success/10 text-success'
                              : 'text-muted-foreground'
                          }
                        >
                          {client.isActive ? 'ativo' : 'inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={getTenantBasePath(client.slug)}>
                            <ArrowUpRight className="h-4 w-4" />
                            Abrir painel
                          </Link>
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(client.createdAt))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleViewCredentials(client)}>
                            <Eye className="h-4 w-4" />
                            Ver credenciais
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={rotatePending}
                            onClick={(event) => {
                              rotateTriggerRef.current = event.currentTarget
                              setRotateTarget(client)
                              setRotateDialogOpen(true)
                            }}
                          >
                            <Terminal className="h-4 w-4" />
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
        </CardContent>
      </Card>
    </div>
  )
}
