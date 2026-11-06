export type AssetLifecycleStatus = 'IN_USE' | 'IN_STOCK' | 'IN_MAINTENANCE' | 'ON_LOAN' | 'DISPOSED'

export const LIFECYCLE_STATUS_LABELS: Record<AssetLifecycleStatus, string> = {
  IN_USE: 'Em Uso',
  IN_STOCK: 'Em Estoque',
  IN_MAINTENANCE: 'Em Manutenção',
  ON_LOAN: 'Empréstimo (Home Office)',
  DISPOSED: 'Baixado / Descartado',
}

export const LIFECYCLE_STATUS_BADGE_CLASS: Record<AssetLifecycleStatus, string> = {
  IN_USE: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  IN_STOCK: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  IN_MAINTENANCE: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  ON_LOAN: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
  DISPOSED: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export type AssetMaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'UPGRADE'

export const MAINTENANCE_TYPE_LABELS: Record<AssetMaintenanceType, string> = {
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
  UPGRADE: 'Upgrade',
}

export interface DepreciationCalculationInput {
  purchaseCost?: number | null
  purchaseDate?: Date | string | null
  usefulLifeMonths?: number | null
  salvageValue?: number | null
  asOfDate?: Date
}

export interface DepreciationCalculationResult {
  hasCost: boolean
  purchaseCost: number
  salvageValue: number
  depreciableBasis: number
  usefulLifeMonths: number
  monthsElapsed: number
  depreciationRateMonthly: number
  monthlyDepreciationAmount: number
  accumulatedDepreciation: number
  currentBookValue: number
  isFullyDepreciated: boolean
  percentageDepreciated: number
}

/**
 * Calcula a depreciação linear (método das cotas constantes) de um ativo de TI.
 * Padrão brasileiro da Receita Federal (IN RFB nº 1700/2017) para equipamentos
 * de informática e processamento de dados: 5 anos de vida útil (60 meses),
 * taxa de 20% ao ano (~1,666% ao mês).
 */
export function calculateAssetDepreciation({
  purchaseCost,
  purchaseDate,
  usefulLifeMonths = 60,
  salvageValue = 0,
  asOfDate = new Date(),
}: DepreciationCalculationInput): DepreciationCalculationResult {
  const cost = typeof purchaseCost === 'number' && !Number.isNaN(purchaseCost) && purchaseCost > 0 ? purchaseCost : 0
  const salvage = typeof salvageValue === 'number' && !Number.isNaN(salvageValue) && salvageValue > 0 ? salvageValue : 0
  const life = typeof usefulLifeMonths === 'number' && !Number.isNaN(usefulLifeMonths) && usefulLifeMonths > 0 ? usefulLifeMonths : 60

  const monthlyRate = 1 / life

  if (cost === 0) {
    return {
      hasCost: false,
      purchaseCost: 0,
      salvageValue: salvage,
      depreciableBasis: 0,
      usefulLifeMonths: life,
      monthsElapsed: 0,
      depreciationRateMonthly: monthlyRate,
      monthlyDepreciationAmount: 0,
      accumulatedDepreciation: 0,
      currentBookValue: 0,
      isFullyDepreciated: false,
      percentageDepreciated: 0,
    }
  }

  // Base depreciável = Custo de aquisição - Valor residual
  const depreciableBasis = Math.max(0, cost - salvage)
  const monthlyDepreciationAmount = Math.round((depreciableBasis / life) * 100) / 100

  if (!purchaseDate) {
    return {
      hasCost: true,
      purchaseCost: cost,
      salvageValue: salvage,
      depreciableBasis,
      usefulLifeMonths: life,
      monthsElapsed: 0,
      depreciationRateMonthly: monthlyRate,
      monthlyDepreciationAmount,
      accumulatedDepreciation: 0,
      currentBookValue: cost,
      isFullyDepreciated: false,
      percentageDepreciated: 0,
    }
  }

  const pDate = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate
  if (Number.isNaN(pDate.getTime()) || asOfDate < pDate) {
    return {
      hasCost: true,
      purchaseCost: cost,
      salvageValue: salvage,
      depreciableBasis,
      usefulLifeMonths: life,
      monthsElapsed: 0,
      depreciationRateMonthly: monthlyRate,
      monthlyDepreciationAmount,
      accumulatedDepreciation: 0,
      currentBookValue: cost,
      isFullyDepreciated: false,
      percentageDepreciated: 0,
    }
  }

  // Diferença em meses entre compra e data de referência
  const yearDiff = asOfDate.getFullYear() - pDate.getFullYear()
  const monthDiff = asOfDate.getMonth() - pDate.getMonth()
  let monthsElapsed = yearDiff * 12 + monthDiff

  // Se a compra foi no mesmo mês mas dia posterior, ou ajuste de fração de mês
  if (asOfDate.getDate() < pDate.getDate() && monthsElapsed > 0) {
    monthsElapsed -= 1
  }

  const effectiveMonths = Math.min(Math.max(0, monthsElapsed), life)
  const isFullyDepreciated = effectiveMonths >= life

  const accumulatedDepreciation = isFullyDepreciated
    ? depreciableBasis
    : Math.min(depreciableBasis, Math.round(effectiveMonths * monthlyDepreciationAmount * 100) / 100)

  const currentBookValue = Math.max(salvage, Math.round((cost - accumulatedDepreciation) * 100) / 100)
  const percentageDepreciated =
    depreciableBasis > 0 ? Math.min(100, Math.round((accumulatedDepreciation / depreciableBasis) * 100)) : 100

  return {
    hasCost: true,
    purchaseCost: cost,
    salvageValue: salvage,
    depreciableBasis,
    usefulLifeMonths: life,
    monthsElapsed,
    depreciationRateMonthly: monthlyRate,
    monthlyDepreciationAmount,
    accumulatedDepreciation,
    currentBookValue,
    isFullyDepreciated,
    percentageDepreciated,
  }
}

/**
 * Formata valor em Real Brasileiro (BRL)
 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

