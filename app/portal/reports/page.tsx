import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requirePortalContext } from '@/lib/portal-context'
import { getDeviceReportRows, buildDeviceReportSummary } from '@/lib/reports/device-report'

export default async function PortalReportsPage() {
  const context = await requirePortalContext()

  const rows = await getDeviceReportRows({ clientId: context.clientId })
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

      {summary.storageCapacityGb > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Uso geral de armazenamento</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {summary.storageUsedGb} GB usados de {summary.storageCapacityGb} GB
              </span>
              <span className="font-semibold">{summary.storageUsedPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${summary.storageUsedPercent}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
