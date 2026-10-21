import { auth } from '@/auth'
import { HardDrive, Monitor, TriangleAlert, Wifi, WifiOff } from 'lucide-react'
import prisma from '@/lib/prisma'
import { KpiCard } from '@/components/ui/kpi-card'
import { OsDistributionChart, RamDistributionChart } from '@/components/dashboard-charts-lazy'
import { TenantEmptyState } from '@/components/tenant-empty-state'
import { TenantRecentDevicesTable, type RecentDeviceRow } from '@/components/tenant-recent-devices-table'
import { InventorySecurityHero, buildSecurityIndicators } from '@/components/inventory-security-hero'
import { CriticalDevicesPanel, buildCriticalDeviceEntries } from '@/components/critical-devices-panel'
import {
  RecentActivityPanel,
  formatAuditActionLabel,
  toDiscoveredDeviceType,
  type AuditActivityItem,
  type NetworkDiscoveryItem,
} from '@/components/recent-activity-panel'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
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
} from '@/lib/dashboard/inventory-overview'

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
    // uma so fonte de verdade para agregados do parque, em vez de cada tela
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
        {/* Mesmo h1 do caminho com maquinas: sem ele, esta tela ficava sem
            nenhum h1 depois que a marca da Sidebar deixou de ser h1 (A2). */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Visão geral</h1>
        </div>
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

  const securityIndicators = buildSecurityIndicators(summary, rows)
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
  const ramData = summary.ramDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))
  const diskData = summary.diskUsageDistribution.map((bucket) => ({ name: bucket.label, value: bucket.count }))

  return (
    <div className="space-y-6">
      {/* O titulo da pagina e' DESTA pagina: o cabecalho fixo do shell
          (components/sidebar.tsx) renderiza apenas breadcrumbs, paleta de
          comando, seletor de cliente e menu de perfil. Cabecalho no padrao
          unico das 12 telas do tenant (Sprint V17): flex-wrap + h1 text-2xl +
          subtitulo na escala do body. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão geral</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real dos ativos de TI da empresa <span className="font-medium text-foreground">{tenant.name}</span>.
          </p>
        </div>
      </div>

      {/*
        Duas faixas com hierarquia explicita (Sprint V18): primeiro o que exige
        intervencao, depois o retrato consolidado do parque. Os 5 KPIs se
        dividem 3 + 2 por significado — decisao (atencao, sem coleta, disco
        critico) versus contexto (total, online) —, o que tambem elimina o card
        orfao do antigo grid de 5 sem inventar um sexto.

        Cada card navega para a listagem que mostra EXATAMENTE a populacao que
        ele conta — por isso os cards de status apontam para `/assets`
        (computadores + servidores), e nao para `/computers`, que exclui
        servidores por definicao e devolveria menos linhas do que o numero do
        card promete. `/storage?faixa=critical` fecha o mesmo contrato pelo lado
        do disco (ver `countCriticalDiskDevices`).

        Nenhum card leva micro-tendencia: nao existe serie temporal AGREGADA do
        parque nesta base (`MetricSample` e' por dispositivo), e um sparkline
        alimentado por dado sintetico num painel de operacao seria informacao
        fabricada. O contexto de cada card e' um percentual ou uma contagem
        real.
      */}
      <section aria-label="Ação imediata" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Em atenção"
            value={summary.warning}
            subtitle={`Disco abaixo de ${alertDiskThresholdGb} GB livres ou RAM abaixo do limiar`}
            icon={<TriangleAlert />}
            tone="warning"
            emphasizeValue={summary.warning > 0}
            href={`${assetsPath}?status=warning`}
          />
          <KpiCard
            label="Sem coleta recente"
            value={summary.offline}
            subtitle={`Sem contato há ${alertOfflineHours}h ou mais`}
            icon={<WifiOff />}
            tone="destructive"
            emphasizeValue={summary.offline > 0}
            href={`${assetsPath}?status=offline`}
          />
          <KpiCard
            label="Disco crítico"
            value={criticalDiskDevices}
            subtitle={`Pior disco acima de ${DISK_USAGE_THRESHOLDS.critical}% usado`}
            icon={<HardDrive />}
            tone="destructive"
            emphasizeValue={criticalDiskDevices > 0}
            href={`${getTenantPath(tenantSlug, 'storage')}?faixa=critical`}
          />
        </div>

        <CriticalDevicesPanel
          entries={criticalEntries}
          totalCritical={totalCritical}
          alertDiskThresholdGb={alertDiskThresholdGb}
          alertOfflineHours={alertOfflineHours}
          allDevicesHref={`${assetsPath}?status=offline`}
        />
      </section>

      <section aria-labelledby="inventory-portrait-title" className="space-y-6 border-t border-surface-line pt-6">
        <h2 id="inventory-portrait-title" className="section-label">
          Retrato do parque
        </h2>

        {/* Unico pico tipografico da tela: o `text-4xl` vive so no hero. */}
        <InventorySecurityHero
          indicators={securityIndicators}
          totalDevices={summary.totalDevices}
          reportsHref={getTenantPath(tenantSlug, 'reports')}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <KpiCard
            label="Máquinas monitoradas"
            value={summary.totalDevices}
            subtitle={`${summary.computadores} computador${summary.computadores === 1 ? '' : 'es'} · ${summary.servidores} servidor${summary.servidores === 1 ? '' : 'es'}`}
            icon={<Monitor />}
            tone="primary"
            href={assetsPath}
          />
          <KpiCard
            label="Online agora"
            value={summary.online}
            subtitle={`${summary.availabilityPercent}% de disponibilidade`}
            icon={<Wifi />}
            tone="success"
            href={`${assetsPath}?status=online`}
          />
        </div>

        {/* Sem o donut de Status: ele repetia exatamente os tres numeros dos
            KPIs de status, que ja estao maiores e clicaveis nesta mesma tela.
            Tres graficos: em lg o terceiro ocupa a linha inteira em vez de
            ficar orfao ao lado de um vazio. */}
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <OsDistributionChart data={osData} computersPath={getTenantPath(tenantSlug, 'computers')} />
          <RamDistributionChart data={ramData} />
          <div className="lg:col-span-2 xl:col-span-1">
            <RamDistributionChart
              data={diskData}
              title="Uso de disco por máquina"
              description="Quantidade de máquinas por faixa de uso — não soma capacidade"
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <RecentActivityPanel
            discovery={{
              enabled: discoveryEnabled,
              items: discoveredItems,
              href: getTenantPath(tenantSlug, 'network'),
            }}
            audit={canViewAudit ? { items: auditItems, href: getTenantPath(tenantSlug, 'audit') } : null}
          />

          <Panel>
            <PanelHeader
              title="Últimas coletas"
              description="Somente dispositivos pertencentes ao tenant atual"
            />
            {/* `flush`: a tabela sangra ate a borda do painel. O recuo de 20px e'
                das CELULAS (TABLE_CELL_CLASS ja usa px-5) — envolver numa segunda
                borda aqui seria card dentro de card, que o Panel proibe. */}
            <PanelBody flush>
              <div className="overflow-x-auto">
                <TenantRecentDevicesTable devices={recentDevices} />
              </div>
            </PanelBody>
          </Panel>
        </div>
      </section>
    </div>
  )
}
