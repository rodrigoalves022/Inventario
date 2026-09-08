// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DeviceReportRow } from '@/lib/reports/device-report'
import { CriticalDevicesPanel, buildCriticalDeviceEntries } from '@/components/critical-devices-panel'

/**
 * Overhaul visual — Fase 4, painel esquerdo do bloco duplo do dashboard.
 *
 * O painel nao reavalia limiar nenhum: "pouco disco" vem de
 * `DeviceReportRow.criticalDisks` (ja filtrado por `alertDiskThresholdGb` do
 * tenant em `getDeviceReportRows`) e "coleta atrasada" vem do STATUS EFETIVO
 * (`row.status === 'offline'`, produzido por `getRowEffectiveStatus` com o
 * `alertOfflineHours` do tenant — RN010). Derivar de novo aqui faria o painel
 * divergir do card de KPI e da listagem que ele leva.
 */

const NOW = new Date('2026-09-08T12:00:00.000Z')

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

const resolveHref = (hostname: string) => `/app/cliente-a/assets/id-${hostname}`

describe('buildCriticalDeviceEntries — quem entra na lista e por quê', () => {
  it('maquina saudavel (online, sem disco critico) nao entra', () => {
    const { entries, totalCritical } = buildCriticalDeviceEntries({
      rows: [makeRow({ hostname: 'PC-OK', status: 'online' })],
      now: NOW,
      resolveHref,
    })

    expect(entries).toHaveLength(0)
    expect(totalCritical).toBe(0)
  })

  it('status efetivo offline vira "Sem coleta recente" com a idade da ultima coleta', () => {
    const { entries } = buildCriticalDeviceEntries({
      rows: [
        makeRow({
          hostname: 'PC-OFFLINE',
          status: 'offline',
          ultimaColeta: new Date('2026-09-06T12:00:00.000Z'),
        }),
      ],
      now: NOW,
      resolveHref,
    })

    expect(entries[0].reasons).toEqual([
      { code: 'stale_collection', label: 'Sem coleta recente', detail: 'última coleta há 2 dias' },
    ])
    expect(entries[0].href).toBe('/app/cliente-a/assets/id-PC-OFFLINE')
  })

  it('maquina que nunca coletou nao vira "há NaN" — diz "nunca coletou"', () => {
    const { entries } = buildCriticalDeviceEntries({
      rows: [makeRow({ hostname: 'PC-NOVO', status: 'offline', ultimaColeta: null })],
      now: NOW,
      resolveHref,
    })

    expect(entries[0].reasons[0].detail).toBe('nunca coletou')
  })

  it('disco critico usa o PIOR disco e conta os demais que tambem estao abaixo do limiar', () => {
    const { entries } = buildCriticalDeviceEntries({
      rows: [
        makeRow({
          hostname: 'PC-DISCO',
          status: 'warning',
          criticalDisks: [
            { unidade: 'D:', capacidadeGb: 500, espacoLivreGb: 8 },
            { unidade: 'C:', capacidadeGb: 250, espacoLivreGb: 3 },
          ],
        }),
      ],
      now: NOW,
      resolveHref,
    })

    expect(entries[0].reasons).toEqual([
      {
        code: 'low_disk',
        label: 'Pouco disco',
        detail: 'C: com 3 GB livres · mais 1 disco abaixo do limiar',
      },
    ])
  })

  it('ordena por gravidade: as duas condicoes juntas, depois offline, depois menor disco livre', () => {
    const { entries, totalCritical } = buildCriticalDeviceEntries({
      rows: [
        makeRow({
          hostname: 'PC-DISCO-5GB',
          status: 'warning',
          criticalDisks: [{ unidade: 'C:', capacidadeGb: 250, espacoLivreGb: 5 }],
        }),
        makeRow({ hostname: 'PC-SO-OFFLINE', status: 'offline', ultimaColeta: NOW }),
        makeRow({
          hostname: 'PC-AMBOS',
          status: 'offline',
          ultimaColeta: NOW,
          criticalDisks: [{ unidade: 'C:', capacidadeGb: 250, espacoLivreGb: 9 }],
        }),
        makeRow({
          hostname: 'PC-DISCO-1GB',
          status: 'warning',
          criticalDisks: [{ unidade: 'C:', capacidadeGb: 250, espacoLivreGb: 1 }],
        }),
      ],
      now: NOW,
      resolveHref,
    })

    expect(entries.map((entry) => entry.hostname)).toEqual([
      'PC-AMBOS',
      'PC-SO-OFFLINE',
      'PC-DISCO-1GB',
      'PC-DISCO-5GB',
    ])
    expect(totalCritical).toBe(4)
  })

  it('respeita o limite mostrado, mas totalCritical continua contando a populacao inteira', () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      makeRow({ hostname: `PC-${index}`, status: 'offline', ultimaColeta: NOW })
    )

    const { entries, totalCritical } = buildCriticalDeviceEntries({ rows, now: NOW, resolveHref, limit: 6 })

    expect(entries).toHaveLength(6)
    expect(totalCritical).toBe(9)
  })
})

describe('CriticalDevicesPanel — estados de tela', () => {
  it('estado vazio ensina os limiares do tenant em vez de so dizer "nada aqui"', () => {
    render(
      <CriticalDevicesPanel
        entries={[]}
        totalCritical={0}
        alertDiskThresholdGb={15}
        alertOfflineHours={12}
        allDevicesHref="/app/cliente-a/assets?status=offline"
      />
    )

    expect(screen.getByText('Nenhuma máquina em alerta crítico')).toBeTruthy()
    expect(screen.getByText(/Menos de 15 GB livres em algum disco, ou sem coleta há 12h ou mais\./)).toBeTruthy()
  })

  it('quando ha mais criticos do que o painel mostra, diz explicitamente quantos ficaram de fora', () => {
    render(
      <CriticalDevicesPanel
        entries={[
          {
            hostname: 'PC-01',
            href: '/app/cliente-a/assets/id-1',
            reasons: [{ code: 'stale_collection', label: 'Sem coleta recente', detail: 'nunca coletou' }],
          },
        ]}
        totalCritical={4}
        alertDiskThresholdGb={10}
        alertOfflineHours={24}
        allDevicesHref="/app/cliente-a/assets?status=offline"
      />
    )

    expect(screen.getByText('PC-01')).toBeTruthy()
    expect(screen.getByText('Ver as outras 3 máquinas em alerta')).toBeTruthy()
  })
})
