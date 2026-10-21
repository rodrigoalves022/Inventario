'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Copy, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  createWebhookEndpointAction,
  toggleWebhookEndpointAction,
  updateWebhookEndpointAction,
  type WebhookEndpointActionState,
} from '@/app/app/[clientSlug]/settings/actions'
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from '@/lib/webhook-event-catalog'
import { cn } from '@/lib/utils'

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async.
const idleState: WebhookEndpointActionState = { status: 'idle', message: null, secret: null }

export type WebhookEndpointRow = {
  id: string
  url: string
  events: WebhookEvent[]
  isActive: boolean
  maskedSecret: string
  createdAt: string
}

function EventsCheckboxGroup({ name, defaultValues }: { name: string; defaultValues?: WebhookEvent[] }) {
  const defaults = new Set(defaultValues ?? [])
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {WEBHOOK_EVENTS.map((event) => (
        <label key={event} className="flex items-center gap-2 text-sm">
          <Checkbox name={name} value={event} defaultChecked={defaults.has(event)} />
          {WEBHOOK_EVENT_LABELS[event]}
        </label>
      ))}
    </div>
  )
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
      {pending ? pendingLabel : label}
    </Button>
  )
}

function CreateEndpointForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction] = useActionState(createWebhookEndpointAction, idleState)
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <form
        action={(formData) => {
          setCopied(false)
          return formAction(formData)
        }}
        className="space-y-3"
      >
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <div className="space-y-1.5">
          <Label htmlFor="url" className="text-xs">URL do endpoint</Label>
          <Input id="url" name="url" type="url" placeholder="https://exemplo.com/webhooks/inventario" required className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Eventos</Label>
          <EventsCheckboxGroup name="events" />
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton label="Cadastrar webhook" pendingLabel="Cadastrando..." />
          {state.status === 'error' && <p className="text-xs text-destructive">{state.message}</p>}
        </div>
      </form>

      {state.status === 'success' && state.secret && (
        <div className="space-y-2 rounded-md border border-warning/30 bg-warning/10 p-3">
          <p className="text-xs font-medium text-warning">
            Copie o segredo agora — ele não será exibido novamente.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">{state.secret}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                void navigator.clipboard?.writeText(state.secret ?? '')
                setCopied(true)
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleSubmitButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        isActive
          ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
          : 'border-dashed text-muted-foreground hover:bg-muted'
      )}
    >
      {isActive ? 'Ativo' : 'Desativado'}
    </button>
  )
}

function ToggleEndpointButton({ tenantSlug, endpointId, isActive }: { tenantSlug: string; endpointId: string; isActive: boolean }) {
  const [, formAction] = useActionState(toggleWebhookEndpointAction, idleState)
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="endpointId" value={endpointId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <ToggleSubmitButton isActive={isActive} />
    </form>
  )
}

function EditEndpointForm({ tenantSlug, endpoint, onDone }: { tenantSlug: string; endpoint: WebhookEndpointRow; onDone: () => void }) {
  const [state, formAction] = useActionState(updateWebhookEndpointAction, idleState)

  // Efeito (nao durante o render) para nao atualizar o estado do componente
  // PAI (onDone -> setEditing) enquanto este componente filho ainda esta
  // renderizando — mesmo motivo pelo qual formatRelative/computeCheckinLatency
  // em outros pontos do projeto isolam efeitos colaterais do corpo do render.
  useEffect(() => {
    if (state.status === 'success') onDone()
  }, [state.status, onDone])

  return (
    <form action={formAction} className="space-y-3 border-t p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="endpointId" value={endpoint.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`url-${endpoint.id}`} className="text-xs">URL do endpoint</Label>
        <Input id={`url-${endpoint.id}`} name="url" type="url" defaultValue={endpoint.url} required className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Eventos</Label>
        <EventsCheckboxGroup name="events" defaultValues={endpoint.events} />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton label="Salvar" pendingLabel="Salvando..." />
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        {state.status === 'error' && <p className="text-xs text-destructive">{state.message}</p>}
      </div>
    </form>
  )
}

function EndpointRow({ tenantSlug, endpoint }: { tenantSlug: string; endpoint: WebhookEndpointRow }) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{endpoint.url}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.events.map((event) => WEBHOOK_EVENT_LABELS[event] ?? event).join(', ')}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{endpoint.maskedSecret}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToggleEndpointButton tenantSlug={tenantSlug} endpointId={endpoint.id} isActive={endpoint.isActive} />
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Editar webhook"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
      {editing && <EditEndpointForm tenantSlug={tenantSlug} endpoint={endpoint} onDone={() => setEditing(false)} />}
    </div>
  )
}

export function WebhookEndpointsPanel({ tenantSlug, endpoints }: { tenantSlug: string; endpoints: WebhookEndpointRow[] }) {
  return (
    <div className="space-y-4">
      <CreateEndpointForm tenantSlug={tenantSlug} />

      {endpoints.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> Nenhum webhook cadastrado ainda.
        </p>
      ) : (
        <div className="divide-y divide-surface-line">
          {endpoints.map((endpoint) => (
            <EndpointRow key={endpoint.id} tenantSlug={tenantSlug} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  )
}
