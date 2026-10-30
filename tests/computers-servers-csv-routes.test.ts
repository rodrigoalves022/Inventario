import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  getRows: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/tenant-scope', () => ({ getTenantDeviceWhere: () => ({}) }))
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsBySlug: async () => null,
  getDefaultAlertSettings: () => ({ alertOfflineHours: 24, alertDiskThresholdGb: 20 }),
}))
vi.mock('@/lib/reports/device-report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reports/device-report')>()
  return { ...actual, getDeviceReportRows: mocks.getRows }
})

import { GET as getComputers } from '@/app/api/tenant/[clientSlug]/computers/csv/route'
import { GET as getServers } from '@/app/api/tenant/[clientSlug]/servers/csv/route'

const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
const makeReq = (qs = '') => ({ nextUrl: new URL(`http://x/?${qs}`) }) as never

const rows = [
  { hostname: 'PC-ON', status: 'online', deviceType: 'computador' },
  { hostname: 'PC-OFF', status: 'offline', deviceType: 'computador' },
  { hostname: 'SRV-ON', status: 'online', deviceType: 'servidor' },
  { hostname: 'SRV-OFF', status: 'offline', deviceType: 'servidor' },
]

describe.each([
  { name: 'computers', GET: getComputers, prefix: 'maquinas', keep: ['PC-ON', 'PC-OFF'], drop: ['SRV-ON', 'SRV-OFF'], onlyOnline: 'PC-ON' },
  { name: 'servers', GET: getServers, prefix: 'servidores', keep: ['SRV-ON', 'SRV-OFF'], drop: ['PC-ON', 'PC-OFF'], onlyOnline: 'SRV-ON' },
])('GET /api/tenant/[clientSlug]/$name/csv', ({ GET, prefix, keep, drop, onlyOnline }) => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue({ id: 'c1', slug: 'acme' })
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.getRows.mockResolvedValue(rows)
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(makeReq(), params)).status).toBe(401)
    expect(mocks.getRows).not.toHaveBeenCalled()
  })

  it('returns 403 without tenant access', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    expect((await GET(makeReq(), params)).status).toBe(403)
    expect(mocks.getRows).not.toHaveBeenCalled()
  })

  it('returns BOM CSV filtered by device type', async () => {
    const res = await GET(makeReq(), params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(new RegExp(`filename="${prefix}-acme-[0-9]{4}-[0-9]{2}-[0-9]{2}[.]csv"`))
    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = await res.text()
    for (const h of keep) expect(text).toContain(h)
    for (const h of drop) expect(text).not.toContain(h)
  })

  it('filters by status query', async () => {
    const text = await (await GET(makeReq('status=online'), params)).text()
    expect(text).toContain(onlyOnline)
    expect(text).not.toContain(keep.find((h) => h !== onlyOnline)!)
  })
})
