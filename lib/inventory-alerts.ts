export const DEFAULT_ALERT_SETTINGS = {
  alertsEnabled: true,
  alertWebhookEnabled: false,
  alertWebhookUrl: null,
  alertDiskThresholdGb: 10,
  alertRamThresholdGb: 4,
  alertOfflineHours: 24,
} as const

export type InventoryAlertSettings = {
  alertsEnabled: boolean
  alertWebhookEnabled: boolean
  alertWebhookUrl: string | null
  alertDiskThresholdGb: number
  alertRamThresholdGb: number
  alertOfflineHours: number
}

export type InventoryIssueCode = 'low_disk' | 'low_ram' | 'stale_collection'

export type InventoryIssue = {
  code: InventoryIssueCode
  title: string
  message: string
  severity: 'warning' | 'critical'
}

export type InventoryHealthInput = {
  updatedAt?: Date | string | null
  lastCollectionAt?: Date | string | null
  hardware?: { ramTotalGb?: number | null } | null
  disks?: Array<{ espacoLivreGb?: number | null; unidade?: string | null }>
}

function toBoolean(value: boolean | number | string | null | undefined, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    if (value === '1' || value.toLowerCase() === 'true') return true
    if (value === '0' || value.toLowerCase() === 'false') return false
  }
  return fallback
}

function toPositiveNumber(value: number | string | null | undefined, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function toOptionalString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function normalizeAlertSettings(value?: Partial<Record<keyof InventoryAlertSettings, unknown>> | null): InventoryAlertSettings {
  return {
    alertsEnabled: toBoolean(value?.alertsEnabled as any, DEFAULT_ALERT_SETTINGS.alertsEnabled),
    alertWebhookEnabled: toBoolean(value?.alertWebhookEnabled as any, DEFAULT_ALERT_SETTINGS.alertWebhookEnabled),
    alertWebhookUrl: toOptionalString(value?.alertWebhookUrl as string | null | undefined),
    alertDiskThresholdGb: toPositiveNumber(value?.alertDiskThresholdGb as any, DEFAULT_ALERT_SETTINGS.alertDiskThresholdGb),
    alertRamThresholdGb: toPositiveNumber(value?.alertRamThresholdGb as any, DEFAULT_ALERT_SETTINGS.alertRamThresholdGb),
    alertOfflineHours: toPositiveNumber(value?.alertOfflineHours as any, DEFAULT_ALERT_SETTINGS.alertOfflineHours),
  }
}

export function getLastCollectionDate(input: Pick<InventoryHealthInput, 'lastCollectionAt' | 'updatedAt'>) {
  const raw = input.lastCollectionAt ?? input.updatedAt ?? null
  if (!raw) return null
  const value = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(value.getTime()) ? null : value
}

export function getLowestDiskFreeGb(disks: InventoryHealthInput['disks']) {
  if (!disks || disks.length === 0) return null
  const values = disks
    .map((disk) => disk.espacoLivreGb)
    .filter((value): value is number => typeof value === 'number')
  if (values.length === 0) return null
  return Math.min(...values)
}

export function deriveInventoryIssues(
  input: InventoryHealthInput,
  settings: InventoryAlertSettings,
  now: Date = new Date()
): InventoryIssue[] {
  const issues: InventoryIssue[] = []
  const lowestDiskFreeGb = getLowestDiskFreeGb(input.disks)

  if (lowestDiskFreeGb !== null && lowestDiskFreeGb < settings.alertDiskThresholdGb) {
    issues.push({
      code: 'low_disk',
      title: 'Pouco disco livre',
      message: `Menor disco com ${lowestDiskFreeGb} GB livres (limite: ${settings.alertDiskThresholdGb} GB).`,
      severity: 'critical',
    })
  }

  const totalRamGb = input.hardware?.ramTotalGb ?? null
  if (typeof totalRamGb === 'number' && totalRamGb < settings.alertRamThresholdGb) {
    issues.push({
      code: 'low_ram',
      title: 'RAM abaixo do recomendado',
      message: `Máquina com ${totalRamGb} GB de RAM (limite: ${settings.alertRamThresholdGb} GB).`,
      severity: 'warning',
    })
  }

  const lastCollectionDate = getLastCollectionDate(input)
  if (lastCollectionDate) {
    const ageHours = Math.floor((now.getTime() - lastCollectionDate.getTime()) / 36e5)
    if (ageHours >= settings.alertOfflineHours) {
      issues.push({
        code: 'stale_collection',
        title: 'Coleta atrasada',
        message: `Última coleta há ${ageHours}h (limite: ${settings.alertOfflineHours}h).`,
        severity: 'critical',
      })
    }
  }

  return issues
}

export function getWarningTransitionIssues(issues: InventoryIssue[]) {
  return issues.filter((issue) => issue.code !== 'stale_collection')
}

export function getEffectiveDeviceStatus(baseStatus: string, issues: InventoryIssue[]) {
  if (issues.some((issue) => issue.code === 'stale_collection')) return 'offline'
  if (issues.length > 0) return 'warning'
  return baseStatus
}
