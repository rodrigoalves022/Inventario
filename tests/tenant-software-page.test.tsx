// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  deviceFindMany: vi.fn(),
  ruleFindMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/prisma', () => ({
  default: {
    device: { findMany: mocks.deviceFindMany },
    alertRule: { findMany: mocks.ruleFindMany },
  },
}))

import { GET } from '@/app/api/tenant/[clientSlug]/software/csv/route'
import { TenantSoftwareTable, type SoftwareCatalogItem } from '@/components/tenant-software-table'

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
    expect(mocks.deviceFindMany.mock.calls[0][0].where).toEqual({ clientId: 'client-1' })

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder('utf-8', { ignoreBOM: false }).decode(bytes).split('\r\n')
    expect(lines[0]).toBe('Software;Versao;Fabricante;Conformidade;Qtd Maquinas;Maquinas')
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`)
    expect(lines[2]).toBe('uTorrent;3.5;;Restrito;2;"pc-1, pc-2"'.replace('"pc-1, pc-2"', 'pc-1, pc-2'))
  })
})
