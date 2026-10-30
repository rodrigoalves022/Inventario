import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getClients: vi.fn(),
  groupBy: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/app/admin/clients/queries', () => ({ getClients: mocks.getClients }))
vi.mock('@/lib/prisma', () => ({ default: { device: { groupBy: mocks.groupBy } } }))

import { GET } from '@/app/api/admin/clients/csv/route'

const req = {} as never

function sessionFor(role: string, organizationId: string | null = 'org-1') {
  return { user: { id: 'u1', role, organizationId } }
}

describe('GET /api/admin/clients/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.groupBy.mockResolvedValue([{ clientId: 'c1', _count: { _all: 3 } }])
    mocks.getClients.mockResolvedValue([
      { id: 'c1', name: '=EVIL', slug: 'evil', isActive: true, createdAt: '2026-01-01T00:00:00.000Z', activeAgentCount: 2 },
      { id: 'c2', name: 'Acme; Ltda', slug: 'acme', isActive: false, createdAt: '2026-02-01T00:00:00.000Z', activeAgentCount: 0 },
    ])
  })

  it('retorna 401 sem sessao', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(mocks.getClients).not.toHaveBeenCalled()
  })

  it.each(['ORG_OPERATOR', 'CLIENT_VIEWER'])('retorna 403 para %s', async (role) => {
    mocks.auth.mockResolvedValue(sessionFor(role))
    const res = await GET(req)
    expect(res.status).toBe(403)
    expect(mocks.getClients).not.toHaveBeenCalled()
  })

  it('retorna 403 para ORG_ADMIN sem organizacao', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN', null))
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('retorna CSV com BOM, protecao contra formula e escopo da organizacao', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN'))
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="clientes-\d{4}-\d{2}-\d{2}\.csv"$/)

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    const lines = body.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('Nome;Slug;Status;Dispositivos;Agentes Ativos;Criado Em')
    expect(lines[1]).toBe("'=EVIL;evil;Ativo;3;2;2026-01-01T00:00:00.000Z")
    expect(lines[2]).toBe('"Acme; Ltda";acme;Inativo;0;0;2026-02-01T00:00:00.000Z')

    expect(mocks.getClients).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }))
    expect(mocks.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: { in: ['c1', 'c2'] } } })
    )
  })

  it('permite PLATFORM_ADMIN', async () => {
    mocks.auth.mockResolvedValue(sessionFor('PLATFORM_ADMIN', null))
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
