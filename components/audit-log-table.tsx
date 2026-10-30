'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatAuditActionLabel } from '@/lib/audit-action-labels'
import type { AuditLogListItem } from '@/lib/audit-log'
import { getTenantPath } from '@/lib/tenant-links'
import { cn } from '@/lib/utils'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'
import { TablePagination } from '@/components/ui/table-pagination'
import {
  DEFAULT_PAGE_SIZE,
  getPageSlice,
  paginationQueryUpdates,
  parsePageNumber,
  parsePageSize,
  replaceListQueryParams,
  type PageSize,
} from '@/lib/table-pagination'

type AuditLogTableProps = {
  logs: AuditLogListItem[]
  emptyMessage: string
  showTenant?: boolean
  tenantBasePath?: string | null
  /**
   * Overhaul visual — Fase 3. Paginacao OPT-IN: `/app/[clientSlug]/audit` e
   * (Sprint A53) `/admin/clients/audit` ligam. O default continua `false` para
   * que nenhum outro consumidor passe a recortar a lista sem pedir.
   *
   * Nao ha nada de server-side aqui: a query de `listAuditLogs` (LIMIT 200)
   * fica INTACTA e o rodape recorta os ate-200 registros ja carregados.
   */
  paginated?: boolean
  /** `?page=`/`?limit=`, revalidados aqui tambem. */
  initialPage?: number
  initialPageSize?: number
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

/** Sprint A53: o catalogo completo vive em `lib/audit-action-labels`; acao
 * fora dele cai no proprio identificador. */
function formatAction(action: string) {
  return formatAuditActionLabel(action)
}

function formatTargetType(targetType: string) {
  if (targetType === 'client') return 'Cliente'
  if (targetType === 'device') return 'Máquina'
  return targetType
}

/** Sprint A53: tons calmos. Acesso a chaves e' informativo (azul `info`, nao o
 * laranja de marca); so o que remove maquina/agente usa `destructive`. */
function getActionTone(action: string) {
  if (action === 'device.delete' || action === 'agent_auth.revoke' || action === 'agent_auth.remote_uninstall') {
    return 'border-destructive/40 bg-destructive/10 text-destructive'
  }
  if (action === 'credentials.view' || action === 'credentials.rotate') return 'border-info/40 bg-info/10 text-info'
  if (action === 'command.enqueue' || action === 'command.bulk_enqueue') {
    return 'border-warning/40 bg-warning/10 text-warning'
  }
  return 'border-surface-line bg-surface-raise text-foreground/85'
}

/** Links relativos (`?action=`, `?actorEmail=`, `?clientId=`): ficam na mesma
 * rota e trocam o recorte inteiro pelo valor clicado — mesmo efeito de
 * escolher esse filtro sozinho no formulario. */
const FILTER_LINK_CLASS = 'font-medium text-foreground hover:text-primary hover:underline'
const FILTER_LINK_FOCUS_CLASS =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

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

export function AuditLogTable({
  logs,
  emptyMessage,
  showTenant = false,
  tenantBasePath = null,
  paginated = false,
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: AuditLogTableProps) {
  const [page, setPage] = useState(() => parsePageNumber(initialPage))
  const [pageSize, setPageSize] = useState<PageSize>(() => parsePageSize(initialPageSize))

  /** Sem `paginated`, o recorte e' ignorado e a tabela renderiza a lista
   * inteira — nao ha "pagina gigante" a simular: `getPageSlice` so aceita
   * tamanhos do catalogo fechado e um valor arbitrario cairia no default de
   * 25, truncando silenciosamente a listagem do /admin. */
  const slice = getPageSlice(logs, page, pageSize)
  const visibleLogs = paginated ? slice.items : logs

  /** Os filtros de auditoria (`action`, `actorEmail`, `from`, `to`) vivem num
   * `<form method="GET">` na page.tsx; `replaceListQueryParams` preserva todos
   * eles ao escrever `page`/`limit`. E o caminho inverso tambem esta certo por
   * construcao: o form nao tem campo `page`, entao submeter um filtro novo
   * deixa a URL sem `page` — ou seja, volta para a pagina 1, que e' o que uma
   * troca de filtro deve fazer. */
  function syncUrl(nextPage: number, nextPageSize: PageSize) {
    replaceListQueryParams(paginationQueryUpdates(nextPage, nextPageSize))
  }

  function changePage(nextPage: number) {
    setPage(nextPage)
    syncUrl(nextPage, pageSize)
  }

  function changePageSize(nextPageSize: PageSize) {
    setPageSize(nextPageSize)
    setPage(1)
    syncUrl(1, nextPageSize)
  }

  return (
    <div className={cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
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
            {visibleLogs.length === 0 ? (
              <tr>
                <td colSpan={showTenant ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleLogs.map((log) => {
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
                      <Badge
                        asChild
                        variant="outline"
                        className={cn(
                          getActionTone(log.action),
                          'transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        <Link
                          href={`?action=${encodeURIComponent(log.action)}`}
                          title={`Filtrar por ação: ${formatAction(log.action)}`}
                        >
                          {formatAction(log.action)}
                        </Link>
                      </Badge>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div>
                        {log.actorEmail ? (
                          <Link
                            href={`?actorEmail=${encodeURIComponent(log.actorEmail)}`}
                            title={`Filtrar por operador: ${log.actorEmail}`}
                            className={cn(FILTER_LINK_CLASS, FILTER_LINK_FOCUS_CLASS)}
                          >
                            {log.actorEmail}
                          </Link>
                        ) : (
                          <p className="font-medium text-foreground">Sistema</p>
                        )}
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
                              {log.clientId ? (
                                <Link
                                  href={`?clientId=${encodeURIComponent(log.clientId)}`}
                                  title={`Filtrar por tenant: ${log.clientName ?? log.clientSlug}`}
                                  className={cn(FILTER_LINK_CLASS, FILTER_LINK_FOCUS_CLASS)}
                                >
                                  {log.clientName ?? log.clientSlug}
                                </Link>
                              ) : (
                                <p className="font-medium text-foreground">{log.clientName ?? log.clientSlug}</p>
                              )}
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
                          <p className="data-mono text-xs text-muted-foreground">{log.targetId}</p>
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

      {paginated ? (
        <TablePagination
          slice={slice}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
          itemNoun={{ one: 'registro', other: 'registros' }}
          navLabel="Paginação do log de auditoria"
        />
      ) : null}
    </div>
  )
}
