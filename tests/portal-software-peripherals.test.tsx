// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

const ctx = { clientId: 'c1', clientName: 'Acme', clientSlug: 'acme', viewerName: 'Ana', viewerEmail: 'a@acme.com' }

const { findDevices, findRules } = vi.hoisted(() => ({ findDevices: vi.fn(), findRules: vi.fn() }))

vi.mock('@/lib/portal-context', () => ({ requirePortalContext: vi.fn(async () => ctx) }))
vi.mock('@/lib/prisma', () => ({
  default: { device: { findMany: findDevices }, alertRule: { findMany: findRules } },
}))
vi.mock('@/components/portal-sign-out-button', () => ({ PortalSignOutButton: () => <button>Sair</button> }))
vi.mock('@/components/tenant-software-table', () => ({
  TenantSoftwareTable: ({ items, tenantSlug }: { items: unknown[]; tenantSlug: string }) => (
    <div data-testid="sw-table">{items.length}:{tenantSlug}</div>
  ),
}))
vi.mock('@/components/tenant-peripherals-table', () => ({
  TenantPeripheralsTable: ({ rows, tenantSlug }: { rows: unknown[]; tenantSlug: string }) => (
    <div data-testid="per-table">{rows.length}:{tenantSlug}</div>
  ),
}))

vi.mock('@/components/tenant-local-accounts-table', () => ({
  TenantLocalAccountsTable: ({
    rows,
    tenantSlug,
    deviceBasePath,
  }: {
    rows: unknown[]
    tenantSlug: string
    deviceBasePath?: string
  }) => (
    <div data-testid="la-table">{rows.length}:{tenantSlug}:{deviceBasePath}</div>
  ),
}))

import PortalLayout from '@/app/portal/layout'
import PortalHomePage from '@/app/portal/page'
import PortalLocalAccountsPage from '@/app/portal/local-accounts/page'
import PortalSoftwarePage from '@/app/portal/software/page'
import PortalPeripheralsPage from '@/app/portal/peripherals/page'

beforeEach(() => {
  cleanup()
  findDevices.mockReset()
  findRules.mockReset()
})

describe('PortalLayout', () => {
  it('renderiza links de navegação do portal', async () => {
    render(await PortalLayout({ children: <p>conteúdo</p> }))
    for (const [label, href] of [
      ['Dispositivos', '/portal'],
      ['Softwares', '/portal/software'],
      ['Periféricos', '/portal/peripherals'],
      ['Contas locais', '/portal/local-accounts'],
      ['Relatórios', '/portal/reports'],
    ]) {
      expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href)
    }
  })
})

describe('PortalSoftwarePage', () => {
  it('agrega KPIs, tabela e CSV do tenant', async () => {
    findDevices.mockResolvedValue([
      { id: 'd1', hostname: 'pc1', software: [{ nome: 'Chrome', versao: '1', editor: 'Google', installadoEm: null }, { nome: 'Torrent', versao: '2', editor: 'X', installadoEm: null }] },
      { id: 'd2', hostname: 'pc2', software: [{ nome: 'Chrome', versao: '1', editor: 'Google', installadoEm: null }] },
    ])
    findRules.mockResolvedValue([{ pattern: 'torrent' }])
    render(await PortalSoftwarePage({ searchParams: Promise.resolve({}) }))
    expect(findDevices.mock.calls[0][0].where).toEqual({ clientId: 'c1', agentAuth: { is: { isActive: true } } })
    expect(screen.getByText('Catálogo de Softwares')).toBeTruthy()
    expect(screen.getByText(/Acme/)).toBeTruthy()
    expect(screen.getByTestId('sw-table').textContent).toBe('2:acme')
    expect(screen.getByText('Softwares restritos')).toBeTruthy()
    expect(screen.getByText('Instalações totais')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Baixar CSV/ }).getAttribute('href')).toBe('/api/tenant/acme/software/csv')
  })
})

describe('PortalLocalAccountsPage', () => {
  it('agrega KPIs, tabela e CSV do tenant', async () => {
    findDevices.mockResolvedValue([
      {
        id: 'd1',
        hostname: 'pc1',
        localAccounts: [
          { id: 'a1', usuario: 'admin', isAdmin: true, habilitada: true, senhaNuncaExpira: true },
          { id: 'a2', usuario: 'user', isAdmin: false, habilitada: true, senhaNuncaExpira: false },
        ],
      },
    ])
    render(await PortalLocalAccountsPage({ searchParams: Promise.resolve({}) }))
    expect(findDevices.mock.calls[0][0].where).toEqual({ clientId: 'c1', agentAuth: { is: { isActive: true } } })
    expect(screen.getByText('Contas Locais e Privilégios')).toBeTruthy()
    expect(screen.getByText('Total de contas locais')).toBeTruthy()
    expect(screen.getByTestId('la-table').textContent).toBe('2:acme:/portal/devices')
    expect(screen.getByRole('link', { name: /Baixar CSV/ }).getAttribute('href')).toBe('/api/tenant/acme/local-accounts/csv')
  })
})

