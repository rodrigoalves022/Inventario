/**
 * Limiar de cor pro uso de disco em telas de inventario (ex.: /storage):
 * verde ate 60%, ambar de 60 a 80%, vermelho acima de 80%. Funcao pura para
 * ser reaproveitada pela UI e testada isoladamente, sem depender de React.
 */
export type DiskUsageTier = 'ok' | 'warning' | 'critical'

export function getDiskUsageTier(usedPercent: number): DiskUsageTier {
  if (usedPercent > 80) return 'critical'
  if (usedPercent > 60) return 'warning'
  return 'ok'
}

export const DISK_USAGE_TIER_BAR_CLASS: Record<DiskUsageTier, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
}

export const DISK_USAGE_TIER_TEXT_CLASS: Record<DiskUsageTier, string> = {
  ok: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
}

export function computeDiskUsagePercent(capacityGb: number, usedGb: number): number {
  if (capacityGb <= 0) return 0
  return Math.round((usedGb / capacityGb) * 100)
}
