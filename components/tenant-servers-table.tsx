'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
 * pagina (app/tenant/[clientSlug]/servers/page.tsx) so para poder usar
 * useRouter() e tornar a linha inteira clicavel — mesmo padrao aplicado em
 * tenant-computers-table.tsx e tenant-recent-devices-table.tsx.
 */
export function TenantServersTable({ servers }: { servers: TenantServerRow[] }) {
  const router = useRouter()

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
    </div>
  )
}
