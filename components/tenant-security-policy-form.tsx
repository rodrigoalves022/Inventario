'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  updateTenantSecurityPolicyAction,
  type CompanyProfileActionState,
  type TenantSecurityPolicyData,
} from '@/app/app/[clientSlug]/settings/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const IDLE: CompanyProfileActionState = { status: 'idle', message: null }

type Option = { value: number; label: string }

const SESSION_OPTIONS: Option[] = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 240, label: '4 horas' },
]
const ATTEMPT_OPTIONS: Option[] = [3, 5, 10].map((value) => ({ value, label: `${value} tentativas` }))
const RETENTION_OPTIONS: Option[] = [30, 90, 180, 365].map((value) => ({ value, label: `${value} dias` }))

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function labelOf(options: Option[], value: number) {
  return options.find((option) => option.value === value)?.label ?? String(value)
}

function formatUpdatedAt(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string
  label: string
  options: Option[]
  defaultValue: number
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={SELECT_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Sprint V25: politicas de seguranca do tenant (gravadas via AuditLog, sem
 * schema novo). Quem nao pode gerenciar ve so a leitura; a action recusa de
 * novo no servidor.
 */
export function TenantSecurityPolicyForm({
  tenantSlug,
  initialData,
  canManage,
}: {
  tenantSlug: string
  initialData: TenantSecurityPolicyData
  canManage: boolean
}) {
  const [state, formAction, pending] = useActionState(updateTenantSecurityPolicyAction, IDLE)
  const updatedAt = formatUpdatedAt(initialData.updatedAt)

  if (!canManage) {
    const rows: Array<[string, string]> = [
      ['Expiração de sessão', labelOf(SESSION_OPTIONS, initialData.sessionTimeoutMinutes)],
      ['Máximo de tentativas de login', labelOf(ATTEMPT_OPTIONS, initialData.maxLoginAttempts)],
      ['Lista de IPs permitidos (CIDR)', initialData.ipAllowlistCidr || '—'],
      ['Retenção de auditoria', labelOf(RETENTION_OPTIONS, initialData.auditRetentionDays)],
    ]
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline">Somente leitura</Badge>
          {updatedAt && <p className="text-xs text-muted-foreground">Atualizado em {updatedAt}</p>}
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5" aria-label="Políticas de segurança">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="sessionTimeoutMinutes"
          label="Expiração de sessão"
          options={SESSION_OPTIONS}
          defaultValue={initialData.sessionTimeoutMinutes}
        />
        <SelectField
          name="maxLoginAttempts"
          label="Máximo de tentativas de login"
          options={ATTEMPT_OPTIONS}
          defaultValue={initialData.maxLoginAttempts}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="ipAllowlistCidr">Lista de IPs permitidos (CIDR)</Label>
          <Input
            id="ipAllowlistCidr"
            name="ipAllowlistCidr"
            defaultValue={initialData.ipAllowlistCidr}
            placeholder="203.0.113.0/24, 198.51.100.7"
            className="data-mono"
          />
        </div>
        <SelectField
          name="auditRetentionDays"
          label="Retenção de auditoria"
          options={RETENTION_OPTIONS}
          defaultValue={initialData.auditRetentionDays}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={cn('min-h-5 text-xs', state.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {state.message ?? (updatedAt ? `Atualizado em ${updatedAt}` : null)}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar políticas
        </Button>
      </div>
    </form>
  )
}
