import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hashSecret } from '@/lib/auth'

// Sprint A3, item 11 (N5 / RF031). POST /api/agent/register passa a gravar
// AuditLog `agent_auth.register` na mesma $transaction da criacao do
// AgentAuth, com ator nulo (nao ha usuario: quem chama e o instalador) e
// metadata { name, via }. Nenhum segredo no metadata. Erros nao auditam.
// Contrato da resposta 201 inalterado.

type FakeClient = { id: string; slug: string; name: string; enrollmentKeyHash: string; isActive: boolean }

const state = vi.hoisted(() => {
  const clientsBySlug = new Map<string, FakeClient>()
  const agentAuths: Array<{ id: string; name: string; apiKeyHash: string; clientId: string }> = []
  const auditLogs: Array<Record<string, unknown>> = []
  const tx = { depth: 0, writesOutside: [] as string[] }
  let counter = 0

  const fakePrisma = {
    client: {
      findFirst: vi.fn(async ({ where }: { where: { OR: Array<{ slug?: string; name?: string }> } }) => {
        const [{ slug }, { name }] = where.OR
        const bySlug = slug ? clientsBySlug.get(slug) : undefined
        if (bySlug) return { ...bySlug }
        const byName = [...clientsBySlug.values()].find((c) => c.name === name)
        return byName ? { ...byName } : null
      }),
      findUnique: vi.fn(async ({ where }: { where: { slug?: string } }) => {
        const client = where.slug ? clientsBySlug.get(where.slug) : undefined
        return client ? { ...client } : null
      }),
    },
    agentAuth: {
      create: vi.fn(async ({ data }: { data: { name: string; apiKeyHash: string; clientId: string } }) => {
        if (tx.depth === 0) tx.writesOutside.push('agentAuth.create')
        const id = `agent-${++counter}`
        agentAuths.push({ id, ...data })
        return { id, name: data.name, apiKeyHash: data.apiKeyHash, clientId: data.clientId }
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (tx.depth === 0) tx.writesOutside.push('auditLog.create')
        auditLogs.push(data)
        return data
      }),
    },
    organization: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'org-legacy', ...data })),
    },
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => {
      const agentCount = agentAuths.length
      const auditCount = auditLogs.length
      tx.depth += 1
      try {
        return await fn(fakePrisma)
      } catch (error) {
        agentAuths.length = agentCount
        auditLogs.length = auditCount
        throw error
      } finally {
        tx.depth -= 1
      }
    }),
  }

  return { clientsBySlug, agentAuths, auditLogs, tx, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: state.fakePrisma }))

const ADMIN_SECRET = 'segredo-admin-de-teste-123'
let ipCounter = 0

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: overrides.slug, enrollmentKeyHash: 'hash-nao-usado', isActive: true, ...overrides }
  state.clientsBySlug.set(client.slug, client)
  return client
}

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  // IP proprio por requisicao: o rate limit do registro e por IP.
  ipCounter += 1
  return new NextRequest('https://inventario.example.com/api/agent/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${ipCounter}`, ...headers },
    body: JSON.stringify(body),
  })
}

function auditMetadata(log: Record<string, unknown> | undefined) {
  return JSON.parse((log?.metadataJson as string) ?? 'null') as Record<string, unknown> | null
}

beforeEach(() => {
  state.clientsBySlug.clear()
  state.agentAuths.length = 0
  state.auditLogs.length = 0
  state.tx.depth = 0
  state.tx.writesOutside.length = 0
  process.env.ADMIN_SECRET = ADMIN_SECRET
  vi.clearAllMocks()
})

