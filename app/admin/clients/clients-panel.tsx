'use client'

import Link from 'next/link'
import { useActionState, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowUpRight, Eye, KeyRound, Loader2, Terminal, X } from 'lucide-react'
import {
  initialProvisioningState,
  type ProvisioningActionState,
  type ProvisioningCredentialsResponse,
  type ProvisioningPackage,
} from './types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AgentInstallPackage } from '@/components/agent-install-package'
import { getTenantBasePath } from '@/lib/tenant-links'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'

type ClientRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  agentCount: number
}

type ClientsPanelProps = {
  clients: ClientRow[]
  serverUrl: string
  createClientAction: (
    state: ProvisioningActionState,
    payload: FormData
  ) => Promise<ProvisioningActionState>
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

function PackagePanel({
  pkg,
  message,
}: {
  pkg: ProvisioningPackage
  message?: string | null
}) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Provisionado</Badge>
          <CardTitle>{pkg.clientName}</CardTitle>
        </div>
        {message && <CardDescription>{message}</CardDescription>}
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

function RotatePackageButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      <Terminal className="h-4 w-4" />
      {pending ? 'Emitindo...' : 'Emitir novo pacote'}
    </Button>
  )
}

export function ClientsPanel({
  clients,
  serverUrl,
  createClientAction,
  rotateEnrollmentKeyAction,
}: ClientsPanelProps) {
  const [provisioningServerUrl, setProvisioningServerUrl] = useState(serverUrl)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createState, createAction, createPending] = useActionState(
    createClientAction,
    initialProvisioningState
  )
  const [, rotateAction] = useActionState(rotateEnrollmentKeyAction, initialProvisioningState)
  const [result, setResult] = useState<ProvisioningActionState>(initialProvisioningState)
  const [credentialsDialog, setCredentialsDialog] = useState<CredentialsDialogState>(
    emptyCredentialsDialogState
  )
  const credentialsRequestId = useRef(0)

  // Espelha `createState` (resultado da Server Action) em `result` — que
  // tambem precisa poder ser descartado independentemente pelo botao "X"
  // (por isso nao da so para renderizar `createState` direto). Ajuste de
  // estado durante o render (comparando com a referencia anterior) evita o
  // setState sincrono dentro de um useEffect, que causa re-render em
  // cascata — mesmo padrao usado em `Sidebar` para fechar o drawer mobile.
  const [prevCreateState, setPrevCreateState] = useState(createState)
  if (createState !== prevCreateState) {
    setPrevCreateState(createState)
    if (createState.error || createState.message || createState.package) {
      setResult(createState)
      if (createState.package) setShowCreateForm(false)
    }
  }

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
        `/api/clients/${client.id}/credentials?serverUrl=${encodeURIComponent(provisioningServerUrl)}`,
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

      {(result.package || result.error) && (
        <div className="relative">
          {result.package ? (
            <PackagePanel pkg={result.package} message={result.message} />
          ) : (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle>Falha ao gerar pacote</CardTitle>
                <CardDescription>{result.error}</CardDescription>
              </CardHeader>
            </Card>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3"
            onClick={() => setResult(initialProvisioningState)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showCreateForm ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Novo cliente</CardTitle>
                <CardDescription>
                  Cria o cadastro, a chave inicial e o pacote de instalação em um passo.
                </CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">URL usada nos instaladores</Label>
                <Input
                  id="serverUrl"
                  name="serverUrl"
                  value={provisioningServerUrl}
                  onChange={(event) => setProvisioningServerUrl(event.target.value)}
                  placeholder="https://inventario.suaempresa.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use o IP ou domínio acessível pela máquina do cliente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome do cliente</Label>
                <Input id="name" name="name" placeholder="Core TI Expert" required minLength={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug do cliente</Label>
                <Input id="slug" name="slug" placeholder="core-ti-expert" />
                <p className="text-xs text-muted-foreground">Se vazio, é gerado automaticamente.</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createPending}>
                  <KeyRound className="h-4 w-4" />
                  {createPending ? 'Criando...' : 'Criar e emitir pacote'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          {sortedClients.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum cliente cadastrado. Clique em <strong>Novo cliente</strong> para começar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={TABLE_HEAD_ROW_CLASS}>
                    <th className={TABLE_HEAD_CLASS}>Cliente</th>
                    <th className={TABLE_HEAD_CLASS}>Agentes</th>
                    <th className={TABLE_HEAD_CLASS}>Status</th>
                    <th className={TABLE_HEAD_CLASS}>Painel</th>
                    <th className={TABLE_HEAD_CLASS}>Criado em</th>
                    <th className={TABLE_HEAD_CLASS}>Instalação</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((client) => (
                    <tr key={client.id} className={cn('border-b last:border-0', STATIC_ROW_HOVER_CLASS)}>
                      <td className={cn(TABLE_CELL_CLASS, 'font-medium text-foreground')}>{client.name}</td>
                      <td className={TABLE_CELL_CLASS}>{client.agentCount}</td>
                      <td className={TABLE_CELL_CLASS}>
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
                      <td className={TABLE_CELL_CLASS}>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={getTenantBasePath(client.slug)}>
                            <ArrowUpRight className="h-4 w-4" />
                            Abrir painel
                          </Link>
                        </Button>
                      </td>
                      <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(client.createdAt))}
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleViewCredentials(client)}>
                            <Eye className="h-4 w-4" />
                            Ver credenciais
                          </Button>
                          <form action={rotateAction} className="inline">
                            <input type="hidden" name="serverUrl" value={provisioningServerUrl} />
                            <input type="hidden" name="clientId" value={client.id} />
                            <RotatePackageButton />
                          </form>
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
