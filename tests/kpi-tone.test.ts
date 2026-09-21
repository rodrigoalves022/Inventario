import { describe, expect, it } from 'vitest'
import {
  KPI_TONES,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  KPI_TONE_RING_CLASS,
  KPI_TONE_VALUE_CLASS,
  normalizeKpiTone,
} from '@/lib/kpi-tone'

/**
 * Vocabulario unico de severidade dos cards de KPI.
 *
 * Antes desta sprint o mesmo tom de falha se chamava `danger` no `StatCard` e
 * `destructive` no `SummaryCard`. A unificacao so vale se for RETROCOMPATIVEL:
 * os tres call sites que ainda passam `variant="danger"`
 * (app/app/[clientSlug]/page.tsx e audit/page.tsx) precisam continuar
 * funcionando sem edicao. E' isso que o primeiro bloco trava.
 */
describe('normalizeKpiTone — alias legado nao pode quebrar chamador existente', () => {
  it('traduz o nome antigo `danger` para o canonico `destructive`', () => {
    expect(normalizeKpiTone('danger')).toBe('destructive')
  })

  it('traduz o nome antigo `default` para o canonico `neutral`', () => {
    expect(normalizeKpiTone('default')).toBe('neutral')
  })

  it('devolve os tons canonicos inalterados', () => {
    for (const tone of KPI_TONES) {
      expect(normalizeKpiTone(tone)).toBe(tone)
    }
  })

  it('`danger` e `destructive` produzem exatamente as mesmas classes', () => {
    const viaAlias = normalizeKpiTone('danger')
    const viaCanonico = normalizeKpiTone('destructive')

    expect(KPI_TONE_ICON_CLASS[viaAlias]).toBe(KPI_TONE_ICON_CLASS[viaCanonico])
    expect(KPI_TONE_VALUE_CLASS[viaAlias]).toBe(KPI_TONE_VALUE_CLASS[viaCanonico])
    expect(KPI_TONE_GLOW_CLASS[viaAlias]).toBe(KPI_TONE_GLOW_CLASS[viaCanonico])
  })
})

describe('tabelas de tom — cobertura completa, sem tom orfao', () => {
  it('todo tom canonico tem entrada nas quatro tabelas', () => {
    for (const tone of KPI_TONES) {
      expect(KPI_TONE_ICON_CLASS[tone], `icone de ${tone}`).toBeTruthy()
      expect(KPI_TONE_VALUE_CLASS[tone], `valor de ${tone}`).toBeTruthy()
      expect(KPI_TONE_GLOW_CLASS[tone], `glow de ${tone}`).toBeTruthy()
      expect(KPI_TONE_RING_CLASS[tone], `ring de ${tone}`).toBeTruthy()
    }
  })

  it('nenhuma tabela declara o nome extinto `danger`', () => {
    for (const table of [
      KPI_TONE_ICON_CLASS,
      KPI_TONE_VALUE_CLASS,
      KPI_TONE_GLOW_CLASS,
      KPI_TONE_RING_CLASS,
    ]) {
      expect(Object.keys(table)).not.toContain('danger')
    }
  })

  it('a cor entra por token de tema, nunca por rgba/hex literal', () => {
    const allClasses = [
      ...Object.values(KPI_TONE_ICON_CLASS),
      ...Object.values(KPI_TONE_VALUE_CLASS),
      ...Object.values(KPI_TONE_GLOW_CLASS),
      ...Object.values(KPI_TONE_RING_CLASS),
    ].join(' ')

    expect(allClasses).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(allClasses).not.toMatch(/rgba?\(/)
  })
})
