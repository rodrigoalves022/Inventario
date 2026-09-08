import { auth } from '@/auth'
import { HardDrive, Monitor, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { StatCard } from '@/components/stat-cards'
import { OsDistributionChart, StatusChart, RamDistributionChart } from '@/components/dashboard-charts-lazy'
import { TenantEmptyState } from '@/components/tenant-empty-state'
import { TenantRecentDevicesTable, type RecentDeviceRow } from '@/components/tenant-recent-devices-table'
import { FleetSecurityHero, buildFleetSecurityIndicators } from '@/components/fleet-security-hero'
import { CriticalDevicesPanel, buildCriticalDeviceEntries } from '@/components/critical-devices-panel'
import {
  RecentActivityPanel,
  formatAuditActionLabel,
  toDiscoveredDeviceType,
  type AuditActivityItem,
  type NetworkDiscoveryItem,
} from '@/components/recent-activity-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'
import { canManageTenant, canViewTenantAudit, getSessionPermissionUser } from '@/lib/permissions'
import { getDevicePresence } from '@/lib/inventory-alerts'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'
import { listAuditLogs } from '@/lib/audit-log'
import { DISK_USAGE_THRESHOLDS } from '@/lib/disk-usage'
import {
  countCriticalDiskDevices,
  createDeviceHrefResolver,
  formatRelativeAge,
} from '@/lib/dashboard/fleet-overview'

async function getRecentDevices(tenantSlug: string) {
  return prisma.device.findMany({
    where: getTenantDeviceWhere(tenantSlug),
    take: 10,
    orderBy: { updatedAt: 'desc' },
    include: {
      hardware: { select: { sistema: true, ramTotalGb: true } },
      networks: { where: { isPrimary: true }, select: { ip: true } },
      logs: {
        where: getTenantCollectionLogWhere(tenantSlug),
        orderBy: { coletadoEm: 'desc' },
        take: 1,
        select: { coletadoEm: true },
      },
    },
  })
}

/**
 * Duas perguntas, uma consulta rasa (Fase 4):
 *
 * 1. Quantas MAQUINAS estao na faixa critica de uso de disco — o numero do card
 *    de KPI que navega para `/storage?faixa=critical`, e que por isso precisa
 *    ser calculado pelo criterio do `/storage` (pior disco), nao pelos buckets
 *    de capacidade somada do relatorio. Ver `countCriticalDiskDevices`.
 * 2. O `id` de cada device por hostname — `DeviceReportRow` nao carrega `id`, e
 *    o painel de alerta critico precisa levar ao detalhe do ativo.
 *
 * `select` explicito e' o ponto: sao 3 colunas rasas sobre o mesmo conjunto que
 * `getDeviceReportRows` ja varre com todas as relacoes, nao uma segunda carga
 * cheia. E e' UMA consulta para a lista inteira — nada de um log por device em
 * laco.
 */
async function getDeviceDiskFootprints(tenantSlug: string) {
  return prisma.device.findMany({
    where: getTenantDeviceWhere(tenantSlug),
    select: {
      id: true,
      hostname: true,
      disks: { select: { capacidadeGb: true, espacoLivreGb: true } },
    },
  })
}

/** Escopo por `tenant.id` vindo de `requireTenantContext` — nunca por um id
 * recebido da URL (RNF004). Indice `[clientId, lastSeenAt]` cobre exatamente
 * este acesso. */
async function getRecentDiscoveries(clientId: string) {
  return prisma.discoveredDevice.findMany({
    where: { clientId },
    select: { id: true, ip: true, hostname: true, vendor: true, deviceType: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 5,
  })
}

export default async function TenantDashboardPage({ params }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  // Onda 1: sessao + configuracoes do tenant. As duas decidem o resto — os
  // limiares alimentam o status efetivo (RN010) e o disco critico, e o papel
  // decide se a consulta de auditoria chega a sair.
  const [session, tenantAlertSettings] = await Promise.all([auth(), getTenantAlertSettingsBySlug(tenantSlug)])
  const alertSettings = tenantAlertSettings ?? getDefaultAlertSettings()
  const { alertOfflineHours, alertDiskThresholdGb } = alertSettings
  // Fail-closed: tenant sem linha lida nunca aparece com a varredura ligada
  // (`Client.discoveryEnabled @default(false)`, Sprint 14).
  const discoveryEnabled = tenantAlertSettings?.discoveryEnabled ?? false
  const canViewAudit = canViewTenantAudit(getSessionPermissionUser(session), tenant)

  // Onda 2: tudo o que depende so dos limiares, em paralelo. Nenhuma consulta
  // global — todas saem de `getTenantDeviceWhere(tenantSlug)` ou de
  // `tenant.id`.
  const [recentDevicesRaw, rows, deviceDiskFootprints, discoveredRaw, auditLogs] = await Promise.all([
    getRecentDevices(tenantSlug),
    // Mesma consulta usada pelos relatorios (lib/reports/device-report.ts):
    // uma so fonte de verdade para agregados de frota, em vez de cada tela
    // somar hardware/disco do jeito dela. `alertDiskThresholdGb` do tenant
    // agora e' passado explicitamente porque `criticalDisks` alimenta o painel
    // de alerta critico — sem ele o painel usaria o default de 10 GB e
    // divergiria das configuracoes do cliente.
    getDeviceReportRows(getTenantDeviceWhere(tenantSlug), alertOfflineHours, alertDiskThresholdGb),
    getDeviceDiskFootprints(tenantSlug),
    getRecentDiscoveries(tenant.id),
    canViewAudit ? listAuditLogs({ clientId: tenant.id, limit: 5 }) : Promise.resolve([]),
  ])

  const summary = buildDeviceReportSummary(rows)
  const now = new Date()

  if (summary.totalDevices === 0) {
    return (
      <div className="space-y-6">
        <TenantEmptyState
          clientId={tenant.id}
          clientName={tenant.name}
          canManageCredentials={canManageTenant(getSessionPermissionUser(session), tenant)}
        />
      </div>
    )
  }

  const assetsPath = getTenantPath(tenantSlug, 'assets')
  const resolveDeviceHref = createDeviceHrefResolver(deviceDiskFootprints, tenantSlug)

  const recentDevices: RecentDeviceRow[] = recentDevicesRaw.map((device) => {
    const lastCollectionAt = device.logs[0]?.coletadoEm ?? null
    return {
      id: device.id,
      hostname: device.hostname,
      ip: device.networks[0]?.ip ?? null,
      sistema: device.hardware?.sistema ?? null,
      ramLabel: device.hardware?.ramTotalGb ? `${device.hardware.ramTotalGb} GB` : '—',
      lastCollectionAbsolute: lastCollectionAt ? lastCollectionAt.toLocaleString('pt-BR') : null,
      lastCollectionRelative: lastCollectionAt ? formatRelativeAge(lastCollectionAt, now) : null,
      presence: getDevicePresence(lastCollectionAt, alertOfflineHours, now),
      detailsPath: getTenantPath(tenantSlug, `assets/${device.id}`),
    }
  })

  const securityIndicators = buildFleetSecurityIndicators(summary, rows)
  const criticalDiskDevices = countCriticalDiskDevices(deviceDiskFootprints)
  const { entries: criticalEntries, totalCritical } = buildCriticalDeviceEntries({
    rows,
    now,
    resolveHref: resolveDeviceHref,
  })

  const discoveredItems: NetworkDiscoveryItem[] = discoveredRaw.map((device) => ({
    id: device.id,
    ip: device.ip,
    label: device.hostname ?? device.vendor,
    deviceType: toDiscoveredDeviceType(device.deviceType),
    lastSeenLabel: formatRelativeAge(device.lastSeenAt, now),
  }))

  const auditItems: AuditActivityItem[] = auditLogs.map((log) => ({
    id: log.id,
    actionLabel: formatAuditActionLabel(log.action),
    actorLabel: log.actorEmail ?? 'sistema',
    targetLabel: typeof log.metadata?.hostname === 'string' ? log.metadata.hostname : null,
    whenLabel: formatRelativeAge(new Date(log.createdAt), now),
  }))

  const osData = summary.osDistribution.map((item) => ({ name: item.name, value: item.value }))
  const statusData = [
    { name: 'Online', value: summary.online },
    { name: 'Offline', value: summary.offline },
    { name: 'Warning', value: summary.warning },
  ]
  const ramData = summary.ramDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))
  const diskData = summary.diskUsageDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))

  return (
    <div className="space-y-6">
      <div>
        {/* Titulo fica no cabecalho fixo; aqui so o contexto. */}
        <p className="text-muted-foreground">
          Monitoramento em tempo real dos ativos de TI da empresa <span className="font-medium text-foreground">{tenant.name}</span>.
        </p>
      </div>

      <FleetSecurityHero
        indicators={securityIndicators}
        totalDevices={summary.totalDevices}
        reportsHref={getTenantPath(tenantSlug, 'reports')}
      />

      {/*
        Grid de KPI. Cada card navega para a listagem que mostra EXATAMENTE a
        populacao que ele conta — por isso os tres cards de status apontam para
        `/assets` (computadores + servidores), e nao para `/computers`, que
        exclui servidores por definicao e devolveria menos linhas do que o
        numero do card promete. `/storage?faixa=critical` fecha o mesmo
        contrato pelo lado do disco (ver `countCriticalDiskDevices`).

        Nenhum card leva micro-tendencia: nao existe serie temporal AGREGADA de
        frota nesta base (`MetricSample` e' por dispositivo), e um sparkline
        alimentado por dado sintetico num painel de operacao seria informacao
        fabricada. O contexto de cada card e' um percentual ou uma contagem
        real.
      */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          title="Máquinas monitoradas"
          value={summary.totalDevices}
          subtitle={`${summary.computadores} computador${summary.computadores === 1 ? '' : 'es'} · ${summary.servidores} servidor${summary.servidores === 1 ? '' : 'es'}`}
          icon={<Monitor className="h-6 w-6" />}
          variant="primary"
          featured
          href={assetsPath}
        />
        <StatCard
          title="Online agora"
          value={summary.online}
          subtitle={`${summary.availabilityPercent}% de disponibilidade`}
          icon={<Wifi className="h-5 w-5" />}
          variant="success"
          href={`${assetsPath}?status=online`}
        />
        <StatCard
          title="Em atenção"
          value={summary.warning}
          subtitle={`Disco abaixo de ${alertDiskThresholdGb} GB livres ou RAM abaixo do limiar`}
          icon={<TriangleAlert className="h-5 w-5" />}
          variant="warning"
          valueClassName={summary.warning > 0 ? 'text-warning' : undefined}
          href={`${assetsPath}?status=warning`}
        />
        <StatCard
          title="Sem coleta recente"
          value={summary.offline}
          subtitle={`Sem contato há ${alertOfflineHours}h ou mais`}
          icon={<WifiOff className="h-5 w-5" />}
          variant="danger"
          valueClassName={summary.offline > 0 ? 'text-destructive' : undefined}
          href={`${assetsPath}?status=offline`}
        />
        <StatCard
          title="Disco crítico"
          value={criticalDiskDevices}
          subtitle={`Pior disco acima de ${DISK_USAGE_THRESHOLDS.critical}% usado`}
          icon={<HardDrive className="h-5 w-5" />}
          variant="danger"
          valueClassName={criticalDiskDevices > 0 ? 'text-destructive' : undefined}
          href={`${getTenantPath(tenantSlug, 'storage')}?faixa=critical`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OsDistributionChart data={osData} computersPath={getTenantPath(tenantSlug, 'computers')} />
        <StatusChart data={statusData} computersPath={getTenantPath(tenantSlug, 'computers')} />
        <RamDistributionChart data={ramData} />
        <RamDistributionChart
          data={diskData}
          title="Uso de disco por máquina"
          description="Quantidade de máquinas por faixa de uso — não soma capacidade"
        />
      </div>

      {/* Painel duplo: o que exige acao (esquerda) ao lado do que aconteceu
          (direita). */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CriticalDevicesPanel
          entries={criticalEntries}
          totalCritical={totalCritical}
          alertDiskThresholdGb={alertDiskThresholdGb}
          alertOfflineHours={alertOfflineHours}
          allDevicesHref={`${assetsPath}?status=offline`}
        />
        <RecentActivityPanel
          discovery={{
            enabled: discoveryEnabled,
            items: discoveredItems,
            href: getTenantPath(tenantSlug, 'network'),
          }}
          audit={canViewAudit ? { items: auditItems, href: getTenantPath(tenantSlug, 'audit') } : null}
        />
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Últimas atualizações
          </CardTitle>
          <CardDescription>
            Somente dispositivos pertencentes ao tenant atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <TenantRecentDevicesTable devices={recentDevices} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
