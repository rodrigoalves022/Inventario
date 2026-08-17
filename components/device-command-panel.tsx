'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Activity, Power, RefreshCw, Terminal, Wrench } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  enqueueDeviceCommandAction,
  type EnqueueCommandActionState,
} from '@/app/tenant/[clientSlug]/assets/[id]/actions'
import {
  RESTARTABLE_SERVICES,
  RESTARTABLE_SERVICE_LABELS,
  SCRIPT_CATALOG_IDS,
  SCRIPT_CATALOG_LABELS,
} from '@/lib/agent-commands'

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async, nunca valores.
const idleState: EnqueueCommandActionState = { status: 'idle', message: null }

function SubmitButton({ children, variant = 'outline' }: { children: React.ReactNode; variant?: 'outline' | 'destructive' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size="sm" className="gap-2" disabled={pending}>
      {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
      {pending ? 'Enfileirando...' : children}
    </Button>
  )
}

function useCommandFeedback(state: EnqueueCommandActionState) {
  const [feedback, setFeedback] = useState<string | null>(null)
  useEffect(() => {
    if (state.message) setFeedback(state.message)
  }, [state])
  return feedback
}

function CollectMetricsNowForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  const feedback = useCommandFeedback(state)

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="assetId" value={deviceId} />
      <input type="hidden" name="type" value="collect_metrics_now" />
      <SubmitButton>
        <Activity className="h-4 w-4" />
        Coletar métricas agora
      </SubmitButton>
      {feedback && (
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {feedback}
        </p>
      )}
    </form>
  )
}

function RestartServiceForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  const feedback = useCommandFeedback(state)

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="assetId" value={deviceId} />
      <input type="hidden" name="type" value="restart_service" />
      <div className="flex flex-wrap items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <select
          name="serviceName"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue={RESTARTABLE_SERVICES[0]}
        >
          {RESTARTABLE_SERVICES.map((service) => (
            <option key={service} value={service}>
              {RESTARTABLE_SERVICE_LABELS[service]}
            </option>
          ))}
        </select>
        <SubmitButton>Reiniciar serviço</SubmitButton>
      </div>
      {feedback && (
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {feedback}
        </p>
      )}
    </form>
  )
}

function RunScriptForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  const feedback = useCommandFeedback(state)

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="assetId" value={deviceId} />
      <input type="hidden" name="type" value="run_script" />
      <div className="flex flex-wrap items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <select
          name="scriptId"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue={SCRIPT_CATALOG_IDS[0]}
        >
          {SCRIPT_CATALOG_IDS.map((script) => (
            <option key={script} value={script}>
              {SCRIPT_CATALOG_LABELS[script]}
            </option>
          ))}
        </select>
        <SubmitButton>Rodar script</SubmitButton>
      </div>
      {feedback && (
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {feedback}
        </p>
      )}
    </form>
  )
}

function RestartComputerForm({ tenantSlug, deviceId, hostname }: { tenantSlug: string; deviceId: string; hostname: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  const feedback = useCommandFeedback(state)

  return (
    <div className="flex flex-col gap-1.5">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-fit gap-2">
            <Power className="h-4 w-4" />
            Reiniciar máquina
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar {hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              A máquina reinicia em ~10s após o agente receber o comando (até ~90s de fila). Qualquer
              trabalho não salvo do usuário logado será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={formAction}>
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="assetId" value={deviceId} />
            <input type="hidden" name="type" value="restart_computer" />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </AlertDialogCancel>
              <SubmitButton variant="destructive">Confirmar reinício</SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {feedback && (
        <p className={state.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {feedback}
        </p>
      )}
    </div>
  )
}

export function DeviceCommandPanel({
  tenantSlug,
  deviceId,
  hostname,
}: {
  tenantSlug: string
  deviceId: string
  hostname: string
}) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <CollectMetricsNowForm tenantSlug={tenantSlug} deviceId={deviceId} />
      <RestartComputerForm tenantSlug={tenantSlug} deviceId={deviceId} hostname={hostname} />
      <RestartServiceForm tenantSlug={tenantSlug} deviceId={deviceId} />
      <RunScriptForm tenantSlug={tenantSlug} deviceId={deviceId} />
    </div>
  )
}
