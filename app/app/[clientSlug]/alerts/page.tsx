import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { AlertRulesPanel } from '@/components/alert-rules-panel'
import { ALERT_METRIC_LABELS, type AlertMetric } from '@/lib/alert-rules'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES: Record<string, string> = {
  warning: 'border-warning/30 bg-warning/10 text-warning',
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
}

const SEVERITY_LABELS: Record<string, string> = {
  warning: 'Atenção',
  critical: 'Crítico',
}

export default async function TenantAlertsPage({ params }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const session = await auth()
  const canManage = canManageTenantAlerts(getSessionPermissionUser(session), tenant)

  const [rules, events] = await Promise.all([
    prisma.alertRule.findMany({
      where: { clientId: tenant.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, metric: true, severity: true, enabled: true },
    }),
    prisma.alertEvent.findMany({
      where: { clientId: tenant.id },
      orderBy: { firedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        message: true,
        severity: true,
        firedAt: true,
        resolvedAt: true,
        device: { select: { hostname: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
        <p className="text-muted-foreground">
          Regras sobre a postura de segurança coletada e histórico de disparos.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Regras</h2>
        {canManage ? (
          <AlertRulesPanel tenantSlug={tenant.slug} rules={rules} />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ALERT_METRIC_LABELS[rule.metric as AlertMetric] ?? rule.metric}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    rule.enabled ? 'border-success/30 bg-success/10 text-success' : 'text-muted-foreground'
                  )}
                >
                  {rule.enabled ? 'Ativa' : 'Desativada'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Histórico de disparos</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum alerta disparado ainda. Alertas aparecem aqui quando uma regra ativa encontra a
            condição na próxima coleta do agente.
          </p>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    <span className="font-mono">{event.device.hostname}</span> · {event.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Disparado em {new Date(event.firedAt).toLocaleString('pt-BR')}
                    {event.resolvedAt && ` · resolvido em ${new Date(event.resolvedAt).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      SEVERITY_STYLES[event.severity] ?? 'text-muted-foreground'
                    )}
                  >
                    {SEVERITY_LABELS[event.severity] ?? event.severity}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      event.resolvedAt
                        ? 'text-muted-foreground'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    )}
                  >
                    {event.resolvedAt ? 'Resolvido' : 'Aberto'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
