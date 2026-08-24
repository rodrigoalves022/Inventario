'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { HardDrive, Search, Wifi, WifiOff, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DevicePresence } from '@/lib/inventory-alerts'
import { computeDiskUsagePercent, getDiskUsageTier, DISK_USAGE_TIER_BAR_CLASS, DISK_USAGE_TIER_TEXT_CLASS } from '@/lib/disk-usage'

export type TenantStorageRow = {
  id: string
  hostname: string
  usuario: string | null
  capacity: number
  used: number
  free: number
  diskCount: number
  types: string[]
  presence: DevicePresence
  detailsPath: string
}

const PRESENCE_BADGE_CLASS: Record<DevicePresence, string> = {
  online: 'border-success/30 bg-success/10 text-success',
  ausente: 'border-warning/30 bg-warning/10 text-warning',
  offline: 'border-border bg-muted text-muted-foreground',
}

const PRESENCE_ICON: Record<DevicePresence, typeof Wifi> = {
  online: Wifi,
  ausente: Clock,
  offline: WifiOff,
}

function PresenceBadge({ presence }: { presence: DevicePresence }) {
  const Icon = PRESENCE_ICON[presence]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm',
        PRESENCE_BADGE_CLASS[presence]
      )}
    >
      <Icon className="h-3 w-3" />
      {presence}
    </span>
  )
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
      devices.map((device) => ({
        ...device,
        usagePercent: computeDiskUsagePercent(device.capacity, device.used),
      })),
    [devices]
  )

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesType = typeFilter === 'all' || row.types.includes(typeFilter)
      const matchesUsage = usageFilter === 'all' || getDiskUsageTier(row.usagePercent) === usageFilter
      return matchesType && matchesUsage
    })
  }, [rows, typeFilter, usageFilter])

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

  return (
    <div className="space-y-4">
      {/* Filtros — clicaveis, refletidos na URL (?tipo=, ?faixa=) */}
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

        <div className="flex flex-wrap gap-2">
          {(['ok', 'warning', 'critical'] as const).map((tier) => (
            <Badge
              key={tier}
              data-testid={`usage-filter-${tier}`}
              variant="outline"
              role="button"
              tabIndex={0}
              onClick={() => applyUsageFilter(tier)}
              className={cn(
                'cursor-pointer px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                usageFilter === tier ? 'ring-2 ring-offset-1' : '',
                tier === 'ok' && 'border-success/40 bg-success/5 text-success hover:bg-success/10',
                tier === 'warning' && 'border-warning/40 bg-warning/5 text-warning hover:bg-warning/10',
                tier === 'critical' && 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10'
              )}
            >
              {USAGE_RANGE_LABEL[tier]}
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
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Hostname</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Usuário</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Disco</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Uso</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((device) => {
                  const tier = getDiskUsageTier(device.usagePercent)
                  return (
                    <tr key={device.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4 align-top font-mono font-medium">
                        <Link href={device.detailsPath} className="text-foreground hover:text-primary transition-colors">
                          {device.hostname}
                        </Link>
                      </td>
                      <td className="px-5 py-4 align-top text-muted-foreground">{device.usuario ?? '—'}</td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <HardDrive className="h-3 w-3" />
                          {device.types.length > 0 ? device.types.join(', ') : 'N/A'} · {device.diskCount} disco{device.diskCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="min-w-[10rem] space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{device.used} GB de {device.capacity} GB</span>
                            <span className={cn('font-semibold', DISK_USAGE_TIER_TEXT_CLASS[tier])}>{device.usagePercent}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn('h-full rounded-full', DISK_USAGE_TIER_BAR_CLASS[tier])}
                              style={{ width: `${Math.min(device.usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
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
