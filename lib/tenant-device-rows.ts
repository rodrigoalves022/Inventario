import {
  deriveInventoryIssues,
  getEffectiveDeviceStatus,
  type InventoryAlertSettings,
  type InventoryIssue,
} from '@/lib/inventory-alerts'
import { getTenantPath } from '@/lib/tenant-links'

/**
 * Formato minimo esperado do `Device` retornado pelo Prisma para virar uma
 * linha de tabela do tenant (computers/servers/assets). Estrutural — qualquer
 * resultado de `prisma.device.findMany` com esses campos (mesmo com `select`
 * trazendo campos extras) satisfaz o tipo.
 */
export type TenantDeviceForRow = {
  id: string
  hostname: string
  status: string
  updatedAt: Date
  hardware: { sistema: string | null; processador: string | null; ramTotalGb: number | null } | null
  networks: Array<{ ip: string | null }>
  disks: Array<{ espacoLivreGb: number | null; capacidadeGb: number | null; tipo: string | null }>
  logs: Array<{ coletadoEm: Date }>
}

export type TenantDeviceRow = {
  id: string
  hostname: string
  ip: string | null
  sistema: string | null
  processador: string | null
  ramTotalGb: number | null
  lowestDiskFreeGb: number | null
  storageLabel: string | null
  updatedAt: string
  lastCollectionAt: string | null
  effectiveStatus: 'online' | 'warning' | 'offline'
  issues: InventoryIssue[]
  detailsPath: string
}

/**
 * Mapeia um `Device` (com o include padrao usado por computers/servers/assets)
 * para a linha de tabela usada por `TenantComputersTable` — issues (RN de
 * alerta), menor espaco livre em disco e status efetivo (RN010), calculados
 * do mesmo jeito em qualquer tela que liste dispositivos do tenant.
 *
 * Extraido de `app/app/[clientSlug]/computers/page.tsx` (Sprint de
 * unificacao de dispositivos) para dar paridade real — nao so visual — aos
 * servidores quando aparecem na listagem unificada de `/assets`, que antes so
 * existia para computadores.
 */
export function buildTenantDeviceRow(
  device: TenantDeviceForRow,
  settings: InventoryAlertSettings,
  tenantSlug: string
): TenantDeviceRow {
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

  const lowestDiskFreeGb =
    device.disks
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
}
