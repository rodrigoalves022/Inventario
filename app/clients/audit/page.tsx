import { notFound } from 'next/navigation'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { AuditLogTable } from '@/components/audit-log-table'
import { listAuditLogs } from '@/lib/audit-log'
import { 
  History, 
  Search, 
  KeyRound, 
  Trash2, 
  Filter,
  Calendar as CalendarIcon,
  XCircle
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

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
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
                  <a href="/clients/audit">
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </a>
                </Button>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-primary/40">
                <div className="flex items-center gap-3 mb-1">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total de Eventos</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{logs.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-blue-500/40">
                <div className="flex items-center gap-3 mb-1">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acesso a Chaves</p>
                </div>
                <p className="text-2xl font-bold text-blue-500">{credentialViews}</p>
              </div>
              <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-destructive/40">
                <div className="flex items-center gap-3 mb-1">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exclusões</p>
                </div>
                <p className="text-2xl font-bold text-destructive">{deviceDeletes}</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
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
                      <SelectItem value="credentials.view">Visualização de credenciais</SelectItem>
                      <SelectItem value="device.delete">Exclusão de máquina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Tenant</label>
                  <Select name="clientId" defaultValue={filters.clientId || "all"}>
                    <SelectTrigger className="h-9 bg-muted/40">
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
            </div>

            <AuditLogTable 
              logs={logs} 
              emptyMessage="Nenhum evento registrado nos critérios selecionados." 
              showTenant 
            />
          </div>
        </main>
      </div>
    </div>
  )
}
