import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        {[
          { label: 'Taxa de disponibilidade', value: `${summary.availabilityPercent}%` },
          { label: 'Máquinas online', value: String(summary.online) },
          { label: 'Máquinas offline', value: String(summary.offline) },
          { label: 'Em atenção', value: String(summary.warning) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição de sistemas operacionais</h2>
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
      </div>

      {summary.diskUsageDistribution.some((bucket) => bucket.count > 0) && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Uso de disco por máquina</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Quantidade de máquinas por faixa de uso — máquinas diferentes têm discos de tamanhos
            diferentes, então um percentual único somando tudo não representa nenhuma delas.
          </p>
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
        </div>
      )}
    </div>
  )
}
