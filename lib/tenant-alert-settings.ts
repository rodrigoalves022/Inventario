import prisma from '@/lib/prisma'
import { DEFAULT_ALERT_SETTINGS, normalizeAlertSettings, type InventoryAlertSettings } from '@/lib/inventory-alerts'

type RawAlertSettingsRow = {
  id: string
  alertsEnabled: boolean | number | string | null
  alertWebhookEnabled: boolean | number | string | null
  alertWebhookUrl: string | null
  alertDiskThresholdGb: number | string | null
  alertRamThresholdGb: number | string | null
  alertOfflineHours: number | string | null
  metricsRetentionDays: number | string | null
  discoveryEnabled: boolean | number | string | null
}

/**
 * Sprint 14. `discoveryEnabled` fica FORA de `InventoryAlertSettings`
 * (lib/inventory-alerts.ts) de proposito, apesar de compartilhar o mesmo
 * formulario e a mesma Server Action que `alertsEnabled`/`alertWebhookEnabled`:
 * `InventoryAlertSettings` alimenta `deriveInventoryIssues`/
 * `reconcileAvailabilityEvents`/`getDevicePresence` — logica de ALERTA. A
 * varredura de rede nao e' um alerta; enfiar o flag ali arrastaria um campo
 * irrelevante para dentro de todo o caminho de decisao de alerta (e de toda
 * fixture de teste que constroi esse tipo). Ele vive aqui, no registro
 * persistido por tenant, junto de `clientId`.
 */
export type TenantAlertSettingsRecord = InventoryAlertSettings & {
  clientId: string
  discoveryEnabled: boolean
}

/**
 * Fail-closed: qualquer valor que nao seja reconhecidamente verdadeiro vira
 * `false`. Uma coluna nula (linha gravada antes da migration desta sprint) ou
 * um valor inesperado NUNCA deve ligar a varredura sozinho.
 */
function toDiscoveryEnabled(value: boolean | number | string | null | undefined) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}

function mapRow(row: RawAlertSettingsRow | undefined | null): TenantAlertSettingsRecord | null {
  if (!row) return null

  return {
    clientId: row.id,
    discoveryEnabled: toDiscoveryEnabled(row.discoveryEnabled),
    ...normalizeAlertSettings({
      alertsEnabled: row.alertsEnabled,
      alertWebhookEnabled: row.alertWebhookEnabled,
      alertWebhookUrl: row.alertWebhookUrl,
      alertDiskThresholdGb: row.alertDiskThresholdGb,
      alertRamThresholdGb: row.alertRamThresholdGb,
      alertOfflineHours: row.alertOfflineHours,
      metricsRetentionDays: row.metricsRetentionDays,
    }),
  }
}

export async function getTenantAlertSettingsBySlug(clientSlug: string) {
  const rows = await prisma.$queryRaw<RawAlertSettingsRow[]>`
    SELECT
      "id",
      "alertsEnabled",
      "alertWebhookEnabled",
      "alertWebhookUrl",
      "alertDiskThresholdGb",
      "alertRamThresholdGb",
      "alertOfflineHours",
      "metricsRetentionDays",
      "discoveryEnabled"
    FROM "clients"
    WHERE "slug" = ${clientSlug}
    LIMIT 1
  `

  return mapRow(rows[0])
}

export async function getTenantAlertSettingsByClientId(clientId: string | null | undefined) {
  if (!clientId) return null

  const rows = await prisma.$queryRaw<RawAlertSettingsRow[]>`
    SELECT
      "id",
      "alertsEnabled",
      "alertWebhookEnabled",
      "alertWebhookUrl",
      "alertDiskThresholdGb",
      "alertRamThresholdGb",
      "alertOfflineHours",
      "metricsRetentionDays",
      "discoveryEnabled"
    FROM "clients"
    WHERE "id" = ${clientId}
    LIMIT 1
  `

  return mapRow(rows[0])
}

/**
 * Sprint 14: `discoveryEnabled` entra como campo do payload de escrita (mesmo
 * UPDATE, mesma Server Action) — ver a nota em `TenantAlertSettingsRecord`
 * sobre por que ele nao faz parte de `InventoryAlertSettings`.
 */
export type TenantSettingsUpdate = InventoryAlertSettings & {
  discoveryEnabled: boolean
}

export async function updateTenantAlertSettings(clientId: string, settings: TenantSettingsUpdate) {
  await prisma.$executeRaw`
    UPDATE "clients"
    SET
      "alertsEnabled" = ${settings.alertsEnabled},
      "alertWebhookEnabled" = ${settings.alertWebhookEnabled},
      "alertWebhookUrl" = ${settings.alertWebhookUrl},
      "alertDiskThresholdGb" = ${settings.alertDiskThresholdGb},
      "alertRamThresholdGb" = ${settings.alertRamThresholdGb},
      "alertOfflineHours" = ${settings.alertOfflineHours},
      "metricsRetentionDays" = ${settings.metricsRetentionDays},
      "discoveryEnabled" = ${settings.discoveryEnabled}
    WHERE "id" = ${clientId}
  `
}

export function getDefaultAlertSettings() {
  return { ...DEFAULT_ALERT_SETTINGS }
}
