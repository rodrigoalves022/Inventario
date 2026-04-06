import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'

export default async function TenantStoragePage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const devices = await prisma.device.findMany({
    where: getTenantDeviceWhere(tenantSlug),
    orderBy: { updatedAt: 'desc' },
    include: {
      disks: {
        orderBy: { unidade: 'asc' },
        select: {
          id: true,
          unidade: true,
          tipo: true,
          capacidadeGb: true,
          espacoLivreGb: true,
        },
      },
    },
  })

  const storageDevices = devices
    .map((device) => {
      const total = device.disks.reduce((sum, disk) => sum + (disk.capacidadeGb ?? 0), 0)
      const free = device.disks.reduce((sum, disk) => sum + (disk.espacoLivreGb ?? 0), 0)
      const used = Math.max(total - free, 0)
      const primaryType = device.disks[0]?.tipo ?? 'N/A'

      return {
        id: device.id,
        name: device.hostname,
        capacity: total,
        used,
        free,
        type: primaryType,
        status: device.status,
        diskCount: device.disks.length,
      }
    })
    .filter((device) => device.capacity > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Armazenamento</h1>
        <p className="text-muted-foreground">
          {storageDevices.length} dispositivo{storageDevices.length !== 1 ? 's' : ''} com armazenamento reportado para o tenant atual.
        </p>
      </div>

      <div className="grid gap-4">
        {storageDevices.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-muted-foreground">
            Nenhum dispositivo com discos reportados no tenant atual.
          </div>
        ) : (
          storageDevices.map((device) => {
            const usage = device.capacity > 0 ? Math.round((device.used / device.capacity) * 100) : 0
            return (
              <div key={device.id} className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{device.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {device.type} - {device.diskCount} disco{device.diskCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                    device.status === 'online'
                      ? 'bg-success/10 text-success'
                      : device.status === 'offline'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {device.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {device.used} GB de {device.capacity} GB
                    </span>
                    <span className="font-semibold">{usage}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${usage}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{device.free} GB livres</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
