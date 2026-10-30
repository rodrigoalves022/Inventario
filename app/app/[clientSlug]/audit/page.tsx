import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { AuditLogTable } from '@/components/audit-log-table'
import { KpiCard } from '@/components/ui/kpi-card'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantBasePath } from '@/lib/tenant-links'
import { listAuditLogs } from '@/lib/audit-log'
import { parsePageNumber, parsePageSize } from '@/lib/table-pagination'
import { canViewTenantAudit, getSessionPermissionUser } from '@/lib/permissions'
import {
  ClipboardList,
  History,
  Search,
  KeyRound,
  Trash2,
  Filter,
  Users,
  Calendar as CalendarIcon,
  XCircle
} from 'lucide-react'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { AUDIT_ACTION_LABEL } from '@/lib/audit-action-labels'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

type TenantAuditSearchParams = {
  action?: string
  actorEmail?: string
  from?: string
  to?: string
  /** Overhaul visual — Fase 3: rodape de paginacao. NAO alteram a query de
   * `listAuditLogs` (o LIMIT 200 continua igual) — recortam no cliente os ate
   * 200 registros ja carregados. */
  page?: string
  limit?: string
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}${endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

const AUDIT_LOG_LIMIT = 200

export default async function TenantAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>
  searchParams: Promise<TenantAuditSearchParams>
}) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const session = await auth()
  const canViewAudit = canViewTenantAudit(getSessionPermissionUser(session), tenant)

  if (!session?.user || !canViewAudit) {
    notFound()
  }

  const filters = await searchParams
  const logs = await listAuditLogs({
    clientId: tenant.id,
    action: filters.action || null,
    actorEmail: filters.actorEmail || null,
    from: parseDate(filters.from),
    to: parseDate(filters.to, true),
    limit: AUDIT_LOG_LIMIT,
  })

  const credentialViews = logs.filter((log) => log.action === 'credentials.view').length
  const deviceDeletes = logs.filter((log) => log.action === 'device.delete').length

  const basePath = getTenantBasePath(tenant.slug)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria do Tenant</h1>
          <p className="text-muted-foreground">
            Eventos sensíveis registrados para <span className="font-semibold text-foreground underline underline-offset-4 decoration-primary/30">{tenant.name}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`${basePath}/audit`}>
            <XCircle className="h-4 w-4 mr-2" />
            Limpar Filtros
          </a>
        </Button>
      </div>

      {/* Summary Grid — cada card filtra a tabela abaixo (mesmo padrao dos
          outros grids de resumo clicaveis do tenant). Usa o KpiCard
          (components/ui/kpi-card.tsx) em vez de reimplementar o hover à mão. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Log do Tenant"
          value={logs.length}
          subtitle="no recorte atual (máx. 200)"
          icon={<History />}
          tone="primary"
          href={`${basePath}/audit`}
        />
        <KpiCard
          label="Operadores no Recorte"
          value={new Set(logs.map((l) => l.actorEmail).filter(Boolean)).size}
          subtitle="contas com atividade"
          icon={<Users />}
        />
        <KpiCard
          label="Acesso a Chaves"
          value={credentialViews}
          subtitle="visualizações de credenciais"
          icon={<KeyRound />}
          tone="info"
          emphasizeValue={credentialViews > 0}
          href={`${basePath}/audit?action=credentials.view`}
        />
        <KpiCard
          label="Exclusões"
          value={deviceDeletes}
          subtitle="máquinas removidas"
          icon={<Trash2 />}
          tone={deviceDeletes > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={deviceDeletes > 0}
          href={`${basePath}/audit?action=device.delete`}
        />
      </div>

      {/* Filter Bar — rotulos em `.section-label` (Sprint V20), nao a variante
          artesanal de 10px/widest. Sem shadow-sm: borda de 1px ja declara a superficie. */}
      <Panel>
        <PanelHeader
          icon={<Filter />}
          title="Filtros de auditoria"
          description="Refine por ação, operador ou período."
        />
        <PanelBody>
        <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
          <div className="space-y-2">
            <label className="section-label flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Ação
            </label>
            <Select name="action" defaultValue={filters.action || "all"}>
              <SelectTrigger className="h-9 bg-muted/40">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="section-label flex items-center gap-1.5">
              <Search className="h-3 w-3" /> Usuário
            </label>
            <Input 
              name="actorEmail" 
              type="search" 
              defaultValue={filters.actorEmail ?? ''} 
              placeholder="E-mail do operador..." 
              className="h-9 bg-muted/40" 
            />
          </div>

          <div className="space-y-2">
            <label className="section-label block">Início</label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input name="from" type="date" defaultValue={filters.from ?? ''} className="h-9 pl-8 bg-muted/40" />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="space-y-2 flex-1">
              <label className="section-label block">Até</label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input name="to" type="date" defaultValue={filters.to ?? ''} className="h-9 pl-8 bg-muted/40" />
              </div>
            </div>
            <Button type="submit" className="h-9 px-6 mt-auto">
              Filtrar
            </Button>
          </div>
        </form>
        </PanelBody>
      </Panel>

      {logs.length >= AUDIT_LOG_LIMIT ? (
        <p role="note" className="text-xs text-muted-foreground">
          Exibindo os 200 eventos mais recentes (limite da consulta). Use os filtros de período, ação ou e-mail acima para refinar a busca em históricos mais antigos.
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          icon={<ClipboardList />}
          title="Eventos registrados"
          description={`${logs.length} evento(s) listado(s) para ${tenant.name}.`}
        />
        <PanelBody flush>
          <AuditLogTable
            logs={logs}
            emptyMessage="Nenhum evento registrado nos critérios selecionados para este tenant."
            tenantBasePath={basePath}
            paginated
            initialPage={parsePageNumber(filters.page)}
            initialPageSize={parsePageSize(filters.limit)}
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
