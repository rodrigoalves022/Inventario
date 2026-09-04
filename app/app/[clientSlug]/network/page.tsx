import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantNetworkWhere } from '@/lib/tenant-scope'
import { getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'
import { DiscoveredDevicesTable, type DiscoveredDeviceRow } from '@/components/discovered-devices-table'
import { DISCOVERED_DEVICE_TYPES, type DiscoveredDeviceType } from '@/lib/schemas/agent-discovery'

/**
 * Sprint 14. `DiscoveredDevice.deviceType` e' `String` livre no banco (RNF012 —
 * nenhum enum existe no schema), entao a leitura NAO confia no valor
 * armazenado: qualquer coisa fora do catalogo fechado vira 'UNKNOWN' na
 * exibicao, em vez de quebrar o `Record` de rotulo/badge do componente. Mesmo
 * principio de parse defensivo de `parseSoftwareBlacklistMetadata`.
 */
function toDiscoveredDeviceType(value: string): DiscoveredDeviceType {
  return (DISCOVERED_DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as DiscoveredDeviceType)
    : 'UNKNOWN'
}

function extractSubnet(ip?: string | null) {
  if (!ip) return null
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

export default async function TenantNetworkPage({ params }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const [networks, discoveredRows, tenantSettings] = await Promise.all([
    prisma.network.findMany({
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
    }),
    // Escopo por `tenant.id` vindo de requireTenantContext — nunca por um id
    // recebido da URL/formulario (RNF004). `select` explicito, nunca o model
    // inteiro.
    prisma.discoveredDevice.findMany({
      where: { clientId: tenant.id },
      select: {
        id: true,
        ip: true,
        mac: true,
        hostname: true,
        vendor: true,
        deviceType: true,
        snmpSysDescr: true,
        openPorts: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
      // Teto de seguranca da pagina: uma /24 rende ~254 linhas por sub-rede;
      // 500 cobre um cliente com duas redes sem transformar a pagina num dump.
      take: 500,
    }),
    getTenantAlertSettingsBySlug(tenantSlug),
  ])

  const discoveredDevices: DiscoveredDeviceRow[] = discoveredRows.map((device) => ({
    id: device.id,
    ip: device.ip,
    mac: device.mac,
    hostname: device.hostname,
    vendor: device.vendor,
    deviceType: toDiscoveredDeviceType(device.deviceType),
    snmpSysDescr: device.snmpSysDescr,
    openPorts: device.openPorts,
    firstSeenAt: device.firstSeenAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
  }))

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
  const discoveryEnabled = tenantSettings?.discoveryEnabled ?? false

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
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th className={TABLE_HEAD_CLASS}>Segmento</th>
              <th className={TABLE_HEAD_CLASS}>Subnet</th>
              <th className={TABLE_HEAD_CLASS}>Gateway</th>
              <th className={TABLE_HEAD_CLASS}>Total</th>
              <th className={TABLE_HEAD_CLASS}>Ativos</th>
              <th className={TABLE_HEAD_CLASS}>Utilização</th>
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
                  <tr key={segment.subnet} className={STATIC_ROW_HOVER_CLASS}>
                    <td className={cn(TABLE_CELL_CLASS, 'font-medium')}>{segment.subnet}</td>
                    <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{segment.subnet}</td>
                    <td className={cn(TABLE_CELL_CLASS, 'font-mono text-muted-foreground')}>{segment.gateway}</td>
                    <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{segment.devices}</td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        {segment.active}
                      </span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
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

      {/* Sprint 14 (RF028) — secao NOVA, adicional a de segmentos acima (que
          continua derivando das interfaces das maquinas COM agente). Esta lista
          e' o oposto: dispositivos SEM agente, achados pela varredura. */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dispositivos Descobertos na Rede</h2>
          <p className="text-sm text-muted-foreground">
            {discoveredDevices.length} dispositivo{discoveredDevices.length !== 1 ? 's' : ''} sem agente instalado
            {discoveredDevices.length !== 1 ? ' catalogados' : ' catalogado'} pela varredura dos agentes deste tenant.
          </p>
        </div>

        <DiscoveredDevicesTable devices={discoveredDevices} discoveryEnabled={discoveryEnabled} />
      </div>
    </div>
  )
}
