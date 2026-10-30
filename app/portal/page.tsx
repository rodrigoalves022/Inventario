import Link from 'next/link'
import { AlertCircle, ChevronRight, Monitor, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { AnydeskBadge } from '@/components/anydesk-badge'
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

export default async function PortalHomePage(
  { searchParams }: { searchParams?: Promise<{ status?: string }> },
) {
  const params = (await searchParams) ?? {}
  const statusFilter: PortalStatusFilter =
    params.status === 'online' || params.status === 'offline' || params.status === 'warning'
      ? params.status
      : 'all'
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
      _count: { select: { software: true } },
    },
  })

  const total = devices.length
  const online = devices.filter((device) => device.status === 'online').length
  const warning = devices.filter((device) => device.status === 'warning').length
  const offline = total - online - warning
  const visibleDevices =
    statusFilter === 'all'
      ? devices
      : devices.filter((device) =>
          statusFilter === 'offline'
            ? device.status !== 'online' && device.status !== 'warning'
            : device.status === statusFilter,
        )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Seu parque de TI</h1>
        <p className="text-sm text-muted-foreground">
          Consulta somente leitura do inventário coletado nas máquinas de {context.clientName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Máquinas" value={total} subtitle="equipamentos monitorados" icon={<Monitor />} href="/portal" active={statusFilter === 'all'} />
        <KpiCard
          label="Online"
          value={online}
          subtitle="reportando normalmente"
          href="/portal?status=online"
          active={statusFilter === 'online'}
          icon={<Wifi />}
          tone="success"
          emphasizeValue={online > 0}
        />
        <KpiCard
          label="Em atenção"
          value={warning}
          subtitle="com alerta operacional"
          href="/portal?status=warning"
          active={statusFilter === 'warning'}
          icon={<AlertCircle />}
          tone={warning > 0 ? 'warning' : 'neutral'}
          emphasizeValue={warning > 0}
        />
        <KpiCard
          label="Offline"
          value={offline}
          subtitle="sem check-in recente"
          href="/portal?status=offline"
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
        />
        <PanelBody flush>
          {devices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              Nenhuma máquina reportou inventário ainda. Assim que o agente for instalado, ela aparece
              aqui automaticamente.
            </p>
          ) : visibleDevices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              Nenhuma máquina com este status.
            </p>
          ) : (
            <ul className="divide-y divide-surface-line border-t border-surface-line">
              {visibleDevices.map((device) => {
                const meta = statusMeta(device.status)
                return (
                  <li key={device.id}>
                    <Link
                      href={`/portal/devices/${device.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
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
                          {device._count.software} programas
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
