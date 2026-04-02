import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantNetworkWhere } from '@/lib/tenant-scope'

type TenantParams = Promise<{ clientSlug: string }> | { clientSlug: string }

function extractSubnet(ip?: string | null) {
  if (!ip) return null
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

export default async function TenantNetworkPage({ params }: { params: TenantParams }) {
  const { clientSlug } = await Promise.resolve(params)
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const networks = await prisma.network.findMany({
    where: getTenantNetworkWhere(tenantSlug),
    include: {
      device: {
        select: {
          status: true,
          hostname: true,
        },
      },
    },
    orderBy: { ip: 'asc' },
  })

  const grouped = new Map<string, { subnet: string; gateway: string; devices: number; active: number; hostnames: Set<string> }>()

  for (const entry of networks) {
    const subnet = extractSubnet(entry.ip) ?? 'Nao identificado'
    const group = grouped.get(subnet) ?? {
      subnet,
      gateway: entry.gateway ?? '-',
      devices: 0,
      active: 0,
      hostnames: new Set<string>(),
    }

    if (!group.hostnames.has(entry.device.hostname)) {
      group.hostnames.add(entry.device.hostname)
      group.devices += 1
      if (entry.device.status === 'online') {
        group.active += 1
      }
    }

    if (group.gateway === '-' && entry.gateway) {
      group.gateway = entry.gateway
    }

    grouped.set(subnet, group)
  }

  const segments = Array.from(grouped.values()).sort((left, right) => left.subnet.localeCompare(right.subnet))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rede</h1>
        <p className="text-muted-foreground">
          {segments.length} segmento{segments.length !== 1 ? 's' : ''} identificado{segments.length !== 1 ? 's' : ''} a partir das interfaces do tenant atual.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold">Segmento</th>
              <th className="px-4 py-3 text-left font-semibold">Subnet</th>
              <th className="px-4 py-3 text-left font-semibold">Gateway</th>
              <th className="px-4 py-3 text-left font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Ativos</th>
              <th className="px-4 py-3 text-left font-semibold">Utilização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {segments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma interface de rede reportada ainda para este tenant.
                </td>
              </tr>
            ) : (
              segments.map((segment) => {
                const utilization = segment.devices > 0 ? (segment.active / segment.devices) * 100 : 0
                return (
                  <tr key={segment.subnet} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{segment.subnet}</td>
                    <td className="px-4 py-3 text-muted-foreground">{segment.subnet}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{segment.gateway}</td>
                    <td className="px-4 py-3 text-muted-foreground">{segment.devices}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        {segment.active}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${utilization}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
