import { describe, expect, it } from 'vitest'
import { LATEST_AGENT_VERSION } from '@/lib/agent-binary'
import { buildDeviceReportSummary, type DeviceReportRow } from '@/lib/reports/device-report'

const NOW = new Date('2026-06-15T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function makeRow(overrides: Partial<DeviceReportRow> = {}): DeviceReportRow {
  return {
    hostname: 'PC-01',
    status: 'online',
    ip: null,
    sistema: 'Windows 11 Pro',
    processador: 'Intel Core i5',
    ramTotalGb: 16,
    discoCapacidadeGb: 500,
    discoLivreGb: 250,
    antivirusAtivo: true,
    firewallAtivo: true,
    ultimaColeta: NOW,
    etiquetaPatrimonio: null,
    localizacao: null,
    responsavel: null,
    deviceType: 'computador',
    antivirusAtualizado: true,
    bitlockerAtivo: true,
    criticalDisks: [],
    ...overrides,
  }
}

describe('buildDeviceReportSummary — Sprint A18 analytics', () => {
  it('groups processors by name, most common first', () => {
    const summary = buildDeviceReportSummary(
      [
        makeRow({ processador: 'Intel Core i5' }),
        makeRow({ processador: 'AMD Ryzen 5' }),
        makeRow({ processador: 'Intel Core i5' }),
        makeRow({ processador: null }),
      ],
      NOW
    )
    expect(summary.processorDistribution).toEqual([
      { name: 'Intel Core i5', value: 2 },
      { name: 'AMD Ryzen 5', value: 1 },
    ])
  })

  it('computes antivirusActivePercent over known values only', () => {
    const summary = buildDeviceReportSummary(
      [makeRow({ antivirusAtivo: true }), makeRow({ antivirusAtivo: false }), makeRow({ antivirusAtivo: null })],
      NOW
    )
    expect(summary.securityCompliance.antivirusActivePercent).toBe('50.0')
    expect(summary.securityCompliance.antivirusActiveKnownCount).toBe(2)
  })

  it('computes AnyDesk coverage', () => {
    const summary = buildDeviceReportSummary(
      [makeRow({ anydeskId: '123456789' }), makeRow({ anydeskId: null }), makeRow({}), makeRow({ anydeskId: '987654321' })],
      NOW
    )
    expect(summary.fleetGovernance.anydeskCount).toBe(2)
    expect(summary.fleetGovernance.anydeskPercent).toBe('50.0')
  })

  it('computes agent compliance against LATEST_AGENT_VERSION, ignoring unknown versions', () => {
    const summary = buildDeviceReportSummary(
      [
        makeRow({ agentVersion: LATEST_AGENT_VERSION }),
        makeRow({ agentVersion: '0.0.1' }),
        makeRow({ agentVersion: null }),
        makeRow({}),
      ],
      NOW
    )
    expect(summary.fleetGovernance).toMatchObject({
      agentUpToDateCount: 1,
      agentOutdatedCount: 1,
      agentKnownCount: 2,
      agentCompliancePercent: '50.0',
    })
  })

  it('computes patrimony coverage and total asset value', () => {
    const summary = buildDeviceReportSummary(
      [
        makeRow({ etiquetaPatrimonio: 'PAT-1', valorPatrimonio: 3500.5 }),
        makeRow({ responsavel: 'Ana', valorPatrimonio: 1000 }),
        makeRow({}),
        makeRow({}),
      ],
      NOW
    )
    expect(summary.fleetGovernance.patrimonioRegisteredCount).toBe(2)
    expect(summary.fleetGovernance.patrimonioPercent).toBe('50.0')
    expect(summary.fleetGovernance.totalAssetValue).toBe(4500.5)
  })

  it('classifies warranties as expired, expiring within 30 days, or active', () => {
    const summary = buildDeviceReportSummary(
      [
        makeRow({ garantiaAte: new Date(NOW.getTime() - DAY) }),
        makeRow({ garantiaAte: new Date(NOW.getTime() + 10 * DAY) }),
        makeRow({ garantiaAte: new Date(NOW.getTime() + 30 * DAY) }),
        makeRow({ garantiaAte: new Date(NOW.getTime() + 90 * DAY) }),
        makeRow({ garantiaAte: null }),
      ],
      NOW
    )
    expect(summary.fleetGovernance.warrantyExpiredCount).toBe(1)
    expect(summary.fleetGovernance.warrantyExpiringSoonCount).toBe(2)
    expect(summary.fleetGovernance.warrantyActiveCount).toBe(1)
  })

  it('returns zeroed governance for an empty fleet', () => {
    const summary = buildDeviceReportSummary([], NOW)
    expect(summary.fleetGovernance.anydeskPercent).toBe('0.0')
    expect(summary.fleetGovernance.agentCompliancePercent).toBe('0.0')
    expect(summary.fleetGovernance.totalAssetValue).toBe(0)
    expect(summary.processorDistribution).toEqual([])
  })
})
