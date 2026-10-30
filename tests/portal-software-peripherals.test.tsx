// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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
