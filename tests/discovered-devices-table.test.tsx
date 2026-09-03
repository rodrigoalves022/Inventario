// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, within, fireEvent, screen } from '@testing-library/react'
import { DiscoveredDevicesTable, type DiscoveredDeviceRow } from '@/components/discovered-devices-table'

// Sprint 14 (RF028): filtro por tipo + busca por IP/Hostname/MAC da tabela de
// dispositivos descobertos. O componente e' puro (nao navega, nao dispara
// action) — os casos abaixo exercitam exatamente o que o usuario faz nele.

const devices: DiscoveredDeviceRow[] = [
  {
    id: 'd-printer',
    ip: '192.168.1.10',
    mac: 'AA:BB:CC:DD:EE:FF',
    hostname: 'impressora-rh',
    vendor: 'HP',
    deviceType: 'PRINTER',
    snmpSysDescr: 'HP ETHERNET MULTI-ENVIRONMENT, JETDIRECT',
    openPorts: '80,161,9100',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'd-switch',
    ip: '192.168.1.2',
    mac: '00:1B:78:11:22:33',
    hostname: 'sw-core-01',
    vendor: 'Cisco',
    deviceType: 'SWITCH',
    snmpSysDescr: 'Cisco IOS Software',
    openPorts: '22,161',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'd-router',
    ip: '192.168.1.1',
    mac: null,
    hostname: null,
    vendor: 'MikroTik',
    deviceType: 'ROUTER',
    snmpSysDescr: 'RouterOS RB750',
    openPorts: '80,443,161',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'd-nas',
    ip: '192.168.1.50',
    mac: '00:11:32:AA:BB:CC',
    hostname: 'nas-backup',
    vendor: 'Synology',
    deviceType: 'NAS',
    snmpSysDescr: null,
    openPorts: '80,445',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'd-ap',
    ip: '192.168.1.60',
    mac: null,
    hostname: 'ap-recepcao',
    vendor: 'Ubiquiti',
    deviceType: 'ACCESS_POINT',
    snmpSysDescr: 'UniFi AP-AC-Lite',
    openPorts: '22,80',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'd-unknown',
    ip: '192.168.1.99',
    mac: null,
    hostname: null,
    vendor: null,
    deviceType: 'UNKNOWN',
    snmpSysDescr: null,
    openPorts: '443',
    firstSeenAt: '2026-08-01T10:00:00.000Z',
    lastSeenAt: '2026-09-01T10:00:00.000Z',
  },
]

function renderTable(overrides: Partial<Parameters<typeof DiscoveredDevicesTable>[0]> = {}) {
  const result = render(<DiscoveredDevicesTable devices={devices} discoveryEnabled {...overrides} />)
  const table = result.container.querySelector('table') as HTMLElement
  return { ...result, table }
}

/**
 * Radix Tabs troca de aba na ativacao automatica por FOCO da trigger (roving
 * tabindex), nao so no evento `click` isolado — `fireEvent.click` sozinho no
 * jsdom nao dispara foco de verdade, entao a aba nunca muda sem este passo
 * extra. Mesmo helper ja documentado em
 * tests/device-detail-tabs-metrics-polling.test.tsx.
 */
function switchToTab(name: string) {
  const trigger = screen.getByRole('tab', { name })
  fireEvent.mouseDown(trigger)
  fireEvent.focus(trigger)
  fireEvent.click(trigger)
}

/** Conta linhas de dados (o `tbody` sempre tem ao menos a linha de estado vazio). */
function visibleIps(table: HTMLElement) {
  return Array.from(table.querySelectorAll('tbody tr'))
    .map((row) => row.querySelector('td')?.textContent ?? '')
    .filter((text) => /^\d+\.\d+\.\d+\.\d+$/.test(text))
}

