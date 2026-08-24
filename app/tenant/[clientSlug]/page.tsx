import Link from 'next/link'
import { Wifi, WifiOff, Clock, Inbox } from 'lucide-react'
import { auth } from '@/auth'
import { StatsGrid } from '@/components/stat-cards'
import { OsDistributionChart, StatusChart, RamDistributionChart } from '@/components/dashboard-charts-lazy'
import { TenantEmptyState } from '@/components/tenant-empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getDevicePresence, type DevicePresence } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'

const PRESENCE_BADGE_CLASS: Record<DevicePresence, string> = {
  online: 'border-success/30 bg-success/10 text-success',
  ausente: 'border-warning/30 bg-warning/10 text-warning',
  offline: 'border-border bg-muted text-muted-foreground',
}

const PRESENCE_ICON: Record<DevicePresence, typeof Wifi> = {
  online: Wifi,
  ausente: Clock,
  offline: WifiOff,
}

const PRESENCE_LABEL: Record<DevicePresence, string> = {
  online: 'online',
  ausente: 'ausente',
  offline: 'offline',
}

const PRESENCE_DATE_CLASS: Record<DevicePresence, string> = {
  online: 'text-muted-foreground',
  ausente: 'font-medium text-warning',
  offline: 'font-medium text-muted-foreground',
}

function PresenceBadge({ presence }: { presence: DevicePresence }) {
  const Icon = PRESENCE_ICON[presence]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${PRESENCE_BADGE_CLASS[presence]}`}
    >
      <Icon className="h-3 w-3" />
      {PRESENCE_LABEL[presence]}
    </span>
  )
}

/** So pra "destacar" a coleta antiga perto da data absoluta — nao precisa de
 * precisao de segundo, e' so pra bater o olho e entender a idade da coleta. */
function formatRelativeAge(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000))
  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

async function getRecentDevices(tenantSlug: string) {
  return prisma.device.findMany({
    where: getTenantDeviceWhere(tenantSlug),
    take: 10,
    orderBy: { updatedAt: 'desc' },
    include: {
      hardware: { select: { sistema: true, ramTotalGb: true } },
      networks: { where: { isPrimary: true }, select: { ip: true } },
      logs: {
        where: getTenantCollectionLogWhere(tenantSlug),
        orderBy: { coletadoEm: 'desc' },
        take: 1,
        select: { coletadoEm: true },
      },
    },
  })
}

export default async function TenantDashboardPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  // Mesma consulta usada pelos relatorios (lib/reports/device-report.ts):
  // uma so fonte de verdade para agregados de frota, em vez de cada tela
  // somar hardware/disco do jeito dela.
  const [recentDevicesRaw, session, tenantAlertSettings] = await Promise.all([
    getRecentDevices(tenantSlug),
    auth(),
    getTenantAlertSettingsBySlug(tenantSlug),
  ])
  const alertOfflineHours = (tenantAlertSettings ?? getDefaultAlertSettings()).alertOfflineHours
  // Mesmo alertOfflineHours do tenant usado pela badge de presenca abaixo —
  // status efetivo (RN010) tem que bater entre dashboard e /reports.
  const rows = await getDeviceReportRows(getTenantDeviceWhere(tenantSlug), alertOfflineHours)
  const summary = buildDeviceReportSummary(rows)
  const now = new Date()
  const recentDevices = recentDevicesRaw.map((device) => {
    const lastCollectionAt = device.logs[0]?.coletadoEm ?? null
    return {
      ...device,
      lastCollectionAt,
      presence: getDevicePresence(lastCollectionAt, alertOfflineHours, now),
    }
  })

  if (summary.totalDevices === 0) {
    return (
      <div className="space-y-6">
        <TenantEmptyState
          clientId={tenant.id}
          clientName={tenant.name}
          canManageCredentials={canManageTenant(getSessionPermissionUser(session), tenant)}
        />
      </div>
    )
  }

  const win10 = summary.osDistribution.find((item) => item.name === 'Windows 10')?.value ?? 0
  const win11 = summary.osDistribution.find((item) => item.name === 'Windows 11')?.value ?? 0
  const server = summary.osDistribution.find((item) => item.name === 'Windows Server')?.value ?? 0

  const osData = summary.osDistribution.map((item) => ({ name: item.name, value: item.value }))
  const statusData = [
    { name: 'Online', value: summary.online },
    { name: 'Offline', value: summary.offline },
    { name: 'Warning', value: summary.warning },
  ]
  const ramData = summary.ramDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))
  const diskData = summary.diskUsageDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))

  return (
    <div className="space-y-6">
      <div>
        {/* Titulo fica no cabecalho fixo; aqui so o contexto. */}
        <p className="text-muted-foreground">
          Monitoramento em tempo real dos ativos de TI da empresa <span className="font-medium text-foreground">{tenant.name}</span>.
        </p>
      </div>

      <StatsGrid
        total={summary.totalDevices}
        win10={win10}
        win11={win11}
        server={server}
        online={summary.online}
        offline={summary.offline}
        warning={summary.warning}
        computersPath={getTenantPath(tenantSlug, 'computers')}
        serversPath={getTenantPath(tenantSlug, 'servers')}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OsDistributionChart data={osData} computersPath={getTenantPath(tenantSlug, 'computers')} />
        <StatusChart data={statusData} computersPath={getTenantPath(tenantSlug, 'computers')} />
        <RamDistributionChart data={ramData} />
        <RamDistributionChart
          data={diskData}
          title="Uso de disco por máquina"
          description="Quantidade de máquinas por faixa de uso — não soma capacidade"
        />
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Últimas atualizações
          </CardTitle>
          <CardDescription>
            Somente dispositivos pertencentes ao tenant atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Hostname</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Sistema</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">RAM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Última coleta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentDevices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Inbox className="h-6 w-6 opacity-30" />
                          <p>Nenhum dispositivo encontrado para este tenant.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentDevices.map((device) => (
                      <tr key={device.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono font-medium">
                          <Link
                            href={getTenantPath(tenantSlug, `assets/${device.id}`)}
                            className="text-foreground transition-colors hover:text-primary"
                          >
                            {device.hostname}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {device.networks[0]?.ip ?? '—'}
                          </code>
                        </td>
                        <td className="px-4 py-3">{device.hardware?.sistema ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {device.hardware?.ramTotalGb ? `${device.hardware.ramTotalGb} GB` : '—'}
                        </td>
                        <td className={`px-4 py-3 tabular-nums ${PRESENCE_DATE_CLASS[device.presence]}`}>
                          {device.lastCollectionAt ? (
                            <>
                              {device.lastCollectionAt.toLocaleString('pt-BR')}
                              <span className="ml-1 text-xs opacity-80">
                                ({formatRelativeAge(device.lastCollectionAt, now)})
                              </span>
                            </>
                          ) : (
                            'nunca coletado'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <PresenceBadge presence={device.presence} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
