import { describe, expect, it } from 'vitest'
import {
  KPI_TONES,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  KPI_TONE_RING_CLASS,
  KPI_TONE_VALUE_CLASS,
} from '@/lib/kpi-tone'

/**
 * Vocabulario unico de severidade dos cards de KPI (Sprint 16).
 *
 * Antes existiam DOIS nomes para o mesmo tom de falha: `danger` no `StatCard` e
 * `destructive` no `SummaryCard`. A Sprint 16 eliminou `danger` do sistema —
 * sem alias, porque um alias mantido indefinidamente e' o mesmo vocabulario
 * duplo com uma camada de traducao por cima.
 */
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

  it('o vocabulario e exatamente os seis tons canonicos', () => {
    expect([...KPI_TONES]).toEqual(['neutral', 'primary', 'info', 'success', 'warning', 'destructive'])
  })

  it('`neutral` e `primary` nao tingem o numero — um total nao e um alerta', () => {
    expect(KPI_TONE_VALUE_CLASS.neutral).toBe('text-card-foreground')
    expect(KPI_TONE_VALUE_CLASS.primary).toBe('text-card-foreground')
  })

  it('os tons de severidade tingem o numero, porque ali a cor E a informacao', () => {
    expect(KPI_TONE_VALUE_CLASS.warning).toContain('warning')
    expect(KPI_TONE_VALUE_CLASS.destructive).toContain('destructive')
    expect(KPI_TONE_VALUE_CLASS.success).toContain('success')
    expect(KPI_TONE_VALUE_CLASS.info).toContain('info')
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
