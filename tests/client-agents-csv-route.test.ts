import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getClientAgents: vi.fn(),
  findUnique: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/app/admin/clients/queries', () => ({ getClientAgents: mocks.getClientAgents }))
vi.mock('@/lib/prisma', () => ({ default: { client: { findUnique: mocks.findUnique } } }))

import { GET } from '@/app/api/admin/clients/[id]/agents/csv/route'

const req = {} as never
const ctx = (id = 'c1') => ({ params: Promise.resolve({ id }) })

function sessionFor(role: string, organizationId: string | null = 'org-1') {
  return { user: { id: 'u1', role, organizationId } }
}

const client = { id: 'c1', name: 'Acme; Ltda', slug: 'acme', organizationId: 'org-1', isActive: true }

describe('GET /api/admin/clients/[id]/agents/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue(client)
    mocks.getClientAgents.mockResolvedValue([
      {
        id: 'agent-1',
        name: '=HYPERLINK("x")',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        revokedAt: null,
        hasDevice: true,
        hostname: '@PC-01',
        agentVersion: '1.2.3',
        lastCollectionAt: '2026-10-29T12:00:00.000Z',
      },
      {
        id: 'agent-2',
        name: 'Notebook',
        isActive: false,
        createdAt: '2026-02-01T00:00:00.000Z',
        revokedAt: '2026-03-01T00:00:00.000Z',
        hasDevice: false,
        hostname: null,
        agentVersion: null,
        lastCollectionAt: null,
      },
    ])
  })

  it('retorna 401 sem sessao', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await GET(req, ctx())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Não autenticado' })
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.getClientAgents).not.toHaveBeenCalled()
  })

  it('retorna 404 para ORG_ADMIN de outra organizacao', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN', 'org-2'))
    const res = await GET(req, ctx())
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Cliente não encontrado' })
    expect(mocks.getClientAgents).not.toHaveBeenCalled()
  })

  it('retorna o mesmo 404 para cliente inexistente', async () => {
    mocks.auth.mockResolvedValue(sessionFor('PLATFORM_ADMIN', null))
    mocks.findUnique.mockResolvedValue(null)
    const res = await GET(req, ctx('nao-existe'))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Cliente não encontrado' })
    expect(mocks.getClientAgents).not.toHaveBeenCalled()
  })

  it.each(['ORG_OPERATOR', 'CLIENT_VIEWER'])('retorna 404 para %s da mesma organizacao', async (role) => {
    mocks.auth.mockResolvedValue(sessionFor(role))
    const res = await GET(req, ctx())
    expect(res.status).toBe(404)
    expect(mocks.getClientAgents).not.toHaveBeenCalled()
  })

  it('retorna CSV com BOM, cabecalhos e protecao contra formula', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN'))
    const res = await GET(req, ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="agentes-acme-\d{4}-\d{2}-\d{2}\.csv"$/
    )

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    const lines = body.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe(
      'Cliente;IDAgente;NomeAgente;StatusCredencial;UltimoCheckin;HostnameVinculado;VersaoAgente;UltimaColetaDispositivo;CriadoEm'
    )
    expect(lines[1]).toBe(
      `"Acme; Ltda";agent-1;"'=HYPERLINK(""x"")";Ativo;2026-10-29T12:00:00.000Z;'@PC-01;1.2.3;2026-10-29T12:00:00.000Z;2026-01-01T00:00:00.000Z`
    )
    expect(lines[2]).toBe('"Acme; Ltda";agent-2;Notebook;Revogado;;;;;2026-02-01T00:00:00.000Z')

    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' } }))
    expect(mocks.getClientAgents).toHaveBeenCalledWith('c1')
  })

  it('permite PLATFORM_ADMIN e reflete cliente desativado no estado da credencial', async () => {
    mocks.auth.mockResolvedValue(sessionFor('PLATFORM_ADMIN', null))
    mocks.findUnique.mockResolvedValue({ ...client, organizationId: 'org-9', isActive: false })
    const res = await GET(req, ctx())
    expect(res.status).toBe(200)
    const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(await res.arrayBuffer()))
    expect(body).toContain(';Bloqueado pelo cliente;')
  })
})
