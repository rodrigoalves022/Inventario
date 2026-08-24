import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDevicePresence } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantStorageTable } from '@/components/tenant-storage-table'

export default async function TenantStoragePage({ params, searchParams }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const resolvedSearchParams = (await searchParams) ?? {}
  const tipoParam = resolvedSearchParams.tipo
  const initialTipo = typeof tipoParam === 'string' ? tipoParam : (tipoParam?.[0] ?? 'all')
  const faixaParam = resolvedSearchParams.faixa
  const rawFaixa = typeof faixaParam === 'string' ? faixaParam : faixaParam?.[0]
  const initialFaixa: 'all' | 'ok' | 'warning' | 'critical' =
    rawFaixa === 'ok' || rawFaixa === 'warning' || rawFaixa === 'critical' ? rawFaixa : 'all'

  const [devices, tenantAlertSettings] = await Promise.all([
    prisma.device.findMany({
      where: getTenantDeviceWhere(tenantSlug),
      orderBy: { hostname: 'asc' },
      select: {
        id: true,
        hostname: true,
        usuario: true,
        disks: {
          orderBy: { unidade: 'asc' },
          select: { unidade: true, tipo: true, capacidadeGb: true, espacoLivreGb: true },
        },
        logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
      },
    }),
    getTenantAlertSettingsBySlug(tenantSlug),
  ])

  const alertOfflineHours = (tenantAlertSettings ?? getDefaultAlertSettings()).alertOfflineHours
  const now = new Date()

  const storageDevices = devices
    .map((device) => {
      const capacity = device.disks.reduce((sum, disk) => sum + (disk.capacidadeGb ?? 0), 0)
      const free = device.disks.reduce((sum, disk) => sum + (disk.espacoLivreGb ?? 0), 0)
      const used = Math.max(capacity - free, 0)
      const types = Array.from(new Set(device.disks.map((disk) => disk.tipo).filter((tipo): tipo is string => Boolean(tipo))))
      const lastCollectionAt = device.logs[0]?.coletadoEm ?? null

      return {
        id: device.id,
        hostname: device.hostname,
        usuario: device.usuario,
        capacity,
        used,
        free,
        diskCount: device.disks.length,
        types,
        presence: getDevicePresence(lastCollectionAt, alertOfflineHours, now),
        detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
      }
    })
    .filter((device) => device.capacity > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Armazenamento</h1>
        <p className="text-muted-foreground">
          {storageDevices.length} dispositivo{storageDevices.length !== 1 ? 's' : ''} com armazenamento reportado para a empresa atual.
        </p>
      </div>

      <TenantStorageTable devices={storageDevices} initialType={initialTipo} initialUsageRange={initialFaixa} />
    </div>
  )
}
