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
vi.mock('@/lib/prisma', () => ({ default: { alertEvent: { findMany: mocks.findMany } } }))

import { GET } from '@/app/api/tenant/[clientSlug]/alerts/csv/route'

const tenant = { id: 'client-1', slug: 'acme' }
const params = { params: Promise.resolve({ clientSlug: 'acme' }) }

function makeReq(query = '') {
  return { nextUrl: new URL(`http://localhost/api/tenant/acme/alerts/csv${query}`) } as never
}

describe('GET /api/tenant/[clientSlug]/alerts/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([
      {
        firedAt: new Date('2026-01-02T03:04:05.000Z'),
        resolvedAt: null,
        severity: 'critical',
        metric: 'software_blacklisted',
        message: '=HYPERLINK("x")',
        device: { hostname: '@evil' },
        rule: { name: 'Regra; A' },
      },
    ])
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(makeReq(), params)
    expect(res.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 when not authorized', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(makeReq(), params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('exports CSV with BOM, escaping and attachment headers', async () => {
    const res = await GET(makeReq(), params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="alertas-acme-\d{4}-\d{2}-\d{2}\.csv"$/)

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])

    const text = new TextDecoder().decode(bytes).replace(/^﻿/, '')
    const [header, row] = text.split('\r\n')
    expect(header).toBe('Disparo;Resolucao;Estado;Severidade;Maquina;Regra;Metrica;Mensagem')
    expect(row).toBe(
      `2026-01-02T03:04:05.000Z;;Aberto;Critico;'@evil;"Regra; A";software_blacklisted;"'=HYPERLINK(""x"")"`,
    )
  })

  it('forwards state and severity filters to the query', async () => {
    await GET(makeReq('?state=open&severity=critical'), params)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', resolvedAt: null, severity: 'critical' },
        take: 1000,
      }),
    )
  })

  it('ignores invalid filters', async () => {
    await GET(makeReq('?state=x&severity=bogus'), params)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clientId: 'client-1' } }))
  })
})
