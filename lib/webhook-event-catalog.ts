/**
 * Catalogo de eventos de WebhookEndpoint — extraido de lib/webhook-endpoints.ts
 * pra este modulo separado, SEM NENHUMA dependencia de Node (`crypto`, `net`,
 * `dns/promises`). Motivo: components/webhook-endpoints-panel.tsx e' um
 * componente "use client" que precisa de `WEBHOOK_EVENTS`/`WEBHOOK_EVENT_LABELS`
 * pra montar o formulario — se ele importar isso de lib/webhook-endpoints.ts
 * (que agora importa lib/webhook-url-guard.ts, que usa `node:net`/
 * `node:dns/promises` pra a checagem de SSRF), o bundler tenta incluir esses
 * modulos Node no bundle do navegador e quebra o build
 * ("UnhandledSchemeError: node:dns/promises"). lib/webhook-endpoints.ts
 * continua reexportando estes mesmos simbolos pra nao quebrar os imports
 * server-side ja existentes (actions.ts, page.tsx, availability-alerts.ts,
 * checkin/route.ts) — so o componente client passou a importar direto daqui.
 *
 * Sprint 11, item A. Mesmos eventos ja emitidos hoje pelo caminho reativo de
 * app/api/agent/checkin/route.ts ('device.warning' / 'device.recovered') e
 * pela varredura de disponibilidade/disco de lib/availability-alerts.ts
 * ('device.offline' / 'device.online' / 'device.low_disk' / 'device.disk_ok').
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
