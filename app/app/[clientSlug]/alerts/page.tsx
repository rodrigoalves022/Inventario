import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { AlertRulesPanel } from '@/components/alert-rules-panel'
import { ALERT_METRIC_LABELS, parseSoftwareBlacklistMetadata, type AlertMetric } from '@/lib/alert-rules'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { KpiCard } from '@/components/ui/kpi-card'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { AlertTriangle, BellRing, CheckCircle2, History, ShieldAlert } from 'lucide-react'

const SEVERITY_TONES: Record<string, StatusPillTone> = {
  warning: 'warning',
  critical: 'destructive',
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
      select: { id: true, name: true, metric: true, severity: true, enabled: true, pattern: true },
    }),
    prisma.alertEvent.findMany({
      where: { clientId: tenant.id },
      orderBy: { firedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        message: true,
        severity: true,
        metric: true,
        metadataJson: true,
        firedAt: true,
        resolvedAt: true,
        device: { select: { hostname: true } },
      },
    }),
  ])

  const openCount = events.filter((e) => !e.resolvedAt).length
  const criticalOpenCount = events.filter((e) => !e.resolvedAt && e.severity === 'critical').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
          <p className="text-muted-foreground">
            Regras sobre a postura de segurança coletada e histórico de disparos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Regras Ativas"
          value={rules.filter((r) => r.enabled).length}
          subtitle={`de ${rules.length} configurada(s)`}
          icon={<BellRing />}
          tone="primary"
        />
        <KpiCard
          label="Disparos em Aberto"
          value={openCount}
          subtitle="aguardando normalização"
          icon={<AlertTriangle />}
          tone={openCount > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={openCount > 0}
        />
        <KpiCard
          label="Críticos Abertos"
          value={criticalOpenCount}
          subtitle="severidade crítica ativa"
          icon={<ShieldAlert />}
          tone={criticalOpenCount > 0 ? 'destructive' : 'neutral'}
          emphasizeValue={criticalOpenCount > 0}
        />
        <KpiCard
          label="Resolvidos (Recentes)"
          value={events.filter((e) => Boolean(e.resolvedAt)).length}
          subtitle="nos últimos 50 disparos"
          icon={<CheckCircle2 />}
          tone="success"
        />
      </div>

      {/*
        Casca Panel (Sprint V20): mesma regua do resto do tenant — rounded-xl,
        px-5, titulo text-base. Listas dentro do painel sao linhas com
        divide-y, nunca cartoes com borda propria (card dentro de card).
      */}
      <Panel>
        <PanelHeader
          icon={<BellRing />}
          title="Regras"
          description="Condições avaliadas a cada coleta do agente."
        />
        <PanelBody>
          {canManage ? (
            <AlertRulesPanel tenantSlug={tenant.slug} rules={rules} />
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
          ) : (
            <div className="divide-y divide-surface-line">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ALERT_METRIC_LABELS[rule.metric as AlertMetric] ?? rule.metric}
                      {rule.pattern ? ` ("${rule.pattern}")` : ''}
                    </p>
                  </div>
                  <StatusPill tone={rule.enabled ? 'success' : 'neutral'} label={rule.enabled ? 'Ativa' : 'Desativada'} />
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<History />}
          title="Histórico de disparos"
          description="Os 50 disparos mais recentes, abertos e resolvidos."
        />
        <PanelBody>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum alerta disparado ainda. Alertas aparecem aqui quando uma regra ativa encontra a
              condição na próxima coleta do agente.
            </p>
          ) : (
            <div className="divide-y divide-surface-line">
              {events.map((event) => {
                // Sprint 13: exibicao destacada do metadataJson gravado pelo
                // check-in (Sprint 12) — hoje so 'software_blacklisted' carrega
                // metadata estruturado; as outras 4 metricas tem metadataJson
                // null e a mensagem em `message` ja e autoexplicativa. Parse
                // defensivo (nunca confia cegamente no conteudo armazenado).
                const softwareMetadata =
                  event.metric === 'software_blacklisted' ? parseSoftwareBlacklistMetadata(event.metadataJson) : null

                return (
                  <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        <span className="data-mono">{event.device.hostname}</span> · {event.message}
                      </p>
                      {softwareMetadata && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
                          <span>
                            Software: <span className="font-semibold">{softwareMetadata.softwareNome}</span>
                          </span>
                          <span>
                            Versão: <span className="font-medium">{softwareMetadata.softwareVersao ?? 'não apurada'}</span>
                          </span>
                          <span>
                            Editor: <span className="font-medium">{softwareMetadata.softwareEditor ?? 'não apurado'}</span>
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Disparado em {new Date(event.firedAt).toLocaleString('pt-BR')}
                        {event.resolvedAt && ` · resolvido em ${new Date(event.resolvedAt).toLocaleString('pt-BR')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill
                        tone={SEVERITY_TONES[event.severity] ?? 'neutral'}
                        label={SEVERITY_LABELS[event.severity] ?? event.severity}
                      />
                      <StatusPill
                        tone={event.resolvedAt ? 'neutral' : 'destructive'}
                        label={event.resolvedAt ? 'Resolvido' : 'Aberto'}
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
  )
}
