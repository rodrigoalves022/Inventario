import Link from 'next/link'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantPath } from '@/lib/tenant-links'
import { deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantAlertSettingsForm } from '@/components/tenant-alert-settings-form'
import { TenantComputersTable } from '@/components/tenant-computers-table'

export default async function TenantComputersPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug
  const session = await auth()

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
  const devices = allDevices
    .filter((device) => !isServerOperatingSystem(device.hardware?.sistema))
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

      const lowestDiskFreeGb = device.disks
        .map((disk) => disk.espacoLivreGb)
        .filter((value): value is number => typeof value === 'number')
        .sort((left, right) => left - right)[0] ?? null

      return {
        id: device.id,
        hostname: device.hostname,
        ip: device.networks[0]?.ip ?? null,
        sistema: device.hardware?.sistema ?? null,
        processador: device.hardware?.processador ?? null,
        ramTotalGb: device.hardware?.ramTotalGb ?? null,
        lowestDiskFreeGb,
        storageLabel: device.disks[0] ? `${device.disks[0].capacidadeGb ?? '?'} GB ${device.disks[0].tipo ?? ''}` : null,
        updatedAt: device.updatedAt.toISOString(),
        lastCollectionAt: lastCollectionAt?.toISOString() ?? null,
        effectiveStatus: getEffectiveDeviceStatus(device.status, issues) as 'online' | 'warning' | 'offline',
        issues,
        detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
      }
    })

  const canManageAlerts = canManageTenantAlerts(getSessionPermissionUser(session), tenantSlug)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Computadores registrados</h1>
          <p className="text-muted-foreground">
            {devices.length} computador{devices.length !== 1 ? 'es' : ''} classificado{devices.length !== 1 ? 's' : ''} no tenant atual.
          </p>
        </div>
        <Link href={getTenantPath(tenantSlug, '')} className="text-sm text-primary hover:underline">
          Voltar ao dashboard
        </Link>
      </div>

      {canManageAlerts ? <TenantAlertSettingsForm tenantSlug={tenantSlug} settings={settings} /> : null}

      <TenantComputersTable devices={devices} />
    </div>
  )
}
