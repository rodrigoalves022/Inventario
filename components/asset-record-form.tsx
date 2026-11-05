'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { DollarSign, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusPill } from '@/components/ui/status-pill'
import { Textarea } from '@/components/ui/textarea'
import {
  saveAssetRecordAction,
  type AssetRecordActionState,
} from '@/app/app/[clientSlug]/assets/[id]/actions'
import {
  calculateAssetDepreciation,
  formatBRL,
  LIFECYCLE_STATUS_LABELS,
  LIFECYCLE_STATUS_BADGE_CLASS,
  type AssetLifecycleStatus,
} from '@/lib/asset-depreciation'

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
  lifecycleStatus?: string | null
  usefulLifeMonths?: number | null
  salvageValue?: number | null
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

  const currentLifecycle = (values.lifecycleStatus || 'IN_USE') as AssetLifecycleStatus
  const lifecycleBadge = LIFECYCLE_STATUS_BADGE_CLASS[currentLifecycle] || LIFECYCLE_STATUS_BADGE_CLASS.IN_USE
  const lifecycleLabel = LIFECYCLE_STATUS_LABELS[currentLifecycle] || currentLifecycle

  const depreciation = calculateAssetDepreciation({
    purchaseCost: values.valor,
    purchaseDate: values.dataCompra,
    usefulLifeMonths: values.usefulLifeMonths,
    salvageValue: values.salvageValue,
  })

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${lifecycleBadge}`}>
          {lifecycleLabel}
        </span>
        {values.garantiaAte && warranty.status !== 'none' && (
          <StatusPill tone={WARRANTY_TONE[warranty.status]} label={warranty.label} />
        )}
      </div>

      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="deviceId" value={deviceId} />

      {/* Snapshot Financeiro & Depreciação Contábil */}
      <div className="rounded-xl border border-surface-line bg-secondary/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span>Apuração Contábil & Depreciação Linear (ITAM)</span>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Valor de Aquisição</p>
            <p className="text-sm font-semibold text-foreground">{formatBRL(depreciation.purchaseCost)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Depreciação Acumulada</p>
            <p className="text-sm font-semibold text-amber-400">
              {formatBRL(depreciation.accumulatedDepreciation)}
              <span className="text-[10px] ml-1 text-muted-foreground">({depreciation.percentageDepreciated}%)</span>
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Valor Residual Estimado</p>
            <p className="text-sm font-semibold text-muted-foreground">{formatBRL(depreciation.salvageValue)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">Valor Contábil Líquido Atual</p>
            <p className="text-sm font-bold text-emerald-400">
              {formatBRL(depreciation.currentBookValue)}
              {depreciation.isFullyDepreciated && (
                <span className="ml-1.5 rounded bg-muted/60 px-1 py-0.2 text-[9px] font-normal text-muted-foreground">
                  Totalmente Depreciado
                </span>
              )}
            </p>
          </div>
        </div>

        {depreciation.hasCost && (
          <div className="pt-2 border-t border-surface-line flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <span>
              Decorrido: <strong className="text-foreground">{depreciation.monthsElapsed}</strong> de{' '}
              <strong className="text-foreground">{depreciation.usefulLifeMonths}</strong> meses (cotas de{' '}
              {formatBRL(depreciation.monthlyDepreciationAmount)}/mês)
            </span>
            <div className="w-36 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${depreciation.percentageDepreciated}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="lifecycleStatus" className="text-xs">Status do Ciclo de Vida</Label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={values.lifecycleStatus ?? 'IN_USE'}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="IN_USE">Em Uso (Ativo operacional)</option>
            <option value="IN_STOCK">Em Estoque (Reserva técnica)</option>
            <option value="IN_MAINTENANCE">Em Manutenção (Laboratório/Reparo)</option>
            <option value="ON_LOAN">Empréstimo (Home Office/Temporário)</option>
            <option value="DISPOSED">Baixado / Descartado</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="etiqueta" className="text-xs">Etiqueta de patrimônio</Label>
          <Input id="etiqueta" name="etiqueta" maxLength={100} defaultValue={values.etiqueta ?? ''} className="h-9" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dataCompra" className="text-xs">Data de compra</Label>
          <Input id="dataCompra" name="dataCompra" type="date" defaultValue={toDateInputValue(values.dataCompra)} className="h-9" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="valor" className="text-xs">Valor de compra (R$)</Label>
          <Input id="valor" name="valor" type="number" min={0} max={100_000_000} step="0.01" defaultValue={values.valor ?? ''} className="h-9" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="usefulLifeMonths" className="text-xs">Vida útil contábil (meses)</Label>
          <Input
            id="usefulLifeMonths"
            name="usefulLifeMonths"
            type="number"
            min={1}
            max={600}
            defaultValue={values.usefulLifeMonths ?? 60}
            placeholder="60 (5 anos)"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="salvageValue" className="text-xs">Valor residual final (R$)</Label>
          <Input
            id="salvageValue"
            name="salvageValue"
            type="number"
            min={0}
            step="0.01"
            defaultValue={values.salvageValue ?? 0}
            placeholder="0.00"
            className="h-9"
          />
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
