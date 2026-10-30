'use client'

import Link from 'next/link'
import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, Monitor, RefreshCw, ShieldOff, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'
import { cn } from '@/lib/utils'
import { getAgentAuthState } from '../../agent-state'
import type { ClientAgentRow } from '../../queries'
import type { RevokeAgentAuthState } from '../../actions'
import { initialRequestAgentUpdateState, type RequestAgentUpdateState } from '../../types'

type ClientAgentsPanelProps = {
  client: { id: string; name: string; isActive: boolean }
  agents: ClientAgentRow[]
  revokeAgentAuthAction: (state: RevokeAgentAuthState, payload: FormData) => Promise<RevokeAgentAuthState>
  requestAgentUpdateAction?: (state: RequestAgentUpdateState, payload: FormData) => Promise<RequestAgentUpdateState>
  latestAgentVersion?: string
}

const initialRevokeState: RevokeAgentAuthState = { error: null, message: null }

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatDateTime(value: string | null) {
  return value ? dateTimeFormat.format(new Date(value)) : '—'
}

/** Fim do id: o comeco de um cuid e carimbo de tempo e se repete entre instalacoes proximas. */
function shortId(id: string) {
  return id.length > 8 ? id.slice(-8) : id
}

function RevokeConfirmDialog({
  agent,
  isLastActive,
  open,
  onOpenChange,
  onConfirm,
  onCloseAutoFocus,
}: {
  agent: ClientAgentRow | null
  isLastActive: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{agent ? `Revogar ${agent.name}?` : 'Revogar agente?'}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                A revogação é imediata e não pode ser desfeita.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  O serviço do agente continua instalado na máquina e é recusado pelo servidor a cada
                  ciclo. Para parar de vez, desinstale o agente na máquina.
                </li>
                <li>
                  A máquina e o histórico não são apagados. Ela deixa de aparecer nas listas de máquinas
                  do cliente; os alertas antigos continuam no histórico de alertas.
                </li>
                <li>Comandos pendentes deste agente são cancelados.</li>
                <li>Reinstalar o agente na mesma máquina cria um registro novo, com outro id.</li>
              </ul>
              {isLastActive && (
                <p className="font-medium text-destructive">
                  Este é o último agente ativo do cliente. Depois da revogação, o cliente fica sem nenhuma
                  máquina reportando.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={onConfirm}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ClientAgentsPanel({
  client,
  agents,
  revokeAgentAuthAction,
  requestAgentUpdateAction,
  latestAgentVersion,
}: ClientAgentsPanelProps) {
  const [revokeState, revokeAction, revokePending] = useActionState(revokeAgentAuthAction, initialRevokeState)
  // Alvo do dialogo, separado de `dialogOpen` para o conteudo nao sumir
  // durante a animacao de fechamento (mesmo padrao de clients-panel.tsx).
  const [revokeTarget, setRevokeTarget] = useState<ClientAgentRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'outdated' | 'revoked'>('all')
  // useActionState exige uma action; sem ela (prop opcional) vira no-op.
  const [updateState, updateAction, updatePending] = useActionState(
    requestAgentUpdateAction ?? (async () => initialRequestAgentUpdateState),
    initialRequestAgentUpdateState
  )
  // Qual feedback e o mais recente: a regiao role="status" e unica.
  const [lastFeedback, setLastFeedback] = useState<'revoke' | 'update'>('revoke')
  // Nome do agente da ultima revogacao confirmada, para o anuncio do resultado
  // (depois do revalidatePath a linha muda de estado).
  const [confirmedName, setConfirmedName] = useState<string | null>(null)
  // Estado derivado: guarda a referencia dispensada em vez de copiar o estado.
  const [dismissedState, setDismissedState] = useState<RevokeAgentAuthState | null>(null)
  const result = revokeState === dismissedState ? initialRevokeState : revokeState

  // O dialogo e controlado e nao tem AlertDialogTrigger: o Radix nao sabe para
  // onde devolver o foco. Guardamos o botao "Revogar" que o abriu.
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const confirmedRef = useRef(false)
  const resultRef = useRef<HTMLDivElement | null>(null)

  const activeCount = agents.filter((agent) => agent.isActive).length
  const isOutdated = (agent: ClientAgentRow) =>
    agent.isActive && Boolean(agent.agentVersion) && agent.agentVersion !== latestAgentVersion
  const outdatedCount = latestAgentVersion ? agents.filter(isOutdated).length : 0
  const revokedCount = agents.filter((agent) => !agent.isActive).length
  const visibleAgents = agents.filter((agent) => {
    if (statusFilter === 'active') return agent.isActive
    if (statusFilter === 'outdated') return latestAgentVersion ? isOutdated(agent) : false
    if (statusFilter === 'revoked') return !agent.isActive
    return true
  })
  const isLastActive =Boolean(revokeTarget?.isActive) && activeCount === 1

  function confirmRevoke() {
    if (!revokeTarget) return
    const formData = new FormData()
    formData.set('agentAuthId', revokeTarget.id)
    confirmedRef.current = true
    setLastFeedback('revoke')
    setConfirmedName(revokeTarget.name)
    setDialogOpen(false)
    startTransition(() => revokeAction(formData))
  }

  function dispatchUpdate(field: 'agentAuthId' | 'clientId', value: string) {
    const formData = new FormData()
    formData.set(field, value)
    setLastFeedback('update')
    startTransition(() => updateAction(formData))
  }

  function handleCloseAutoFocus(event: Event) {
    event.preventDefault()
    // Confirmado: o foco vai para o resultado quando ele chegar (efeito abaixo).
    if (!confirmedRef.current) triggerRef.current?.focus()
    confirmedRef.current = false
  }

  // Cada revogacao devolve um objeto novo; leva o foco ao resultado.
  useEffect(() => {
    if (revokeState.message || revokeState.error) resultRef.current?.focus()
  }, [revokeState])

  const updateAnnouncement = updateState.error ?? updateState.message ?? ''
  const revokeAnnouncement = result.error
    ? `Falha ao revogar ${confirmedName ?? 'o agente'}: ${result.error}`
    : result.message
      ? `${confirmedName ?? 'Agente'}: ${result.message}`
      : ''
  const announcement =
    lastFeedback === 'update' && updateAnnouncement ? updateAnnouncement : revokeAnnouncement || updateAnnouncement

  const canUpdateAll =
    Boolean(requestAgentUpdateAction) && agents.some((agent) => agent.isActive && agent.hasDevice)

  return (
    <div className="space-y-6">
      <RevokeConfirmDialog
        agent={revokeTarget}
        isLastActive={isLastActive}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={confirmRevoke}
        onCloseAutoFocus={handleCloseAutoFocus}
      />

      {/* Regiao viva sempre montada: leitores de tela so anunciam mudancas em
          regioes que ja existiam antes do conteudo chegar. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {(result.message || result.error) && (
        <div
          ref={resultRef}
          tabIndex={-1}
          data-testid="revoke-result"
          className="relative rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Panel className={cn(result.error && 'border-destructive/40')}>
            <PanelHeader
              className="pr-14"
              title={result.error ? 'Falha ao revogar o agente' : 'Agente revogado'}
              description={result.error ?? `${confirmedName ?? 'Agente'}: ${result.message}`}
            />
          </Panel>
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3"
            aria-label="Dispensar"
            onClick={() => setDismissedState(revokeState)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {agents.length === 0 ? (
        <Panel>
          <PanelBody className="space-y-2 pt-5">
            <p className="text-sm font-medium text-foreground">
              Nenhum agente se registrou com a chave deste cliente.
            </p>
            <p className="text-sm text-muted-foreground">
              Um agente aparece aqui quando é instalado numa máquina com o pacote de instalação de{' '}
              {client.name}. O pacote fica em Clientes, na ação &quot;Ver credenciais&quot; deste cliente.
            </p>
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/admin/clients">Abrir o pacote de instalação em Clientes</Link>
            </Button>
          </PanelBody>
        </Panel>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total de credenciais"
            value={agents.length}
            subtitle="credenciais emitidas"
            icon={<Bot />}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <KpiCard
            label="Agentes ativos"
            value={activeCount}
            subtitle="autorizados a enviar coleta"
            icon={<CheckCircle2 />}
            tone="success"
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter((f) => (f === 'active' ? 'all' : 'active'))}
          />
          <KpiCard
            label="Agentes desatualizados"
            value={outdatedCount}
            subtitle="versão diferente da mais recente"
            icon={<Monitor />}
            tone="warning"
            active={statusFilter === 'outdated'}
            onClick={() => setStatusFilter((f) => (f === 'outdated' ? 'all' : 'outdated'))}
          />
          <KpiCard
            label="Revogados"
            value={revokedCount}
            subtitle="bloqueados permanentemente"
            icon={<ShieldOff />}
            tone="neutral"
            active={statusFilter === 'revoked'}
            onClick={() => setStatusFilter((f) => (f === 'revoked' ? 'all' : 'revoked'))}
          />
        </div>
        <Panel>
          <PanelHeader
            icon={<Bot className="h-4 w-4" />}
            title="Credenciais e instalações de agente"
            description={`${activeCount} ativo(s) de ${agents.length} registrado(s)`}
            action={
              canUpdateAll ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={updatePending}
                  onClick={() => dispatchUpdate('clientId', client.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar todos os agentes
                </Button>
              ) : undefined
            }
          />
        <div className={cn(TABLE_SHELL_CLASS, 'overflow-x-auto')}>
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CLASS}>Agente</th>
                <th className={TABLE_HEAD_CLASS}>Hostname</th>
                <th className={TABLE_HEAD_CLASS}>Versão</th>
                <th className={TABLE_HEAD_CLASS}>Registrado em</th>
                <th className={TABLE_HEAD_CLASS}>Última coleta</th>
                <th className={TABLE_HEAD_CLASS}>Estado</th>
                <th className={TABLE_HEAD_CLASS}>Revogado em</th>
                <th className={TABLE_HEAD_CLASS}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleAgents.map((agent) => {
                const state = getAgentAuthState({
                  isActive: agent.isActive,
                  hasDevice: agent.hasDevice,
                  clientIsActive: client.isActive,
                })

                return (
                  <tr key={agent.id} className={cn('border-b border-surface-line last:border-0', STATIC_ROW_HOVER_CLASS)}>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="font-medium text-foreground">{agent.name}</div>
                      <div className="data-mono text-xs text-muted-foreground" title={agent.id}>
                        {shortId(agent.id)}
                      </div>
                    </td>
                    <td className={TABLE_DATA_CELL_CLASS}>{agent.hostname ?? '—'}</td>
                    <td className={TABLE_DATA_CELL_CLASS}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{agent.agentVersion ?? '—'}</span>
                        {agent.agentVersion && latestAgentVersion && (
                          <StatusPill
                            tone={agent.agentVersion === latestAgentVersion ? 'success' : 'warning'}
                            label={
                              agent.agentVersion === latestAgentVersion
                                ? 'Atualizado'
                                : `v${latestAgentVersion} disponível`
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                      {formatDateTime(agent.createdAt)}
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                      {formatDateTime(agent.lastCollectionAt)}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <StatusPill tone={state.tone} label={state.label} />
                      {state.detail && (
                        <p className="mt-1.5 max-w-64 text-xs text-muted-foreground">{state.detail}</p>
                      )}
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                      {formatDateTime(agent.revokedAt)}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {agent.isActive ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {agent.hasDevice && requestAgentUpdateAction && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={updatePending}
                              aria-label={`Atualizar ${agent.name}`}
                              onClick={() => dispatchUpdate('agentAuthId', agent.id)}
                            >
                              Atualizar
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={revokePending}
                            aria-label={`Revogar ${agent.name}`}
                            onClick={(event) => {
                              triggerRef.current = event.currentTarget
                              setRevokeTarget(agent)
                              setDialogOpen(true)
                            }}
                          >
                            {revokePending && revokeTarget?.id === agent.id ? 'Revogando...' : 'Revogar'}
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
        </Panel>
        </>
      )}
    </div>
  )
}
