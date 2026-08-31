import { auth } from '@/auth'
import { StatsGrid } from '@/components/stat-cards'
import { OsDistributionChart, StatusChart, RamDistributionChart } from '@/components/dashboard-charts-lazy'
import { TenantEmptyState } from '@/components/tenant-empty-state'
import { TenantRecentDevicesTable, type RecentDeviceRow } from '@/components/tenant-recent-devices-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getDevicePresence } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'

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

export default async function TenantDashboardPage({ params }: PageProps<'/app/[clientSlug]'>) {
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
  const recentDevices: RecentDeviceRow[] = recentDevicesRaw.map((device) => {
    const lastCollectionAt = device.logs[0]?.coletadoEm ?? null
    return {
      id: device.id,
      hostname: device.hostname,
      ip: device.networks[0]?.ip ?? null,
      sistema: device.hardware?.sistema ?? null,
      ramLabel: device.hardware?.ramTotalGb ? `${device.hardware.ramTotalGb} GB` : '—',
      lastCollectionAbsolute: lastCollectionAt ? lastCollectionAt.toLocaleString('pt-BR') : null,
      lastCollectionRelative: lastCollectionAt ? formatRelativeAge(lastCollectionAt, now) : null,
      presence: getDevicePresence(lastCollectionAt, alertOfflineHours, now),
      detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
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
        assetsPath={getTenantPath(tenantSlug, 'assets')}
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
              <TenantRecentDevicesTable devices={recentDevices} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
