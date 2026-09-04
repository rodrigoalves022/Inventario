'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
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

export type TenantServerRow = {
  id: string
  hostname: string
  ip: string | null
  sistema: string | null
  processador: string | null
  ramTotalGb: number | null
  storageLabel: string | null
  effectiveStatus: 'online' | 'warning' | 'offline'
  detailsPath: string
}

/** Mesmo vocabulario de STATUS EFETIVO de /computers (online | warning |
 * offline, de `getEffectiveDeviceStatus`) e a mesma traducao para a pilula
 * compartilhada — as duas listagens de maquina precisam ler igual. */
const STATUS_TONE: Record<TenantServerRow['effectiveStatus'], StatusPillTone> = {
  online: 'success',
  warning: 'warning',
  offline: 'destructive',
}

function DeviceStatusPill({ status }: { status: TenantServerRow['effectiveStatus'] }) {
  return <StatusPill tone={STATUS_TONE[status]} label={status === 'offline' ? 'Desconectado' : status} />
}

/**
 * Tabela de /servers. Componente client separado do Server Component da
 * pagina (app/app/[clientSlug]/servers/page.tsx) so para poder usar
 * useRouter() e tornar a linha inteira clicavel — mesmo padrao aplicado em
 * tenant-computers-table.tsx e tenant-recent-devices-table.tsx.
 */
export function TenantServersTable({
  servers,
  tenantSlug,
  canOperate = false,
}: {
  servers: TenantServerRow[]
  /** Sprint 12. Mesmo contrato de tenant-computers-table.tsx: seleção múltipla
   * + barra de comando em lote só aparecem quando os dois estão presentes. */
  tenantSlug?: string
  canOperate?: boolean
}) {
  const router = useRouter()
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

  if (servers.length === 0) {
    return (
      <div className={TABLE_SHELL_CLASS}>
        <div className="px-4 py-8 text-center text-muted-foreground">
          Nenhum servidor registrado para o cliente atual.
        </div>
      </div>
    )
  }

  return (
    <div className={cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              {canBulkOperate && (
                <th className={cn(TABLE_HEAD_CLASS, 'w-10')}>
                  <Checkbox
                    aria-label="Selecionar todos os servidores"
                    checked={servers.length > 0 && servers.every((server) => selectedIds.has(server.id))}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        if (checked) servers.forEach((server) => next.add(server.id))
                        else servers.forEach((server) => next.delete(server.id))
                        return next
                      })
                    }}
                  />
                </th>
              )}
              <th className={TABLE_HEAD_CLASS}>Hostname</th>
              <th className={TABLE_HEAD_CLASS}>IP</th>
              <th className={TABLE_HEAD_CLASS}>Sistema</th>
              <th className={TABLE_HEAD_CLASS}>Processador</th>
              <th className={TABLE_HEAD_CLASS}>RAM</th>
              <th className={TABLE_HEAD_CLASS}>Armazenamento</th>
              <th className={TABLE_HEAD_CLASS}>Status</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr
                key={server.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(server.detailsPath)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(server.detailsPath)
                  }
                }}
                className={cn('border-b last:border-0', CLICKABLE_ROW_CLASS)}
              >
                {canBulkOperate && (
                  <td className={TABLE_CELL_CLASS} onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Selecionar ${server.hostname}`}
                      checked={selectedIds.has(server.id)}
                      onCheckedChange={(checked) => toggleSelected(server.id, checked === true)}
                    />
                  </td>
                )}
                <td className={cn(TABLE_DATA_CELL_CLASS, 'font-medium')}>
                  <Link
                    href={server.detailsPath}
                    onClick={(event) => event.stopPropagation()}
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    {server.hostname}
                  </Link>
                </td>
                <td className={cn(TABLE_DATA_CELL_CLASS, 'text-muted-foreground')}>{server.ip ?? '-'}</td>
                <td className={TABLE_CELL_CLASS}>{server.sistema ?? '-'}</td>
                <td className={cn(TABLE_CELL_CLASS, 'max-w-[240px] truncate text-muted-foreground')}>
                  {server.processador ?? '-'}
                </td>
                <td className={TABLE_CELL_CLASS}>{server.ramTotalGb ? `${server.ramTotalGb} GB` : '-'}</td>
                <td className={TABLE_CELL_CLASS}>{server.storageLabel ?? '-'}</td>
                <td className={TABLE_CELL_CLASS}>
                  <DeviceStatusPill status={server.effectiveStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
