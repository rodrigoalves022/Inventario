import Link from 'next/link'
import { StatsGrid, SecondaryStats } from '@/components/stat-cards'
import { OsDistributionChart, StatusChart, RamDistributionChart } from '@/components/dashboard-charts'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere, getTenantDiskWhere, getTenantHardwareWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'

type TenantParams = Promise<{ clientSlug: string }> | { clientSlug: string }

async function getStats(clientSlug: string) {
  const [total, online, offline, warning, hardware, diskData] = await Promise.all([
    prisma.device.count({ where: getTenantDeviceWhere(clientSlug) }),
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'online' } }),
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'offline' } }),
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'warning' } }),
    prisma.hardware.findMany({
      where: getTenantHardwareWhere(clientSlug),
      select: { sistema: true, ramTotalGb: true },
    }),
    prisma.disk.findMany({
      where: getTenantDiskWhere(clientSlug),
      select: { capacidadeGb: true },
    }),
  ])

  const ramTotal = hardware.reduce((sum, item) => sum + (item.ramTotalGb ?? 0), 0)
  const storageTotal = diskData.reduce((sum, item) => sum + (item.capacidadeGb ?? 0), 0)

  const win10 = hardware.filter((item) => item.sistema?.includes('10') && !item.sistema?.includes('Server')).length
  const win11 = hardware.filter((item) => item.sistema?.includes('11') && !item.sistema?.includes('Server')).length
  const server = hardware.filter((item) => item.sistema?.includes('Server')).length

  return { total, online, offline, warning, win10, win11, server, totalRam: ramTotal, totalStorage: storageTotal }
}

async function getChartData(clientSlug: string) {
  const hardware = await prisma.hardware.findMany({
    where: getTenantHardwareWhere(clientSlug),
    select: { sistema: true, ramTotalGb: true },
  })

  const osCount: Record<string, number> = {}
  for (const item of hardware) {
    if (!item.sistema) continue
    const key = item.sistema.includes('11')
      ? 'Windows 11'
      : item.sistema.includes('10')
      ? 'Windows 10'
      : item.sistema.includes('Server')
      ? 'Windows Server'
      : item.sistema
    osCount[key] = (osCount[key] ?? 0) + 1
  }

  const osData = Object.entries(osCount).map(([name, value]) => ({ name, value }))

  const [onlineCount, offlineCount, warningCount] = await Promise.all([
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'online' } }),
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'offline' } }),
    prisma.device.count({ where: { ...getTenantDeviceWhere(clientSlug), status: 'warning' } }),
  ])

  const statusData = [
    { name: 'Online', value: onlineCount },
    { name: 'Offline', value: offlineCount },
    { name: 'Warning', value: warningCount },
  ]

  const ramGroups: Record<string, number> = { '≤8 GB': 0, '16 GB': 0, '32 GB': 0, '64+ GB': 0 }
  for (const item of hardware) {
    const ram = item.ramTotalGb ?? 0
    if (ram <= 8) ramGroups['≤8 GB'] += 1
    else if (ram <= 16) ramGroups['16 GB'] += 1
    else if (ram <= 32) ramGroups['32 GB'] += 1
    else ramGroups['64+ GB'] += 1
  }

  const ramData = Object.entries(ramGroups).map(([name, value]) => ({ name, value }))
  return { osData, statusData, ramData }
}

async function getRecentDevices(clientSlug: string) {
  return prisma.device.findMany({
    where: getTenantDeviceWhere(clientSlug),
    take: 10,
    orderBy: { updatedAt: 'desc' },
    include: {
      hardware: { select: { sistema: true, ramTotalGb: true } },
      networks: { where: { isPrimary: true }, select: { ip: true } },
      logs: {
        where: getTenantCollectionLogWhere(clientSlug),
        orderBy: { coletadoEm: 'desc' },
        take: 1,
        select: { coletadoEm: true },
      },
    },
  })
}

export default async function TenantDashboardPage({ params }: { params: TenantParams }) {
  const { clientSlug } = await Promise.resolve(params)
  const tenant = await requireTenantContext(clientSlug)
  const [stats, { osData, statusData, ramData }, recentDevices] = await Promise.all([
    getStats(clientSlug),
    getChartData(clientSlug),
    getRecentDevices(clientSlug),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Visão geral</h1>
        <p className="text-muted-foreground">
          Monitoramento em tempo real dos ativos de TI do tenant <span className="font-medium text-foreground">{tenant.name}</span>.
        </p>
      </div>

      <StatsGrid
        total={stats.total}
        win10={stats.win10}
        win11={stats.win11}
        server={stats.server}
        online={stats.online}
        offline={stats.offline}
        warning={stats.warning}
        totalRam={stats.totalRam}
        totalStorage={stats.totalStorage}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <OsDistributionChart data={osData} />
        <StatusChart data={statusData} />
        <RamDistributionChart data={ramData} />
      </div>

      <SecondaryStats totalRam={stats.totalRam} totalStorage={stats.totalStorage} />

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Últimas atualizações</h2>
            <p className="text-sm text-muted-foreground">Somente dispositivos pertencentes ao tenant atual.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 text-left font-medium">Hostname</th>
                <th className="pb-2 text-left font-medium">IP</th>
                <th className="pb-2 text-left font-medium">Sistema</th>
                <th className="pb-2 text-left font-medium">RAM</th>
                <th className="pb-2 text-left font-medium">Última coleta</th>
                <th className="pb-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nenhum dispositivo encontrado para este tenant.
                  </td>
                </tr>
              ) : (
                recentDevices.map((device) => (
                  <tr key={device.id} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium">
                      <Link href={getTenantPath(clientSlug, `assets/${device.id}`)} className="hover:underline">
                        {device.hostname}
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">{device.networks[0]?.ip ?? '—'}</td>
                    <td className="py-2">{device.hardware?.sistema ?? '—'}</td>
                    <td className="py-2">{device.hardware?.ramTotalGb ? `${device.hardware.ramTotalGb} GB` : '—'}</td>
                    <td className="py-2 text-muted-foreground">
                      {device.logs[0]?.coletadoEm ? new Date(device.logs[0].coletadoEm).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        device.status === 'online'
                          ? 'bg-success/10 text-success'
                          : device.status === 'offline'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {device.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
