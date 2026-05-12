import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { AuditLogListItem } from '@/lib/audit-log'

type AuditLogTableProps = {
  logs: AuditLogListItem[]
  emptyMessage: string
  showTenant?: boolean
  tenantBasePath?: string | null
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAction(action: string) {
  if (action === 'credentials.view') return 'Visualização de credenciais'
  if (action === 'device.delete') return 'Exclusão de máquina'
  return action
}

function formatTargetType(targetType: string) {
  if (targetType === 'client') return 'Cliente'
  if (targetType === 'device') return 'Máquina'
  return targetType
}

function getActionTone(action: string) {
  if (action === 'device.delete') return 'border-destructive/40 text-destructive'
  if (action === 'credentials.view') return 'border-primary/40 text-primary'
  return 'border-border text-foreground'
}

function renderMetadata(log: AuditLogListItem) {
  const hostname = typeof log.metadata?.hostname === 'string' ? log.metadata.hostname : null
  const clientSlug = typeof log.metadata?.clientSlug === 'string' ? log.metadata.clientSlug : log.clientSlug
  const reason = typeof log.metadata?.reason === 'string' ? log.metadata.reason : null
  const status = typeof log.metadata?.status === 'string' ? log.metadata.status : null

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {hostname ? <p>Hostname: <span className="font-medium text-foreground">{hostname}</span></p> : null}
      {clientSlug ? <p>Tenant: <span className="font-medium text-foreground">{clientSlug}</span></p> : null}
      {status ? <p>Status: <span className="font-medium text-foreground">{status}</span></p> : null}
      {reason ? <p>Motivo: <span className="font-medium text-foreground">{reason}</span></p> : null}
      {!hostname && !clientSlug && !status && !reason ? <span>—</span> : null}
    </div>
  )
}

export function AuditLogTable({ logs, emptyMessage, showTenant = false, tenantBasePath = null }: AuditLogTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Quando</th>
              <th className="px-4 py-3 text-left font-medium">Ação</th>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              {showTenant ? <th className="px-4 py-3 text-left font-medium">Tenant</th> : null}
              <th className="px-4 py-3 text-left font-medium">Alvo</th>
              <th className="px-4 py-3 text-left font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={showTenant ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const assetHref =
                  log.targetType === 'device' && log.targetId
                    ? tenantBasePath
                      ? `${tenantBasePath}/assets/${log.targetId}`
                      : log.clientSlug
                      ? `/tenant/${log.clientSlug}/assets/${log.targetId}`
                      : null
                    : null

                return (
                  <tr key={log.id} className="border-b last:border-0 align-top hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={getActionTone(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{log.actorEmail ?? 'Sistema'}</p>
                        <p className="text-xs text-muted-foreground">{log.actorRole ?? 'sem role'}</p>
                      </div>
                    </td>
                    {showTenant ? (
                      <td className="px-4 py-3">
                        {log.clientSlug ? (
                          <div>
                            <p className="font-medium text-foreground">{log.clientName ?? log.clientSlug}</p>
                            <p className="text-xs text-muted-foreground">{log.clientSlug}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{formatTargetType(log.targetType)}</p>
                        {assetHref ? (
                          <Link href={assetHref} className="text-xs text-primary hover:underline">
                            Abrir ativo
                          </Link>
                        ) : log.targetId ? (
                          <p className="text-xs text-muted-foreground font-mono">{log.targetId}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderMetadata(log)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
