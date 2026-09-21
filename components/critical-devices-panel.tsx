import Link from 'next/link'
import { ArrowRight, HardDrive, ShieldCheck, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeAge } from '@/lib/dashboard/fleet-overview'
import type { DeviceReportRow } from '@/lib/reports/device-report'
import { Panel, PanelFooter, PanelHeader } from '@/components/ui/panel'

/**
 * Painel esquerdo do bloco duplo do dashboard (Overhaul visual — Fase 4):
 * maquinas que exigem acao agora.
 *
 * Duas condicoes, as duas pedidas no escopo, as duas vindas de dado que a base
 * ja calcula — o painel nao reavalia nenhum limiar:
 *
 * - POUCO DISCO: `DeviceReportRow.criticalDisks`, que `getDeviceReportRows` ja
 *   filtra por `alertDiskThresholdGb` do proprio tenant.
 * - COLETA ATRASADA: `DeviceReportRow.status === 'offline'`, ou seja o STATUS
 *   EFETIVO que `getRowEffectiveStatus` produz com o `alertOfflineHours` do
 *   tenant (RN010 — derivado da ultima coleta, nunca do `Device.status` bruto).
 *   Derivar "atrasado" de novo aqui, com uma segunda conta de horas, faria o
 *   painel divergir do card de KPI e da listagem `/assets?status=offline` que
 *   ele leva — o mesmo dispositivo apareceria atrasado num lugar e nao no
 *   outro.
 */

export type CriticalDeviceReasonCode = 'stale_collection' | 'low_disk'

export type CriticalDeviceReason = {
  code: CriticalDeviceReasonCode
  label: string
  detail: string
}

export type CriticalDeviceEntry = {
  hostname: string
  href: string
  reasons: CriticalDeviceReason[]
}

type CriticalSourceRow = Pick<DeviceReportRow, 'hostname' | 'status' | 'ultimaColeta' | 'criticalDisks'>

/** Menor espaco livre entre os discos criticos do device — e' o numero que
 * decide quem aparece primeiro na lista. `null` quando o device nao tem disco
 * critico (ou nenhum deles reportou espaco livre). */
function getLowestFreeGb(row: CriticalSourceRow): number | null {
  const values = row.criticalDisks
    .map((disk) => disk.espacoLivreGb)
    .filter((value): value is number => typeof value === 'number')
  return values.length > 0 ? Math.min(...values) : null
}

function buildLowDiskReason(row: CriticalSourceRow): CriticalDeviceReason | null {
  if (row.criticalDisks.length === 0) return null

  const lowest = row.criticalDisks.reduce((worst, disk) => {
    if (worst === null) return disk
    const worstFree = worst.espacoLivreGb ?? Number.POSITIVE_INFINITY
    const diskFree = disk.espacoLivreGb ?? Number.POSITIVE_INFINITY
    return diskFree < worstFree ? disk : worst
  }, null as CriticalSourceRow['criticalDisks'][number] | null)

  if (!lowest) return null

  const unidade = lowest.unidade ?? 'disco'
  const livre = lowest.espacoLivreGb === null ? 'espaço livre não apurado' : `${lowest.espacoLivreGb} GB livres`
  const outros = row.criticalDisks.length - 1

  return {
    code: 'low_disk',
    label: 'Pouco disco',
    detail: `${unidade} com ${livre}${outros > 0 ? ` · mais ${outros} disco${outros === 1 ? '' : 's'} abaixo do limiar` : ''}`,
  }
}

function buildStaleReason(row: CriticalSourceRow, now: Date): CriticalDeviceReason | null {
  if (row.status !== 'offline') return null

  return {
    code: 'stale_collection',
    label: 'Sem coleta recente',
    detail: row.ultimaColeta ? `última coleta ${formatRelativeAge(row.ultimaColeta, now)}` : 'nunca coletou',
  }
}

/**
 * Ordena por quem dói mais: as duas condicoes juntas primeiro, depois coleta
 * atrasada (a maquina esta fora de contato — nenhum outro dado dela e'
 * confiavel), depois pouco disco pelo menor espaco livre. Empate resolvido por
 * hostname para a lista nao dancar entre dois renders com o mesmo dado.
 */