describe('DiscoveredDevicesTable — listagem', () => {
  it('sem filtro, lista todos os dispositivos descobertos', () => {
    const { table } = renderTable()
    expect(visibleIps(table)).toHaveLength(devices.length)
  })

  it('exibe IP, MAC, hostname, fabricante, descricao SNMP e portas do dispositivo', () => {
    const { table } = renderTable()
    const scoped = within(table)

    expect(scoped.getByText('192.168.1.10')).toBeDefined()
    expect(scoped.getByText('AA:BB:CC:DD:EE:FF')).toBeDefined()
    expect(scoped.getByText('impressora-rh')).toBeDefined()
    expect(scoped.getByText('HP')).toBeDefined()
    expect(scoped.getByText('HP ETHERNET MULTI-ENVIRONMENT, JETDIRECT')).toBeDefined()
    expect(scoped.getByText('80,161,9100')).toBeDefined()
  })

  it('campos nao apurados aparecem como "-", nunca como "null" ou vazio', () => {
    const { table } = renderTable({ devices: [devices[5]] })
    const cells = Array.from(table.querySelectorAll('tbody tr td')).map((cell) => cell.textContent)

    // MAC, hostname e fabricante/SNMP do dispositivo UNKNOWN.
    expect(cells.filter((text) => text === '-')).toHaveLength(3)
    expect(cells.some((text) => text?.includes('null'))).toBe(false)
  })
})

describe('DiscoveredDevicesTable — filtro por tipo', () => {
  it('aba "Impressoras" mostra so o dispositivo PRINTER', () => {
    const { table } = renderTable()

    switchToTab('Impressoras')

    expect(visibleIps(table)).toEqual(['192.168.1.10'])
  })

  it('aba "Roteadores/Switches" agrupa ROUTER, SWITCH e ACCESS_POINT', () => {
    const { table } = renderTable()

    switchToTab('Roteadores/Switches')

    expect(visibleIps(table).sort()).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.60'])
  })

  it('aba "NAS" mostra so o NAS', () => {
    const { table } = renderTable()

    switchToTab('NAS')

    expect(visibleIps(table)).toEqual(['192.168.1.50'])
  })

  it('voltar para "Todos" restaura a lista completa', () => {
    const { table } = renderTable()

    switchToTab('NAS')
    expect(visibleIps(table)).toHaveLength(1)

    switchToTab('Todos')
    expect(visibleIps(table)).toHaveLength(devices.length)
  })
})

describe('DiscoveredDevicesTable — busca', () => {
  it('busca por IP parcial filtra a lista', () => {
    const { table } = renderTable()

    fireEvent.change(screen.getByLabelText('Buscar por IP, hostname ou MAC'), { target: { value: '1.50' } })

    expect(visibleIps(table)).toEqual(['192.168.1.50'])
  })

  it('busca por hostname e case-insensitive', () => {
    const { table } = renderTable()

    fireEvent.change(screen.getByLabelText('Buscar por IP, hostname ou MAC'), { target: { value: 'IMPRESSORA' } })

    expect(visibleIps(table)).toEqual(['192.168.1.10'])
  })

  it('busca por MAC parcial filtra a lista', () => {
    const { table } = renderTable()

    fireEvent.change(screen.getByLabelText('Buscar por IP, hostname ou MAC'), { target: { value: '00:1b:78' } })

    expect(visibleIps(table)).toEqual(['192.168.1.2'])
  })

  it('busca nao vasculha vendor/sysDescr — "cisco" nao traz nada por hostname/IP/MAC', () => {
    const { table } = renderTable()

    fireEvent.change(screen.getByLabelText('Buscar por IP, hostname ou MAC'), { target: { value: 'cisco' } })

    expect(visibleIps(table)).toHaveLength(0)
    expect(within(table).getByText('Nenhum dispositivo descoberto corresponde ao filtro.')).toBeDefined()
  })

  it('busca e filtro de tipo se combinam (AND, nunca OR)', () => {
    const { table } = renderTable()

    switchToTab('Roteadores/Switches')
    fireEvent.change(screen.getByLabelText('Buscar por IP, hostname ou MAC'), { target: { value: 'ap-' } })

    expect(visibleIps(table)).toEqual(['192.168.1.60'])
  })
})

describe('DiscoveredDevicesTable — estados vazios', () => {
  it('varredura desabilitada explica que a feature esta desligada, nao que a rede esta vazia', () => {
    const { table } = renderTable({ devices: [], discoveryEnabled: false })

    expect(within(table).getByText(/Varredura de rede desabilitada para este tenant/)).toBeDefined()
  })

  it('varredura habilitada e nenhum dispositivo ainda mostra mensagem propria', () => {
    const { table } = renderTable({ devices: [], discoveryEnabled: true })

    expect(within(table).getByText(/Nenhum dispositivo descoberto ainda/)).toBeDefined()
  })
})
