'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AgentInstallPackage } from '@/components/agent-install-package'
import { getTenantBasePath } from '@/lib/tenant-links'
import { cn } from '@/lib/utils'
import { initialProvisioningState, type ProvisioningActionState, type ProvisioningPackage } from '../types'

type WizardProps = {
  serverUrl: string
  createClientAction: (
    state: ProvisioningActionState,
    formData: FormData
  ) => Promise<ProvisioningActionState>
}

type ClientStatus = {
  agentCount: number
  device: { id: string; hostname: string; lastSeenAt: string } | null
}

const STEPS = ['Dados do cliente', 'Instalação', 'Primeira máquina'] as const

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary',
                !done && !active && 'border-border text-muted-foreground'
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn('hidden sm:inline', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </li>
        )
      })}
    </ol>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'Criando...' : 'Criar cliente e gerar instalador'}
    </Button>
  )
}

const POLL_INTERVAL_MS = 5_000
/** Sem check-in depois disso, o passo 3 mostra o checklist de diagnostico. */
const FIRST_CHECKIN_TIMEOUT_MS = 180_000

function pollErrorMessage(httpStatus: number) {
  if (httpStatus === 401) {
    return 'Sua sessão expirou. Entre novamente para acompanhar a instalação.'
  }
  if (httpStatus === 404) {
    return 'Cliente não encontrado ou sem acesso para a sua conta.'
  }
  return `O servidor respondeu com erro (HTTP ${httpStatus}) ao consultar o status. Nova tentativa em 5 s.`
}

const networkErrorMessage =
  'Não foi possível falar com o servidor para consultar o status. Verifique sua conexão; nova tentativa em 5 s.'

/**
 * Passo 3: pergunta ao servidor, a cada 5 s, se alguma maquina ja fez check-in.
 * Erros HTTP e de rede viram mensagem visivel (antes eram engolidos). O polling
 * continua depois do tempo esgotado: uma maquina atrasada ainda vira sucesso.
 * `elapsedMs` so muda no callback do intervalo (nunca no corpo do efeito) e o
 * "tempo esgotado" e derivado dele no render.
 */
function useFirstCheckin(clientId: string | null) {
  const [status, setStatus] = useState<ClientStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!clientId) return

    let cancelled = false

    async function poll() {
      let response: Response
      try {
        response = await fetch(`/api/clients/${clientId}/status`, { cache: 'no-store' })
      } catch {
        if (!cancelled) setError(networkErrorMessage)
        return
      }

      if (!response.ok) {
        if (!cancelled) setError(pollErrorMessage(response.status))
        return
      }

      try {
        const data = (await response.json()) as ClientStatus
        if (cancelled) return
        setStatus(data)
        setError(null)
      } catch {
        if (!cancelled) setError(pollErrorMessage(response.status))
      }
    }

    void poll()
    timer.current = setInterval(() => {
      setElapsedMs((value) => value + POLL_INTERVAL_MS)
      void poll()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
    }
  }, [clientId])

  // Para de checar assim que a primeira maquina aparece.
  useEffect(() => {
    if (status?.device && timer.current) clearInterval(timer.current)
  }, [status])

  const timedOut = !status?.device && elapsedMs >= FIRST_CHECKIN_TIMEOUT_MS
  return { status, error, timedOut }
}

type FirstCheckin = ReturnType<typeof useFirstCheckin>

/**
 * Passo 3 completo: consulta o status e renderiza o painel. O assistente usa
 * `useFirstCheckin` + `FirstCheckinPanel` direto porque o Stepper tambem
 * precisa saber se ja conectou; os dois caminhos usam as mesmas pecas.
 */
export function FirstCheckinStatus({ clientId, clientSlug }: { clientId: string; clientSlug: string }) {
  const checkin = useFirstCheckin(clientId)
  return <FirstCheckinPanel checkin={checkin} clientSlug={clientSlug} />
}

/**
 * Estado do passo 3 (aguardando, registrado sem coleta, erro, tempo esgotado,
 * conectado), todo dentro de uma regiao role="status" para leitores de tela.
 */
function FirstCheckinPanel({ checkin, clientSlug }: { checkin: FirstCheckin; clientSlug: string }) {
  const { status, error, timedOut } = checkin
  const device = status?.device ?? null
  const registered = !device && (status?.agentCount ?? 0) > 0

  return (
    <div
      role="status"
      className={cn(
        'rounded-xl border p-6 transition-colors',
        device ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-card'
      )}
    >
      {device ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-4 w-4 text-emerald-600" />
            </span>
            <div>
              <p className="font-medium">{device.hostname} conectou</p>
              <p className="text-sm text-muted-foreground">
                O inventário está sendo coletado. Instale nas demais máquinas usando o mesmo
                instalador.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={getTenantBasePath(clientSlug)}>Abrir painel do cliente</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/clients">Voltar para clientes</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">
                {registered
                  ? 'Agente registrado, aguardando a primeira coleta…'
                  : 'Aguardando a primeira máquina…'}
              </p>
              <p className="text-sm text-muted-foreground">
                {registered
                  ? 'O agente já se registrou neste cliente. O inventário aparece aqui assim que a primeira coleta chegar.'
                  : 'Assim que o agente for instalado e fizer o primeiro check-in, ele aparece aqui.'}{' '}
                Pode fechar esta página — o cliente já está criado.
              </p>
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {timedOut && (
            <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
              <p className="font-medium">Nenhum check-in em 3 minutos. Confira na máquina:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>O instalador foi executado como Administrador.</li>
                <li>O firewall da máquina e da rede libera a saída para a porta do servidor.</li>
                <li>
                  O servidor está alcançável pela rede do cliente. O instalador usa o endereço do
                  servidor configurado, não o digitado no passo 1.
                </li>
              </ul>
              <p className="text-muted-foreground">Esta página continua verificando a cada 5 s.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NewClientWizard({ serverUrl, createClientAction }: WizardProps) {
  const [state, formAction] = useActionState(createClientAction, initialProvisioningState)
  const pkg: ProvisioningPackage | null = state.package
  const checkin = useFirstCheckin(pkg?.clientId ?? null)
  const connected = Boolean(checkin.status?.device)
  const step = !pkg ? 0 : connected ? 2 : 1

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link href="/admin/clients">
            <ArrowLeft className="h-4 w-4" />
            Clientes
          </Link>
        </Button>
        <Stepper current={step} />
      </div>

      {/* ---------- Passo 1 ---------- */}
      {!pkg && (
        <form action={formAction} className="space-y-6 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">Dados do cliente</h2>
            <p className="text-sm text-muted-foreground">
              O instalador é gerado já configurado para este cliente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome da empresa</Label>
            <Input id="name" name="name" required minLength={3} placeholder="Acme Indústria Ltda" autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serverUrl">Endereço do servidor</Label>
            <Input id="serverUrl" name="serverUrl" required defaultValue={serverUrl} />
            <p className="text-xs text-muted-foreground">
              É o endereço que as máquinas do cliente vão usar para enviar o inventário. Precisa ser
              acessível a partir da rede delas.
            </p>
          </div>

          {state.error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      )}

      {/* ---------- Passo 2 ---------- */}
      {pkg && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">
                Instale o agente em uma máquina de {pkg.clientName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Baixe e execute como administrador. O instalador já vem com a chave embutida — não é
                preciso digitar nada.
              </p>
            </div>

            <AgentInstallPackage pkg={pkg} keyIsFresh />
          </div>

          {/* ---------- Passo 3 ---------- */}
          <FirstCheckinPanel checkin={checkin} clientSlug={pkg.clientSlug} />
        </div>
      )}
    </div>
  )
}
