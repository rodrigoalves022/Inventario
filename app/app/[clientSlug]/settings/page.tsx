import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { WebhookEndpointsPanel } from '@/components/webhook-endpoints-panel'
import {
  decryptWebhookSecret,
  maskWebhookSecret,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from '@/lib/webhook-endpoints'

export default async function TenantSettingsPage({ params }: PageProps<'/app/[clientSlug]/settings'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const session = await auth()
  const canManage = canManageTenantAlerts(getSessionPermissionUser(session), tenant)

  // secret nunca sai deste modulo em texto pleno: so o valor mascarado
  // (maskWebhookSecret) atravessa para o componente client.
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { clientId: tenant.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, url: true, events: true, isActive: true, secret: true, createdAt: true },
  })

  const rows = endpoints.map((endpoint) => {
    // `secret` esta cifrado em repouso (Sprint 11, Backlog item 7) — precisa
    // decifrar antes de mascarar, senao maskWebhookSecret mostraria os
    // ultimos 4 caracteres do payload cifrado (sem relacao com o segredo
    // real). Defensivo contra falha de decifragem (nao deveria acontecer em
    // uso normal) para nao derrubar a pagina inteira por causa de uma linha.
    let maskedSecret = '••••••••????'
    try {
      maskedSecret = maskWebhookSecret(decryptWebhookSecret(endpoint.secret))
    } catch (error) {
      console.error(`[settings] Falha ao decifrar secret do endpoint ${endpoint.id}:`, error)
    }

    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events as WebhookEvent[],
      isActive: endpoint.isActive,
      maskedSecret,
      createdAt: endpoint.createdAt.toISOString(),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Endpoints de webhook por evento, com assinatura HMAC-SHA256 — mecanismo adicional ao
            webhook único configurado em Alertas, que continua funcionando sem alteração.
          </p>
        </div>
      </div>

      {/* Casca Panel (Sprint V20) — ver nota em alerts/page.tsx. */}
      <Panel>
        <PanelHeader
          title="Webhooks"
          description={
            <>
              Cada endpoint recebe apenas os eventos selecionados, com o payload assinado no header{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Webhook-Signature</code> (HMAC-SHA256
              usando o segredo do endpoint). O segredo é gerado automaticamente e mostrado apenas uma vez,
              no momento do cadastro.
            </>
          }
        />
        <PanelBody>
          {canManage ? (
            <WebhookEndpointsPanel tenantSlug={tenant.slug} endpoints={rows} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
          ) : (
            <div className="divide-y divide-surface-line">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.events.map((event) => WEBHOOK_EVENT_LABELS[event] ?? event).join(', ')}
                    </p>
                  </div>
                  <span
                    className={
                      row.isActive
                        ? 'shrink-0 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success'
                        : 'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {row.isActive ? 'Ativo' : 'Desativado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}
