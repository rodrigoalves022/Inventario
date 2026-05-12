'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { 
  AlertTriangle, 
  HardDrive, 
  Search, 
  ServerCrash, 
  TriangleAlert, 
  Wifi, 
  WifiOff,
  Filter,
  Monitor,
  Activity,
  History
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import type { InventoryIssue } from '@/lib/inventory-alerts'

export type TenantComputerRow = {
  id: string
  hostname: string
  ip: string | null
  sistema: string | null
  processador: string | null
  ramTotalGb: number | null
  lowestDiskFreeGb: number | null
  storageLabel: string | null
  updatedAt: string
  lastCollectionAt: string | null
  effectiveStatus: 'online' | 'warning' | 'offline'
  issues: InventoryIssue[]
  detailsPath: string
}

function formatLastCollection(value: string | null) {
  if (!value) return 'Sem coletas'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function getStatusBadge(status: TenantComputerRow['effectiveStatus']) {
  if (status === 'offline') return 'bg-destructive/10 text-destructive'
  if (status === 'warning') return 'bg-warning/10 text-warning'
  return 'bg-success/10 text-success'
}

export function TenantComputersTable({ devices }: { devices: TenantComputerRow[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TenantComputerRow['effectiveStatus']>('all')
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
        (device.sistema ?? '').toLowerCase().includes(normalized)

      const matchesStatus = statusFilter === 'all' || device.effectiveStatus === statusFilter
      const matchesCritical =
        criticalFilter === 'all' || device.issues.some((issue) => issue.code === criticalFilter)

      return matchesSearch && matchesStatus && matchesCritical
    })
  }, [criticalFilter, devices, search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Monitor className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Máquinas</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-warning/10 p-2 text-warning">
              <TriangleAlert className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warnings Ativos</p>
          </div>
          <p className="text-2xl font-bold text-warning">{summary.warning}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <HardDrive className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pouco Disco</p>
          </div>
          <p className="text-2xl font-bold text-destructive">{summary.lowDisk}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-warning/20 p-2 text-warning">
              <Activity className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pouca RAM</p>
          </div>
          <p className="text-2xl font-bold text-warning">{summary.lowRam}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-destructive/20 p-2 text-destructive">
              <History className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coleta Atrasada</p>
          </div>
          <p className="text-2xl font-bold text-destructive">{summary.stale}</p>
        </div>
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select 
            value={criticalFilter} 
            onValueChange={(v) => setCriticalFilter(v as any)}
          >
            <SelectTrigger className="w-full md:w-[200px] h-10 bg-card">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Criticidade" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sem filtro crítico</SelectItem>
              <SelectItem value="low_disk">Pouco disco</SelectItem>
              <SelectItem value="low_ram">Pouca RAM</SelectItem>
              <SelectItem value="stale_collection">Coleta atrasada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground transition-colors hover:bg-muted/80">
                <th className="px-5 py-4 text-left font-semibold uppercase tracking-wider">Hostname</th>
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
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-20" />
                      <p className="text-base font-medium">Nenhum computador encontrado</p>
                      <p className="text-sm">Tente ajustar os filtros ou limpar a busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device.id} className="group transition-colors hover:bg-muted/30">
                    <td className="px-5 py-4 font-mono font-medium">
                      <Link href={device.detailsPath} className="text-foreground hover:text-primary transition-colors">
                        {device.hostname}
                      </Link>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1">
                        {device.sistema ?? 'N/A'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {device.ip ?? '0.0.0.0'}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 text-muted-foreground text-xs font-medium">
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {device.ramTotalGb ? `${device.ramTotalGb}GB` : '—'}
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {device.lowestDiskFreeGb !== null ? `${device.lowestDiskFreeGb}GB` : device.storageLabel?.split(' ')[0] ?? '—'}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {device.issues.length === 0 ? (
                          <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest italic">Saudável</span>
                        ) : (
                          device.issues.map((issue) => (
                            <Badge
                              key={`${device.id}-${issue.code}`}
                              variant="outline"
                              className={`px-1.5 py-0 text-[10px] font-bold uppercase transition-all ${
                                issue.severity === 'critical' 
                                  ? 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10' 
                                  : 'border-warning/40 bg-warning/5 text-warning hover:bg-warning/10'
                              }`}
                              title={issue.message}
                            >
                              {issue.title}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground tabular-nums">
                      {formatLastCollection(device.lastCollectionAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight shadow-sm border ${getStatusBadge(device.effectiveStatus)}`}>
                        {device.effectiveStatus === 'offline' ? <WifiOff className="h-3 w-3" /> : null}
                        {device.effectiveStatus === 'warning' ? <TriangleAlert className="h-3 w-3" /> : null}
                        {device.effectiveStatus === 'online' ? <Wifi className="h-3 w-3" /> : null}
                        {device.effectiveStatus === 'offline' ? 'Desconectado' : device.effectiveStatus}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
