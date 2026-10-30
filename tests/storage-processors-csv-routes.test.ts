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
vi.mock('@/lib/prisma', () => ({ default: { device: { findMany: mocks.findMany } } }))

import { GET as getStorage } from '@/app/api/tenant/[clientSlug]/storage/csv/route'
import { GET as getProcessors } from '@/app/api/tenant/[clientSlug]/processors/csv/route'

const tenant = { id: 'client-1', slug: 'acme' }
const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
const req = {} as never

const cases = [
  {
    name: 'storage',
    GET: getStorage,
    devices: [
      {
        hostname: '=cmd|calc',
        usuario: 'ana',
        disks: [
          { unidade: 'C:', modelo: 'SSD', tipo: 'SSD', capacidadeGb: 100, espacoLivreGb: 40, criptografia: 'on' },
        ],
      },
    ],
    expectedRow: "'=cmd|calc;ana;C:;SSD;SSD;100;60;40;60;on",
  },
  {
    name: 'processors',
    GET: getProcessors,
    devices: [{ hostname: '@evil', hardware: { processador: 'Intel Core i5' } }],
    expectedRow: "Intel Core i5;",
  },
]

describe.each(cases)('GET /api/tenant/[clientSlug]/$name/csv', ({ GET, devices, expectedRow }) => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue(devices)
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 for cross-tenant access', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns a BOM CSV with formula injection escaped', async () => {
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toContain(expectedRow)
  })
})

describe('processors csv hostnames', () => {
  it('escapes a hostname starting with @', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([{ hostname: '@evil', hardware: { processador: 'Intel Core i5' } }])
    const text = await (await getProcessors(req, params)).text()
    expect(text).toContain(";1;'@evil")
  })
})
