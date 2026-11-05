import { describe, expect, it } from 'vitest'
import {
  calculateAssetDepreciation,
  formatBRL,
  LIFECYCLE_STATUS_LABELS,
  LIFECYCLE_STATUS_BADGE_CLASS,
} from '@/lib/asset-depreciation'

describe('calculateAssetDepreciation', () => {
  const asOf = new Date('2026-06-15T12:00:00Z')

  it('retorna hasCost false se custo nao informado ou <= 0', () => {
    const res = calculateAssetDepreciation({ purchaseCost: 0, asOfDate: asOf })
    expect(res.hasCost).toBe(false)
    expect(res.purchaseCost).toBe(0)
    expect(res.currentBookValue).toBe(0)
    expect(res.isFullyDepreciated).toBe(false)
  })

  it('retorna valor integral quando nao ha data de compra', () => {
    const res = calculateAssetDepreciation({
      purchaseCost: 6000,
      purchaseDate: null,
      usefulLifeMonths: 60,
      asOfDate: asOf,
    })
    expect(res.hasCost).toBe(true)
    expect(res.purchaseCost).toBe(6000)
    expect(res.monthsElapsed).toBe(0)
    expect(res.accumulatedDepreciation).toBe(0)
    expect(res.currentBookValue).toBe(6000)
    expect(res.isFullyDepreciated).toBe(false)
    expect(res.percentageDepreciated).toBe(0)
  })

  it('calcula depreciacao linear proporcional aos meses decorridos', () => {
    // Compra ha exatamente 12 meses (2025-06-15 para 2026-06-15)
    // Custo R$ 6.000, 60 meses -> R$ 100/mes -> 12 meses = R$ 1.200 depreciado
    // Valor contábil atual = R$ 4.800
    const res = calculateAssetDepreciation({
      purchaseCost: 6000,
      purchaseDate: new Date('2025-06-15T00:00:00Z'),
      usefulLifeMonths: 60,
      salvageValue: 0,
      asOfDate: asOf,
    })

    expect(res.hasCost).toBe(true)
    expect(res.purchaseCost).toBe(6000)
    expect(res.usefulLifeMonths).toBe(60)
    expect(res.monthsElapsed).toBe(12)
    expect(res.monthlyDepreciationAmount).toBe(100)
    expect(res.accumulatedDepreciation).toBe(1200)
    expect(res.currentBookValue).toBe(4800)
    expect(res.percentageDepreciated).toBe(20)
    expect(res.isFullyDepreciated).toBe(false)
  })

  it('respeita o valor residual ao calcular a base depreciável', () => {
    // Custo R$ 5.000, Valor residual R$ 500 -> Base depreciável R$ 4.500
    // 60 meses -> R$ 75/mes
    // Apos 24 meses -> Depreciacao = R$ 1.800
    // Valor contabil atual = R$ 5.000 - R$ 1.800 = R$ 3.200
    const res = calculateAssetDepreciation({
      purchaseCost: 5000,
      purchaseDate: new Date('2024-06-15T00:00:00Z'),
      usefulLifeMonths: 60,
      salvageValue: 500,
      asOfDate: asOf,
    })

    expect(res.depreciableBasis).toBe(4500)
    expect(res.monthsElapsed).toBe(24)
    expect(res.monthlyDepreciationAmount).toBe(75)
    expect(res.accumulatedDepreciation).toBe(1800)
    expect(res.currentBookValue).toBe(3200)
    expect(res.isFullyDepreciated).toBe(false)
  })

  it('atinge 100% de depreciacao e trava no valor residual apos o fim da vida util', () => {
    // Compra em 2019 (mais de 60 meses atras)
    // Custo R$ 4.000, Valor residual R$ 400 -> Base R$ 3.600
    const res = calculateAssetDepreciation({
      purchaseCost: 4000,
      purchaseDate: new Date('2019-01-01T00:00:00Z'),
      usefulLifeMonths: 60,
      salvageValue: 400,
      asOfDate: asOf,
    })

    expect(res.isFullyDepreciated).toBe(true)
    expect(res.accumulatedDepreciation).toBe(3600)
    expect(res.currentBookValue).toBe(400) // Travado no residual
    expect(res.percentageDepreciated).toBe(100)
  })

  it('nao deprecia se a data de compra for futura', () => {
    const res = calculateAssetDepreciation({
      purchaseCost: 3000,
      purchaseDate: new Date('2026-12-01T00:00:00Z'),
      asOfDate: asOf,
    })
    expect(res.monthsElapsed).toBe(0)
    expect(res.accumulatedDepreciation).toBe(0)
    expect(res.currentBookValue).toBe(3000)
    expect(res.isFullyDepreciated).toBe(false)
  })
})

describe('formatBRL', () => {
  it('formata valores monetarios em reais', () => {
    expect(formatBRL(1250.5)).toContain('1.250,50')
    expect(formatBRL(0)).toContain('0,00')
    expect(formatBRL(null)).toContain('0,00')
  })
})

describe('labels e classes de status de ciclo de vida', () => {
  it('contém mapeamento completo de status de ciclo de vida', () => {
    expect(LIFECYCLE_STATUS_LABELS.IN_USE).toBe('Em Uso')
    expect(LIFECYCLE_STATUS_LABELS.IN_STOCK).toBe('Em Estoque')
    expect(LIFECYCLE_STATUS_LABELS.IN_MAINTENANCE).toBe('Em Manutenção')
    expect(LIFECYCLE_STATUS_LABELS.ON_LOAN).toBe('Empréstimo (Home Office)')
    expect(LIFECYCLE_STATUS_LABELS.DISPOSED).toBe('Baixado / Descartado')

    expect(LIFECYCLE_STATUS_BADGE_CLASS.IN_USE).toContain('emerald')
    expect(LIFECYCLE_STATUS_BADGE_CLASS.DISPOSED).toContain('destructive')
  })
})
