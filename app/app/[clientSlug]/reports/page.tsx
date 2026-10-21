import { Download, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantCollectionLogWhere, getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'
import { getDefaultAlertSettings, getTenantAlertSettingsBySlug } from '@/lib/tenant-alert-settings'

export default async function TenantReportsPage({ params }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug
  const tenantAlertSettings = await getTenantAlertSettingsBySlug(tenantSlug)
  const alertOfflineHours = (tenantAlertSettings ?? getDefaultAlertSettings()).alertOfflineHours

  // Mesma consulta usada pelo CSV/PDF (lib/reports/device-report.ts): a tela
  // e' so mais uma vitrine dos mesmos numeros, nunca uma segunda conta.
  const rows = await getDeviceReportRows(getTenantDeviceWhere(tenantSlug), alertOfflineHours)
  const summary = buildDeviceReportSummary(rows)

  const logs = await prisma.collectionLog.findMany({
    where: getTenantCollectionLogWhere(tenantSlug),
    orderBy: { coletadoEm: 'desc' },
    take: 10,
    include: { device: { select: { hostname: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Resumo operacional baseado exclusivamente nos dados reais do cliente atual.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/tenant/${tenantSlug}/reports/csv`}>
              <Download className="h-4 w-4" />
              Baixar CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/tenant/${tenantSlug}/reports/pdf`}>
              <FileText className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      {/*
        "Taxa de disponibilidade" e' um PERCENTUAL DERIVADO — nao existe
        listagem que mostre "as maquinas que compoem 94%", entao ele nao tem
        para onde levar e continua sem `href`. O que muda na Sprint 16 e' que
        agora ele tambem nao FINGE levar: o KpiCard so aplica
        `surface-interactive` quando ha `href` ou `onClick`, entao o card parou
        de levantar 2px e ganhar halo no hover sem ser clicavel nem focalizavel,
        ao lado de tres cards que sao.
      */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taxa de disponibilidade"
          value={`${summary.availabilityPercent}%`}
          tone="success"
          emphasizeValue
        />
        <KpiCard
          label="Dispositivos online"
          value={summary.online}
          tone="info"
          emphasizeValue
          href={`${getTenantPath(tenantSlug, 'computers')}?status=online`}
        />
        <KpiCard
          label="Dispositivos offline"
          value={summary.offline}
          tone="destructive"
          emphasizeValue
          href={`${getTenantPath(tenantSlug, 'computers')}?status=offline`}
        />
        <KpiCard
          label="Status warning"
          value={summary.warning}
          tone="warning"
          emphasizeValue
          href={`${getTenantPath(tenantSlug, 'computers')}?status=warning`}
        />
      </div>

      {/*
        Regua dos quatro blocos (Sprint V20): todo Panel tem titulo E
        subtitulo — antes tres eram titulo seco e um so tinha paragrafo.

        Regra de cor das barras: a barra mede QUANTIDADE, nao estado, entao o
        preenchimento padrao e' `bg-primary` nos tres blocos. A unica excecao
        e' semantica de estado declarada: a faixa critica de disco usa
        `bg-destructive`, a mesma cor do rotulo dela. RAM deixou de usar
        `bg-info` — azul de "informacao" num histograma de capacidade nao
        dizia nada que o primary ja nao dissesse.
      */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Distribuição de sistemas operacionais"
            description="Máquinas por sistema operacional reportado, em proporção do parque."
          />
          <PanelBody className="space-y-3">
            {summary.osDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum sistema operacional reportado ainda.</p>
            ) : (
              summary.osDistribution.map((item) => {
                const percent = summary.totalDevices > 0 ? Math.round((item.value / summary.totalDevices) * 100) : 0
                return (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-muted-foreground">{item.value} ({percent}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Uso de disco por máquina"
            description="Quantidade de máquinas por faixa de uso — discos de tamanhos diferentes não se resumem a um único percentual somado."
          />
          <PanelBody>
            {summary.diskUsageDistribution.every((bucket) => bucket.count === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum disco reportado ainda.</p>
            ) : (
              <div className="space-y-3">
                {summary.diskUsageDistribution.map((bucket) => {
                  const maxCount = Math.max(...summary.diskUsageDistribution.map((b) => b.count), 1)
                  const percent = Math.round((bucket.count / maxCount) * 100)
                  const critical = bucket.label.includes('crítico')
                  return (
                    <div key={bucket.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className={critical ? 'font-medium text-destructive' : 'text-foreground'}>
                          {bucket.label}
                        </span>
                        <span className="text-muted-foreground">{bucket.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${critical ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Distribuição de RAM"
            description="Quantidade de máquinas por faixa de memória instalada."
          />
          <PanelBody className="space-y-3">
            {summary.ramDistribution.every((item) => item.count === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma informação de memória reportada ainda.</p>
            ) : (
              summary.ramDistribution.map((item) => {
                const maxCount = Math.max(...summary.ramDistribution.map((entry) => entry.count), 1)
                const percent = Math.round((item.count / maxCount) * 100)
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Últimas coletas"
            description="As 10 coletas mais recentes enviadas pelos agentes."
          />
          {/* Linhas com `divide-y`, nao cartoezinhos com borda propria: o
              Panel proibe card dentro de card (borda dentro de borda e'
              elevacao declarada duas vezes). `flush` porque cada linha ja
              carrega o recuo de 20px. E `.data-mono` no lugar de `font-mono`
              cru — e' a classe que todos os outros hostnames do app usam. */}
          <PanelBody flush>
            {logs.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma coleta registrada ainda.</p>
            ) : (
              <div className="divide-y divide-surface-line border-t border-surface-line">
                {logs.map((log) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="data-mono text-sm text-foreground">{log.device.hostname}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.coletadoEm).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{log.mensagem ?? '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
