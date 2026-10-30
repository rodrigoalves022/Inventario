import { notFound } from 'next/navigation'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { AuditLogTable } from '@/components/audit-log-table'
import { listAuditLogs } from '@/lib/audit-log'
import { AUDIT_ACTION_LABEL } from '@/lib/audit-action-labels'
import { parsePageNumber, parsePageSize } from '@/lib/table-pagination'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { 
  History, 
  Search, 
  Building2,
  KeyRound, 
  Trash2, 
  Filter,
  Calendar as CalendarIcon,
  XCircle,
  Download
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

type AuditPageSearchParams = {
  action?: string
  actorEmail?: string
  clientId?: string
  from?: string
  to?: string
  /** Sprint A53: rodape de paginacao — recorta no cliente os ate 200
   * registros ja carregados; a query de `listAuditLogs` nao muda. */
  page?: string
  limit?: string
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}${endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'}`)
  return Number.isNaN(date.getTime()) ? null : date
}

async function requireSuperAdmin() {
  const session = await auth()

  if (!canAccessGlobalAdmin(getSessionPermissionUser(session))) {
    notFound()
  }

  return session
}

export default async function ClientsAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditPageSearchParams>
}) {
  const session = await requireSuperAdmin()
  const user = getSessionPermissionUser(session)

  const filters = await searchParams
  const [clients, logs] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    listAuditLogs({
      clientId: filters.clientId || null,
      action: filters.action || null,
      actorEmail: filters.actorEmail || null,
      from: parseDate(filters.from),
      to: parseDate(filters.to, true),
      limit: 200,
    }),
  ])

  const credentialViews = logs.filter((log) => log.action === 'credentials.view').length
  const deviceDeletes = logs.filter((log) => log.action === 'device.delete').length
  const csvParams = new URLSearchParams()
  for (const key of ['action', 'clientId', 'actorEmail', 'from', 'to'] as const) {
    const value = filters[key]
    if (value && !((key === 'action' || key === 'clientId') && value === 'all')) csvParams.set(key, value)
  }
  const csvQuery = csvParams.size > 0 ? `?${csvParams.toString()}` : ''
  // Sprint A53: badges/operadores/tenants da tabela e os KPIs navegam por
  // <Link>; a chave do recorte remonta a tabela para voltar a pagina 1.
  const tableKey = csvParams.toString()
  const isAllActions = !filters.action || filters.action === 'all'
  const tenantsInScope =new Set(logs.map((l) => l.clientId).filter(Boolean)).size

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Audit Log Global</h1>
                <p className="text-muted-foreground text-sm">
                  Rastro completo de ações administrativas em todos os tenants.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/admin/audit/csv${csvQuery}`}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar CSV
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/admin/clients/audit">
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Total de Eventos"
                value={logs.length}
                subtitle="no recorte atual (máx. 200)"
                icon={<History />}
                href="/admin/clients/audit"
                active={isAllActions}
              />
              <KpiCard
                label="Tenants no Recorte"
                value={tenantsInScope}
                subtitle="clientes com atividade"
                icon={<Building2 />}
                href="/admin/clients/audit#clientId"
              />
              <KpiCard
                label="Acesso a Chaves"
                value={credentialViews}
                subtitle="visualizações de credenciais"
                icon={<KeyRound />}
                tone="info"
                href="/admin/clients/audit?action=credentials.view"
                active={filters.action === 'credentials.view'}
              />
              <KpiCard
                label="Exclusões"
                value={deviceDeletes}
                subtitle="máquinas removidas"
                icon={<Trash2 />}
                tone={deviceDeletes > 0 ? 'destructive' : 'neutral'}
                emphasizeValue={deviceDeletes > 0}
                href="/admin/clients/audit?action=device.delete"
                active={filters.action === 'device.delete'}
              />
            </div>

            <Panel>
              <PanelHeader
                icon={<Filter />}
                title="Filtros de auditoria"
                description="Refine por ação, tenant, operador ou janela de datas."
              />
              <PanelBody>
              <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
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
                  <label htmlFor="clientId" className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Tenant</label>
                  <Select name="clientId" defaultValue={filters.clientId || "all"}>
                    <SelectTrigger id="clientId" className="h-9 bg-muted/40">
                      <SelectValue placeholder="Todos os tenants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tenants</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
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
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Período (Início)</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input name="from" type="date" defaultValue={filters.from ?? ''} className="h-9 pl-8 bg-muted/40" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="space-y-2 flex-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Até</label>
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

            <Panel>
              <PanelHeader
                icon={<History />}
                title="Eventos registrados"
                description={
                  logs.length >= 200
                    ? 'Exibindo os 200 eventos mais recentes. Refine os filtros acima para recortes específicos.'
                    : `${logs.length} evento(s) listado(s).`
                }
              />
              <PanelBody flush>
                <AuditLogTable
                  key={tableKey}
                  logs={logs}
                  emptyMessage="Nenhum evento registrado nos critérios selecionados."
                  showTenant
                  paginated
                  initialPage={parsePageNumber(filters.page)}
                  initialPageSize={parsePageSize(filters.limit)}
                />
              </PanelBody>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  )
}
