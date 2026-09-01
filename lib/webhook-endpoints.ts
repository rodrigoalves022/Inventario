import crypto from 'crypto'
import prisma from '@/lib/prisma'

/**
 * Sprint 11, item A. Mecanismo ADICIONAL de webhook, paralelo a
 * Client.alertWebhookEnabled/alertWebhookUrl (lib/alert-webhook.ts,
 * lib/availability-alerts.ts) — aquele continua funcionando exatamente como
 * antes, sem nenhuma alteracao de comportamento. Diferencas: aqui um cliente
 * pode cadastrar VARIOS endpoints, cada um recebendo so os eventos que
 * escolheu (`events`), com o payload assinado por HMAC-SHA256
 * (header X-Webhook-Signature) usando um segredo por endpoint.
 *
 * Catalogo fechado de eventos — os mesmos ja emitidos hoje pelo caminho
 * reativo de app/api/agent/checkin/route.ts ('device.warning' /
 * 'device.recovered') e pela varredura de disponibilidade/disco de
 * lib/availability-alerts.ts ('device.offline' / 'device.online' /
 * 'device.low_disk' / 'device.disk_ok'). Confirmado por leitura direta dos
 * dois arquivos antes de fixar esta lista, nao presumido.
 */
export const WEBHOOK_EVENTS = [
  'device.offline',
  'device.online',
  'device.low_disk',
  'device.disk_ok',
  'device.warning',
  'device.recovered',
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'device.offline': 'Dispositivo ficou offline',
  'device.online': 'Dispositivo voltou a coletar',
  'device.low_disk': 'Disco abaixo do limiar',
  'device.disk_ok': 'Disco voltou ao normal',
  'device.warning': 'Dispositivo entrou em atenção',
  'device.recovered': 'Dispositivo saiu de atenção',
}

/**
 * TEXTO PLANO de proposito — correcao deliberada ao pedido original (que
 * citava `secretHash`): HMAC-SHA256 exige o segredo de volta a cada disparo
 * para recalcular a assinatura; um hash e' unidirecional e nao serve pra
 * assinar nada. Diferente de Client.enrollmentKeyHash, que so precisa
 * COMPARAR um hash contra uma chave apresentada pelo agente, nunca devolve-la.
 * Gerado sempre no servidor — nunca aceito de formulario, pra evitar segredo
 * fraco/reusado escolhido pelo usuario.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Nunca expor o segredo completo fora do instante da criacao — mesmo padrao
 * de UX de outros segredos do projeto (mostrar so uma vez, depois mascarar). */
export function maskWebhookSecret(secret: string): string {
  const visible = secret.slice(-4)
  return `••••••••${visible}`
}

export function signWebhookPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Fan-out fire-and-forget para todos os WebhookEndpoint ATIVOS do cliente
 * cujo `events` inclui o evento disparado — independente de
 * Client.alertWebhookEnabled (mecanismo antigo, lib/alert-webhook.ts), que
 * mantém seu próprio gate, sem relação com este. Nunca lança: uma falha aqui
 * nunca pode derrubar o check-in do agente nem a reconciliação de alertas
 * (mesmo princípio de sendAlertWebhook).
 */
export async function dispatchClientWebhookEndpoints(
  clientId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { clientId, isActive: true, events: { has: event } },
      select: { id: true, url: true, secret: true },
    })

    const body = JSON.stringify(payload)

    for (const endpoint of endpoints) {
      const signature = signWebhookPayload(endpoint.secret, body)

      void fetch(endpoint.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Webhook-Signature': signature },
        body,
        signal: AbortSignal.timeout(4000),
      }).catch((error) => {
        console.error(`[webhook-endpoints] Falha ao enviar para endpoint ${endpoint.id}:`, error)
      })
    }
  } catch (error) {
    console.error('[webhook-endpoints] Falha ao consultar endpoints do cliente:', error)
  }
}
