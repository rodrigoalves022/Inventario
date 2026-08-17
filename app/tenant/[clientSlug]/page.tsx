import Link from 'next/link'
import { StatsGrid } from '@/components/stat-cards'
import { OsDistributionChart, StatusChart, RamDistributionChart } from '@/components/dashboard-charts'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'

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
  const [rows, recentDevices] = await Promise.all([
    getDeviceReportRows(getTenantDeviceWhere(tenantSlug)),
    getRecentDevices(tenantSlug),
  ])
  const summary = buildDeviceReportSummary(rows)

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
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OsDistributionChart data={osData} />
        <StatusChart data={statusData} />
        <RamDistributionChart data={ramData} />
        <RamDistributionChart
          data={diskData}
          title="Uso de disco por máquina"
          description="Quantidade de máquinas por faixa de uso — não soma capacidade"
        />
      </div>

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
                      <Link href={getTenantPath(tenantSlug, `assets/${device.id}`)} className="hover:underline">
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
