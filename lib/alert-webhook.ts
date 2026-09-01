/**
 * Disparo fire-and-forget de webhook de alerta, extraido de
 * app/api/agent/checkin/route.ts (Sprint 9, item A.1) para ser reaproveitado
 * tanto pelo caminho reativo original (status do proprio dispositivo que fez
 * o check-in) quanto pela varredura de disponibilidade/disco de
 * lib/availability-alerts.ts. Timeout curto (4s) e falha silenciosa
 * (so loga) de proposito: o check-in do agente nunca pode falhar ou atrasar
 * por causa de um endpoint de terceiro fora do ar.
 */
export function sendAlertWebhook(url: string, payload: unknown) {
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  }).catch((error) => {
    console.error('[alerts/webhook] Falha ao enviar webhook:', error)
  })
}
