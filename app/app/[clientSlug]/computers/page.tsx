import Link from 'next/link'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { getTenantPath } from '@/lib/tenant-links'
import { buildTenantDeviceRow } from '@/lib/tenant-device-rows'
import { canManageTenantAlerts, canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantAlertSettingsForm } from '@/components/tenant-alert-settings-form'
import { TenantComputersTable } from '@/components/tenant-computers-table'
import { parsePageNumber, parsePageSize } from '@/lib/table-pagination'

export default async function TenantComputersPage({ params, searchParams }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug
  const session = await auth()

  const resolvedSearchParams = (await searchParams) ?? {}
  // `search` e o nome generico (usado por /processors ao linkar por nome de
  // processador); `os` e mantido pelo link legado do grafico de SO no
  // dashboard (components/dashboard-charts.tsx) — os dois alimentam a mesma
  // caixa de busca da tabela.
  const searchFilterParam = resolvedSearchParams.search ?? resolvedSearchParams.os
  const initialSearch = typeof searchFilterParam === 'string' ? searchFilterParam : (searchFilterParam?.[0] ?? '')

  // Overhaul visual — Fase 3. `?page=`/`?limit=` do rodape de paginacao. O
  // parse defensivo (limit fora de 10/25/50/100 cai em 25) mora em
  // lib/table-pagination.ts e roda de novo dentro do componente.
  const initialPage = parsePageNumber(resolvedSearchParams.page)
  const initialPageSize = parsePageSize(resolvedSearchParams.limit)

  const statusFilterParam = resolvedSearchParams.status
  const rawStatus = typeof statusFilterParam === 'string' ? statusFilterParam : statusFilterParam?.[0]
  const initialStatusFilter: 'all' | 'online' | 'warning' | 'offline' =
    rawStatus === 'online' || rawStatus === 'warning' || rawStatus === 'offline' ? rawStatus : 'all'

  const criticalParam = resolvedSearchParams.critical ?? resolvedSearchParams.critico
  const rawCritical = typeof criticalParam === 'string' ? criticalParam : criticalParam?.[0]
  const initialCriticalFilter: 'all' | 'low_disk' | 'low_ram' | 'stale_collection' =
    rawCritical === 'low_disk' || rawCritical === 'low_ram' || rawCritical === 'stale_collection' ? rawCritical : 'all'

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

  // Sprint 14: o fallback repete o default fail-closed do banco
  // (`Client.discoveryEnabled @default(false)`) — tenant sem linha lida nunca
  // aparece com a varredura ligada no formulario.
  const settings = tenantAlertSettings ?? {
    clientId: tenant.id,
    discoveryEnabled: false,
    ...getDefaultAlertSettings(),
  }
  const devices = allDevices
    .filter((device) => !isServerOperatingSystem(device.hardware?.sistema))
    .map((device) => buildTenantDeviceRow(device, settings, tenantSlug))

  const sessionUser = getSessionPermissionUser(session)
  const canManageAlerts = canManageTenantAlerts(sessionUser, tenant)
  const canOperate = canOperateTenant(sessionUser, tenant)

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

      {canManageAlerts ? (
        <TenantAlertSettingsForm
          tenantSlug={tenantSlug}
          settings={settings}
          discoveryEnabled={settings.discoveryEnabled}
        />
      ) : null}

      <TenantComputersTable
        devices={devices}
        initialSearch={initialSearch}
        initialStatusFilter={initialStatusFilter}
        initialCriticalFilter={initialCriticalFilter}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
        tenantSlug={tenantSlug}
        canOperate={canOperate}
      />
    </div>
  )
}
