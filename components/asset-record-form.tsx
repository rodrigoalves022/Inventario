'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusPill } from '@/components/ui/status-pill'
import { Textarea } from '@/components/ui/textarea'
import {
  saveAssetRecordAction,
  type AssetRecordActionState,
} from '@/app/app/[clientSlug]/assets/[id]/actions'

const initialState: AssetRecordActionState = { status: 'idle', message: null }

export type AssetRecordValues = {
  etiqueta: string | null
  dataCompra: string | null
  notaFiscal: string | null
  fornecedor: string | null
  valor: number | null
  garantiaAte: string | null
  centroCusto: string | null
  localizacao: string | null
  responsavel: string | null
  observacoes: string | null
}

function toDateInputValue(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

export type WarrantyStatus = 'none' | 'active' | 'expiring_soon' | 'expired'

export function evaluateWarrantyStatus(
  garantiaAteIso: string | null,
  now: Date = new Date()
): { status: WarrantyStatus; daysRemaining: number | null; label: string } {
  if (!garantiaAteIso) {
    return { status: 'none', daysRemaining: null, label: 'Sem data de garantia informada' }
  }
  const target = new Date(garantiaAteIso)
  const daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining, label: `Garantia vencida há ${Math.abs(daysRemaining)} dia(s)` }
  }
  if (daysRemaining <= 30) {
    return { status: 'expiring_soon', daysRemaining, label: `Garantia vence em ${daysRemaining} dia(s)` }
  }
  return { status: 'active', daysRemaining, label: `Garantia ativa (${daysRemaining} dia(s) restantes)` }
}

const WARRANTY_TONE = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'destructive',
} as const

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Save className="h-4 w-4" />
      {pending ? 'Salvando...' : 'Salvar patrimônio'}
    </Button>
  )
}

export function AssetRecordForm({
  tenantSlug,
  deviceId,
  values,
}: {
  tenantSlug: string
  deviceId: string
  values: AssetRecordValues
}) {
  const [state, formAction] = useActionState(saveAssetRecordAction, initialState)
  const warranty = evaluateWarrantyStatus(values.garantiaAte)

  return (
    <form action={formAction} className="space-y-6">
      {values.garantiaAte && warranty.status !== 'none' && (
        <StatusPill tone={WARRANTY_TONE[warranty.status]} label={warranty.label} />
      )}
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="deviceId" value={deviceId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="etiqueta" className="text-xs">Etiqueta de patrimônio</Label>
          <Input id="etiqueta" name="etiqueta" maxLength={100} defaultValue={values.etiqueta ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dataCompra" className="text-xs">Data de compra</Label>
          <Input id="dataCompra" name="dataCompra" type="date" defaultValue={toDateInputValue(values.dataCompra)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notaFiscal" className="text-xs">Nota fiscal</Label>
          <Input id="notaFiscal" name="notaFiscal" maxLength={100} defaultValue={values.notaFiscal ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fornecedor" className="text-xs">Fornecedor</Label>
          <Input id="fornecedor" name="fornecedor" maxLength={255} defaultValue={values.fornecedor ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor" className="text-xs">Valor (R$)</Label>
          <Input id="valor" name="valor" type="number" min={0} max={100_000_000} step="0.01" defaultValue={values.valor ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="garantiaAte" className="text-xs">Garantia até</Label>
          <Input id="garantiaAte" name="garantiaAte" type="date" defaultValue={toDateInputValue(values.garantiaAte)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="centroCusto" className="text-xs">Centro de custo</Label>
          <Input id="centroCusto" name="centroCusto" maxLength={100} defaultValue={values.centroCusto ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="localizacao" className="text-xs">Localização</Label>
          <Input id="localizacao" name="localizacao" maxLength={255} defaultValue={values.localizacao ?? ''} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="responsavel" className="text-xs">Responsável</Label>
          <Input id="responsavel" name="responsavel" maxLength={255} defaultValue={values.responsavel ?? ''} className="h-9" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes" className="text-xs">Observações</Label>
        <Textarea id="observacoes" name="observacoes" maxLength={2000} defaultValue={values.observacoes ?? ''} rows={3} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <p className={`text-xs ${state.status === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {state.message ?? 'Preenchimento manual — nunca sobrescrito por uma coleta do agente.'}
        </p>
        <SubmitButton />
      </div>
    </form>
  )
}
