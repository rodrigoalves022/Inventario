'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AgentInstallPackage } from '@/components/agent-install-package'
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

/** Passo 3: pergunta ao servidor, a cada 5s, se alguma maquina ja fez check-in. */
function useFirstCheckin(clientId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<ClientStatus | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!clientId || !enabled) return

    let cancelled = false

    async function poll() {
      try {
        const response = await fetch(`/api/clients/${clientId}/status`, { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as ClientStatus
        if (!cancelled) setStatus(data)
      } catch {
        // silencioso: a tela ja mostra "aguardando", nao ha acao do usuario aqui
      }
    }

    void poll()
    timer.current = setInterval(poll, 5000)

    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
    }
  }, [clientId, enabled])

  // Para de checar assim que a primeira maquina aparece.
  useEffect(() => {
    if (status?.device && timer.current) clearInterval(timer.current)
  }, [status])

  return status
}

export function NewClientWizard({ serverUrl, createClientAction }: WizardProps) {
  const [state, formAction] = useActionState(createClientAction, initialProvisioningState)
  const pkg: ProvisioningPackage | null = state.package
  const status = useFirstCheckin(pkg?.clientId ?? null, Boolean(pkg))
  const connected = Boolean(status?.device)
  const step = !pkg ? 0 : connected ? 2 : 1

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link href="/clients">
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
          <div
            className={cn(
              'rounded-xl border p-6 transition-colors',
              connected ? 'border-emerald-500/40 bg-emerald-500/5' : 'bg-card'
            )}
          >
            {connected && status?.device ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-4 w-4 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-medium">{status.device.hostname} conectou</p>
                    <p className="text-sm text-muted-foreground">
                      O inventário está sendo coletado. Instale nas demais máquinas usando o mesmo
                      instalador.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/tenant/${pkg.clientSlug}`}>Abrir painel do cliente</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/clients">Voltar para clientes</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <div>
                  <p className="font-medium">Aguardando a primeira máquina…</p>
                  <p className="text-sm text-muted-foreground">
                    Assim que o agente for instalado e fizer o primeiro check-in, ele aparece aqui.
                    Pode fechar esta página — o cliente já está criado.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
