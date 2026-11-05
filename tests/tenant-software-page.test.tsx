// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  requireTenantContext: vi.fn(),
  requirePortalContext: vi.fn(),
  deviceFindMany: vi.fn(),
  ruleFindMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
  canReadTenantData: (...args: unknown[]) => (mocks.canAccessTenant as (...a: unknown[]) => unknown)(...args),
  canOperateTenant: (...args: unknown[]) => (mocks.canAccessTenant as (...a: unknown[]) => unknown)(...args),
}))
vi.mock('@/lib/tenant-context', () => ({
  getTenantContext: mocks.getTenantContext,
  requireTenantContext: mocks.requireTenantContext,
}))
vi.mock('@/lib/portal-context', () => ({ requirePortalContext: mocks.requirePortalContext }))
vi.mock('@/lib/prisma', () => ({
  default: {
    device: { findMany: mocks.deviceFindMany },
    alertRule: { findMany: mocks.ruleFindMany },
    softwareLicense: { findMany: vi.fn(async () => []) },
    software: { findMany: vi.fn(async () => []) },
  },
}))

import { GET } from '@/app/api/tenant/[clientSlug]/software/csv/route'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { buildSoftwareCatalog, deduplicateDeviceSoftware, isControlPanelSoftware } from '@/lib/software-catalog'
import { TenantSoftwareTable, type SoftwareCatalogItem } from '@/components/tenant-software-table'
import TenantSoftwarePage from '@/app/app/[clientSlug]/software/page'
import PortalSoftwarePage from '@/app/portal/software/page'

const items: SoftwareCatalogItem[] = [
  {
    key: 'a',
    nome: 'Chrome',
    versao: '120',
    editor: 'Google',
    installationsCount: 5,
    machines: [
      { id: 'm1', hostname: 'pc-1' },
      { id: 'm2', hostname: 'pc-2' },
      { id: 'm3', hostname: 'pc-3' },
      { id: 'm4', hostname: 'pc-4' },
      { id: 'm5', hostname: 'pc-5' },
    ],
    isBlacklisted: false,
  },
  {
    key: 'b',
    nome: 'uTorrent',
    versao: '3.5',
    editor: 'BitTorrent',
    installationsCount: 1,
    machines: [{ id: 'm9', hostname: 'notebook-9' }],
    isBlacklisted: true,
  },
]

describe('<TenantSoftwareTable />', () => {
  it('filtra por nome, versão, editor e hostname', () => {
    render(<TenantSoftwareTable items={items} tenantSlug="acme" />)
    const search = screen.getByLabelText('Buscar software')

    fireEvent.change(search, { target: { value: 'bittorrent' } })
    expect(screen.queryByText('Chrome')).toBeNull()
    expect(screen.getByText('uTorrent')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'pc-3' } })
    expect(screen.getByText('Chrome')).toBeTruthy()
    expect(screen.queryByText('uTorrent')).toBeNull()
  })

  it('aba Restritos mostra só itens blacklisted com pílula "Restrito"', () => {
    render(<TenantSoftwareTable items={items} tenantSlug="acme" />)
    expect(screen.getByText('Permitido')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Restritos / Blacklist' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Restritos / Blacklist' }))
    expect(screen.queryByText('Chrome')).toBeNull()
    expect(screen.getByText('Restrito')).toBeTruthy()
  })

  it('links de máquinas apontam para o detalhe e limitam a 3 + badge', () => {
    render(<TenantSoftwareTable items={items} tenantSlug="acme" />)
    expect(screen.getByRole('link', { name: 'pc-1' }).getAttribute('href')).toBe('/app/acme/assets/m1')
    expect(screen.queryByRole('link', { name: 'pc-4' })).toBeNull()
    expect(screen.getByText('+2')).toBeTruthy()
  })
})

