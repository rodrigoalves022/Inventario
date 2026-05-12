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
}

export type TenantAlertSettingsRecord = InventoryAlertSettings & {
  clientId: string
}

function mapRow(row: RawAlertSettingsRow | undefined | null): TenantAlertSettingsRecord | null {
  if (!row) return null

  return {
    clientId: row.id,
    ...normalizeAlertSettings({
      alertsEnabled: row.alertsEnabled,
      alertWebhookEnabled: row.alertWebhookEnabled,
      alertWebhookUrl: row.alertWebhookUrl,
      alertDiskThresholdGb: row.alertDiskThresholdGb,
      alertRamThresholdGb: row.alertRamThresholdGb,
      alertOfflineHours: row.alertOfflineHours,
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
      "alertOfflineHours"
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
      "alertOfflineHours"
    FROM "clients"
    WHERE "id" = ${clientId}
    LIMIT 1
  `

  return mapRow(rows[0])
}

export async function updateTenantAlertSettings(clientId: string, settings: InventoryAlertSettings) {
  await prisma.$executeRaw`
    UPDATE "clients"
    SET
      "alertsEnabled" = ${settings.alertsEnabled},
      "alertWebhookEnabled" = ${settings.alertWebhookEnabled},
      "alertWebhookUrl" = ${settings.alertWebhookUrl},
      "alertDiskThresholdGb" = ${settings.alertDiskThresholdGb},
      "alertRamThresholdGb" = ${settings.alertRamThresholdGb},
      "alertOfflineHours" = ${settings.alertOfflineHours}
    WHERE "id" = ${clientId}
  `
}

export function getDefaultAlertSettings() {
  return { ...DEFAULT_ALERT_SETTINGS }
}
