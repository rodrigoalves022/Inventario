import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/prisma', () => ({
  default: { discoveredDevice: { findMany: mocks.findMany } },
}))

import { GET } from '@/app/api/tenant/[clientSlug]/network/discovered/csv/route'

const tenant = { id: 'client-1', slug: 'acme' }
const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
const req = {} as never

function device(overrides: Record<string, unknown> = {}) {
  return {
    ip: '10.0.0.5',
    mac: 'AA:BB:CC:DD:EE:FF',
    hostname: 'printer-1',
    vendor: 'HP',
    deviceType: 'PRINTER',
    openPorts: '80,9100',
    snmpSysDescr: null,
    firstSeenAt: new Date('2026-01-01T00:00:00Z'),
    lastSeenAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }
}

describe('GET /api/tenant/[clientSlug]/network/discovered/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([])
  })

  it('returns 403 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 for cross-tenant access', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 when tenant does not exist', async () => {
    mocks.getTenantContext.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
  })

  it('returns scoped CSV with BOM, headers and escaped formulas', async () => {
    mocks.findMany.mockResolvedValue([
      device(),
      device({ ip: '10.0.0.6', hostname: '=CMD("calc")', snmpSysDescr: 'a,b "c"' }),
    ])

    const res = await GET(req, params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toContain('dispositivos-descobertos-acme.csv')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1' },
      orderBy: [{ deviceType: 'asc' }, { ip: 'asc' }],
    })

    // `res.text()` descarta o BOM (spec Fetch), entao inspecionamos os bytes.
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder('utf-8', { ignoreBOM: false }).decode(bytes).split('\r\n')
    expect(lines[0]).toBe(
      'IP,MAC,Hostname,Fabricante,Tipo,Portas Abertas,Descrição SNMP,Primeira Detecção,Última Detecção'
    )
    expect(lines[1]).toContain('10.0.0.5')
    expect(lines[1]).toContain('"80,9100"')
    expect(lines[2]).toContain(`"'=CMD(""calc"")"`)
    expect(lines[2]).toContain('"a,b ""c"""')
  })
})
