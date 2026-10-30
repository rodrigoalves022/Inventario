// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildDeviceReportSummary, type DeviceReportRow } from '@/lib/reports/device-report'
import {
  InventorySecurityHero,
  buildSecurityIndicators,
  getComplianceTone,
  type SecurityIndicator,
} from '@/components/inventory-security-hero'

/**
 * Overhaul visual — Fase 4, hero de postura de seguranca do dashboard.
 *
 * A regra que este arquivo trava e a mesma de RN013 aplicada a conformidade:
 * percentual sobre o denominador de maquinas com dado APURADO, nunca sobre a
 * parque inteiro. "Nao apurado" nao e "desativado".
 *
 * O caso limite e o motivo de o hero nao consumir `securityCompliance` cru:
 * `buildDeviceReportSummary` devolve a string '0.0' quando NENHUMA maquina tem
 * o dado apurado (um `.toFixed(1)` precisa devolver alguma coisa), e
 * renderizar isso como "0%" afirmaria que o parque inteiro esta sem BitLocker
 * quando a verdade e' que ninguem reportou. O `knownCount` desfaz a
 * ambiguidade, e o hero tem que usa-lo.
 */

function makeRow(overrides: Partial<DeviceReportRow>): DeviceReportRow {
  return {
    hostname: 'HOST-01',
    status: 'online',
    ip: null,
    sistema: null,
    processador: null,
    ramTotalGb: null,
    discoCapacidadeGb: null,
    discoLivreGb: null,
    antivirusAtivo: null,
    firewallAtivo: null,
    ultimaColeta: null,
    etiquetaPatrimonio: null,
    localizacao: null,
    responsavel: null,
    deviceType: 'computador',
    antivirusAtualizado: null,
    bitlockerAtivo: null,
    criticalDisks: [],
    ...overrides,
  }
}

/**
 * Parque de 5 maquinas com cobertura de dado DELIBERADAMENTE desigual — e' o
 * caso real de um parque em que a coleta de seguranca nao chegou em todo mundo:
 *
 * - bitlocker:  on, on, off, ?, ?   -> 3 apuradas, 2 ativas  -> 66.7% (nao 40%)
 * - antivirus:  on, on, on, off, ?  -> 4 apuradas, 3 ativas  -> 75.0% (nao 60%)
 * - firewall:   ?, ?, ?, ?, ?       -> 0 apuradas            -> SEM DADO
 * - av atualizado: on, off, ?, ?, ? -> 2 apuradas, 1 ativa   -> 50.0%
 */
const INVENTORY: DeviceReportRow[] = [
  makeRow({ hostname: 'PC-01', bitlockerAtivo: true, antivirusAtivo: true, antivirusAtualizado: true }),
  makeRow({ hostname: 'PC-02', bitlockerAtivo: true, antivirusAtivo: true, antivirusAtualizado: false }),
  makeRow({ hostname: 'PC-03', bitlockerAtivo: false, antivirusAtivo: true }),
  makeRow({ hostname: 'PC-04', antivirusAtivo: false }),
  makeRow({ hostname: 'PC-05' }),
]

function indicatorsOf(rows: DeviceReportRow[]) {
  const summary = buildDeviceReportSummary(rows)
  const indicators = buildSecurityIndicators(summary, rows)
  const byKey = (key: SecurityIndicator['key']) => {
    const found = indicators.find((indicator) => indicator.key === key)
    if (!found) throw new Error(`indicador ausente: ${key}`)
    return found
  }
  return { summary, indicators, byKey }
}

describe('Hero de conformidade — percentual sobre o denominador de dado apurado', () => {
  it('BitLocker: 2 ativas entre 3 apuradas = 66.7%, e NAO 2 entre 5 do parque (40%)', () => {
    const { byKey } = indicatorsOf(INVENTORY)
    const bitlocker = byKey('bitlocker')

    expect(bitlocker.percentLabel).toBe('66.7')
    expect(bitlocker.percent).toBeCloseTo(66.7, 1)
    expect(bitlocker.knownCount).toBe(3)
    expect(bitlocker.totalDevices).toBe(5)
    expect(bitlocker.percentLabel).not.toBe('40.0')
  })

  it('Antivirus ativo: 3 ativas entre 4 apuradas = 75.0%, e a nota traz o "atualizado" do relatorio', () => {
    const { summary, byKey } = indicatorsOf(INVENTORY)
    const antivirus = byKey('antivirus')

    expect(antivirus.percentLabel).toBe('75.0')
    expect(antivirus.knownCount).toBe(4)
    // A nota nao reimplementa nada: e' o agregado ja testado do relatorio.
    expect(summary.securityCompliance.antivirusUpdatedPercent).toBe('50.0')
    expect(antivirus.note).toContain('50.0%')
    expect(antivirus.note).toContain('2')
  })

  it('BitLocker e Firewall saem do summary sem recalculo (mesma string do relatorio/PDF)', () => {
    const { summary, byKey } = indicatorsOf(INVENTORY)

    expect(byKey('bitlocker').percentLabel).toBe(summary.securityCompliance.bitlockerActivePercent)
    expect(byKey('bitlocker').knownCount).toBe(summary.securityCompliance.bitlockerKnownCount)
    expect(summary.securityCompliance.firewallKnownCount).toBe(0)
  })
})

