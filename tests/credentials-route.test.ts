import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/clients/[id]/credentials/route'

type FakeClientRow = {
  id: string
  name: string
  slug: string
  organizationId: string
  activeProvisioningKeyEnc: string | null
  activeProvisioningSetAt: Date | null
}

const { clients, sessionRef } = vi.hoisted(() => {
  const clients = new Map<string, FakeClientRow>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  return { clients, sessionRef }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))

vi.mock('@/lib/audit-log', () => ({
  getSessionAuditActor: vi.fn((user: Record<string, unknown>) => ({
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: user?.role ?? null,
    clientId: user?.clientId ?? null,
  })),
  recordAuditLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, id: string) => {
      const client = clients.get(id)
      return client ? [client] : []
    }),
  },
}))

function buildContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clients.clear()
  sessionRef.user = null
})

describe('GET /api/clients/[id]/credentials — sem oraculo de existencia entre organizacoes', () => {
  it('id inexistente e id de outra organizacao respondem com o MESMO status e corpo', async () => {
    clients.set('client-b', {
      id: 'client-b',
      name: 'Cliente B',
      slug: 'cliente-b',
      organizationId: 'org-b',
      activeProvisioningKeyEnc: null,
      activeProvisioningSetAt: null,
    })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const req = new NextRequest('https://inventario.example.com/api/clients/does-not-exist/credentials')
    const resNotFound = await GET(req, buildContext('does-not-exist') as any)

    const reqOtherOrg = new NextRequest('https://inventario.example.com/api/clients/client-b/credentials')
    const resOtherOrg = await GET(reqOtherOrg, buildContext('client-b') as any)

    expect(resNotFound.status).toBe(404)
    expect(resOtherOrg.status).toBe(404)
    expect(resNotFound.status).toBe(resOtherOrg.status)

    const bodyNotFound = await resNotFound.json()
    const bodyOtherOrg = await resOtherOrg.json()
    expect(bodyNotFound).toEqual(bodyOtherOrg)
  })

  it('ORG_ADMIN da PROPRIA organizacao consegue passar da checagem de existencia/escopo', async () => {
    clients.set('client-a', {
      id: 'client-a',
      name: 'Cliente A',
      slug: 'cliente-a',
      organizationId: 'org-a',
      activeProvisioningKeyEnc: null,
      activeProvisioningSetAt: null,
    })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const req = new NextRequest('https://inventario.example.com/api/clients/client-a/credentials')
    const res = await GET(req, buildContext('client-a') as any)

    // Nao e 404 — passou da checagem de escopo (mesmo sem credencial ativa,
    // cai no branch "unavailable", nao no oraculo de existencia).
    expect(res.status).not.toBe(404)
  })
})
