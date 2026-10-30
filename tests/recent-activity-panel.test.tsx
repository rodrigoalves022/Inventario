// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  RecentActivityPanel,
  formatAuditActionLabel,
  toDiscoveredDeviceType,
  type NetworkDiscoveryItem,
} from '@/components/recent-activity-panel'

/**
 * Overhaul visual — Fase 4, painel direito do bloco duplo do dashboard.
 *
 * O caso que este arquivo existe para travar: `Client.discoveryEnabled` e'
 * opt-in por tenant e nasce `false` (Sprint 14). Num tenant com a varredura
 * DESLIGADA, "0 dispositivos descobertos" seria uma afirmacao falsa sobre a
 * rede do cliente — ninguem olhou. O painel tem que dizer que a varredura esta
 * desligada, e nunca insinuar que a rede foi varrida e estava vazia.
 */

const DISCOVERY_HREF = '/app/cliente-a/network'
const AUDIT_HREF = '/app/cliente-a/audit'

const DISCOVERED: NetworkDiscoveryItem[] = [
  {
    id: 'd-1',
    ip: '192.168.1.10',
    label: 'impressora-rh',
    deviceType: 'PRINTER',
    lastSeenLabel: 'há 2h',
  },
]

describe('Descobertas de rede — "desligada" nao pode ser exibida como "zero"', () => {
  it('varredura desligada: diz que esta desligada e onde ligar, sem falar em contagem', () => {
    const { container } = render(
      <RecentActivityPanel
        discovery={{ enabled: false, items: [], href: DISCOVERY_HREF }}
        audit={null}
      />
    )

    expect(
      screen.getByText(/Varredura de rede desligada para este tenant — nada foi procurado\./)
    ).toBeTruthy()
    expect(screen.getByText(/Configurações de Alerta → Descoberta de Rede/)).toBeTruthy()
    // Nenhuma insinuacao de que a rede foi varrida e nao havia nada.
    expect(container.textContent).not.toContain('Nenhum dispositivo descoberto ainda')
    expect(container.textContent).not.toContain('0 dispositivo')
  })

  it('varredura ligada e sem resultado: aí sim "nenhum dispositivo descoberto ainda"', () => {
    const { container } = render(
      <RecentActivityPanel discovery={{ enabled: true, items: [], href: DISCOVERY_HREF }} audit={null} />
    )

    expect(screen.getByText(/Nenhum dispositivo descoberto ainda\./)).toBeTruthy()
    expect(container.textContent).not.toContain('Varredura de rede desligada')
  })

  it('com resultados, lista IP, tipo traduzido e a idade da ultima visita', () => {
    render(
      <RecentActivityPanel
        discovery={{ enabled: true, items: DISCOVERED, href: DISCOVERY_HREF }}
        audit={null}
      />
    )

    expect(screen.getByText('192.168.1.10')).toBeTruthy()
    expect(screen.getByText('Impressora · impressora-rh')).toBeTruthy()
    expect(screen.getByText('há 2h')).toBeTruthy()
  })
})

describe('Atividade de auditoria — visibilidade por papel', () => {
  it('sem permissao de auditoria o bloco some inteiro (lista vazia sugeriria "nao houve atividade")', () => {
    const { container } = render(
      <RecentActivityPanel
        discovery={{ enabled: true, items: DISCOVERED, href: DISCOVERY_HREF }}
        audit={null}
      />
    )

    expect(container.textContent).not.toContain('Atividade de auditoria')
    expect(container.querySelector(`a[href="${AUDIT_HREF}"]`)).toBeNull()
  })

  it('com permissao, mostra a acao traduzida, o ator e o instante', () => {
    render(
      <RecentActivityPanel
        discovery={{ enabled: true, items: DISCOVERED, href: DISCOVERY_HREF }}
        audit={{
          items: [
            {
              id: 'a-1',
              actionLabel: formatAuditActionLabel('credentials.view'),
              actorLabel: 'admin@core-ti-expert.local',
              targetLabel: 'PC-01',
              whenLabel: 'há 12 min',
            },
          ],
          href: AUDIT_HREF,
        }}
      />
    )

    expect(screen.getByText('Visualização de credenciais')).toBeTruthy()
    expect(screen.getByText('admin@core-ti-expert.local · PC-01')).toBeTruthy()
    expect(screen.getByText('há 12 min')).toBeTruthy()
  })

  it('com permissao e sem eventos, o estado vazio ensina o que costuma cair ali', () => {
    render(
      <RecentActivityPanel
        discovery={{ enabled: true, items: DISCOVERED, href: DISCOVERY_HREF }}
        audit={{ items: [], href: AUDIT_HREF }}
      />
    )

    expect(screen.getByText(/Nenhum evento sensível registrado ainda\./)).toBeTruthy()
  })
})

describe('Linhas clicaveis (Sprint A51)', () => {
  it('cada descoberta leva a /network e cada evento de auditoria leva a /audit', () => {
    render(
      <RecentActivityPanel
        discovery={{ enabled: true, items: DISCOVERED, href: DISCOVERY_HREF }}
        audit={{
          items: [
            {
              id: 'a-1',
              actionLabel: 'Login',
              actorLabel: 'admin@core-ti-expert.local',
              targetLabel: null,
              whenLabel: 'há 12 min',
            },
          ],
          href: AUDIT_HREF,
        }}
      />
    )

    expect(screen.getByText('192.168.1.10').closest('a')?.getAttribute('href')).toBe(DISCOVERY_HREF)
    expect(screen.getByText('Login').closest('a')?.getAttribute('href')).toBe(AUDIT_HREF)
  })
})

describe('Traducoes defensivas do painel', () => {
  it('acao de auditoria desconhecida cai no proprio identificador, nao some da tela', () => {
    expect(formatAuditActionLabel('login')).toBe('Login')
    expect(formatAuditActionLabel('device.delete')).toBe('Exclusão de máquina')
    expect(formatAuditActionLabel('algo.novo')).toBe('algo.novo')
  })

  it('deviceType fora do catalogo fechado vira UNKNOWN em vez de quebrar o rotulo', () => {
    expect(toDiscoveredDeviceType('PRINTER')).toBe('PRINTER')
    expect(toDiscoveredDeviceType('CAFETEIRA')).toBe('UNKNOWN')
  })
})
