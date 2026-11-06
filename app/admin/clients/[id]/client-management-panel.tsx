'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bot, KeyRound, Loader2, RefreshCw, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { deleteClientAction, rotateEnrollmentKeyAction, updateClientAction } from '../actions'
import { addClientUserAction, getClientPackageAction, removeClientUserAction, toggleClientUserAction } from '../user-actions'
import { type ClientUserRow } from '../queries'
import { initialProvisioningState, type ClientMutationState } from '../types'

export type ManagedClient = {
  id: string
  name: string
  slug: string
  isActive: boolean
  discoveryEnabled: boolean
  metricsRetentionDays: number
  alertsEnabled: boolean
  alertWebhookEnabled: boolean
  alertWebhookUrl: string | null
  alertOfflineHours: number
  alertDiskThresholdGb: number
  alertRamThresholdGb: number
}

type Props = {
  client: ManagedClient
  users: ClientUserRow[]
  serverUrl: string
  activeAgentCount: number
  totalAgentCount: number
}

function Feedback({ state }: { state: ClientMutationState | null }) {
  if (!state) return null
  if (state.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Aba 1: endereco do servidor, pacote ativo e rotacao de chave. */
function PackageTab({ client, serverUrl: initialServerUrl, activeAgentCount }: Pick<Props, 'client' | 'serverUrl' | 'activeAgentCount'>) {
  const [serverUrl, setServerUrl] = useState(initialServerUrl)
  const [loading, setLoading] = useState(false)
  const [pkgState, setPkgState] = useState(initialProvisioningState)
  const [revokeAgents, setRevokeAgents] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateEnrollmentKeyAction, initialProvisioningState)

  const loadPackage = useCallback(
    async (url: string) => {
      const formData = new FormData()
      formData.set('clientId', client.id)
      formData.set('serverUrl', url)
      setLoading(true)
      try {
        setPkgState(await getClientPackageAction(formData))
      } catch {
        setPkgState({ error: 'Falha ao carregar o pacote de instalação.', message: null, package: null })
      } finally {
        setLoading(false)
      }
    },
    [client.id]
  )

  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void loadPackage(initialServerUrl)
  }, [initialServerUrl, loadPackage])

  // Pacote novo da rotacao substitui o exibido (chave nova, mesmo servidor).
  const shown = rotateState.package ?? pkgState.package
  const fresh = rotateState.package !== null
  const error = rotateState.error ?? pkgState.error

  function confirmRotate() {
    const formData = new FormData()
    formData.set('clientId', client.id)
    formData.set('serverUrl', serverUrl)
    if (revokeAgents) formData.set('revokeActiveAgents', 'true')
    setRotateOpen(false)
    startTransition(() => rotateAction(formData))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
        <Panel className={error ? 'border-destructive/40' : undefined}>
          <PanelHeader
            title={fresh ? 'Novo pacote emitido' : 'Credenciais ativas / Pacote de instalação'}
            description={
              fresh
                ? (rotateState.message ?? 'Chave de instalação rotacionada.')
                : (pkgState.message ?? 'Pacote ativo do cliente, sem rotacionar a chave.')
            }
          />
          <PanelBody>
            {loading && !shown ? (
              <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando pacote ativo...
              </p>
            ) : null}
            {error && !fresh ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {shown ? <AgentInstallPackage key={shown.bootstrapUrl} pkg={shown} keyIsFresh={fresh} /> : null}
          </PanelBody>
        </Panel>

        </div>
        <div className="min-w-0 space-y-6">
        <Panel>
          <PanelHeader
            title="Endereço do servidor"
            description="Os comandos e links de instalação são recalculados para o endereço informado, sem alterar a chave."
          />
          <PanelBody className="space-y-3">
            <div className="max-w-xl space-y-2">
              <Label htmlFor="mgmt-server-url">Endereço do servidor</Label>
              <Input
                id="mgmt-server-url"
                type="url"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://..."
                className="data-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={loading || serverUrl.trim() === ''} onClick={() => loadPackage(serverUrl)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar servidor no pacote
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Emitir novo pacote"
            description="Gera uma nova chave de instalação. Instaladores antigos deixam de funcionar para novas máquinas."
          />
          <PanelBody className="space-y-3">
            <Button type="button" variant="outline" size="sm" disabled={rotatePending} onClick={() => setRotateOpen(true)}>
              {rotatePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Emitir novo pacote (Rotacionar chave)
            </Button>
            {rotateState.error ? <p role="alert" className="text-sm text-destructive">{rotateState.error}</p> : null}
          </PanelBody>
        </Panel>
        </div>
      </div>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotacionar a chave de instalação?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeAgentCount === 0
                ? 'Nenhum agente ativo neste cliente no momento.'
                : `${activeAgentCount} agente(s) ativo(s) continuam funcionando com a própria credencial, a menos que você os revogue abaixo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CheckField
            id="mgmt-revoke-agents"
            label={`Revogar também os agentes ativos (${activeAgentCount})`}
            hint="As máquinas precisarão ser reinstaladas com o pacote novo."
            checked={revokeAgents}
            onChange={setRevokeAgents}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRotate}>Emitir novo pacote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Aba 2: usuarios (CLIENT_VIEWER) vinculados ao tenant. */
function UsersTab({ client, users }: Pick<Props, 'client' | 'users'>) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ClientMutationState | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClientUserRow | null>(null)

  async function run(action: (formData: FormData) => Promise<ClientMutationState>, formData: FormData) {
    setPending(true)
    try {
      const outcome = await action(formData)
      setResult(outcome)
      if (!outcome.error) router.refresh()
      return outcome
    } catch {
      setResult({ error: 'Erro interno ao atualizar o usuário.', message: null })
      return null
    } finally {
      setPending(false)
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('clientId', client.id)
    const outcome = await run(addClientUserAction, formData)
    if (outcome && !outcome.error) formRef.current?.reset()
  }

  function userForm(user: ClientUserRow) {
    const formData = new FormData()
    formData.set('clientId', client.id)
    formData.set('userId', user.id)
    return formData
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="min-w-0">
        <Panel>
          <PanelHeader title="Vincular novo e-mail ao cliente" description="Cria um usuário com acesso somente leitura ao portal deste cliente." />
          <PanelBody>
            <form ref={formRef} onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mgmt-user-name">Nome do usuário</Label>
                  <Input id="mgmt-user-name" name="name" required minLength={2} placeholder="Nome do usuário" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mgmt-user-email">E-mail</Label>
                  <Input id="mgmt-user-email" name="email" type="email" required placeholder="email@dominio.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mgmt-user-password">Senha inicial</Label>
                  <Input id="mgmt-user-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Vincular e-mail
                </Button>
                <Feedback state={result} />
              </div>
            </form>
          </PanelBody>
        </Panel>
        </div>
        <div className="min-w-0">
        <Panel>
          <PanelHeader title="Usuários vinculados" description="Quem acessa o portal deste cliente (somente leitura)." />
          <PanelBody>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário vinculado a este cliente ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-line text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Nome</th>
                      <th className="py-2 pr-4 font-medium">E-mail</th>
                      <th className="py-2 pr-4 font-medium">Papel</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const manageable = user.role === 'CLIENT_VIEWER'
                      return (
                        <tr key={user.id} className="border-b border-surface-line last:border-0">
                          <td className="py-2 pr-4 text-foreground">{user.name ?? '—'}</td>
                          <td className="py-2 pr-4 data-mono">{user.email}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{user.role}</td>
                          <td className="py-2 pr-4">
                            <StatusPill tone={user.isActive ? 'success' : 'neutral'} label={user.isActive ? 'Ativo' : 'Inativo'} />
                          </td>
                          <td className="py-2">
                            {manageable ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() => run(toggleClientUserAction, userForm(user))}
                                >
                                  {user.isActive ? 'Desativar' : 'Ativar'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={pending}
                                  onClick={() => setRemoveTarget(user)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remover
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>
        </div>
      </div>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removeTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário é excluído e perde o acesso ao portal deste cliente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) void run(removeClientUserAction, userForm(removeTarget))
                setRemoveTarget(null)
              }}
            >
              Remover usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Aba 3: dados cadastrais, coleta/rede, limiares de alerta e webhook. */
function SettingsTab({ client }: Pick<Props, 'client'>) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(client.isActive)
  const [discoveryEnabled, setDiscoveryEnabled] = useState(client.discoveryEnabled)
  const [alertsEnabled, setAlertsEnabled] = useState(client.alertsEnabled)
  const [webhookEnabled, setWebhookEnabled] = useState(client.alertWebhookEnabled)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ClientMutationState | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('clientId', client.id)
    formData.set('isActive', String(isActive))
    formData.set('discoveryEnabled', String(discoveryEnabled))
    formData.set('alertsEnabled', String(alertsEnabled))
    formData.set('alertWebhookEnabled', String(webhookEnabled))
    setPending(true)
    try {
      const outcome = await updateClientAction(formData)
      setResult(outcome)
      if (!outcome.error) router.refresh()
    } catch {
      setResult({ error: 'Erro interno ao atualizar o cliente.', message: null })
    } finally {
      setPending(false)
    }
  }

  const numberInput = 'max-w-[10rem]'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Dados cadastrais" />
          <PanelBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mgmt-name">Nome da empresa</Label>
                <Input id="mgmt-name" name="name" required minLength={3} defaultValue={client.name} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgmt-slug">Identificador (slug)</Label>
                <Input
                  id="mgmt-slug"
                  name="slug"
                  required
                  maxLength={64}
                  pattern="[a-z0-9\-]+"
                  defaultValue={client.slug}
                  placeholder="nome-da-empresa"
                  className="data-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e hifens. Alterar o slug muda o endereço do painel do cliente.
            </p>
            <CheckField id="mgmt-active" label="Cliente ativo" hint="Cliente inativo não recebe novos check-ins." checked={isActive} onChange={setIsActive} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Coleta e rede" />
          <PanelBody className="space-y-4">
            <CheckField
              id="mgmt-discovery"
              label="Descoberta de rede na LAN"
              hint="Permite que os agentes varram a rede local e catalogem dispositivos."
              checked={discoveryEnabled}
              onChange={setDiscoveryEnabled}
            />
            <div className="space-y-2">
              <Label htmlFor="mgmt-retention">Retenção de histórico de métricas (dias)</Label>
              <Input
                id="mgmt-retention"
                name="metricsRetentionDays"
                type="number"
                min={7}
                max={365}
                required
                defaultValue={client.metricsRetentionDays}
                className={numberInput}
              />
              <p className="text-xs text-muted-foreground">De 7 a 365 dias.</p>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Limiares de alerta" />
          <PanelBody className="space-y-4">
            <CheckField id="mgmt-alerts" label="Alertas ativos" checked={alertsEnabled} onChange={setAlertsEnabled} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="mgmt-offline">Máquina offline (horas)</Label>
                <Input id="mgmt-offline" name="alertOfflineHours" type="number" min={1} max={720} defaultValue={client.alertOfflineHours} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgmt-disk">Disco livre crítico (GB)</Label>
                <Input id="mgmt-disk" name="alertDiskThresholdGb" type="number" min={1} max={10000} defaultValue={client.alertDiskThresholdGb} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgmt-ram">RAM mínima (GB)</Label>
                <Input id="mgmt-ram" name="alertRamThresholdGb" type="number" min={1} max={1024} defaultValue={client.alertRamThresholdGb} />
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Webhook do cliente" />
          <PanelBody className="space-y-4">
            <CheckField id="mgmt-webhook" label="Webhook ativo" checked={webhookEnabled} onChange={setWebhookEnabled} />
            <div className="max-w-xl space-y-2">
              <Label htmlFor="mgmt-webhook-url">URL do webhook</Label>
              <Input
                id="mgmt-webhook-url"
                name="alertWebhookUrl"
                type="url"
                defaultValue={client.alertWebhookUrl ?? ''}
                placeholder="https://..."
                className="data-mono"
              />
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar configurações
        </Button>
        <Feedback state={result} />
      </div>
    </form>
  )
}

/** Aba 4: resumo de agentes e exclusao do cliente. */
function DangerTab({ client, activeAgentCount, totalAgentCount }: Pick<Props, 'client' | 'activeAgentCount' | 'totalAgentCount'>) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const formData = new FormData()
    formData.set('clientId', client.id)
    setPending(true)
    setError(null)
    try {
      const outcome = await deleteClientAction(formData)
      if (outcome.error) {
        setError(outcome.error)
        setOpen(false)
      } else {
        router.push('/admin/clients')
      }
    } catch {
      setError('Erro interno ao excluir o cliente.')
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Agentes registrados" description="Instalações do agente neste cliente." />
          <PanelBody className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{activeAgentCount}</span> ativo(s) de{' '}
              <span className="font-semibold">{totalAgentCount}</span> registrado(s).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/clients/${client.id}/agents`}>
                  <Bot className="h-4 w-4" />
                  Ver agentes
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href={getTenantBasePath(client.slug)}>
                  <ArrowUpRight className="h-4 w-4" />
                  Abrir painel
                </Link>
              </Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="border-destructive/40">
          <PanelHeader title="Zona de perigo" description="A exclusão remove o cliente e seus dados. Não pode ser desfeita." />
          <PanelBody className="space-y-3">
            <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Excluir cliente permanentemente
            </Button>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </PanelBody>
        </Panel>
      </div>

      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {client.name} permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Agentes, máquinas, métricas e usuários deste cliente deixam de existir. A trilha de auditoria é mantida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {pending ? 'Excluindo...' : 'Excluir cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function ClientManagementPanel({ client, users, serverUrl, activeAgentCount, totalAgentCount }: Props) {
  return (
    <Tabs defaultValue="package" className="mx-auto w-full max-w-5xl gap-6">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="package">Pacote &amp; Servidor</TabsTrigger>
        <TabsTrigger value="users">E-mails &amp; Acessos ({users.length})</TabsTrigger>
        <TabsTrigger value="settings">Configurações, Rede &amp; Alertas</TabsTrigger>
        <TabsTrigger value="danger">Agentes &amp; Zona de Perigo</TabsTrigger>
      </TabsList>
      <TabsContent value="package">
        <PackageTab client={client} serverUrl={serverUrl} activeAgentCount={activeAgentCount} />
      </TabsContent>
      <TabsContent value="users">
        <UsersTab client={client} users={users} />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsTab client={client} />
      </TabsContent>
      <TabsContent value="danger">
        <DangerTab client={client} activeAgentCount={activeAgentCount} totalAgentCount={totalAgentCount} />
      </TabsContent>
    </Tabs>
  )
}
