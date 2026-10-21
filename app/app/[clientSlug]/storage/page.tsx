import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDevicePresence } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantStorageTable } from '@/components/tenant-storage-table'
import { parsePageNumber, parsePageSize } from '@/lib/table-pagination'

export default async function TenantStoragePage({ params, searchParams }: PageProps<'/app/[clientSlug]'>) {
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

  // Overhaul visual — Fase 3: `?page=`/`?limit=` do rodape de paginacao.
  const initialPage = parsePageNumber(resolvedSearchParams.page)
  const initialPageSize = parsePageSize(resolvedSearchParams.limit)

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
      // Cada disco fica separado (sem somar capacidade/livre entre discos
      // heterogeneos do mesmo device) — a UI desenha uma barra por disco.
      const disks = device.disks
        .filter((disk) => (disk.capacidadeGb ?? 0) > 0)
        .map((disk) => {
          const capacidadeGb = disk.capacidadeGb ?? 0
          const usedGb = Math.max(capacidadeGb - (disk.espacoLivreGb ?? 0), 0)
          return { unidade: disk.unidade, tipo: disk.tipo, capacidadeGb, usedGb }
        })
      const types = Array.from(new Set(device.disks.map((disk) => disk.tipo).filter((tipo): tipo is string => Boolean(tipo))))
      const lastCollectionAt = device.logs[0]?.coletadoEm ?? null

      return {
        id: device.id,
        hostname: device.hostname,
        usuario: device.usuario,
        disks,
        types,
        presence: getDevicePresence(lastCollectionAt, alertOfflineHours, now),
        detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
      }
    })
    .filter((device) => device.disks.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Armazenamento</h1>
          <p className="text-muted-foreground">
            {storageDevices.length} dispositivo{storageDevices.length !== 1 ? 's' : ''} com armazenamento reportado para a empresa atual.
          </p>
        </div>
      </div>

      <TenantStorageTable
        devices={storageDevices}
        initialType={initialTipo}
        initialUsageRange={initialFaixa}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
      />
    </div>
  )
}
