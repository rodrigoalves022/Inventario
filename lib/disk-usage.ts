/**
 * Limiar de cor pro uso de disco em telas de inventario (ex.: /storage):
 * verde ate 60%, ambar de 60 a 80%, vermelho acima de 80%. Funcao pura para
 * ser reaproveitada pela UI e testada isoladamente, sem depender de React.
 */
export type DiskUsageTier = 'ok' | 'warning' | 'critical'

/**
 * Fonte de verdade UNICA dos limiares. Existe porque a barra de uso agora
 * desenha marcacoes visiveis nessas mesmas posicoes (`disk-usage-mark` em
 * app/globals.css): se a marca ficasse com o numero colado no componente, a
 * marca e a cor poderiam divergir do tier calculado aqui sem nada acusar.
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
 * Classe da barra de uso.
 *
 * Substitui o antigo `DISK_USAGE_TIER_BAR_CLASS` (um mapa tier -> cor chapada).
 * O gradiente agora e' de ESCALA, nao de estado: `disk-usage-scale`
 * (app/globals.css) pinta a faixa inteira 0–100% com Emerald -> Amber ->
 * Crimson trocando exatamente sobre os limiares acima, e a barra e' um RECORTE
 * dessa escala no percentual do disco. Nao ha mais um valor por tier porque a
 * cor deixou de depender do tier: ela depende da POSICAO, e por isso significa
 * sempre a mesma coisa entre discos e entre linhas.
 *
 * O tier continua governando o NUMERO ao lado (DISK_USAGE_TIER_TEXT_CLASS) e o
 * filtro por faixa dos cards de KPI — o que mudou foi so como a barra pinta.
 */
export const DISK_USAGE_SCALE_CLASS = 'disk-usage-scale'

export const DISK_USAGE_TIER_TEXT_CLASS: Record<DiskUsageTier, string> = {
  ok: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
}

export function computeDiskUsagePercent(capacityGb: number, usedGb: number): number {
  if (capacityGb <= 0) return 0
  return Math.round((usedGb / capacityGb) * 100)
}