describe('PortalPeripheralsPage', () => {
  it('agrega KPIs, tabela e CSV do tenant', async () => {
    findDevices.mockResolvedValue([
      {
        id: 'd1',
        hostname: 'pc1',
        monitors: [{ id: 'm1', fabricante: 'Dell', modelo: 'U24', serial: 's', polegadas: 24, conexao: 'HDMI', ano: 2020 }],
        printers: [{ id: 'p1', nome: 'HP', porta: 'IP', driver: 'd', padrao: true, deRede: true }],
        usbDevices: [{ id: 'u1', nome: 'Mouse', vendorId: '1', productId: '2', serial: null }],
      },
    ])
    render(await PortalPeripheralsPage({ searchParams: Promise.resolve({}) }))
    expect(findDevices.mock.calls[0][0].where).toEqual({ clientId: 'c1', agentAuth: { is: { isActive: true } } })
    expect(screen.getByText('Periféricos e Dispositivos USB')).toBeTruthy()
    expect(screen.getByText('Total de periféricos')).toBeTruthy()
    expect(screen.getByText('1 em rede')).toBeTruthy()
    expect(screen.getByTestId('per-table').textContent).toBe('3:acme')
    expect(screen.getByRole('link', { name: /Baixar CSV/ }).getAttribute('href')).toBe('/api/tenant/acme/peripherals/csv')
  })
})

describe('PortalHomePage (Sprint A66)', () => {
  const devices = [
    {
      id: 'd1',
      hostname: 'PC-01',
      status: 'online',
      updatedAt: new Date(Date.now() - 5 * 60_000),
      usuario: 'ana',
      anydeskId: '123456789',
      hardware: { sistema: 'Windows 11', ramTotalGb: 16, processador: 'Intel i5' },
      networks: [{ ip: '10.0.0.5' }],
      software: [{ nome: 'Chrome', versao: '1', editor: 'Google', installadoEm: null }],
    },
    {
      id: 'd2',
      hostname: 'PC-02',
      status: 'offline',
      updatedAt: new Date(Date.now() - 3 * 86_400_000),
      usuario: null,
      anydeskId: null,
      hardware: null,
      networks: [],
      software: [],
    },
  ]

  it('copia IP e AnyDesk com botoes fora do link da maquina', async () => {
    findDevices.mockResolvedValue(devices)
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(await PortalHomePage({ searchParams: Promise.resolve({}) }))

    const link = screen.getByRole('link', { name: 'PC-01' })
    expect(link.getAttribute('href')).toBe('/portal/devices/d1')

    const copyIp = screen.getByRole('button', { name: 'Copiar IP 10.0.0.5' })
    const copyAnydesk = screen.getByRole('button', { name: 'Copiar AnyDesk 123456789' })
    // Botao dentro de <a> seguiria o href no clique; aqui eles sao irmaos do link.
    expect(copyIp.closest('a')).toBeNull()
    expect(copyAnydesk.closest('a')).toBeNull()

    fireEvent.click(copyIp)
    fireEvent.click(copyAnydesk)
    expect(writeText).toHaveBeenCalledWith('10.0.0.5')
    expect(writeText).toHaveBeenCalledWith('123456789')

    // Maquina sem IP nem AnyDesk nao ganha botao de copiar.
    const row2 = screen.getByRole('link', { name: 'PC-02' }).closest('li') as HTMLElement
    expect(within(row2).queryByRole('button')).toBeNull()
    expect(within(row2).getByText('sem IP')).toBeTruthy()
  })

  it('mostra a idade da ultima coleta em <time> com data absoluta', async () => {
    findDevices.mockResolvedValue(devices)
    render(await PortalHomePage({ searchParams: Promise.resolve({}) }))

    const row1 = screen.getByRole('link', { name: 'PC-01' }).closest('li') as HTMLElement
    const time1 = row1.querySelector('time') as HTMLTimeElement
    expect(time1.getAttribute('dateTime')).toBe(devices[0].updatedAt.toISOString())
    expect(time1.getAttribute('title')).toMatch(/^Última coleta: /)
    expect(time1.textContent).toBe('Última coleta há 5 min')

    const row2 = screen.getByRole('link', { name: 'PC-02' }).closest('li') as HTMLElement
    expect(row2.querySelector('time')?.textContent).toBe('Última coleta há 3 dias')
  })

  it('mantem busca, filtro de status e exportacoes CSV/PDF', async () => {
    findDevices.mockResolvedValue(devices)
    render(await PortalHomePage({ searchParams: Promise.resolve({ q: '10.0.0.5', status: 'online' }) }))

    expect(findDevices.mock.calls[0][0].where).toEqual({ clientId: 'c1', agentAuth: { is: { isActive: true } } })
    expect(screen.getByRole('link', { name: 'PC-01' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'PC-02' })).toBeNull()

    const search = screen.getByRole('searchbox', { name: 'Buscar máquinas' }) as HTMLInputElement
    expect(search.value).toBe('10.0.0.5')
    const form = search.closest('form') as HTMLFormElement
    expect(form.getAttribute('action')).toBe('/portal')
    expect((form.querySelector('input[name="status"]') as HTMLInputElement).value).toBe('online')
    expect(screen.getByRole('link', { name: 'Limpar filtro' }).getAttribute('href')).toBe('/portal')

    // KPI de status troca so o status e preserva a busca digitada.
    expect(screen.getByRole('link', { name: /Offline/ }).getAttribute('href')).toBe('/portal?status=offline&q=10.0.0.5')

    expect(screen.getByRole('link', { name: /Baixar CSV/ }).getAttribute('href')).toBe('/api/portal/reports/csv')
    expect(screen.getByRole('link', { name: /Baixar PDF/ }).getAttribute('href')).toBe('/api/portal/reports/pdf')
  })

  it('filtro de status sem resultado mostra estado vazio', async () => {
    findDevices.mockResolvedValue(devices)
    render(await PortalHomePage({ searchParams: Promise.resolve({ status: 'warning' }) }))
    expect(screen.queryByRole('link', { name: 'PC-01' })).toBeNull()
    expect(screen.getByText('Nenhuma máquina com este status.')).toBeTruthy()
  })
})

