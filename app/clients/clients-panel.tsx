'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowUpRight, Copy, Download, Eye, KeyRound, Loader2, PlusCircle, Rocket, Terminal, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      <Copy className="h-4 w-4" />
      {copied ? 'Copiado' : label}
    </Button>
  )
}

function downloadScriptFile(provisioningPackage: ProvisioningPackage) {
  const content = [
    `$server = '${provisioningPackage.bootstrapUrl}'`,
    'Invoke-RestMethod -Uri $server | Invoke-Expression',
  ].join('\r\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `instalar-${provisioningPackage.clientSlug}.ps1`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function PackageFields({ pkg }: { pkg: ProvisioningPackage }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <Label>Chave de instalação</Label>
          <Textarea value={pkg.enrollmentKey} readOnly className="min-h-24 font-mono" />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={pkg.enrollmentKey} label="Copiar chave" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Comando de instalação em um passo</Label>
          <Textarea value={pkg.bootstrapCommand} readOnly className="min-h-24 font-mono" />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default" size="sm">
              <a href={`/api/agent/download-exe?client=${pkg.clientSlug}&key=${pkg.enrollmentKey}`} download>
                <Download className="h-4 w-4 mr-2" />
                Baixar instalador (.exe)
              </a>
            </Button>
            <CopyButton value={pkg.bootstrapCommand} label="Copiar comando" />
            <Button type="button" variant="outline" size="sm" onClick={() => downloadScriptFile(pkg)}>
              <Download className="h-4 w-4" />
              Baixar script PS1
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Comando manual alternativo</Label>
        <Textarea value={pkg.installCommand} readOnly className="min-h-20 font-mono" />
        <div className="flex flex-wrap gap-2">
          <CopyButton value={pkg.installCommand} label="Copiar modo manual" />
          <Button asChild variant="secondary" size="sm">
            <Link href={pkg.bootstrapUrl}>
              <Rocket className="h-4 w-4" />
              Abrir script gerado
            </Link>
          </Button>
        </div>
      </div>
    </>
  )
}

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
        <PackageFields pkg={pkg} />
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
            <PackageFields pkg={state.data.package} />
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

  useEffect(() => {
    if (createState.error || createState.message || createState.package) {
      setResult(createState)
      if (createState.package) setShowCreateForm(false)
    }
  }, [createState])

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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>
                Gerencie empresas, baixe instaladores e emita novos pacotes.
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateForm(true)} disabled={showCreateForm}>
              <PlusCircle className="h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                        <Badge variant={client.isActive ? 'default' : 'outline'}>
                          {client.isActive ? 'ativo' : 'inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/tenant/${client.slug}`}>
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
