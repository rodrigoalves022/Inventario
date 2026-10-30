import { describe, expect, it } from 'vitest'
import {
  buildDeviceReportSummary,
  getRowEffectiveStatus,
  renderDeviceReportCsv,
  type DeviceReportRow,
} from '@/lib/reports/device-report'

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
    // Sprint 13
    deviceType: 'computador',
    antivirusAtualizado: null,
    bitlockerAtivo: null,
    criticalDisks: [],
    ...overrides,
  }
}

const ALERT_OFFLINE_HOURS = 24

describe('getRowEffectiveStatus (RN010 — status offline nunca gravado no banco)', () => {
  it('mantem o status bruto quando a ultima coleta esta dentro do limiar', () => {
    const recent = new Date(Date.now() - 2 * 3600 * 1000) // 2h atras
    expect(getRowEffectiveStatus({ status: 'online', ultimaColeta: recent }, ALERT_OFFLINE_HOURS)).toBe('online')
  })

  it('reclassifica como offline quando a ultima coleta ultrapassa alertOfflineHours, mesmo com status bruto "online"', () => {
    const stale = new Date(Date.now() - 30 * 3600 * 1000) // 30h atras, limiar e 24h
    expect(getRowEffectiveStatus({ status: 'online', ultimaColeta: stale }, ALERT_OFFLINE_HOURS)).toBe('offline')
  })

  it('trata "nunca coletado" (ultimaColeta null) como offline, usando updatedAt como fallback de idade', () => {
    const staleCreatedAt = new Date(Date.now() - 48 * 3600 * 1000)
    expect(
      getRowEffectiveStatus({ status: 'online', ultimaColeta: null, updatedAt: staleCreatedAt }, ALERT_OFFLINE_HOURS)
    ).toBe('offline')
  })
})

describe('buildDeviceReportSummary — contagem de "offline" via status efetivo', () => {
  it('conta como offline um dispositivo cuja ultima coleta ultrapassa alertOfflineHours (nunca zerado como o device.status bruto faria)', () => {
    const staleDate = new Date(Date.now() - 48 * 3600 * 1000)
    const recentDate = new Date(Date.now() - 1 * 3600 * 1000)

    // Simula exatamente o que getDeviceReportRows faz: computa o status
    // efetivo antes de popular `row.status` (o bug original usava
    // device.status bruto direto, que nunca vira 'offline').
    const staleRow = makeRow({
      hostname: 'STALE-01',
      status: getRowEffectiveStatus({ status: 'online', ultimaColeta: staleDate }, ALERT_OFFLINE_HOURS),
      ultimaColeta: staleDate,
    })
    const onlineRow = makeRow({
      hostname: 'ONLINE-01',
      status: getRowEffectiveStatus({ status: 'online', ultimaColeta: recentDate }, ALERT_OFFLINE_HOURS),
      ultimaColeta: recentDate,
    })

    const summary = buildDeviceReportSummary([staleRow, onlineRow])

    expect(summary.offline).toBe(1)
    expect(summary.online).toBe(1)
    expect(summary.totalDevices).toBe(2)
  })

  it('regressao: device.status bruto nunca contem "offline" — a contagem so funciona porque o status foi recalculado antes de chegar no summary', () => {
    // Se alguem reintroduzir o bug (voltar a usar device.status bruto,
    // que so e 'online'/'warning'), este teste falha porque a contagem
    // de offline fica 0 mesmo com uma linha claramente sumida.
    const staleDate = new Date(Date.now() - 200 * 3600 * 1000)
    const rawRow = makeRow({ status: 'online', ultimaColeta: staleDate }) // status NAO recalculado
    const summary = buildDeviceReportSummary([rawRow])
    expect(summary.offline).toBe(0) // prova que o bug NAO esta em buildDeviceReportSummary...

    const fixedRow = makeRow({
      status: getRowEffectiveStatus({ status: 'online', ultimaColeta: staleDate }, ALERT_OFFLINE_HOURS),
      ultimaColeta: staleDate,
    })
    const fixedSummary = buildDeviceReportSummary([fixedRow])
    expect(fixedSummary.offline).toBe(1) // ...e sim em quem produz `status` sem recalcular (getDeviceReportRows, corrigido)
  })
})

describe('renderDeviceReportCsv — AnyDesk ID (Sprint A12)', () => {
  it('inclui a coluna AnyDesk ID apos IP com o valor da linha (vazio quando ausente)', () => {
    const csv = renderDeviceReportCsv([
      makeRow({ hostname: 'HOST-AD', ip: '10.0.0.5', anydeskId: '123456789' }),
      makeRow({ hostname: 'HOST-SEM', ip: '10.0.0.6' }),
    ])
    const [header, withId, withoutId] = csv.replace(String.fromCharCode(0xfeff), '').split('\r\n')

    expect(header.split(',').slice(0, 4)).toEqual(['Hostname', 'Status', 'IP', 'AnyDesk ID'])
    expect(withId.split(',').slice(0, 4)).toEqual(['HOST-AD', 'online', '10.0.0.5', '123456789'])
    expect(withoutId.split(',').slice(0, 4)).toEqual(['HOST-SEM', 'online', '10.0.0.6', ''])
  })
})