describe('PortalHomePage resumo do parque (Sprint A67)', () => {
  const base = { status: 'online', updatedAt: new Date(), usuario: null, anydeskId: null, networks: [], software: [] }
  const fleet = [
    { ...base, id: 'd1', hostname: 'PC-01', hardware: { sistema: 'Microsoft Windows 11 Pro', ramTotalGb: 16, processador: 'i5' } },
    { ...base, id: 'd2', hostname: 'PC-02', hardware: { sistema: 'Windows Server 2022', ramTotalGb: 64, processador: 'Xeon' } },
    // PRETTY_NAME do os-release, sem a palavra "Linux".
    { ...base, id: 'd3', hostname: 'SRV-01', hardware: { sistema: 'Ubuntu 22.04.3 LTS', ramTotalGb: 32, processador: 'EPYC' } },
    { ...base, id: 'd4', hostname: 'MAC-01', hardware: { sistema: 'macOS 14', ramTotalGb: null, processador: null } },
    { ...base, id: 'd5', hostname: 'PC-05', status: 'offline', hardware: null },
  ]

  it('seleciona RAM e processador e resume RAM total e sistemas do parque inteiro', async () => {
    findDevices.mockResolvedValue(fleet)
    // Filtro ativo nao muda o resumo: ele e do parque, nao da lista.
    render(await PortalHomePage({ searchParams: Promise.resolve({ status: 'offline' }) }))

    expect(findDevices.mock.calls[0][0].select.hardware).toEqual({
      select: { sistema: true, ramTotalGb: true, processador: true },
    })

    const summary = screen.getByRole('list', { name: 'Resumo do parque' })
    const pills = within(summary).getAllByRole('listitem').map((item) => item.textContent)
    expect(pills).toEqual([
      '112 GB de memória RAM total',
      '2 Windows',
      '1 Linux',
      '1 outro sistema',
      '1 sem sistema informado',
    ])
    expect(within(summary).getAllByRole('listitem')[0].getAttribute('title')).toBe(
      'Soma de 3 de 5 máquina(s) com memória informada',
    )
  })

  it('omite sistemas zerados e o resumo quando nao ha maquinas', async () => {
    findDevices.mockResolvedValue([fleet[0]])
    render(await PortalHomePage({ searchParams: Promise.resolve({}) }))
    const items = within(screen.getByRole('list', { name: 'Resumo do parque' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['16 GB de memória RAM total', '1 Windows'])
    expect(items[0].getAttribute('title')).toBeNull()

    cleanup()
    findDevices.mockResolvedValue([])
    render(await PortalHomePage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByRole('list', { name: 'Resumo do parque' })).toBeNull()
  })
})
