import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { decryptJsonSecret, encryptJsonSecret } from '@/lib/encrypted-secret'
import { checkWebhookUrlSafety } from '@/lib/webhook-url-guard'
import { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENTS, type WebhookEvent } from '@/lib/webhook-event-catalog'

/**
 * Sprint 11, item A. Mecanismo ADICIONAL de webhook, paralelo a
 * Client.alertWebhookEnabled/alertWebhookUrl (lib/alert-webhook.ts,
 * lib/availability-alerts.ts) — aquele continua funcionando exatamente como
 * antes, sem nenhuma alteracao de comportamento. Diferencas: aqui um cliente
 * pode cadastrar VARIOS endpoints, cada um recebendo so os eventos que
 * escolheu (`events`), com o payload assinado por HMAC-SHA256
 * (header X-Webhook-Signature) usando um segredo por endpoint.
 *
 * WEBHOOK_EVENTS/WEBHOOK_EVENT_LABELS/WebhookEvent moraram aqui ate a
 * correcao do SSRF (Backlog item 5): foram extraidos pra
 * lib/webhook-event-catalog.ts porque este arquivo agora importa
 * lib/webhook-url-guard.ts (`node:net`/`node:dns/promises`), e
 * components/webhook-endpoints-panel.tsx ("use client") precisa do catalogo
 * sem puxar Node builtins pro bundle do navegador. Reexportados aqui so pra
 * nao quebrar os imports server-side ja existentes.
 */
export { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENTS, type WebhookEvent }

/**
 * NAO e' um hash (`secretHash`, como o pedido original citava) porque
 * HMAC-SHA256 exige o segredo de volta a cada disparo para recalcular a
 * assinatura; um hash e' unidirecional e nao serve pra assinar nada.
 * Diferente de Client.enrollmentKeyHash, que so precisa COMPARAR um hash
 * contra uma chave apresentada pelo agente, nunca devolve-la. Gerado sempre
 * no servidor — nunca aceito de formulario, pra evitar segredo fraco/reusado
 * escolhido pelo usuario.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Cifra o segredo em texto plano antes de persistir em `WebhookEndpoint.secret`
 * (Sprint 11, Backlog item 7 — BAIXO, corrigido nesta sessao). AES-256-GCM,
 * mesmo nucleo de lib/encrypted-secret.ts usado por
 * lib/provisioning-credentials.ts, com um `keySalt` proprio (chave derivada
 * diferente da de provisionamento, mesmo segredo mestre). O campo continua
 * `String` no schema — so o CONTEUDO passa a ser o payload cifrado
 * serializado, nao mais o hex plano.
 */
const WEBHOOK_SECRET_KEY_SALT = 'inventario-webhook-endpoint-secret'

type WebhookSecretPayload = { secret: string }

export function encryptWebhookSecret(secret: string): string {
  return encryptJsonSecret<WebhookSecretPayload>({ secret }, WEBHOOK_SECRET_KEY_SALT)
}

export function decryptWebhookSecret(encrypted: string): string {
  return decryptJsonSecret<WebhookSecretPayload>(encrypted, WEBHOOK_SECRET_KEY_SALT).secret
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
 * Fan-out para todos os WebhookEndpoint ATIVOS do cliente cujo `events`
 * inclui o evento disparado — independente de Client.alertWebhookEnabled
 * (mecanismo antigo, lib/alert-webhook.ts), que mantém seu próprio gate, sem
 * relação com este. Nunca lança: uma falha aqui nunca pode derrubar o
 * check-in do agente nem a reconciliação de alertas (mesmo princípio de
 * sendAlertWebhook). Quem chama esta função sempre faz `void
 * dispatchClientWebhookEndpoints(...)` — ela pode ficar totalmente async por
 * dentro (aguardar a checagem de SSRF e o fetch de cada endpoint) sem
 * bloquear ninguem.
 *
 * checkWebhookUrlSafety é chamado de novo AQUI, a cada disparo — não confia
 * na validação feita no cadastro/edição do endpoint (Sprint 11, Backlog item
 * 5). Isso é a proteção real contra DNS rebinding: o hostname pode ter
 * resolvido para um IP público no momento do cadastro e ter sido trocado
 * para um IP interno depois, sem que o cadastro mude. Se a checagem falhar
 * para um disparo específico, não dispara, loga o motivo e segue para os
 * outros endpoints — não derruba o restante do fan-out.
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

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const safety = await checkWebhookUrlSafety(endpoint.url)
        if (!safety.ok) {
          console.error(
            `[webhook-endpoints] Disparo bloqueado para endpoint ${endpoint.id} (SSRF guard): ${safety.reason}`
          )
          return
        }

        let secret: string
        try {
          secret = decryptWebhookSecret(endpoint.secret)
        } catch (error) {
          console.error(`[webhook-endpoints] Falha ao decifrar secret do endpoint ${endpoint.id}:`, error)
          return
        }

        const signature = signWebhookPayload(secret, body)

        try {
          await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'X-Webhook-Signature': signature },
            body,
            signal: AbortSignal.timeout(4000),
          })
        } catch (error) {
          console.error(`[webhook-endpoints] Falha ao enviar para endpoint ${endpoint.id}:`, error)
        }
      })
    )
  } catch (error) {
    console.error('[webhook-endpoints] Falha ao consultar endpoints do cliente:', error)
  }
}
