'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { HardDrive, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { SummaryCard } from '@/components/ui/summary-card'
import { cn } from '@/lib/utils'
import type { DevicePresence } from '@/lib/inventory-alerts'
import {
  computeDiskUsagePercent,
  getDiskUsageTier,
  DISK_USAGE_SCALE_CLASS,
  DISK_USAGE_THRESHOLDS,
  DISK_USAGE_TIER_TEXT_CLASS,
} from '@/lib/disk-usage'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'

export type TenantStorageDisk = {
  unidade: string | null
  tipo: string | null
  capacidadeGb: number
  usedGb: number
}

export type TenantStorageRow = {
  id: string
  hostname: string
  usuario: string | null
  disks: TenantStorageDisk[]
  types: string[]
  presence: DevicePresence
  detailsPath: string
}

/**
 * Traducao da PRESENCA (`DevicePresence`, derivada da ultima coleta por
 * `getDevicePresence` — nunca do `Device.status` bruto, RN010) para a pilula
 * compartilhada de `components/ui/status-pill.tsx`. O componente e o mesmo de
 * /computers e /servers; o vocabulario, nao: "ausente" continua sendo
 * "ausente" (nao vira "warning"), e "offline" aqui e ausencia de sinal, nao
 * incidente — por isso tom `neutral`, e nao `destructive`.
 */
const PRESENCE_TONE: Record<DevicePresence, StatusPillTone> = {
  online: 'success',
  ausente: 'warning',
  offline: 'neutral',
}

function PresenceBadge({ presence }: { presence: DevicePresence }) {
  return <StatusPill tone={PRESENCE_TONE[presence]} label={presence} />
}

const USAGE_RANGE_LABEL = {
  ok: 'Até 60% usado',
  warning: '60–80% usado',
  critical: 'Acima de 80% usado',
} as const

