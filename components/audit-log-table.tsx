import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { AuditLogListItem } from '@/lib/audit-log'
import { getTenantPath } from '@/lib/tenant-links'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'

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

// Mesma paleta categorica dos graficos do dashboard (dashboard-charts.tsx):
// var(--chart-1..5). Aqui vira so um ponto de re-identificacao visual, nao
// um selo de status, entao um hash estavel do slug basta -- nao precisa de
// mapa persistido nem de cor unica garantida entre tenants.
const TENANT_DOT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function getTenantDotColor(clientSlug: string) {
  let hash = 0
  for (let i = 0; i < clientSlug.length; i++) {
    hash = (hash * 31 + clientSlug.charCodeAt(i)) >>> 0
  }
  return TENANT_DOT_COLORS[hash % TENANT_DOT_COLORS.length]
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
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th className={TABLE_HEAD_CLASS}>Quando</th>
              <th className={TABLE_HEAD_CLASS}>Ação</th>
              <th className={TABLE_HEAD_CLASS}>Usuário</th>
              {showTenant ? <th className={TABLE_HEAD_CLASS}>Tenant</th> : null}
              <th className={TABLE_HEAD_CLASS}>Alvo</th>
              <th className={TABLE_HEAD_CLASS}>Detalhes</th>
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
                      ? getTenantPath(log.clientSlug, `assets/${log.targetId}`)
                      : null
                    : null

                return (
                  <tr key={log.id} className={cn('border-b last:border-0', STATIC_ROW_HOVER_CLASS)}>
                    <td className={cn(TABLE_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <Badge variant="outline" className={getActionTone(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div>
                        <p className="font-medium text-foreground">{log.actorEmail ?? 'Sistema'}</p>
                        <p className="text-xs text-muted-foreground">{log.actorRole ?? 'sem role'}</p>
                      </div>
                    </td>
                    {showTenant ? (
                      <td className={TABLE_CELL_CLASS}>
                        {log.clientSlug ? (
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: getTenantDotColor(log.clientSlug) }}
                              aria-hidden="true"
                            />
                            <div>
                              <p className="font-medium text-foreground">{log.clientName ?? log.clientSlug}</p>
                              <p className="text-xs text-muted-foreground">{log.clientSlug}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className={TABLE_CELL_CLASS}>
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
                    <td className={TABLE_CELL_CLASS}>{renderMetadata(log)}</td>
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
