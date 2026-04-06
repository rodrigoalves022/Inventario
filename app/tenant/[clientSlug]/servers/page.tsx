import Link from 'next/link'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantPath } from '@/lib/tenant-links'

export default async function TenantServersPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
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

  const servers = allDevices.filter((device) => isServerOperatingSystem(device.hardware?.sistema))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Servidores</h1>
        <p className="text-muted-foreground">
          {servers.length} servidor{servers.length !== 1 ? 'es' : ''} identificado{servers.length !== 1 ? 's' : ''} no tenant atual.
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
              {servers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum servidor registrado para este tenant.
                  </td>
                </tr>
              ) : (
                servers.map((server) => (
                  <tr key={server.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link href={getTenantPath(tenantSlug, `assets/${server.id}`)} className="hover:underline">
                        {server.hostname}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{server.networks[0]?.ip ?? '-'}</td>
                    <td className="px-4 py-3">{server.hardware?.sistema ?? '-'}</td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-muted-foreground">{server.hardware?.processador ?? '-'}</td>
                    <td className="px-4 py-3">{server.hardware?.ramTotalGb ? `${server.hardware.ramTotalGb} GB` : '-'}</td>
                    <td className="px-4 py-3">
                      {server.disks[0] ? `${server.disks[0].capacidadeGb ?? '?'} GB ${server.disks[0].tipo ?? ''}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        server.status === 'online'
                          ? 'bg-success/10 text-success'
                          : server.status === 'offline'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {server.status}
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