describe('Hero de conformidade — nenhuma maquina com dado apurado nao vira 0% nem NaN', () => {
  it('percent e percentLabel viram null quando knownCount e 0 (mesmo o summary devolvendo "0.0")', () => {
    const { summary, byKey } = indicatorsOf(INVENTORY)
    const firewall = byKey('firewall')

    // O summary devolve a string '0.0' — e' esse valor que nao pode chegar cru na tela.
    expect(summary.securityCompliance.firewallActivePercent).toBe('0.0')
    expect(firewall.knownCount).toBe(0)
    expect(firewall.percent).toBeNull()
    expect(firewall.percentLabel).toBeNull()
  })

  it('o parque inteiro sem nenhum dado de seguranca produz tres indicadores "sem dado", nunca 0%', () => {
    const semDado = [makeRow({ hostname: 'A' }), makeRow({ hostname: 'B' })]
    const { indicators } = indicatorsOf(semDado)

    expect(indicators).toHaveLength(3)
    for (const indicator of indicators) {
      expect(indicator.percent).toBeNull()
      expect(indicator.percentLabel).toBeNull()
      expect(indicator.knownCount).toBe(0)
      expect(indicator.totalDevices).toBe(2)
      expect(Number.isNaN(indicator.percent as unknown as number)).toBe(false)
    }
  })

  it('o bloco sem dado renderiza "Sem dado" e a base de calculo — e nenhum "0%" ou "NaN" na tela', () => {
    const { byKey } = indicatorsOf(INVENTORY)

    const { container } = render(
      <InventorySecurityHero
        indicators={[byKey('firewall')]}
        totalDevices={5}
        reportsHref="/app/cliente-a/reports"
      />
    )

    expect(screen.getByText('Sem dado')).toBeTruthy()
    expect(screen.getByText('Nenhuma das 5 máquinas reportou este dado')).toBeTruthy()
    expect(container.textContent).not.toContain('0%')
    expect(container.textContent).not.toContain('NaN')
  })
})

describe('Hero de conformidade — a base de calculo aparece ao lado do numero', () => {
  it('mostra "3 de 5 máquinas com dado apurado" junto do percentual de BitLocker', () => {
    const { byKey } = indicatorsOf(INVENTORY)

    render(
      <InventorySecurityHero
        indicators={[byKey('bitlocker')]}
        totalDevices={5}
        reportsHref="/app/cliente-a/reports"
      />
    )

    // O sinal de porcento e' um <span> filho, entao o texto proprio do
    // paragrafo (o que getByText compara) e' so o numero.
    expect(screen.getByText('66.7')).toBeTruthy()
    expect(screen.getByText('3 de 5 máquinas com dado apurado')).toBeTruthy()
  })

  it('a barra de conformidade nunca comunica so por cor: leva aria-label com o percentual e a base', () => {
    const { byKey } = indicatorsOf(INVENTORY)

    render(
      <InventorySecurityHero
        indicators={[byKey('bitlocker'), byKey('firewall')]}
        totalDevices={5}
        reportsHref="/app/cliente-a/reports"
      />
    )

    expect(screen.getByLabelText('BitLocker habilitado: 66.7% das 3 máquinas com dado apurado')).toBeTruthy()
    expect(screen.getByLabelText('Firewall ativo: sem dado apurado')).toBeTruthy()
  })
})

describe('Hero de conformidade — cada indicador navega para o relatorio (Sprint A51)', () => {
  it('os tres blocos sao links para reportsHref', () => {
    const { indicators } = indicatorsOf(INVENTORY)

    const { container } = render(
      <InventorySecurityHero indicators={indicators} totalDevices={5} reportsHref="/app/cliente-a/reports" />
    )

    for (const label of ['BitLocker habilitado', 'Antivírus ativo', 'Firewall ativo']) {
      expect(screen.getByText(label).closest('a')?.getAttribute('href')).toBe('/app/cliente-a/reports')
    }
    // 3 blocos + o "Relatório completo" do cabecalho.
    expect(container.querySelectorAll('a[href="/app/cliente-a/reports"]')).toHaveLength(4)
  })
})

describe('Tom do medidor de conformidade', () => {
  it('sem dado e neutro — nunca vermelho, que leria como "parque reprovado"', () => {
    expect(getComplianceTone(null)).toBe('neutral')
  })

  it('90%+ verde, 70–89.9% ambar, abaixo de 70% vermelho', () => {
    expect(getComplianceTone(100)).toBe('success')
    expect(getComplianceTone(90)).toBe('success')
    expect(getComplianceTone(89.9)).toBe('warning')
    expect(getComplianceTone(70)).toBe('warning')
    expect(getComplianceTone(69.9)).toBe('destructive')
    expect(getComplianceTone(0)).toBe('destructive')
  })
})
