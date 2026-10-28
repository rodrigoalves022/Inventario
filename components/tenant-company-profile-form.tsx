'use client'

import { useActionState, useId } from 'react'
import { Loader2 } from 'lucide-react'
import {
  updateTenantCompanyProfileAction,
  type CompanyProfileActionState,
  type CompanyProfileData,
} from '@/app/app/[clientSlug]/settings/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const IDLE: CompanyProfileActionState = { status: 'idle', message: null }

type ProfileKey = Exclude<keyof CompanyProfileData, 'updatedAt'>

const COMPANY_FIELDS: Array<{ name: ProfileKey; label: string; placeholder?: string; mono?: boolean; type?: string }> = [
  { name: 'legalName', label: 'Razão Social / Nome Corporativo' },
  { name: 'taxId', label: 'CNPJ / Identificação Fiscal', placeholder: '00.000.000/0001-00', mono: true },
  { name: 'sector', label: 'Setor / Segmento', placeholder: 'Ex.: Financeiro, Saúde, Indústria' },
  {
    name: 'maintenanceWindow',
    label: 'Janela Preferencial de Manutenção',
    placeholder: 'Ex.: Domingos 02:00 às 06:00 (BRT)',
  },
]

const NOC_FIELDS: typeof COMPANY_FIELDS = [
  { name: 'nocContactName', label: 'Responsável Técnico / Plantonista' },
  { name: 'nocContactEmail', label: 'E-mail de Escalonamento Crítico', type: 'email' },
  { name: 'nocContactPhone', label: 'Telefone / WhatsApp de Emergência', type: 'tel', mono: true },
]

function formatUpdatedAt(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function ProfileField({
  field,
  defaultValue,
}: {
  field: (typeof COMPANY_FIELDS)[number]
  defaultValue: string
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        name={field.name}
        type={field.type ?? 'text'}
        defaultValue={defaultValue}
        placeholder={field.placeholder}
        required={field.name === 'legalName'}
        className={cn(field.mono && 'data-mono')}
      />
    </div>
  )
}

function ReadOnlyList({ fields, data }: { fields: typeof COMPANY_FIELDS; data: CompanyProfileData }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.name} className="min-w-0 space-y-0.5">
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className={cn('truncate text-sm text-foreground', field.mono && 'data-mono')}>
            {data[field.name] || '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Sprint V24: dados corporativos e contatos de emergencia NOC do tenant.
 * Quem nao pode gerenciar alertas do tenant (mesmo guard da action) ve so a
 * leitura — a action recusa de novo no servidor de qualquer forma.
 */
export function TenantCompanyProfileForm({
  tenantSlug,
  initialData,
  canManage,
}: {
  tenantSlug: string
  initialData: CompanyProfileData
  canManage: boolean
}) {
  const [state, formAction, pending] = useActionState(updateTenantCompanyProfileAction, IDLE)
  const updatedAt = formatUpdatedAt(initialData.updatedAt)

  if (!canManage) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline">Somente leitura</Badge>
          {updatedAt && <p className="text-xs text-muted-foreground">Atualizado em {updatedAt}</p>}
        </div>
        <ReadOnlyList fields={COMPANY_FIELDS} data={initialData} />
        <div className="space-y-3">
          <h3 className="section-label">Contato Técnico de Emergência / NOC 24x7</h3>
          <ReadOnlyList fields={NOC_FIELDS} data={initialData} />
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5" aria-label="Dados da empresa">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <div className="grid gap-4 sm:grid-cols-2">
        {COMPANY_FIELDS.map((field) => (
          <ProfileField key={field.name} field={field} defaultValue={initialData[field.name]} />
        ))}
      </div>
      <fieldset className="space-y-3">
        <legend className="section-label mb-3">Contato Técnico de Emergência / NOC 24x7</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {NOC_FIELDS.map((field) => (
            <ProfileField key={field.name} field={field} defaultValue={initialData[field.name]} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={cn('min-h-5 text-xs', state.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {state.message ?? (updatedAt ? `Atualizado em ${updatedAt}` : null)}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar dados da empresa
        </Button>
      </div>
    </form>
  )
}
