import Link from 'next/link'
import { AlertCircle, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { cn } from '@/lib/utils'

function statusMeta(status: string) {
  if (status === 'online') {
    return { label: 'Online', icon: Wifi, className: 'border-success/30 bg-success/10 text-success' }
  }
  if (status === 'offline') {
    return {
      label: 'Offline',
      icon: WifiOff,
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    }
  }
  return { label: 'Atenção', icon: AlertCircle, className: 'border-warning/30 bg-warning/10 text-warning' }
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

export default async function PortalHomePage() {
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

  const summary = [
    { label: 'Máquinas', value: total },
    { label: 'Online', value: online },
    { label: 'Em atenção', value: warning },
    { label: 'Offline', value: offline },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Seu parque de TI</h1>
        <p className="text-sm text-muted-foreground">
          Consulta somente leitura do inventário coletado nas máquinas de {context.clientName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Máquinas</h2>
        </div>

        {devices.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Nenhuma máquina reportou inventário ainda. Assim que o agente for instalado, ela aparece
            aqui automaticamente.
          </p>
        ) : (
          <ul className="divide-y">
            {devices.map((device) => {
              const meta = statusMeta(device.status)
              return (
                <li key={device.id}>
                  <Link
                    href={`/portal/devices/${device.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{device.hostname}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {device.networks[0]?.ip ?? 'sem IP'}
                        {device.hardware?.sistema ? ` · ${device.hardware.sistema}` : ''}
                        {device.usuario ? ` · ${device.usuario}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {device._count.software} programas
                      </span>
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {formatRelative(device.updatedAt)}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                          meta.className
                        )}
                      >
                        <meta.icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