export function buildCriticalDeviceEntries(input: {
  rows: CriticalSourceRow[]
  now: Date
  resolveHref: (hostname: string) => string
  limit?: number
}): { entries: CriticalDeviceEntry[]; totalCritical: number } {
  const { rows, now, resolveHref, limit = 6 } = input

  const scored = rows
    .map((row) => {
      const reasons = [buildStaleReason(row, now), buildLowDiskReason(row)].filter(
        (reason): reason is CriticalDeviceReason => reason !== null
      )
      return { row, reasons, lowestFreeGb: getLowestFreeGb(row) }
    })
    .filter((candidate) => candidate.reasons.length > 0)

  scored.sort((left, right) => {
    if (right.reasons.length !== left.reasons.length) return right.reasons.length - left.reasons.length

    const leftStale = left.reasons.some((reason) => reason.code === 'stale_collection')
    const rightStale = right.reasons.some((reason) => reason.code === 'stale_collection')
    if (leftStale !== rightStale) return leftStale ? -1 : 1

    const leftFree = left.lowestFreeGb ?? Number.POSITIVE_INFINITY
    const rightFree = right.lowestFreeGb ?? Number.POSITIVE_INFINITY
    if (leftFree !== rightFree) return leftFree - rightFree

    return left.row.hostname.localeCompare(right.row.hostname)
  })

  return {
    totalCritical: scored.length,
    entries: scored.slice(0, limit).map((candidate) => ({
      hostname: candidate.row.hostname,
      href: resolveHref(candidate.row.hostname),
      reasons: candidate.reasons,
    })),
  }
}

const REASON_ICON: Record<CriticalDeviceReasonCode, React.ComponentType<{ className?: string }>> = {
  stale_collection: WifiOff,
  low_disk: HardDrive,
}

export function CriticalDevicesPanel({
  entries,
  totalCritical,
  alertDiskThresholdGb,
  alertOfflineHours,
  allDevicesHref,
}: {
  entries: CriticalDeviceEntry[]
  /** Total de maquinas na condicao — pode ser maior que `entries.length`, que
   * e' so a fatia mostrada. O rodape diz explicitamente quantas ficaram de
   * fora, para o painel nao parecer a lista completa. */
  totalCritical: number
  alertDiskThresholdGb: number
  alertOfflineHours: number
  allDevicesHref: string
}) {
  const hidden = Math.max(totalCritical - entries.length, 0)

  return (
    <Panel aria-labelledby="critical-devices-title" className="flex h-full flex-col">
      <PanelHeader>
        <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="critical-devices-title" className="text-base font-semibold text-card-foreground">
            Dispositivos em alerta crítico
          </h2>
          <p className="text-sm text-muted-foreground">
            Menos de {alertDiskThresholdGb} GB livres em algum disco, ou sem coleta há {alertOfflineHours}h ou
            mais.
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-1 text-sm font-bold tabular-nums',
            totalCritical > 0
              ? 'border-destructive/35 bg-destructive/10 text-destructive'
              : 'border-success/35 bg-success/10 text-success'
          )}
        >
          {totalCritical}
        </span>
        </div>
      </PanelHeader>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t border-surface-line px-5 py-10 text-center">
          <ShieldCheck className="h-6 w-6 text-success" />
          <p className="text-sm font-medium text-foreground">Nenhuma máquina em alerta crítico</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Os limiares vêm das configurações de alerta deste tenant e podem ser ajustados em Computadores →
            Configurações de Alerta.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-surface-line border-t border-surface-line">
          {entries.map((entry) => (
            <li key={entry.hostname}>
              <Link
                href={entry.href}
                className="row-interactive flex items-start justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 space-y-1.5">
                  <p className="data-mono truncate text-sm font-medium text-foreground">{entry.hostname}</p>
                  <div className="flex flex-col gap-1">
                    {entry.reasons.map((reason) => {
                      const Icon = REASON_ICON[reason.code]
                      return (
                        <span
                          key={reason.code}
                          className="flex items-center gap-1.5 text-xs text-destructive"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-semibold">{reason.label}</span>
                          <span className="text-muted-foreground">· {reason.detail}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <PanelFooter>
          <Link
            href={allDevicesHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver as outras {hidden} máquinas em alerta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </PanelFooter>
      ) : null}
    </Panel>
  )
}
