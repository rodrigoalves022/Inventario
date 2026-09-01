'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { BulkCommandBar } from '@/components/bulk-command-bar'
import { cn } from '@/lib/utils'
import { CLICKABLE_ROW_CLASS } from '@/lib/table-styles'

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

const STATUS_BADGE_CLASS: Record<TenantServerRow['effectiveStatus'], string> = {
  online: 'bg-success/10 text-success',
  offline: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
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
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-8 text-center text-muted-foreground">
          Nenhum servidor registrado para o cliente atual.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-muted-foreground">
              {canBulkOperate && (
                <th className="px-4 py-3 text-left font-medium w-10">
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
              <th className="px-4 py-3 text-left font-medium">Hostname</th>
              <th className="px-4 py-3 text-left font-medium">IP</th>
              <th className="px-4 py-3 text-left font-medium">Sistema</th>
              <th className="px-4 py-3 text-left font-medium">Processador</th>
              <th className="px-4 py-3 text-left font-medium">RAM</th>
              <th className="px-4 py-3 text-left font-medium">Armazenamento</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
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
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Selecionar ${server.hostname}`}
                      checked={selectedIds.has(server.id)}
                      onCheckedChange={(checked) => toggleSelected(server.id, checked === true)}
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-mono font-medium">
                  <Link
                    href={server.detailsPath}
                    onClick={(event) => event.stopPropagation()}
                    className="hover:underline"
                  >
                    {server.hostname}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{server.ip ?? '-'}</td>
                <td className="px-4 py-3">{server.sistema ?? '-'}</td>
                <td className="px-4 py-3 max-w-[240px] truncate text-muted-foreground">
                  {server.processador ?? '-'}
                </td>
                <td className="px-4 py-3">{server.ramTotalGb ? `${server.ramTotalGb} GB` : '-'}</td>
                <td className="px-4 py-3">{server.storageLabel ?? '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[server.effectiveStatus]}`}
                  >
                    {server.effectiveStatus}
                  </span>
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
