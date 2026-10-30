'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Search, Server } from 'lucide-react'
import { LATEST_AGENT_VERSION } from '@/lib/agent-version'
import { KpiCard } from '@/components/ui/kpi-card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { BulkCommandBar } from '@/components/bulk-command-bar'
import { AnydeskBadge } from '@/components/anydesk-badge'
import { cn } from '@/lib/utils'
import {
  CLICKABLE_ROW_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
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
  anydeskId?: string | null
  agentVersion?: string | null
}

type ServerFilter = 'all' | 'online' | 'attention' | 'outdated_agent'

function isOutdatedAgent(server: TenantServerRow): boolean {
  return Boolean(server.agentVersion && server.agentVersion !== LATEST_AGENT_VERSION)
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
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: {
  servers: TenantServerRow[]
  /** Sprint 12. Mesmo contrato de tenant-computers-table.tsx: seleção múltipla
   * + barra de comando em lote só aparecem quando os dois estão presentes. */
  tenantSlug?: string
  canOperate?: boolean
  /** `?page=`/`?limit=` (Overhaul visual — Fase 3), revalidados aqui tambem. */
  initialPage?: number
  initialPageSize?: number
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(() => parsePageNumber(initialPage))
  const [pageSize, setPageSize] = useState<PageSize>(() => parsePageSize(initialPageSize))
  const [search, setSearch] = useState('')
  const canBulkOperate = Boolean(tenantSlug && canOperate)

  const [statusFilter, setStatusFilter] = useState<ServerFilter>('all')

  const onlineCount = servers.filter((server) => server.effectiveStatus === 'online').length
  const attentionCount = servers.length - onlineCount
  const outdatedCount = servers.filter(isOutdatedAgent).length

  const filteredServers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const digitsOnly = normalized.replace(/\s+/g, '')
    const byStatus = servers.filter((server) => {
      if (statusFilter === 'online') return server.effectiveStatus === 'online'
      if (statusFilter === 'attention') return server.effectiveStatus !== 'online'
      if (statusFilter === 'outdated_agent') return isOutdatedAgent(server)
      return true
    })
    if (normalized.length === 0) return byStatus

    return byStatus.filter(
      (server) =>
        server.hostname.toLowerCase().includes(normalized) ||
        (server.ip ?? '').toLowerCase().includes(normalized) ||
        (server.sistema ?? '').toLowerCase().includes(normalized) ||
        (server.processador ?? '').toLowerCase().includes(normalized) ||
        (digitsOnly.length > 0 && (server.anydeskId ?? '').replace(/\s+/g, '').toLowerCase().includes(digitsOnly)) ||
        Boolean(server.agentVersion?.toLowerCase().includes(normalized)),
    )
  }, [servers, search, statusFilter])

  // Ordem filtrar -> contar -> paginar.
  const slice = getPageSlice(filteredServers, page, pageSize)

  function changeFilter(next: ServerFilter) {
    setStatusFilter((current) => (current === next ? 'all' : next))
    changePage(1)
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch)
    changePage(1)
  }

  /**
   * `history.replaceState`, e nao `router.replace`: /servers nao tinha
   * sincronizacao de URL nenhuma antes desta fase, e o recorte e' todo
   * client-side — um `router.replace` por clique de pagina refaria o
   * `findMany` do tenant inteiro no servidor para nao mudar uma linha. Ver
   * `replaceListQueryParams` em lib/table-pagination.ts.
   */
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
      <Panel>
        <div className="px-4 py-8 text-center text-muted-foreground">
          Nenhum servidor registrado para o cliente atual.
        </div>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total de servidores"
        value={servers.length}
        onClick={() => changeFilter('all')}
        active={statusFilter === 'all'}
        testId="servers-kpi-all"
      />
      <KpiCard
        label="Servidores online"
        value={onlineCount}
        tone="success"
        onClick={() => changeFilter('online')}
        active={statusFilter === 'online'}
        testId="servers-kpi-online"
      />
      <KpiCard
        label="Offline / Warning"
        value={attentionCount}
        tone={attentionCount > 0 ? 'warning' : 'neutral'}
        onClick={() => changeFilter('attention')}
        active={statusFilter === 'attention'}
        testId="servers-kpi-attention"
      />
      <KpiCard
        label="Agente desatualizado"
        value={outdatedCount}
        subtitle={`v${LATEST_AGENT_VERSION} é a atual`}
        tone={outdatedCount > 0 ? 'warning' : 'neutral'}
        onClick={() => changeFilter('outdated_agent')}
        active={statusFilter === 'outdated_agent'}
        testId="servers-kpi-outdated"
      />
    </div>
    <Panel className="overflow-hidden">
      <PanelHeader
        icon={<Server className="h-4 w-4" />}
        title="Servidores monitorados"
        description={`${filteredServers.length} de ${servers.length} servidor(es)`}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Buscar por hostname, IP, sistema ou AnyDesk..."
              aria-label="Buscar servidores"
              className="h-9 w-full bg-card pl-9"
            />
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              {canBulkOperate && (
                <th className={cn(TABLE_HEAD_CLASS, 'w-10')}>
                  {/* Escopo da checkbox de cabecalho: a PAGINA atual, nao a
                      lista inteira. Com paginacao, "todos" sem qualificacao
                      selecionaria linhas que o usuario nao esta vendo — e o
                      estado marcado/desmarcado nao teria relacao com o que
                      aparece na tela. */}
                  <Checkbox
                    aria-label="Selecionar todos os servidores desta página"
                    checked={slice.items.length > 0 && slice.items.every((server) => selectedIds.has(server.id))}
                    onCheckedChange={(checked) => {
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        if (checked) slice.items.forEach((server) => next.add(server.id))
                        else slice.items.forEach((server) => next.delete(server.id))
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
            {slice.items.map((server) => (
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
                  {server.agentVersion ? (
                    <span className="data-mono mt-1 block text-[11px] text-muted-foreground">
                      Agente v{server.agentVersion}
                    </span>
                  ) : null}
                </td>
                <td className={cn(TABLE_DATA_CELL_CLASS, 'text-muted-foreground')}>{server.ip ?? '-'}
                  <AnydeskBadge anydeskId={server.anydeskId} compact />
                </td>
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

      <TablePagination
        slice={slice}
        onPageChange={changePage}
        onPageSizeChange={changePageSize}
        itemNoun={{ one: 'servidor', other: 'servidores' }}
        navLabel="Paginação dos servidores"
      />

      {canBulkOperate && tenantSlug && (
        <BulkCommandBar
          tenantSlug={tenantSlug}
          deviceIds={[...selectedIds]}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </Panel>
    </div>
  )
}
