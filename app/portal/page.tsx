import Link from 'next/link'
import { AlertCircle, ChevronRight, Clock, Download, FileText, MemoryStick, Monitor, Search, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { deduplicateDeviceSoftware } from '@/lib/software-catalog'
import { AnydeskBadge } from '@/components/anydesk-badge'
import { CopyInlineButton } from '@/components/copy-inline-button'
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

type OsFamily = 'windows' | 'linux' | 'other' | 'unknown'

// O agente Linux manda o PRETTY_NAME do /etc/os-release ("Ubuntu 22.04.3 LTS"),
// que nem sempre traz a palavra "Linux"; por isso a lista de distros.
const LINUX_PATTERN = /linux|ubuntu|debian|centos|fedora|red hat|rhel|rocky|alma|suse|mint/i

function osFamily(sistema: string | null | undefined): OsFamily {
  if (!sistema) return 'unknown'
  if (/windows/i.test(sistema)) return 'windows'
  if (LINUX_PATTERN.test(sistema)) return 'linux'
  return 'other'
}

const summaryPill =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-surface-line bg-surface-raise px-2 py-0.5 text-xs text-muted-foreground'

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
      hardware: { select: { sistema: true, ramTotalGb: true, processador: true } },
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
  // Resumo do parque inteiro, nao da lista filtrada: busca e status nao mudam estes numeros.
  let totalRamGb = 0
  let ramReported = 0
  const osCounts: Record<OsFamily, number> = { windows: 0, linux: 0, other: 0, unknown: 0 }
  for (const device of devices) {
    const ram = device.hardware?.ramTotalGb
    if (ram != null) {
      totalRamGb += ram
      ramReported += 1
    }
    osCounts[osFamily(device.hardware?.sistema)] += 1
  }
  const osSegments = [
    { key: 'windows', count: osCounts.windows, label: 'Windows' },
    { key: 'linux', count: osCounts.linux, label: 'Linux' },
    { key: 'other', count: osCounts.other, label: osCounts.other === 1 ? 'outro sistema' : 'outros sistemas' },
    { key: 'unknown', count: osCounts.unknown, label: 'sem sistema informado' },
  ].filter((segment) => segment.count > 0)
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

      <div className="space-y-3">
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

        {total > 0 && (
          <ul aria-label="Resumo do parque" className="flex flex-wrap items-center gap-2">
            <li
              className={summaryPill}
              title={
                ramReported < total
                  ? `Soma de ${ramReported} de ${total} máquina(s) com memória informada`
                  : undefined
              }
            >
              <MemoryStick className="h-3 w-3" aria-hidden="true" />
              {ramReported > 0 ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {totalRamGb.toLocaleString('pt-BR')} GB
                  </span>{' '}
                  de memória RAM total
                </>
              ) : (
                'Memória RAM não informada'
              )}
            </li>
            {osSegments.map((segment) => (
              <li key={segment.key} className={summaryPill}>
                <span className="font-medium tabular-nums text-foreground">{segment.count}</span> {segment.label}
              </li>
            ))}
          </ul>
        )}
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
                const ip = device.networks[0]?.ip ?? null
                const details = [device.hardware?.sistema, device.usuario].filter(Boolean).join(' · ')
                // A linha inteira continua clicavel, mas sem ser um <a> em volta de
                // tudo: botao dentro de link e HTML invalido e o clique nele seguiria o
                // href (stopPropagation nao cancela a navegacao do <a>). O hostname e o
                // link, e o `after:absolute after:inset-0` estica a area de clique sobre
                // a <li>; os botoes de copiar sobem para `z-10`, acima dessa camada.
                return (
                  <li
                    key={device.id}
                    className="group relative flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40 has-[a:focus-visible]:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-line bg-surface-raise text-foreground/80">
                        <Monitor className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/portal/devices/${device.id}`}
                          className="data-mono block truncate font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                        >
                          {device.hostname}
                        </Link>
                        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          {ip ? (
                            <>
                              <span className="data-mono shrink-0">{ip}</span>
                              <span className="relative z-10 inline-flex">
                                <CopyInlineButton value={ip} label="IP" />
                              </span>
                            </>
                          ) : (
                            <span className="shrink-0">sem IP</span>
                          )}
                          {details && <span className="truncate">· {details}</span>}
                        </div>
                        {device.anydeskId && (
                          <div className="mt-1 flex items-center gap-1">
                            <AnydeskBadge anydeskId={device.anydeskId} compact />
                            <span className="relative z-10 inline-flex">
                              <CopyInlineButton value={device.anydeskId} label="AnyDesk" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {softwareCount} programas
                      </span>
                      <time
                        dateTime={device.updatedAt.toISOString()}
                        title={`Última coleta: ${device.updatedAt.toLocaleString('pt-BR')}`}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-surface-line bg-surface-raise px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">Última coleta </span>
                        {formatRelative(device.updatedAt)}
                      </time>
                      <StatusPill tone={meta.tone} label={meta.label} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
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