describe('lib/software-catalog', () => {
  it('isControlPanelSoftware descarta componentes internos', () => {
    for (const nome of [
      'vs_FileTracker_Singleton',
      'vcpp_crt.redist.clickonce',
      'Application Verifier x64 External Package',
      'Windows SDK for Windows Store Apps Libs',
      'Definition Update for Microsoft Defender',
      'Update for Windows (KB5001234)',
      'Microsoft Visual C++ 2022 X64 Minimum Runtime - 14.38',
    ]) {
      expect(isControlPanelSoftware({ nome })).toBe(false)
    }
    expect(isControlPanelSoftware({ nome: 'Google Chrome', editor: 'Google LLC' })).toBe(true)
  })

  it('deduplicateDeviceSoftware mantém a maior versão por nome', () => {
    const out = deduplicateDeviceSoftware([
      { nome: 'Google Chrome', versao: '9.0' },
      { nome: ' google chrome', versao: '10.0' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].versao).toBe('10.0')
  })

  it('buildSoftwareCatalog agrupa por nome e junta versões', () => {
    const catalog = buildSoftwareCatalog(
      [
        { id: 'a', hostname: 'pc-a', software: [{ nome: 'Google Chrome', versao: '1', editor: 'Google' }] },
        { id: 'b', hostname: 'pc-b', software: [{ nome: 'Google Chrome', versao: '2', editor: 'Google' }, { nome: 'vs_x', versao: null, editor: null }] },
      ],
      ['chrome']
    )
    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({ versao: '1, 2', installationsCount: 2, isBlacklisted: true })
  })
})

describe('initialTab', () => {
  it('abre na aba informada', () => {
    render(<TenantSoftwareTable items={items} tenantSlug="acme" initialTab="blacklisted" />)
    expect(screen.queryByText('Chrome')).toBeNull()
    expect(screen.getByText('uTorrent')).toBeTruthy()
  })
})

describe('GET /api/tenant/[clientSlug]/software/csv', () => {
  const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
  const req = {} as never

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue({ id: 'client-1', slug: 'acme' })
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.ruleFindMany.mockResolvedValue([{ pattern: 'torrent' }])
    mocks.deviceFindMany.mockResolvedValue([])
  })

  it('401 sem sessão', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(401)
    expect(mocks.deviceFindMany).not.toHaveBeenCalled()
  })

  it('403 sem acesso ao tenant', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.deviceFindMany).not.toHaveBeenCalled()
  })

  it('200 com BOM, delimitador ";" e proteção contra formula injection', async () => {
    mocks.deviceFindMany.mockResolvedValue([
      {
        id: 'm1',
        hostname: 'pc-1',
        software: [
          { nome: '=HYPERLINK("x")', versao: '1.0', editor: 'Evil' },
          { nome: 'uTorrent', versao: '3.5', editor: null },
        ],
      },
      { id: 'm2', hostname: 'pc-2', software: [{ nome: 'uTorrent', versao: '3.5', editor: null }] },
    ])

    const res = await GET(req, params)
    expect(res.status).toBe(200)
    expect(mocks.deviceFindMany.mock.calls[0][0].where).toEqual(getTenantDeviceWhere('acme'))

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder('utf-8', { ignoreBOM: false }).decode(bytes).split('\r\n')
    expect(lines[0]).toBe('Software;Versao;Fabricante;Conformidade;Qtd Maquinas;Maquinas')
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`)
    expect(lines[2]).toBe('uTorrent;3.5;;Restrito;2;"pc-1, pc-2"'.replace('"pc-1, pc-2"', 'pc-1, pc-2'))
  })
})

describe('Sprint A70 — paginação e ?tab= do catálogo', () => {
  // 30 itens: 27 permitidos em 1 máquina + 3 restritos em 2 máquinas.
  const many: SoftwareCatalogItem[] = Array.from({ length: 30 }, (_, index) => ({
    key: `sw-${index + 1}`,
    nome: `App ${String(index + 1).padStart(2, '0')}`,
    versao: '1.0',
    editor: 'Acme',
    installationsCount: index >= 27 ? 2 : 1,
    machines: [{ id: `m${index + 1}`, hostname: `host-${index + 1}` }],
    isBlacklisted: index >= 27,
  }))

  beforeEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/app/acme/software')
  })

  it('pagina 25 por vez e conta o conjunto filtrado no rodapé', () => {
    render(<TenantSoftwareTable items={many} tenantSlug="acme" />)
    expect(screen.getByText('App 25')).toBeTruthy()
    expect(screen.queryByText('App 26')).toBeNull()
    expect(screen.getByTestId('table-pagination-summary').textContent).toBe('Exibindo 1–25 de 30 softwares')

    const nav = screen.getByRole('navigation', { name: 'Paginação do catálogo de softwares' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Página 2' }))
    expect(screen.queryByText('App 01')).toBeNull()
    expect(screen.getByText('App 30')).toBeTruthy()
    expect(screen.getByTestId('table-pagination-summary').textContent).toBe('Exibindo 26–30 de 30 softwares')
  })

  it('trocar de aba grava ?tab= na URL e volta para a página 1', () => {
    window.history.replaceState(null, '', '/app/acme/software?foo=bar')
    render(<TenantSoftwareTable items={many} tenantSlug="acme" />)
    const nav = screen.getByRole('navigation', { name: 'Paginação do catálogo de softwares' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Página 2' }))

    const restricted = screen.getByRole('tab', { name: 'Restritos / Blacklist' })
    fireEvent.mouseDown(restricted)
    fireEvent.click(restricted)
    expect(window.location.search).toBe('?foo=bar&tab=blacklisted')
    expect(screen.getByTestId('table-pagination-summary').textContent).toBe('Exibindo 1–3 de 3 softwares')

    const widespread = screen.getByRole('tab', { name: 'Em múltiplas máquinas' })
    fireEvent.mouseDown(widespread)
    fireEvent.click(widespread)
    expect(window.location.search).toBe('?foo=bar&tab=widespread')

    const all = screen.getByRole('tab', { name: 'Todos' })
    fireEvent.mouseDown(all)
    fireEvent.click(all)
    expect(window.location.search).toBe('?foo=bar')
    expect(screen.getByText('App 01')).toBeTruthy()
  })

  it('buscar volta para a página 1 e mantém os links das máquinas', () => {
    render(<TenantSoftwareTable items={many} tenantSlug="acme" />)
    const nav = screen.getByRole('navigation', { name: 'Paginação do catálogo de softwares' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Página 2' }))

    fireEvent.change(screen.getByLabelText('Buscar software'), { target: { value: 'app 0' } })
    expect(screen.getByTestId('table-pagination-summary').textContent).toBe('Exibindo 1–9 de 9 softwares')
    expect(screen.getByRole('link', { name: 'host-1' }).getAttribute('href')).toBe('/app/acme/assets/m1')
  })
})

describe('Sprint A70 — card de KPI ativo conforme ?tab=', () => {
  const kpiLink = (label: string) => screen.getByText(label).closest('a') as HTMLAnchorElement
  const isActive = (label: string) => kpiLink(label).className.includes('border-primary')

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mocks.requireTenantContext.mockResolvedValue({ id: 'client-1', slug: 'acme' })
    mocks.requirePortalContext.mockResolvedValue({ clientId: 'client-1', clientName: 'Acme', clientSlug: 'acme' })
    mocks.deviceFindMany.mockResolvedValue([])
    mocks.ruleFindMany.mockResolvedValue([])
  })

  const cases = [
    ['all', 'Softwares distintos'],
    ['widespread', 'Instalações totais'],
    ['blacklisted', 'Softwares restritos'],
  ] as const
  const labels = cases.map(([, label]) => label)

  for (const [tab, label] of cases) {
    it(`?tab=${tab} destaca "${label}" no catálogo do tenant`, async () => {
      render(
        await TenantSoftwarePage({
          params: Promise.resolve({ clientSlug: 'acme' }),
          searchParams: Promise.resolve({ tab }),
        } as never)
      )
      for (const other of labels) expect(isActive(other)).toBe(other === label)
      expect(isActive('Editores / Fabricantes')).toBe(false)
    })

    it(`?tab=${tab} destaca "${label}" no catálogo do portal`, async () => {
      render(await PortalSoftwarePage({ searchParams: Promise.resolve({ tab }) }))
      for (const other of labels) expect(isActive(other)).toBe(other === label)
      expect(isActive('Editores / Fabricantes')).toBe(false)
    })
  }
})
