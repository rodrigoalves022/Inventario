'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wifi, WifiOff, Clock, Inbox } from 'lucide-react'
import type { DevicePresence } from '@/lib/inventory-alerts'

export type RecentDeviceRow = {
  id: string
  hostname: string
  ip: string | null
  sistema: string | null
  ramLabel: string
  /** Data absoluta ja formatada (pt-BR) da ultima coleta, ou null se nunca coletado. */
  lastCollectionAbsolute: string | null
  /** Idade relativa ja formatada ("há 2h"), acompanha lastCollectionAbsolute. */
  lastCollectionRelative: string | null
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

const PRESENCE_LABEL: Record<DevicePresence, string> = {
  online: 'online',
  ausente: 'ausente',
  offline: 'offline',
}

const PRESENCE_DATE_CLASS: Record<DevicePresence, string> = {
  online: 'text-muted-foreground',
  ausente: 'font-medium text-warning',
  offline: 'font-medium text-muted-foreground',
}

function PresenceBadge({ presence }: { presence: DevicePresence }) {
  const Icon = PRESENCE_ICON[presence]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${PRESENCE_BADGE_CLASS[presence]}`}
    >
      <Icon className="h-3 w-3" />
      {PRESENCE_LABEL[presence]}
    </span>
  )
}

/**
 * Tabela "Últimas atualizações" do dashboard. Componente client separado do
 * Server Component da pagina (app/tenant/[clientSlug]/page.tsx) so para poder
 * usar useRouter() e tornar a linha inteira clicavel — mesmo padrao aplicado
 * em tenant-computers-table.tsx e tenant-servers-table.tsx.
 */
export function TenantRecentDevicesTable({ devices }: { devices: RecentDeviceRow[] }) {
  const router = useRouter()

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
        <Inbox className="h-6 w-6 opacity-30" />
        <p>Nenhum dispositivo encontrado para este tenant.</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50 text-muted-foreground">
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Hostname</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">IP</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Sistema</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">RAM</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Última coleta</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {devices.map((device) => (
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
            className="cursor-pointer transition-colors duration-150 hover:bg-accent/40"
          >
            <td className="px-4 py-3 font-mono font-medium">
              <Link
                href={device.detailsPath}
                onClick={(event) => event.stopPropagation()}
                className="text-foreground transition-colors hover:text-primary"
              >
                {device.hostname}
              </Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{device.ip ?? '—'}</code>
            </td>
            <td className="px-4 py-3">{device.sistema ?? '—'}</td>
            <td className="px-4 py-3 tabular-nums">{device.ramLabel}</td>
            <td className={`px-4 py-3 tabular-nums ${PRESENCE_DATE_CLASS[device.presence]}`}>
              {device.lastCollectionAbsolute ? (
                <>
                  {device.lastCollectionAbsolute}
                  <span className="ml-1 text-xs opacity-80">({device.lastCollectionRelative})</span>
                </>
              ) : (
                'nunca coletado'
              )}
            </td>
            <td className="px-4 py-3">
              <PresenceBadge presence={device.presence} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
