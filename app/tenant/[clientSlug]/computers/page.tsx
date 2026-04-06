import Link from 'next/link'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantPath } from '@/lib/tenant-links'

export default async function TenantComputersPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const allDevices = await prisma.device.findMany({
    where: getTenantDeviceWhere(tenantSlug),
    orderBy: { updatedAt: 'desc' },
    include: {
      hardware: { select: { sistema: true, processador: true, ramTotalGb: true, tipoArmazenamento: true } },
      networks: { where: { isPrimary: true }, select: { ip: true, mac: true } },
      disks: { select: { unidade: true, capacidadeGb: true, espacoLivreGb: true, tipo: true } },
    },
  })

  const devices = allDevices.filter((device) => !isServerOperatingSystem(device.hardware?.sistema))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Computadores registrados</h1>
        <p className="text-muted-foreground">
          {devices.length} computador{devices.length !== 1 ? 'es' : ''} classificado{devices.length !== 1 ? 's' : ''} no tenant atual.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Hostname</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
                <th className="px-4 py-3 text-left font-medium">Sistema</th>
                <th className="px-4 py-3 text-left font-medium">Processador</th>
                <th className="px-4 py-3 text-left font-medium">RAM</th>
                <th className="px-4 py-3 text-left font-medium">Armazenamento</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum computador registrado para este tenant.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link href={getTenantPath(tenantSlug, `assets/${device.id}`)} className="hover:underline">
                        {device.hostname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{device.networks[0]?.ip ?? '-'}</td>
                    <td className="px-4 py-3">{device.hardware?.sistema ?? '-'}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">{device.hardware?.processador ?? '-'}</td>
                    <td className="px-4 py-3">{device.hardware?.ramTotalGb ? `${device.hardware.ramTotalGb} GB` : '-'}</td>
                    <td className="px-4 py-3">
                      {device.disks[0] ? `${device.disks[0].capacidadeGb ?? '?'} GB ${device.disks[0].tipo ?? ''}` : '-'}
                    </td>
                    <td className="px-4 py-3">
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
