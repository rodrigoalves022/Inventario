import { describe, expect, it } from 'vitest'
import { getDiskUsageTier, computeDiskUsagePercent } from '@/lib/disk-usage'

describe('getDiskUsageTier', () => {
  it('classifica ate 60% (inclusive) como "ok" (verde)', () => {
    expect(getDiskUsageTier(0)).toBe('ok')
    expect(getDiskUsageTier(60)).toBe('ok')
  })

  it('classifica entre 60% (exclusive) e 80% (inclusive) como "warning" (ambar)', () => {
    expect(getDiskUsageTier(61)).toBe('warning')
    expect(getDiskUsageTier(80)).toBe('warning')
  })

  it('classifica acima de 80% como "critical" (vermelho)', () => {
    expect(getDiskUsageTier(81)).toBe('critical')
    expect(getDiskUsageTier(100)).toBe('critical')
  })
})

describe('computeDiskUsagePercent', () => {
  it('calcula o percentual usado a partir de capacidade e uso', () => {
    expect(computeDiskUsagePercent(200, 100)).toBe(50)
  })

  it('nao divide por zero quando a capacidade e 0', () => {
    expect(computeDiskUsagePercent(0, 0)).toBe(0)
  })
})

describe('DISK_USAGE_TIER_BAR_CLASS (Sprint V17)', () => {
  it('mapeia cada tier para a cor chapada do token correspondente', async () => {
    const { DISK_USAGE_TIER_BAR_CLASS } = await import('@/lib/disk-usage')
    expect(DISK_USAGE_TIER_BAR_CLASS).toEqual({
      ok: 'bg-success',
      warning: 'bg-warning',
      critical: 'bg-destructive',
    })
  })
})
