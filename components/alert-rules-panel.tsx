'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createAlertRuleAction,
  deleteAlertRuleAction,
  toggleAlertRuleAction,
  type AlertRuleActionState,
} from '@/app/app/[clientSlug]/alerts/actions'
import { ALERT_METRICS, ALERT_METRIC_LABELS, ALERT_SEVERITIES, type AlertMetric, type AlertSeverity } from '@/lib/alert-rules'
import { cn } from '@/lib/utils'

// Objetos simples, nao podem viver no arquivo "use server" de actions.ts:
// esse tipo de arquivo so pode exportar funcoes async.
const idleState: AlertRuleActionState = { status: 'idle', message: null }

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  warning: 'Atenção',
  critical: 'Crítico',
}

export type AlertRuleRow = {
  id: string
  name: string
  metric: string
  severity: string
  enabled: boolean
  /** Sprint 12. So preenchido para metric === 'software_blacklisted'. */
  pattern?: string | null
}

function CreateRuleForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction] = useActionState(createAlertRuleAction, idleState)
  // Controla a visibilidade do campo "Nome do software": so aparece quando a
  // condicao selecionada e' 'software_blacklisted' (unica metrica de texto
  // livre do catalogo). Precisa de estado porque o <select> de metric era
  // nao-controlado (defaultValue) — sem isso nao ha como reagir a mudanca.
  const [metric, setMetric] = useState<string>(ALERT_METRICS[0])

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">Nome da regra</Label>
        <Input id="name" name="name" placeholder="Ex: Antivírus desligado" className="h-9 w-56" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="metric" className="text-xs">Condição</Label>
        <select
          id="metric"
          name="metric"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={metric}
          onChange={(event) => setMetric(event.target.value)}
        >
          {ALERT_METRICS.map((metricOption) => (
            <option key={metricOption} value={metricOption}>
              {ALERT_METRIC_LABELS[metricOption as AlertMetric]}
            </option>
          ))}
        </select>
      </div>
      {metric === 'software_blacklisted' && (
        <div className="space-y-1.5">
          <Label htmlFor="pattern" className="text-xs">Nome do software</Label>
          <Input
            id="pattern"
            name="pattern"
            placeholder="Ex: uTorrent, AnyDesk, Cheat Engine"
            className="h-9 w-56"
            required
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="severity" className="text-xs">Severidade</Label>
        <select
          id="severity"
          name="severity"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="warning"
        >
          {ALERT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity as AlertSeverity]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" className="gap-1.5">
        <Plus className="h-4 w-4" />
        Adicionar regra
      </Button>
      {state.status === 'error' && <p className="w-full text-xs text-destructive">{state.message}</p>}
    </form>
  )
}

function ToggleSubmitButton({ enabled }: { enabled: boolean }) {
  // useFormStatus so enxerga o <form> quando chamado num componente FILHO
  // dele, nunca no mesmo componente que renderiza o <form> — por isso essa
  // extracao, em vez de ler `pending` direto em ToggleButton.
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        enabled
          ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
          : 'border-dashed text-muted-foreground hover:bg-muted'
      )}
    >
      {enabled ? 'Ativa' : 'Desativada'}
    </button>
  )
}

function ToggleButton({ tenantSlug, ruleId, enabled }: { tenantSlug: string; ruleId: string; enabled: boolean }) {
  const [, formAction] = useActionState(toggleAlertRuleAction, idleState)

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="enabled" value={String(!enabled)} />
      <ToggleSubmitButton enabled={enabled} />
    </form>
  )
}

function DeleteRuleButton({ tenantSlug, ruleId }: { tenantSlug: string; ruleId: string }) {
  const [, formAction] = useActionState(deleteAlertRuleAction, idleState)

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="ruleId" value={ruleId} />
      <button
        type="submit"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label="Excluir regra"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  )
}

export function AlertRulesPanel({ tenantSlug, rules }: { tenantSlug: string; rules: AlertRuleRow[] }) {
  return (
    <div className="space-y-4">
      <CreateRuleForm tenantSlug={tenantSlug} />

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma regra configurada. Sem regras, nada é registrado no histórico abaixo.
        </p>
      ) : (
        <div className="divide-y rounded-xl border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ALERT_METRIC_LABELS[rule.metric as AlertMetric] ?? rule.metric}
                  {rule.pattern ? ` ("${rule.pattern}")` : ''} ·{' '}
                  {SEVERITY_LABELS[rule.severity as AlertSeverity] ?? rule.severity}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ToggleButton tenantSlug={tenantSlug} ruleId={rule.id} enabled={rule.enabled} />
                <DeleteRuleButton tenantSlug={tenantSlug} ruleId={rule.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
