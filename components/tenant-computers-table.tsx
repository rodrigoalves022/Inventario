'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  HardDrive,
  Search,
  TriangleAlert,
  Monitor,
  Activity,
  History
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { SummaryCard } from '@/components/ui/summary-card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BulkCommandBar } from '@/components/bulk-command-bar'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'
import { isServerOperatingSystem } from '@/lib/device-classification'
import type { TenantDeviceRow } from '@/lib/tenant-device-rows'

/** Alias mantido pelo nome historico do componente — o formato da linha e o
 * mesmo usado por qualquer listagem de dispositivo do tenant (computers,
 * assets), definido em lib/tenant-device-rows.ts. */
export type TenantComputerRow = TenantDeviceRow

function formatLastCollection(value: string | null) {
  if (!value) return 'Sem coletas'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

/**
 * Traducao do STATUS EFETIVO (`getEffectiveDeviceStatus`: online | warning |
 * offline — presenca combinada com alertas de disco/RAM) para a pilula
 * compartilhada. O vocabulario continua sendo o desta tela: "offline" aqui e
 * uma falha ativa (tom destructive), diferente do "offline" de PRESENCA usado
 * em /storage, que e apenas ausencia de coleta recente (tom neutral).
 * Compartilhado entre a linha da tabela (desktop) e o card (mobile) — mesmo
 * dado, duas formas.
 */
const STATUS_TONE: Record<TenantComputerRow['effectiveStatus'], StatusPillTone> = {
  online: 'success',
  warning: 'warning',
  offline: 'destructive',
}

function DeviceStatusPill({ status }: { status: TenantComputerRow['effectiveStatus'] }) {
  return (
    <StatusPill
      tone={STATUS_TONE[status]}
      label={status === 'offline' ? 'Desconectado' : status}
    />
  )
}

/** Coluna "Tipo" da listagem unificada (`/assets`) — deriva de `sistema`
 * via `isServerOperatingSystem`, o mesmo dado que ja diferencia /computers de
 * /servers, sem precisar de um campo novo na linha. */
function DeviceTypeBadge({ sistema }: { sistema: string | null }) {
  const isServer = isServerOperatingSystem(sistema)
  return (
    <Badge
      variant="outline"
      className={cn(
        'px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide',
        isServer ? 'border-warning/40 bg-warning/5 text-warning' : 'border-info/40 bg-info/5 text-info'
      )}
    >
      {isServer ? 'Servidor' : 'Computador'}
    </Badge>
  )
}

function IssueBadges({ deviceId, issues }: { deviceId: string; issues: TenantComputerRow['issues'] }) {
  if (issues.length === 0) {
    return <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Saudável</span>
  }
  return (
    <>
      {issues.map((issue) => (
        <Badge
          key={`${deviceId}-${issue.code}`}
          variant="outline"
          className={`px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide transition-all ${
            issue.severity === 'critical'
              ? 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
              : 'border-warning/40 bg-warning/5 text-warning hover:bg-warning/10'
          }`}
          title={issue.message}
        >
          {issue.title}
        </Badge>
      ))}
    </>
  )
}

export function TenantComputersTable({
  devices,
  initialSearch = '',
  initialStatusFilter = 'all',
  showTypeColumn = false,
  tenantSlug,
  canOperate = false,
}: {
  devices: TenantComputerRow[]
  initialSearch?: string
  initialStatusFilter?: 'all' | TenantComputerRow['effectiveStatus']
  /** Listagem unificada (`/assets`): mostra a coluna "Tipo" (Computador/Servidor)
   * e generaliza o texto de estado vazio, que por padrao fala em "computador". */
  showTypeColumn?: boolean
  /** Sprint 12. Seleção múltipla + barra de comando em lote só aparecem
   * quando `tenantSlug` e `canOperate` (canOperateTenant, calculado no Server
   * Component da página) estão presentes — omitidos, a tabela se comporta
   * exatamente como antes (nenhuma checkbox, nenhuma barra flutuante). */
  tenantSlug?: string
  canOperate?: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<'all' | TenantComputerRow['effectiveStatus']>(initialStatusFilter)
  const [criticalFilter, setCriticalFilter] = useState<'all' | 'low_disk' | 'low_ram' | 'stale_collection'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const canBulkOperate = Boolean(tenantSlug && canOperate)

  function toggleSelected(deviceId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(deviceId)
      else next.delete(deviceId)
      return next
    })
  }

  const summary = useMemo(() => ({
    total: devices.length,
    lowDisk: devices.filter((device) => device.issues.some((issue) => issue.code === 'low_disk')).length,
    lowRam: devices.filter((device) => device.issues.some((issue) => issue.code === 'low_ram')).length,
    stale: devices.filter((device) => device.issues.some((issue) => issue.code === 'stale_collection')).length,
    warning: devices.filter((device) => device.effectiveStatus === 'warning').length,
  }), [devices])

  const filteredDevices = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    return devices.filter((device) => {
      const matchesSearch =
        normalized.length === 0 ||
        device.hostname.toLowerCase().includes(normalized) ||
        (device.ip ?? '').toLowerCase().includes(normalized) ||
        (device.sistema ?? '').toLowerCase().includes(normalized) ||
        // Precisa bater em processador tambem: /processors linka pra ca com
        // ?search=<nome do processador> (ver components/tenant-processors-table.tsx).
        (device.processador ?? '').toLowerCase().includes(normalized)

      const matchesStatus = statusFilter === 'all' || device.effectiveStatus === statusFilter
      const matchesCritical =
        criticalFilter === 'all' || device.issues.some((issue) => issue.code === criticalFilter)

      return matchesSearch && matchesStatus && matchesCritical
    })
  }, [criticalFilter, devices, search, statusFilter])

  function toggleCriticalFilter(value: 'low_disk' | 'low_ram' | 'stale_collection') {
    setCriticalFilter((current) => (current === value ? 'all' : value))
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — os 3 de criticidade dobram como filtro, ver SummaryCard */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={<Monitor className="h-4 w-4" />}
          label="Total Máquinas"
          value={summary.total}
          tone="primary"
          active={criticalFilter === 'all'}
          onClick={() => setCriticalFilter('all')}
        />
        <SummaryCard
          icon={<TriangleAlert className="h-4 w-4" />}
          label="Warnings Ativos"
          value={summary.warning}
          tone="warning"
          active={statusFilter === 'warning'}
          onClick={() => setStatusFilter((current) => (current === 'warning' ? 'all' : 'warning'))}
        />
        <SummaryCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Pouco Disco"
          value={summary.lowDisk}
          tone="destructive"
          active={criticalFilter === 'low_disk'}
          onClick={() => toggleCriticalFilter('low_disk')}
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Pouca RAM"
          value={summary.lowRam}
          tone="warning"
          active={criticalFilter === 'low_ram'}
          onClick={() => toggleCriticalFilter('low_ram')}
        />
        <SummaryCard
          icon={<History className="h-4 w-4" />}
          label="Coleta Atrasada"
          value={summary.stale}
          tone="destructive"
          active={criticalFilter === 'stale_collection'}
          onClick={() => toggleCriticalFilter('stale_collection')}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por hostname, IP ou sistema..."
            className="pl-9 h-10 w-full bg-card"
          />
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as any)}
          className="w-full md:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4 h-10">
            <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="online" className="text-xs">Online</TabsTrigger>
            <TabsTrigger value="warning" className="text-xs">Warning</TabsTrigger>
            <TabsTrigger value="offline" className="text-xs">Offline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table — telas md+; abaixo disso vira lista de cards (ver bloco seguinte) */}
      <div className={cn(TABLE_SHELL_CLASS, 'hidden overflow-hidden md:block')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                {canBulkOperate && (
                  <th className={cn(TABLE_HEAD_CLASS, 'w-10')}>
                    <Checkbox
                      aria-label="Selecionar todos os dispositivos visíveis"
                      checked={
                        filteredDevices.length > 0 && filteredDevices.every((device) => selectedIds.has(device.id))
                      }
                      onCheckedChange={(checked) => {
                        setSelectedIds((current) => {
                          const next = new Set(current)
                          if (checked) filteredDevices.forEach((device) => next.add(device.id))
                          else filteredDevices.forEach((device) => next.delete(device.id))
                          return next
                        })
                      }}
                    />
                  </th>
                )}
                <th className={TABLE_HEAD_CLASS}>Hostname</th>
                {showTypeColumn && <th className={TABLE_HEAD_CLASS}>Tipo</th>}
                <th className={TABLE_HEAD_CLASS}>Rede / IP</th>
                <th className={TABLE_HEAD_CLASS}>RAM / Disco</th>
                <th className={TABLE_HEAD_CLASS}>Alertas ativos</th>
                <th className={TABLE_HEAD_CLASS}>Última Coleta</th>
                <th className={TABLE_HEAD_CLASS}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td
                    colSpan={(showTypeColumn ? 7 : 6) + (canBulkOperate ? 1 : 0)}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-20" />
                      <p className="text-base font-medium">
                        {showTypeColumn ? 'Nenhum dispositivo encontrado' : 'Nenhum computador encontrado'}
                      </p>
                      <p className="text-sm">Tente ajustar os filtros ou limpar a busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr
                    key={device.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(device.detailsPath)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(device.detailsPath)
                      }
                    }}
                    className={cn('group', CLICKABLE_ROW_CLASS)}
                  >
                    {canBulkOperate && (
                      // stopPropagation: mesmo padrao do <Link> do hostname abaixo —
                      // marcar a checkbox nao pode disparar a navegacao da linha.
                      <td className={TABLE_CELL_CLASS} onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          aria-label={`Selecionar ${device.hostname}`}
                          checked={selectedIds.has(device.id)}
                          onCheckedChange={(checked) => toggleSelected(device.id, checked === true)}
                        />
                      </td>
                    )}
                    <td className={cn(TABLE_DATA_CELL_CLASS, 'font-medium')}>
                      <Link
                        href={device.detailsPath}
                        onClick={(event) => event.stopPropagation()}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {device.hostname}
                      </Link>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mt-1">
                        {device.sistema ?? 'N/A'}
                      </p>
                    </td>
                    {showTypeColumn && (
                      <td className={TABLE_CELL_CLASS}>
                        <DeviceTypeBadge sistema={device.sistema} />
                      </td>
                    )}
                    <td className={TABLE_CELL_CLASS}>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {device.ip ?? '0.0.0.0'}
                      </code>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <div className={`flex items-center gap-1 ${
                          device.issues.some((issue) => issue.code === 'low_ram') ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          <Activity className="h-3 w-3" />
                          {device.ramTotalGb ? `${device.ramTotalGb}GB` : '—'}
                        </div>
                        <div className={`flex items-center gap-1 ${
                          device.issues.some((issue) => issue.code === 'low_disk') ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          <HardDrive className="h-3 w-3" />
                          {device.lowestDiskFreeGb !== null ? `${device.lowestDiskFreeGb}GB` : device.storageLabel?.split(' ')[0] ?? '—'}
                        </div>
                      </div>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex flex-wrap gap-1.5">
                        <IssueBadges deviceId={device.id} issues={device.issues} />
                      </div>
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground tabular-nums')}>
                      {formatLastCollection(device.lastCollectionAt)}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DeviceStatusPill status={device.effectiveStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards — telas abaixo de md, no lugar da tabela. Mesma linha vira um
          alvo de toque unico (a linha inteira e' um Link), em vez de so o
          hostname como na versao desktop. */}
      <div className={cn(TABLE_SHELL_CLASS, 'md:hidden')}>
        {filteredDevices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 opacity-20" />
            <p className="text-base font-medium">
              {showTypeColumn ? 'Nenhum dispositivo encontrado' : 'Nenhum computador encontrado'}
            </p>
            <p className="text-sm">Tente ajustar os filtros ou limpar a busca.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredDevices.map((device) => (
              <Link
                key={device.id}
                href={device.detailsPath}
                className="block space-y-3 p-4 active:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="data-mono truncate font-medium text-foreground">{device.hostname}</p>
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mt-1">
                      {device.sistema ?? 'N/A'}
                    </p>
                  </div>
                  <DeviceStatusPill status={device.effectiveStatus} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium">
                  {showTypeColumn && <DeviceTypeBadge sistema={device.sistema} />}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {device.ip ?? '0.0.0.0'}
                  </code>
                  <span className={cn(
                    'flex items-center gap-1',
                    device.issues.some((issue) => issue.code === 'low_ram') ? 'text-warning' : 'text-muted-foreground'
                  )}>
                    <Activity className="h-3 w-3" />
                    {device.ramTotalGb ? `${device.ramTotalGb}GB` : '—'}
                  </span>
                  <span className={cn(
                    'flex items-center gap-1',
                    device.issues.some((issue) => issue.code === 'low_disk') ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    <HardDrive className="h-3 w-3" />
                    {device.lowestDiskFreeGb !== null ? `${device.lowestDiskFreeGb}GB` : device.storageLabel?.split(' ')[0] ?? '—'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <IssueBadges deviceId={device.id} issues={device.issues} />
                </div>

                <p className="text-xs text-muted-foreground tabular-nums">
                  Última coleta: {formatLastCollection(device.lastCollectionAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {canBulkOperate && tenantSlug && (
        <BulkCommandBar
          tenantSlug={tenantSlug}
          deviceIds={[...selectedIds]}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  )
}
