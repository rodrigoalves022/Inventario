import { Activity, AlertCircle, Download, FileText, HardDrive, Monitor, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { requirePortalContext } from '@/lib/portal-context'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'
import { getDefaultAlertSettings, getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'

export default async function PortalReportsPage() {
  const context = await requirePortalContext()
  const tenantAlertSettings = await getTenantAlertSettingsByClientId(context.clientId)
  const alertOfflineHours = (tenantAlertSettings ?? getDefaultAlertSettings()).alertOfflineHours

  const rows = await getDeviceReportRows({ clientId: context.clientId }, alertOfflineHours)
  const summary = buildDeviceReportSummary(rows)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Resumo do parque de {context.clientName}, baseado exclusivamente nos dados coletados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/portal/reports/csv">
              <Download className="h-4 w-4" />
              Baixar CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/portal/reports/pdf">
              <FileText className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taxa de disponibilidade"
          value={`${summary.availabilityPercent}%`}
          subtitle="proporção online do parque"
          icon={<Activity />}
          tone="success"
          emphasizeValue
        />
        <KpiCard
          label="Máquinas online"
          value={summary.online}
          subtitle="conectadas recentemente"
          icon={<Wifi />}
          tone="info"
          emphasizeValue={summary.online > 0}
        />
        <KpiCard
          label="Máquinas offline"
          value={summary.offline}
          subtitle="sem comunicação recente"
          icon={<WifiOff />}
          tone={summary.offline > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={summary.offline > 0}
        />
        <KpiCard
          label="Em atenção"
          value={summary.warning}
          subtitle="com alerta de capacidade"
          icon={<AlertCircle />}
          tone={summary.warning > 0 ? 'warning' : 'neutral'}
          emphasizeValue={summary.warning > 0}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={<Monitor />}
            title="Distribuição de sistemas operacionais"
            description="Máquinas por sistema operacional reportado, em proporção do parque."
          />
          <PanelBody>
            {summary.osDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum sistema operacional reportado ainda.</p>
            ) : (
              <div className="space-y-3">
                {summary.osDistribution.map((item) => {
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
                })}
              </div>
            )}
          </PanelBody>
        </Panel>

        {summary.diskUsageDistribution.some((bucket) => bucket.count > 0) && (
          <Panel>
            <PanelHeader
              icon={<HardDrive />}
              title="Uso de disco por máquina"
              description="Quantidade de máquinas por faixa de uso — máquinas diferentes têm discos de tamanhos diferentes, então um percentual único somando tudo não representa nenhuma delas."
            />
            <PanelBody>
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
            </PanelBody>
          </Panel>
        )}
      </div>
    </div>
  )
}