export function TenantStorageTable({
  devices,
  initialType = 'all',
  initialUsageRange = 'all',
}: {
  devices: TenantStorageRow[]
  initialType?: string
  initialUsageRange?: 'all' | 'ok' | 'warning' | 'critical'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [usageFilter, setUsageFilter] = useState<'all' | 'ok' | 'warning' | 'critical'>(initialUsageRange)

  const types = useMemo(() => {
    const unique = new Set(devices.flatMap((device) => device.types))
    return Array.from(unique).sort()
  }, [devices])

  const rows = useMemo(
    () =>
      devices.map((device) => {
        const diskUsages = device.disks.map((disk) => ({
          ...disk,
          usagePercent: computeDiskUsagePercent(disk.capacidadeGb, disk.usedGb),
        }))
        // Classifica o device pelo PIOR disco (maior % usado / menor % livre),
        // mesmo criterio de "lowestDiskFreeGb" em lib/tenant-device-rows.ts —
        // um device com 1 disco cheio e outro vazio deve aparecer como
        // critico, nao "ok na media".
        const worstUsagePercent = diskUsages.reduce((max, disk) => Math.max(max, disk.usagePercent), 0)
        return { ...device, diskUsages, worstUsagePercent }
      }),
    [devices]
  )

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesType = typeFilter === 'all' || row.types.includes(typeFilter)
      const matchesUsage = usageFilter === 'all' || getDiskUsageTier(row.worstUsagePercent) === usageFilter
      return matchesType && matchesUsage
    })
  }, [rows, typeFilter, usageFilter])

  /**
   * Contagens dos cards de KPI. Duas propriedades que o grid precisa ter para
   * nao mentir:
   *
   * 1. `total === ok + warning + critical` — `getDiskUsageTier` classifica todo
   *    device em exatamente um tier (<=60 / 60–80 / >80), pelo PIOR disco, e
   *    nenhum device com disco fica de fora.
   * 2. o numero do card e' exatamente a populacao que aparece ao clica-lo — por
   *    isso a base e' `rows` ja restrito pelo filtro de TIPO ativo (a outra
   *    dimensao, que continua nas badges). Com `?tipo=SSD` ligado, "Critico"
   *    conta os criticos entre os SSD, que e' o que a lista vai mostrar.
   */
  const usageSummary = useMemo(() => {
    const scoped = rows.filter((row) => typeFilter === 'all' || row.types.includes(typeFilter))
    const counts = { total: scoped.length, ok: 0, warning: 0, critical: 0 }
    for (const row of scoped) counts[getDiskUsageTier(row.worstUsagePercent)] += 1
    return counts
  }, [rows, typeFilter])

  function syncUrl(nextType: string, nextUsage: 'all' | 'ok' | 'warning' | 'critical') {
    const params = new URLSearchParams()
    if (nextType !== 'all') params.set('tipo', nextType)
    if (nextUsage !== 'all') params.set('faixa', nextUsage)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  function applyTypeFilter(type: string) {
    const next = typeFilter === type ? 'all' : type
    setTypeFilter(next)
    syncUrl(next, usageFilter)
  }

  function applyUsageFilter(usage: 'ok' | 'warning' | 'critical') {
    const next = usageFilter === usage ? 'all' : usage
    setUsageFilter(next)
    syncUrl(typeFilter, next)
  }

  /** Card "Total de Dispositivos" — limpa a faixa, mantendo o filtro de tipo
   * (mesmo papel do card "Total Máquinas" em TenantComputersTable). */
  function clearUsageFilter() {
    setUsageFilter('all')
    syncUrl(typeFilter, 'all')
  }

  return (
    <div className="space-y-6">
      {/* Cards de KPI — os 3 de faixa dobram como filtro (?faixa=) e o card
          "Total" limpa a faixa. A antiga fileira de badges de faixa saiu: com
          os cards, seriam duas UIs mostrando o mesmo numero e aplicando o mesmo
          filtro (ver doc de SummaryCard). As badges de TIPO abaixo ficam — sao
          outra dimensao, sem card correspondente. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          testId="usage-card-all"
          icon={<HardDrive className="h-4 w-4" />}
          label="Total de Dispositivos"
          value={usageSummary.total}
          tone="primary"
          active={usageFilter === 'all'}
          onClick={clearUsageFilter}
        />
        <SummaryCard
          testId="usage-card-ok"
          icon={<HardDrive className="h-4 w-4" />}
          label={`Normal (${USAGE_RANGE_LABEL.ok})`}
          value={usageSummary.ok}
          tone="success"
          active={usageFilter === 'ok'}
          onClick={() => applyUsageFilter('ok')}
        />
        <SummaryCard
          testId="usage-card-warning"
          icon={<HardDrive className="h-4 w-4" />}
          label={`Em Alerta (${USAGE_RANGE_LABEL.warning})`}
          value={usageSummary.warning}
          tone="warning"
          active={usageFilter === 'warning'}
          onClick={() => applyUsageFilter('warning')}
        />
        <SummaryCard
          testId="usage-card-critical"
          icon={<HardDrive className="h-4 w-4" />}
          label={`Crítico (${USAGE_RANGE_LABEL.critical})`}
          value={usageSummary.critical}
          tone="destructive"
          active={usageFilter === 'critical'}
          onClick={() => applyUsageFilter('critical')}
        />
      </div>

      {/* Filtro por tipo de disco — clicavel, refletido na URL (?tipo=) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            role="button"
            tabIndex={0}
            onClick={() => applyTypeFilter('all')}
            className={cn(
              'cursor-pointer px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
              typeFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            Todos os tipos
          </Badge>
          {types.map((type) => (
            <Badge
              key={type}
              data-testid={`type-filter-${type}`}
              variant="outline"
              role="button"
              tabIndex={0}
              onClick={() => applyTypeFilter(type)}
              className={cn(
                'cursor-pointer px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                typeFilter === type ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/40' : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <Search className="h-6 w-6 opacity-30" />
          {devices.length === 0
            ? 'Nenhum dispositivo com discos reportados no cliente selecionado.'
            : 'Nenhum dispositivo encontrado para os filtros selecionados.'}
        </div>
      ) : (
        <div className={cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CLASS}>Hostname</th>
                  <th className={TABLE_HEAD_CLASS}>Usuário</th>
                  <th className={TABLE_HEAD_CLASS}>Disco</th>
                  <th className={TABLE_HEAD_CLASS}>Uso</th>
                  <th className={TABLE_HEAD_CLASS}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((device) => {
                  const diskCount = device.diskUsages.length
                  return (
                    <tr key={device.id} className={STATIC_ROW_HOVER_CLASS}>
                      <td className={cn(TABLE_DATA_CELL_CLASS, 'font-medium')}>
                        <Link href={device.detailsPath} className="text-foreground transition-colors hover:text-primary">
                          {device.hostname}
                        </Link>
                      </td>
                      <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{device.usuario ?? '—'}</td>
                      <td className={TABLE_CELL_CLASS}>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <HardDrive className="h-3 w-3" />
                          {device.types.length > 0 ? device.types.join(', ') : 'N/A'} · {diskCount} disco{diskCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <div className="min-w-[10rem] space-y-2">
                          {device.diskUsages.map((disk, index) => {
                            const tier = getDiskUsageTier(disk.usagePercent)
                            const label = disk.unidade ?? `Disco ${index + 1}`
                            return (
                              <div key={`${device.id}-disk-${index}`} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {label}: {disk.usedGb} GB de {disk.capacidadeGb} GB
                                  </span>
                                  <span className={cn('font-semibold', DISK_USAGE_TIER_TEXT_CLASS[tier])}>{disk.usagePercent}%</span>
                                </div>
                                {/* Medidor de uso. O gradiente pinta a escala INTEIRA
                                    (0–100%) e a barra e' um recorte dela no percentual do
                                    disco — por isso `clipPath` em vez de `width`: a cor
                                    numa posicao significa sempre a mesma coisa, entre
                                    discos e entre linhas. As duas marcas verticais ficam
                                    exatamente em DISK_USAGE_THRESHOLDS (60% / 80%), a
                                    mesma fonte de verdade de `getDiskUsageTier`, para que
                                    marca e cor nunca possam divergir do tier calculado. */}
                                <div
                                  className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
                                  role="img"
                                  aria-label={`${label}: ${disk.usagePercent}% usado`}
                                >
                                  <div
                                    className={cn('absolute inset-0', DISK_USAGE_SCALE_CLASS)}
                                    style={{ clipPath: `inset(0 ${100 - Math.min(disk.usagePercent, 100)}% 0 0)` }}
                                  />
                                  <span className="disk-usage-mark" style={{ left: `${DISK_USAGE_THRESHOLDS.warning}%` }} />
                                  <span className="disk-usage-mark" style={{ left: `${DISK_USAGE_THRESHOLDS.critical}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <PresenceBadge presence={device.presence} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
