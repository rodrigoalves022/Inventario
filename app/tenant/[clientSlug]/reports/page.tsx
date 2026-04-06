import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere, getTenantDiskWhere, getTenantHardwareWhere } from '@/lib/tenant-scope'

function bucketRam(value: number) {
  if (value <= 8) return '8 GB ou menos'
  if (value <= 16) return '16 GB'
  if (value <= 32) return '32 GB'
  if (value <= 64) return '64 GB'
  return '128 GB+'
}

function summarizeOs(osName: string) {
  if (osName.includes('Windows 11')) return 'Windows 11'
  if (osName.includes('Windows 10')) return 'Windows 10'
  if (osName.includes('Server')) return 'Windows Server'
  if (osName.toLowerCase().includes('linux')) return 'Linux'
  return osName
}

export default async function TenantReportsPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const [devices, hardware, disks, logs] = await Promise.all([
    prisma.device.findMany({
      where: getTenantDeviceWhere(tenantSlug),
      orderBy: { updatedAt: 'desc' },
      select: { hostname: true, status: true, updatedAt: true },
    }),
    prisma.hardware.findMany({
      where: getTenantHardwareWhere(tenantSlug),
      select: { sistema: true, ramTotalGb: true },
    }),
    prisma.disk.findMany({
      where: getTenantDiskWhere(tenantSlug),
      select: { capacidadeGb: true, espacoLivreGb: true },
    }),
    prisma.collectionLog.findMany({
      where: getTenantCollectionLogWhere(tenantSlug),
      orderBy: { coletadoEm: 'desc' },
      take: 10,
      include: { device: { select: { hostname: true } } },
    }),
  ])

  const totalDevices = devices.length
  const online = devices.filter((device) => device.status === 'online').length
  const offline = devices.filter((device) => device.status === 'offline').length
  const warning = devices.filter((device) => device.status === 'warning').length
  const availability = totalDevices > 0 ? ((online / totalDevices) * 100).toFixed(1) : '0.0'

  const osMap = new Map<string, number>()
  const ramMap = new Map<string, number>()
  for (const item of hardware) {
    if (item.sistema) {
      const key = summarizeOs(item.sistema)
      osMap.set(key, (osMap.get(key) ?? 0) + 1)
    }

    if (item.ramTotalGb) {
      const bucket = bucketRam(item.ramTotalGb)
      ramMap.set(bucket, (ramMap.get(bucket) ?? 0) + 1)
    }
  }

  const osDistribution = Array.from(osMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)

  const ramDistribution = ['8 GB ou menos', '16 GB', '32 GB', '64 GB', '128 GB+'].map((range) => ({
    range,
    count: ramMap.get(range) ?? 0,
  }))

  const totalCapacity = disks.reduce((sum, disk) => sum + (disk.capacidadeGb ?? 0), 0)
  const totalFree = disks.reduce((sum, disk) => sum + (disk.espacoLivreGb ?? 0), 0)
  const totalUsed = Math.max(totalCapacity - totalFree, 0)
  const storageUsedPercent = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Resumo operacional baseado exclusivamente nos dados reais do tenant atual.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Taxa de disponibilidade', value: `${availability}%`, tone: 'text-success' },
          { label: 'Dispositivos online', value: String(online), tone: 'text-info' },
          { label: 'Dispositivos offline', value: String(offline), tone: 'text-destructive' },
          { label: 'Status warning', value: String(warning), tone: 'text-warning' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`mt-2 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição de sistemas operacionais</h2>
          <div className="space-y-3">
            {osDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum sistema operacional reportado ainda.</p>
            ) : (
              osDistribution.map((item) => {
                const percent = totalDevices > 0 ? Math.round((item.value / totalDevices) * 100) : 0
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-muted-foreground">{item.value} ({percent}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Uso geral de armazenamento</h2>
          {totalCapacity === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disco reportado ainda.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{totalUsed} GB usados de {totalCapacity} GB</span>
                <span className="font-semibold">{storageUsedPercent}%</span>
              </div>
              <div className="h-3 rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${storageUsedPercent}%` }} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">Espaço usado</p>
                  <p className="text-lg font-semibold text-foreground">{totalUsed} GB</p>
                </div>
                <div className="rounded-md bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground">Espaço livre</p>
                  <p className="text-lg font-semibold text-foreground">{totalFree} GB</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição de RAM</h2>
          <div className="space-y-3">
            {ramDistribution.every((item) => item.count === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma informação de memória reportada ainda.</p>
            ) : (
              ramDistribution.map((item) => {
                const maxCount = Math.max(...ramDistribution.map((entry) => entry.count), 1)
                const percent = Math.round((item.count / maxCount) * 100)
                return (
                  <div key={item.range}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.range}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-info" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Últimas coletas</h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma coleta registrada ainda.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-foreground">{log.device.hostname}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.coletadoEm).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{log.mensagem ?? '-'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
