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
vi.mock('@/lib/tenant-scope', () => ({ getTenantDeviceWhere: (slug: string) => ({ client: { slug } }) }))
vi.mock('@/lib/prisma', () => ({ default: { device: { findMany: mocks.findMany } } }))

import { GET } from '@/app/api/tenant/[clientSlug]/network/ips/csv/route'

const tenant = { id: 'client-1', slug: 'acme' }
const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
const req = {} as never

describe('GET /api/tenant/[clientSlug]/network/ips/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([
      {
        hostname: '=evil',
        status: 'online',
        logs: [],
        networks: [
          { ip: '10.0.0.5', mac: 'AA:BB', gateway: '10.0.0.1', dns: '1.1.1.1; 8.8.8.8', dhcp: false, isPrimary: true },
        ],
      },
    ])
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 when not authorized', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('exports CSV with BOM, formula protection and attachment headers', async () => {
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="rede-ips-acme-\d{4}-\d{2}-\d{2}\.csv"$/,
    )

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])

    const text = new TextDecoder().decode(bytes).replace(/^﻿/, '')
    const [header, row] = text.split('\r\n')
    expect(header).toBe('Maquina;IP;MAC;Gateway;DNS;Modo;Primaria;Status')
    expect(row).toBe(`'=evil;10.0.0.5;AA:BB;10.0.0.1;"1.1.1.1; 8.8.8.8";Estatico;Sim;online`)
  })
})