describe('POST /api/agent/register — auditoria agent_auth.register (RF031)', () => {
  it('registro por enrollmentKey grava um agent_auth.register com ator nulo e via enrollment_key', async () => {
    const plaintextKey = 'chave-de-provisionamento-valida-123456'
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: await hashSecret(plaintextKey) })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'PC-NOVO', client: 'cliente-a', enrollmentKey: plaintextKey }))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(state.auditLogs).toHaveLength(1)
    const log = state.auditLogs[0]
    expect(log).toMatchObject({
      action: 'agent_auth.register',
      targetType: 'agent_auth',
      targetId: json.id,
      clientId: 'client-a',
      actorUserId: null,
      actorEmail: null,
      actorRole: null,
    })
    expect(auditMetadata(log)).toEqual({ name: 'PC-NOVO', via: 'enrollment_key' })
  })

  it('registro por X-Admin-Secret grava via admin_secret', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a' })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'PC-ADMIN', client: 'cliente-a' }, { 'x-admin-secret': ADMIN_SECRET }))

    expect(response.status).toBe(201)
    expect(state.auditLogs).toHaveLength(1)
    expect(auditMetadata(state.auditLogs[0])).toEqual({ name: 'PC-ADMIN', via: 'admin_secret' })
  })

  it('o metadata nunca contem apiKey, enrollmentKey ou hash', async () => {
    const plaintextKey = 'chave-de-provisionamento-valida-123456'
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: await hashSecret(plaintextKey) })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'PC-NOVO', client: 'cliente-a', enrollmentKey: plaintextKey }))
    const json = await response.json()

    const serialized = JSON.stringify(state.auditLogs[0])
    expect(serialized).not.toContain(json.apiKey)
    expect(serialized).not.toContain(plaintextKey)
    expect(serialized).not.toContain(state.agentAuths[0]!.apiKeyHash)
    expect(serialized).not.toMatch(/apiKey|enrollmentKey|hash/i)
  })

  it('AgentAuth e AuditLog sao gravados dentro da mesma $transaction', async () => {
    const plaintextKey = 'chave-de-provisionamento-valida-123456'
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: await hashSecret(plaintextKey) })

    const { POST } = await import('@/app/api/agent/register/route')
    await POST(buildRequest({ name: 'PC-NOVO', client: 'cliente-a', enrollmentKey: plaintextKey }))

    expect(state.fakePrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(state.tx.writesOutside).toEqual([])
  })

  it('corpo da resposta 201 inalterado (id, name, client, apiKey, message)', async () => {
    const plaintextKey = 'chave-de-provisionamento-valida-123456'
    seedClient({ id: 'client-a', slug: 'cliente-a', name: 'Cliente A', enrollmentKeyHash: await hashSecret(plaintextKey) })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'PC-NOVO', client: 'cliente-a', enrollmentKey: plaintextKey }))
    const json = await response.json()

    expect(Object.keys(json).sort()).toEqual(['apiKey', 'client', 'id', 'message', 'name'])
    expect(json.client).toEqual({ id: 'client-a', name: 'Cliente A', slug: 'cliente-a' })
    expect(json.name).toBe('PC-NOVO')
    expect(json.message).toBe('Agente registrado. Guarde a apiKey - ela não será exibida novamente.')
  })
})

describe('POST /api/agent/register — erros nao gravam AuditLog', () => {
  it('400 (payload invalido)', async () => {
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'ab' }))
    expect(response.status).toBe(400)
    expect(state.auditLogs).toHaveLength(0)
  })

  it('401 (chave invalida)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: await hashSecret('chave-correta-armazenada') })
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'PC-NOVO', client: 'cliente-a', enrollmentKey: 'chave-totalmente-errada-000000' })
    )
    expect(response.status).toBe(401)
    expect(state.auditLogs).toHaveLength(0)
  })

  it('403 (cliente desativado)', async () => {
    const key = 'chave-valida-para-cliente-inativo'
    seedClient({ id: 'client-b', slug: 'cliente-b', enrollmentKeyHash: await hashSecret(key), isActive: false })
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'PC-NOVO', client: 'cliente-b', enrollmentKey: key }))
    expect(response.status).toBe(403)
    expect(state.auditLogs).toHaveLength(0)
  })

  it('404 (cliente inexistente)', async () => {
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'PC-NOVO', client: 'cliente-que-nao-existe', enrollmentKey: 'qualquer-coisa-16-chars' })
    )
    expect(response.status).toBe(404)
    expect(state.auditLogs).toHaveLength(0)
  })
})
