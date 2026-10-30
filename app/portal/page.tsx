import Link from 'next/link'
import { AlertCircle, ChevronRight, Download, FileText, Monitor, Search, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { deduplicateDeviceSoftware } from '@/lib/software-catalog'
import { AnydeskBadge } from '@/components/anydesk-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'

function statusMeta(status: string) {
  if (status === 'online') return { label: 'Online', tone: 'success' as const }
  if (status === 'offline') return { label: 'Offline', tone: 'destructive' as const }
  return { label: 'Atenção', tone: 'warning' as const }
}

function formatRelative(date: Date | null) {
  if (!date) return 'sem coletas'
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

type PortalStatusFilter = 'all' | 'online' | 'offline' | 'warning'

// Os cards de KPI trocam so o status; a busca digitada continua valendo.
function portalHref(status: PortalStatusFilter, query: string) {
  const search = new URLSearchParams()
  if (status !== 'all') search.set('status', status)
  if (query) search.set('q', query)
  const qs = search.toString()
  return qs ? `/portal?${qs}` : '/portal'
}

export default async function PortalHomePage(
  { searchParams }: { searchParams?: Promise<{ status?: string; q?: string }> },
) {
  const params = (await searchParams) ?? {}
  const statusFilter: PortalStatusFilter =
    params.status === 'online' || params.status === 'offline' || params.status === 'warning'
      ? params.status
      : 'all'
  const query = (params.q ?? '').trim()
  const context = await requirePortalContext()

  const devices = await prisma.device.findMany({
    where: { clientId: context.clientId, agentAuth: { is: { isActive: true } } },
    orderBy: { hostname: 'asc' },
    select: {
      id: true,
      hostname: true,
      status: true,
      updatedAt: true,
      usuario: true,
      anydeskId: true,
      hardware: { select: { sistema: true } },
      networks: {
        where: { isPrimary: true },
        take: 1,
        select: { ip: true },
      },
      // Linhas cruas do banco, nao `_count`: a contagem exibida passa pela
      // mesma deduplicacao do Painel de Controle (appwiz.cpl) e de /portal/software.
      software: { select: { nome: true, versao: true, editor: true, installadoEm: true } },
    },
  })

  const total = devices.length
  const online = devices.filter((device) => device.status === 'online').length
  const warning = devices.filter((device) => device.status === 'warning').length
  const offline = total - online - warning
  const needle = query.toLowerCase()
  const visibleDevices = devices.filter((device) => {
    if (statusFilter !== 'all') {
      const matchesStatus =
        statusFilter === 'offline'
          ? device.status !== 'online' && device.status !== 'warning'
          : device.status === statusFilter
      if (!matchesStatus) return false
    }
    if (!needle) return true
    return [device.hostname, device.usuario, device.anydeskId, device.hardware?.sistema, device.networks[0]?.ip]
      .some((value) => value?.toLowerCase().includes(needle))
  })
  const hasFilter = statusFilter !== 'all' || query.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seu parque de TI</h1>
          <p className="text-sm text-muted-foreground">
            Consulta somente leitura do inventário coletado nas máquinas de {context.clientName}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/portal/reports/csv">
              <Download className="h-4 w-4 mr-2" />
              Baixar CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/portal/reports/pdf">
              <FileText className="h-4 w-4 mr-2" />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Máquinas" value={total} subtitle="equipamentos monitorados" icon={<Monitor />} href={portalHref('all', query)} active={statusFilter === 'all'} />
        <KpiCard
          label="Online"
          value={online}
          subtitle="reportando normalmente"
          href={portalHref('online', query)}
          active={statusFilter === 'online'}
          icon={<Wifi />}
          tone="success"
          emphasizeValue={online > 0}
        />
        <KpiCard
          label="Em atenção"
          value={warning}
          subtitle="com alerta operacional"
          href={portalHref('warning', query)}
          active={statusFilter === 'warning'}
          icon={<AlertCircle />}
          tone={warning > 0 ? 'warning' : 'neutral'}
          emphasizeValue={warning > 0}
        />
        <KpiCard
          label="Offline"
          value={offline}
          subtitle="sem check-in recente"
          href={portalHref('offline', query)}
          active={statusFilter === 'offline'}
          icon={<WifiOff />}
          tone={offline > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={offline > 0}
        />
      </div>

      <Panel>
        <PanelHeader
          icon={<Monitor />}
          title="Máquinas"
          description={`${total} equipamento(s) ativo(s) no inventário de ${context.clientName}.`}
          action={
            <form method="GET" action="/portal" role="search" className="flex items-center gap-2">
              <input type="hidden" name="status" value={statusFilter !== 'all' ? statusFilter : ''} />
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  name="q"
                  type="search"
                  defaultValue={query}
                  placeholder="Hostname, usuário, IP, AnyDesk..."
                  aria-label="Buscar máquinas"
                  className="h-8 w-56 pl-8 sm:w-64"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Buscar
              </Button>
              {hasFilter && (
                <Link href="/portal" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  Limpar filtro
                </Link>
              )}
            </form>
          }
        />
        <PanelBody flush>
          {devices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              Nenhuma máquina reportou inventário ainda. Assim que o agente for instalado, ela aparece
              aqui automaticamente.
            </p>
          ) : visibleDevices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              {query ? 'Nenhuma máquina corresponde à busca.' : 'Nenhuma máquina com este status.'}
            </p>
          ) : (
            <ul className="divide-y divide-surface-line border-t border-surface-line">
              {visibleDevices.map((device) => {
                const meta = statusMeta(device.status)
                const softwareCount = deduplicateDeviceSoftware(device.software).length
                return (
                  <li key={device.id}>
                    <Link
                      href={`/portal/devices/${device.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-line bg-surface-raise text-foreground/80">
                          <Monitor className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="data-mono truncate font-medium text-foreground">{device.hostname}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {device.networks[0]?.ip ?? 'sem IP'}
                            {device.hardware?.sistema ? ` · ${device.hardware.sistema}` : ''}
                            {device.usuario ? ` · ${device.usuario}` : ''}
                          </p>
                          {device.anydeskId && (
                            <div className="mt-1"><AnydeskBadge anydeskId={device.anydeskId} compact /></div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-4">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {softwareCount} programas
                        </span>
                        <span className="hidden text-xs text-muted-foreground md:inline">
                          {formatRelative(device.updatedAt)}
                        </span>
                        <StatusPill tone={meta.tone} label={meta.label} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}
