/**
 * Limiar de cor pro uso de disco em telas de inventario (ex.: /storage):
 * verde ate 60%, ambar de 60 a 80%, vermelho acima de 80%. Funcao pura para
 * ser reaproveitada pela UI e testada isoladamente, sem depender de React.
 */
export type DiskUsageTier = 'ok' | 'warning' | 'critical'

/**
 * Fonte de verdade UNICA dos limiares — a mesma usada pela cor da barra
 * (DISK_USAGE_TIER_BAR_CLASS), pelo numero ao lado dela e pelo filtro por faixa
 * dos cards de KPI, para que nenhum dos tres possa divergir do tier calculado.
 *
 * Semantica preservada de `getDiskUsageTier`: os limiares sao EXCLUSIVOS —
 * 60% ainda e' "ok" e 80% ainda e' "warning".
 */
export const DISK_USAGE_THRESHOLDS = {
  warning: 60,
  critical: 80,
} as const

export function getDiskUsageTier(usedPercent: number): DiskUsageTier {
  if (usedPercent > DISK_USAGE_THRESHOLDS.critical) return 'critical'
  if (usedPercent > DISK_USAGE_THRESHOLDS.warning) return 'warning'
  return 'ok'
}

/**
 * Cor da barra de uso, por tier (Sprint V17).
 *
 * Volta a ser cor CHAPADA de estado. A versao anterior pintava a escala inteira
 * 0–100% num gradiente Emerald -> Amber -> Crimson e recortava essa escala com
 * `clip-path: inset(...)` no percentual do disco. O recorte e' uma aresta reta
 * sem antialias sobre um trilho `rounded-full`: entre 60% e 80% ele caia no
 * meio da transicao de cor e deixava uma ponta quadrada, meio verde e meio
 * ambar ("pixels amarelados" a 66%). Preenchimento por `width` com
 * `rounded-full` proprio termina sempre numa ponta arredondada e de uma cor so
 * — a mesma do numero ao lado (DISK_USAGE_TIER_TEXT_CLASS).
 */
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
