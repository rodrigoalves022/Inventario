import { Download, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/stat-cards'
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

      {/* Usa o StatCard base (components/stat-cards.tsx) em vez de reimplementar
          o hover à mão — elimina a duplicação e corrige o bug do card estático
          ("Taxa de disponibilidade") que antes não tinha hover nenhum. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Taxa de disponibilidade"
          value={`${summary.availabilityPercent}%`}
          valueClassName="text-success"
        />
        <StatCard
          title="Dispositivos online"
          value={summary.online}
          valueClassName="text-info"
          href={`${getTenantPath(tenantSlug, 'computers')}?status=online`}
        />
        <StatCard
          title="Dispositivos offline"
          value={summary.offline}
          valueClassName="text-destructive"
          href={`${getTenantPath(tenantSlug, 'computers')}?status=offline`}
        />
        <StatCard
          title="Status warning"
          value={summary.warning}
          valueClassName="text-warning"
          href={`${getTenantPath(tenantSlug, 'computers')}?status=warning`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição de sistemas operacionais</h2>
          <div className="space-y-3">
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
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold text-foreground">Uso de disco por máquina</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Quantidade de máquinas por faixa de uso — discos de tamanhos diferentes não se
            resumem a um único percentual somado.
          </p>
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
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Distribuição de RAM</h2>
          <div className="space-y-3">
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
                      <div className="h-full rounded-full bg-info" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Últimas coletas</h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma coleta registrada ainda.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-foreground">{log.device.hostname}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.coletadoEm).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{log.mensagem ?? '-'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
