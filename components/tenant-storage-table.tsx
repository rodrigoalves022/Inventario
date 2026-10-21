'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { HardDrive, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { KpiCard } from '@/components/ui/kpi-card'
import { cn } from '@/lib/utils'
import type { DevicePresence } from '@/lib/inventory-alerts'
import {
  computeDiskUsagePercent,
  getDiskUsageTier,
  DISK_USAGE_TIER_BAR_CLASS,
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
import { TablePagination } from '@/components/ui/table-pagination'
import {
  DEFAULT_PAGE_SIZE,
  getPageSlice,
  parsePageNumber,
  parsePageSize,
  type PageSize,
} from '@/lib/table-pagination'

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
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: {
  devices: TenantStorageRow[]
  initialType?: string
  initialUsageRange?: 'all' | 'ok' | 'warning' | 'critical'
  /** Vem de `?page=`/`?limit=` (Overhaul visual — Fase 3). Revalidados aqui
   * tambem, e nao so na page.tsx: entrada de URL nao e' confiavel nem quando
   * so mexe em UI. */
  initialPage?: number
  initialPageSize?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [usageFilter, setUsageFilter] = useState<'all' | 'ok' | 'warning' | 'critical'>(initialUsageRange)
  const [page, setPage] = useState(() => parsePageNumber(initialPage))
  const [pageSize, setPageSize] = useState<PageSize>(() => parsePageSize(initialPageSize))

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

  /**
   * Recorte da pagina. Ordem obrigatoria: filtrar -> contar (`usageSummary`,
   * acima) -> paginar. O rodape conta `filteredRows`, nao `devices`; os cards
   * seguem contando o conjunto do tipo ativo, exatamente como antes.
   */
  const slice = getPageSlice(filteredRows, page, pageSize)

  /**
   * Mecanismo de sincronizacao de URL JA existente nesta tabela (`?tipo=`,
   * `?faixa=`) — `page`/`limit` entraram AQUI em vez de virar um segundo
   * mecanismo (`history.replaceState`) sobrescrevendo este. Default some da
   * URL: `?tipo=SSD` continua sendo `?tipo=SSD`, nao `?tipo=SSD&page=1&limit=25`.
   */
  function syncUrl(
    nextType: string,
    nextUsage: 'all' | 'ok' | 'warning' | 'critical',
    nextPage: number,
    nextPageSize: PageSize
  ) {
    const params = new URLSearchParams()
    if (nextType !== 'all') params.set('tipo', nextType)
    if (nextUsage !== 'all') params.set('faixa', nextUsage)
    if (nextPage > 1) params.set('page', String(nextPage))
    if (nextPageSize !== DEFAULT_PAGE_SIZE) params.set('limit', String(nextPageSize))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  /** Toda troca de filtro volta para a pagina 1 — senao o usuario que estava na
   * pagina 4 de 6 cai numa pagina que o novo recorte nao tem. */
  function applyTypeFilter(type: string) {
    const next = typeFilter === type ? 'all' : type
    setTypeFilter(next)
    setPage(1)
    syncUrl(next, usageFilter, 1, pageSize)
  }

  function applyUsageFilter(usage: 'ok' | 'warning' | 'critical') {
    const next = usageFilter === usage ? 'all' : usage
    setUsageFilter(next)
    setPage(1)
    syncUrl(typeFilter, next, 1, pageSize)
  }

  /** Card "Total de Dispositivos" — limpa a faixa, mantendo o filtro de tipo
   * (mesmo papel do card "Total Máquinas" em TenantComputersTable). */
  function clearUsageFilter() {
    setUsageFilter('all')
    setPage(1)
    syncUrl(typeFilter, 'all', 1, pageSize)
  }

  function changePage(nextPage: number) {
    setPage(nextPage)
    syncUrl(typeFilter, usageFilter, nextPage, pageSize)
  }

  /** Trocar itens por pagina volta para a pagina 1: a pagina 4 de 25-em-25 nao
   * tem equivalente honesto em 100-em-100. */
  function changePageSize(nextPageSize: PageSize) {
    setPageSize(nextPageSize)
    setPage(1)
    syncUrl(typeFilter, usageFilter, 1, nextPageSize)
  }

  return (
    <div className="space-y-6">
      {/* Cards de KPI — os 3 de faixa dobram como filtro (?faixa=) e o card
          "Total" limpa a faixa. A antiga fileira de badges de faixa saiu: com
          os cards, seriam duas UIs mostrando o mesmo numero e aplicando o mesmo
          filtro (ver doc de KpiCard). As badges de TIPO abaixo ficam — sao
          outra dimensao, sem card correspondente. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          testId="usage-card-all"
          icon={<HardDrive />}
          label="Total de Dispositivos"
          value={usageSummary.total}
          tone="primary"
          emphasizeValue
          active={usageFilter === 'all'}
          onClick={clearUsageFilter}
        />
        <KpiCard
          testId="usage-card-ok"
          icon={<HardDrive />}
          label={`Normal (${USAGE_RANGE_LABEL.ok})`}
          value={usageSummary.ok}
          tone="success"
          emphasizeValue
          active={usageFilter === 'ok'}
          onClick={() => applyUsageFilter('ok')}
        />
        <KpiCard
          testId="usage-card-warning"
          icon={<HardDrive />}
          label={`Em Alerta (${USAGE_RANGE_LABEL.warning})`}
          value={usageSummary.warning}
          tone="warning"
          emphasizeValue
          active={usageFilter === 'warning'}
          onClick={() => applyUsageFilter('warning')}
        />
        <KpiCard
          testId="usage-card-critical"
          icon={<HardDrive />}
          label={`Crítico (${USAGE_RANGE_LABEL.critical})`}
          value={usageSummary.critical}
          tone="destructive"
          emphasizeValue
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
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-line p-8 text-center text-muted-foreground">
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
                {slice.items.map((device) => {
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
                                {/* Medidor de uso: preenchimento por `width`, cor chapada
                                    do tier e ponta `rounded-full` propria — nunca um
                                    recorte de gradiente, que deixava aresta reta e cor
                                    misturada na ponta (ver DISK_USAGE_TIER_BAR_CLASS). A
                                    transicao so roda com `motion-safe`. */}
                                <div
                                  className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                                  role="img"
                                  aria-label={`${label}: ${disk.usagePercent}% usado`}
                                >
                                  <div
                                    data-disk-usage-fill
                                    className={cn(
                                      'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out',
                                      DISK_USAGE_TIER_BAR_CLASS[tier]
                                    )}
                                    style={{ width: `${Math.min(Math.max(disk.usagePercent, 0), 100)}%` }}
                                  />
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

          <TablePagination
            slice={slice}
            onPageChange={changePage}
            onPageSizeChange={changePageSize}
            itemNoun={{ one: 'dispositivo', other: 'dispositivos' }}
            navLabel="Paginação dos dispositivos com armazenamento"
          />
        </div>
      )}
    </div>
  )
}
