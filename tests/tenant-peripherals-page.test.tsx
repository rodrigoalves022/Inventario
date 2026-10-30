// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
  canReadTenantData: (...args: unknown[]) => (mocks.canAccessTenant as (...a: unknown[]) => unknown)(...args),
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/prisma', () => ({ default: { device: { findMany: mocks.findMany } } }))

import { GET } from '@/app/api/tenant/[clientSlug]/peripherals/csv/route'
import { TenantPeripheralsTable, type TenantPeripheralRow } from '@/components/tenant-peripherals-table'

const rows: TenantPeripheralRow[] = [
  { id: 'm1', category: 'monitor', deviceId: 'd1', hostname: 'PC-01', name: 'Dell P2419', vendorOrDriver: 'Dell', serialOrPort: 'SN123', detail: '24" · HDMI (2022)', isNetworkPrinter: false },
  { id: 'p1', category: 'printer', deviceId: 'd2', hostname: 'PC-02', name: 'HP LaserJet', vendorOrDriver: 'HP Driver', serialOrPort: 'IP_10.0.0.9', detail: 'Rede · Padrão', isNetworkPrinter: true },
  { id: 'u1', category: 'usb', deviceId: 'd2', hostname: 'PC-02', name: 'Kingston DataTraveler', vendorOrDriver: 'VID:0951 PID:1666', serialOrPort: null, detail: 'Dispositivo USB', isNetworkPrinter: false },
]

describe('TenantPeripheralsTable', () => {
  it('filters by category tab', () => {
    render(<TenantPeripheralsTable rows={rows} tenantSlug="acme" />)
    expect(screen.getByText('Dell P2419')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'USB' }))
    expect(screen.queryByText('Dell P2419')).toBeNull()
    expect(screen.getByText('Kingston DataTraveler')).toBeTruthy()
  })

  it('searches across fields', () => {
    render(<TenantPeripheralsTable rows={rows} tenantSlug="acme" />)
    fireEvent.change(screen.getByLabelText('Buscar periféricos'), { target: { value: 'sn123' } })
    expect(screen.getByText('Dell P2419')).toBeTruthy()
    expect(screen.queryByText('HP LaserJet')).toBeNull()
  })

  it('starts on initialCategory and follows prop changes', () => {
    const { rerender } = render(<TenantPeripheralsTable rows={rows} tenantSlug="acme" initialCategory="printer" />)
    expect(screen.getByText('HP LaserJet')).toBeTruthy()
    expect(screen.queryByText('Dell P2419')).toBeNull()
    rerender(<TenantPeripheralsTable rows={rows} tenantSlug="acme" initialCategory="usb" />)
    expect(screen.getByText('Kingston DataTraveler')).toBeTruthy()
    expect(screen.queryByText('HP LaserJet')).toBeNull()
  })

  it('uses deviceBasePath for machine links', () => {
    render(<TenantPeripheralsTable rows={rows} tenantSlug="acme" deviceBasePath="/portal/devices" />)
    expect(screen.getByRole('link', { name: 'PC-01' }).getAttribute('href')).toBe('/portal/devices/d1')
  })

  it('links the machine to the asset page', () => {
    render(<TenantPeripheralsTable rows={rows} tenantSlug="acme" />)
    expect(screen.getByRole('link', { name: 'PC-01' }).getAttribute('href')).toBe('/app/acme/assets/d1')
  })
})

describe('GET /api/tenant/[clientSlug]/peripherals/csv', () => {
  const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
  const req = {} as never

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue({ id: 'c1', slug: 'acme' })
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([])
  })

  it('returns 401 without session', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(req, params)).status).toBe(401)
  })

  it('returns 403 for cross-tenant access', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('scopes devices to active agents via getTenantDeviceWhere', async () => {
    await GET(req, params)
    const where = mocks.findMany.mock.calls[0][0].where
    expect(where.clientId).toBeUndefined()
    expect(JSON.stringify(where)).toContain('acme')
  })

  it('returns BOM CSV with formula injection protection', async () => {
    mocks.findMany.mockResolvedValue([
      {
        hostname: 'PC-01',
        monitors: [],
        printers: [{ nome: '=cmd()', porta: 'LPT1', driver: '+drv', padrao: false, deRede: false }],
        usbDevices: [{ nome: 'Pen', vendorId: '0951', productId: null, serial: '@x' }],
      },
    ])
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('Categoria;Periferico;Fabricante/Driver/VID;Serie/Porta;Detalhes;Maquina')
    expect(text).toContain("Impressora;'=cmd();'+drv;LPT1;Local;PC-01")
    expect(text).toContain("USB;Pen;VID:0951 PID:—;'@x;Dispositivo USB;PC-01")
  })
})
