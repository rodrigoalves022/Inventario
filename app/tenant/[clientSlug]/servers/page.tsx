import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantPath } from '@/lib/tenant-links'
import { deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantServersTable, type TenantServerRow } from '@/components/tenant-servers-table'

export default async function TenantServersPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const [allDevices, tenantAlertSettings] = await Promise.all([
    prisma.device.findMany({
      where: getTenantDeviceWhere(tenantSlug),
      orderBy: { updatedAt: 'desc' },
      include: {
        hardware: { select: { sistema: true, processador: true, ramTotalGb: true, tipoArmazenamento: true } },
        networks: { where: { isPrimary: true }, select: { ip: true, mac: true } },
        disks: { select: { unidade: true, capacidadeGb: true, espacoLivreGb: true, tipo: true } },
        logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
      },
    }),
    getTenantAlertSettingsBySlug(tenantSlug),
  ])

  const settings = tenantAlertSettings ?? { clientId: tenant.id, ...getDefaultAlertSettings() }

  // Mesmo padrao de computers/page.tsx e tenant-computers-table.tsx: o status
  // efetivo (RN010) e' sempre calculado em runtime via deriveInventoryIssues +
  // getEffectiveDeviceStatus, nunca lido direto de `device.status` bruto (que
  // so recebe 'online'/'warning' no checkin e nunca 'offline'). Corrige o bug
  // documentado na Sprint 7 — servidores obsoletos agora aparecem "offline".
  const servers: TenantServerRow[] = allDevices
    .filter((device) => isServerOperatingSystem(device.hardware?.sistema))
    .map((device) => {
      const lastCollectionAt = device.logs[0]?.coletadoEm ?? device.updatedAt
      const issues = settings.alertsEnabled
        ? deriveInventoryIssues(
            {
              updatedAt: device.updatedAt,
              lastCollectionAt,
              hardware: device.hardware,
              disks: device.disks,
            },
            settings
          )
        : []

      return {
        id: device.id,
        hostname: device.hostname,
        ip: device.networks[0]?.ip ?? null,
        sistema: device.hardware?.sistema ?? null,
        processador: device.hardware?.processador ?? null,
        ramTotalGb: device.hardware?.ramTotalGb ?? null,
        storageLabel: device.disks[0]
          ? `${device.disks[0].capacidadeGb ?? '?'} GB ${device.disks[0].tipo ?? ''}`
          : null,
        effectiveStatus: getEffectiveDeviceStatus(device.status, issues) as 'online' | 'warning' | 'offline',
        detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
      }
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Servidores</h1>
        <p className="text-muted-foreground">
          {servers.length} servidor{servers.length !== 1 ? 'es' : ''} identificado{servers.length !== 1 ? 's' : ''} na empresa selecionada.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Action buttons... */}
      </div>

      <TenantServersTable servers={servers} />
    </div>
  )
}
