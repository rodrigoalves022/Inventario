'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { RefreshCw, Terminal, Wrench, X } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  bulkEnqueueDeviceCommandAction,
  type BulkCommandActionState,
} from '@/app/app/[clientSlug]/computers/actions'
import {
  RESTARTABLE_SERVICES,
  RESTARTABLE_SERVICE_LABELS,
  SCRIPT_CATALOG_IDS,
  SCRIPT_CATALOG_LABELS,
  COMMAND_TYPE_LABELS,
} from '@/lib/agent-commands'

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async, nunca valores.
const idleState: BulkCommandActionState = { status: 'idle', message: null }

/** Mesmo catalogo fechado de components/device-command-panel.tsx (um device
 * por vez), so que aqui um unico form cobre os 5 tipos — a barra flutuante
 * nao tem espaco pra 4 forms lado a lado como no painel de detalhe. */
const BULK_COMMAND_TYPES = ['collect_now', 'collect_metrics_now', 'update_agent', 'restart_service', 'run_script', 'restart_computer'] as const
type BulkCommandType = (typeof BULK_COMMAND_TYPES)[number]

function SubmitButton({ label, destructive }: { label: string; destructive?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={destructive ? 'destructive' : 'default'} size="sm" className="gap-2" disabled={pending}>
      {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
      {pending ? 'Enfileirando...' : label}
    </Button>
  )
}

/**
 * Barra flutuante de acoes em lote (Sprint 12) — reusada por
 * components/tenant-computers-table.tsx (/computers, /assets) e
 * components/tenant-servers-table.tsx (/servers), pra nao duplicar a logica
 * de disparo entre as duas tabelas. Recebe so os IDs selecionados; quem
 * gerencia o Set de selecao e' a tabela (linhas com checkbox), esta barra so
 * consome o resultado.
 */
export function BulkCommandBar({
  tenantSlug,
  deviceIds,
  onClear,
}: {
  tenantSlug: string
  deviceIds: string[]
  onClear: () => void
}) {
  const [state, formAction] = useActionState(bulkEnqueueDeviceCommandAction, idleState)
  const [type, setType] = useState<BulkCommandType>('collect_now')
  const [serviceName, setServiceName] = useState<string>(RESTARTABLE_SERVICES[0])
  const [scriptId, setScriptId] = useState<string>(SCRIPT_CATALOG_IDS[0])

  useEffect(() => {
    if (!state.message) return
    if (state.status === 'error') {
      toast.error(state.message)
    } else {
      toast.success(state.message)
      onClear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (deviceIds.length === 0) return null

  const count = deviceIds.length
  const isDestructive = type === 'restart_computer'

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm font-medium text-foreground">
          {count} dispositivo{count !== 1 ? 's' : ''} selecionado{count !== 1 ? 's' : ''}
        </span>

        <Select value={type} onValueChange={(value) => setType(value as BulkCommandType)}>
          <SelectTrigger size="sm" className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULK_COMMAND_TYPES.map((commandType) => (
              <SelectItem key={commandType} value={commandType}>
                {COMMAND_TYPE_LABELS[commandType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {type === 'restart_service' && (
          <Select value={serviceName} onValueChange={setServiceName}>
            <SelectTrigger size="sm" className="h-9 w-44">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESTARTABLE_SERVICES.map((service) => (
                <SelectItem key={service} value={service}>
                  {RESTARTABLE_SERVICE_LABELS[service]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {type === 'run_script' && (
          <Select value={scriptId} onValueChange={setScriptId}>
            <SelectTrigger size="sm" className="h-9 w-48">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCRIPT_CATALOG_IDS.map((script) => (
                <SelectItem key={script} value={script}>
                  {SCRIPT_CATALOG_LABELS[script]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={isDestructive ? 'destructive' : 'default'} size="sm">
              Executar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {COMMAND_TYPE_LABELS[type]} em {count} dispositivo{count !== 1 ? 's' : ''}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isDestructive
                  ? `Todas as ${count} máquinas selecionadas reiniciam em ~10s após o agente receber o comando (até ~90s de fila). Qualquer trabalho não salvo dos usuários logados será perdido.`
                  : `O comando é enfileirado para as ${count} máquinas selecionadas. Cada agente executa no próximo ciclo (até ~90s).`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form action={formAction}>
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="type" value={type} />
              {type === 'restart_service' && <input type="hidden" name="serviceName" value={serviceName} />}
              {type === 'run_script' && <input type="hidden" name="scriptId" value={scriptId} />}
              {deviceIds.map((id) => (
                <input key={id} type="hidden" name="deviceIds" value={id} />
              ))}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </AlertDialogCancel>
                <SubmitButton label="Confirmar" destructive={isDestructive} />
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>

        <button
          type="button"
          onClick={onClear}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
