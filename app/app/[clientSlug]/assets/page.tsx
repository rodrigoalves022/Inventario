import Link from 'next/link'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { buildTenantDeviceRow } from '@/lib/tenant-device-rows'
import { canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { TenantComputersTable } from '@/components/tenant-computers-table'
import { parsePageNumber, parsePageSize } from '@/lib/table-pagination'

/**
 * Listagem unificada de dispositivos do tenant (Opcao B escolhida pelo
 * usuario): mesma consulta base de `computers/page.tsx`, mas SEM o filtro
 * `isServerOperatingSystem` — mostra computadores e servidores juntos, com
 * paridade real de dados (issues/disco/status efetivo) via
 * `buildTenantDeviceRow`, a mesma funcao usada por `/computers`.
 *
 * `/computers` e `/servers` continuam existindo como estao (filtradas); esta
 * rota e o destino do card "Total de Máquinas" do dashboard, que soma os
 * dois totais num unico numero.
 */
export default async function TenantAssetsPage({ params, searchParams }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const resolvedSearchParams = (await searchParams) ?? {}
  const searchFilterParam = resolvedSearchParams.search ?? resolvedSearchParams.os
  const initialSearch = typeof searchFilterParam === 'string' ? searchFilterParam : (searchFilterParam?.[0] ?? '')

  const statusFilterParam = resolvedSearchParams.status
  const rawStatus = typeof statusFilterParam === 'string' ? statusFilterParam : statusFilterParam?.[0]
  const initialStatusFilter: 'all' | 'online' | 'warning' | 'offline' =
    rawStatus === 'online' || rawStatus === 'warning' || rawStatus === 'offline' ? rawStatus : 'all'

  const criticalParam = resolvedSearchParams.critical ?? resolvedSearchParams.critico
  const rawCritical = typeof criticalParam === 'string' ? criticalParam : criticalParam?.[0]
  const initialCriticalFilter: 'all' | 'low_disk' | 'low_ram' | 'stale_collection' =
    rawCritical === 'low_disk' || rawCritical === 'low_ram' || rawCritical === 'stale_collection' ? rawCritical : 'all'

  // `/assets` compartilha `TenantComputersTable` com `/computers`, entao herdou
  // o rodape de paginacao — e com ele a escrita de `?page=`/`?limit=` na URL.
  // Sem ler os dois de volta aqui, recarregar caia na pagina 1 com um `?page=3`
  // obsoleto pendurado na barra de endereco.
  const initialPage = parsePageNumber(resolvedSearchParams.page)
  const initialPageSize = parsePageSize(resolvedSearchParams.limit)

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
  const devices = allDevices.map((device) => buildTenantDeviceRow(device, settings, tenantSlug))

  const session = await auth()
  const canOperate = canOperateTenant(getSessionPermissionUser(session), tenant)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Todos os dispositivos</h1>
          <p className="text-muted-foreground">
            {devices.length} dispositivo{devices.length !== 1 ? 's' : ''} registrado{devices.length !== 1 ? 's' : ''} no
            tenant atual — computadores e servidores.
          </p>
        </div>
        <Link href={getTenantPath(tenantSlug, '')} className="text-sm text-primary hover:underline">
          Voltar ao dashboard
        </Link>
      </div>

      <TenantComputersTable
        devices={devices}
        initialSearch={initialSearch}
        initialStatusFilter={initialStatusFilter}
        initialCriticalFilter={initialCriticalFilter}
        initialPage={initialPage}
        initialPageSize={initialPageSize}
        showTypeColumn
        tenantSlug={tenantSlug}
        canOperate={canOperate}
      />
    </div>
  )
}
