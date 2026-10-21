'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { cn } from '@/lib/utils'
import type { DevicePresence } from '@/lib/inventory-alerts'
import {
  CLICKABLE_ROW_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from '@/lib/table-styles'

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

/** Mesmo vocabulario de PRESENCA de /storage (online | ausente | offline,
 * derivado da ultima coleta — RN010), traduzido para a mesma pilula
 * compartilhada. "offline" aqui tambem e ausencia de sinal, nao incidente. */
const PRESENCE_TONE: Record<DevicePresence, StatusPillTone> = {
  online: 'success',
  ausente: 'warning',
  offline: 'neutral',
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
  return <StatusPill tone={PRESENCE_TONE[presence]} label={PRESENCE_LABEL[presence]} />
}

/**
 * Tabela "Últimas coletas" do dashboard. Componente client separado do
 * Server Component da pagina (app/app/[clientSlug]/page.tsx) so para poder
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
        <tr className={TABLE_HEAD_ROW_CLASS}>
          <th className={TABLE_HEAD_CLASS}>Hostname</th>
          <th className={TABLE_HEAD_CLASS}>IP</th>
          <th className={TABLE_HEAD_CLASS}>Sistema</th>
          <th className={TABLE_HEAD_CLASS}>RAM</th>
          <th className={TABLE_HEAD_CLASS}>Última coleta</th>
          <th className={TABLE_HEAD_CLASS}>Status</th>
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
            className={CLICKABLE_ROW_CLASS}
          >
            <td className={cn(TABLE_DATA_CELL_CLASS, 'font-medium')}>
              <Link
                href={device.detailsPath}
                onClick={(event) => event.stopPropagation()}
                className="text-foreground transition-colors hover:text-primary"
              >
                {device.hostname}
              </Link>
            </td>
            <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{device.ip ?? '—'}</code>
            </td>
            <td className={TABLE_CELL_CLASS}>{device.sistema ?? '—'}</td>
            <td className={cn(TABLE_CELL_CLASS, 'tabular-nums')}>{device.ramLabel}</td>
            <td className={cn(TABLE_CELL_CLASS, 'tabular-nums', PRESENCE_DATE_CLASS[device.presence])}>
              {device.lastCollectionAbsolute ? (
                <>
                  {device.lastCollectionAbsolute}
                  <span className="ml-1 text-xs opacity-80">({device.lastCollectionRelative})</span>
                </>
              ) : (
                'nunca coletado'
              )}
            </td>
            <td className={TABLE_CELL_CLASS}>
              <PresenceBadge presence={device.presence} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
