'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  HardDrive,
  Search,
  TriangleAlert,
  Wifi,
  WifiOff,
  Monitor,
  Activity,
  History
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SummaryCard } from '@/components/ui/summary-card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { CLICKABLE_ROW_CLASS } from '@/lib/table-styles'
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

function getStatusBadge(status: TenantComputerRow['effectiveStatus']) {
  if (status === 'offline') return 'bg-destructive/10 text-destructive'
  if (status === 'warning') return 'bg-warning/10 text-warning'
  return 'bg-success/10 text-success'
}

/** Compartilhado entre a linha da tabela (desktop) e o card (mobile) — mesmo dado, duas formas. */
function StatusPill({ status }: { status: TenantComputerRow['effectiveStatus'] }) {
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm border ${getStatusBadge(status)}`}
    >
      {status === 'offline' ? <WifiOff className="h-3 w-3" /> : null}
      {status === 'warning' ? <TriangleAlert className="h-3 w-3" /> : null}
      {status === 'online' ? <Wifi className="h-3 w-3" /> : null}
      {status === 'offline' ? 'Desconectado' : status}
    </div>
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
}: {
  devices: TenantComputerRow[]
  initialSearch?: string
  initialStatusFilter?: 'all' | TenantComputerRow['effectiveStatus']
  /** Listagem unificada (`/assets`): mostra a coluna "Tipo" (Computador/Servidor)
   * e generaliza o texto de estado vazio, que por padrao fala em "computador". */
  showTypeColumn?: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<'all' | TenantComputerRow['effectiveStatus']>(initialStatusFilter)
  const [criticalFilter, setCriticalFilter] = useState<'all' | 'low_disk' | 'low_ram' | 'stale_collection'>('all')

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
      <div className="hidden rounded-xl border bg-card overflow-hidden shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Hostname</th>
                {showTypeColumn && (
                  <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Tipo</th>
                )}
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Rede / IP</th>
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">RAM / Disco</th>
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Alertas ativos</th>
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Última Coleta</th>
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={showTypeColumn ? 7 : 6} className="px-5 py-12 text-center">
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
                    <td className="px-5 py-4 font-mono font-medium">
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
                      <td className="px-5 py-4">
                        <DeviceTypeBadge sistema={device.sistema} />
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {device.ip ?? '0.0.0.0'}
                      </code>
                    </td>
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <IssueBadges deviceId={device.id} issues={device.issues} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground tabular-nums">
                      {formatLastCollection(device.lastCollectionAt)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={device.effectiveStatus} />
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
      <div className="rounded-xl border bg-card md:hidden">
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
                    <p className="truncate font-mono font-medium text-foreground">{device.hostname}</p>
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mt-1">
                      {device.sistema ?? 'N/A'}
                    </p>
                  </div>
                  <StatusPill status={device.effectiveStatus} />
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
    </div>
  )
}
