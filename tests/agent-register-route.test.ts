import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hashSecret } from '@/lib/auth'

// Sprint 10, item 5 (RF003: rota POST /api/agent/register — enrollment).
// Teste de integracao da rota REAL (app/api/agent/register/route.ts).
// hashSecret/generateApiKey/hasValidAdminSecret (lib/auth.ts) sao as
// primitivas de auth SOB TESTE indiretamente aqui — usadas de verdade, nunca
// mockadas. Só Prisma e' mockado (findClientByIdentifier/ensureLegacyClient
// sao wrappers finos de Prisma em lib/clients.ts, entao mockamos o Prisma
// por baixo deles, nao as funcoes em si).

type FakeClient = {
  id: string
  slug: string
  name: string
  enrollmentKeyHash: string
  isActive: boolean
}

const { clientsBySlug, clientsById, agentAuths, fakePrisma } = vi.hoisted(() => {
  const clientsBySlug = new Map<string, FakeClient>()
  const clientsById = new Map<string, FakeClient>()
  const agentAuths: Array<{ id: string; name: string; apiKeyHash: string; clientId: string }> = []
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
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
        const client = where.slug ? clientsBySlug.get(where.slug) : where.id ? clientsById.get(where.id) : undefined
        return client ? { ...client } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeClient> }) => {
        const client = clientsById.get(where.id)
        if (client) Object.assign(client, data)
        return client
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `client-${++counter}`
        const client: FakeClient = {
          id,
          slug: data.slug as string,
          name: data.name as string,
          enrollmentKeyHash: data.enrollmentKeyHash as string,
          isActive: true,
        }
        clientsBySlug.set(client.slug, client)
        clientsById.set(id, client)
        return client
      }),
    },
    agentAuth: {
      create: vi.fn(async ({ data }: { data: { name: string; apiKeyHash: string; clientId: string } }) => {
        const id = `agent-${++counter}`
        agentAuths.push({ id, ...data })
        return { id, name: data.name, apiKeyHash: data.apiKeyHash, clientId: data.clientId }
      }),
    },
    organization: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'org-legacy', ...data })),
    },
    // Sprint A3, item 11: o registro grava AgentAuth e AuditLog
    // (agent_auth.register) na mesma $transaction. A auditoria em si e
    // coberta por tests/agent-register-audit.test.ts.
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { clientsBySlug, clientsById, agentAuths, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = {
    name: overrides.slug,
    enrollmentKeyHash: 'hash-nao-usado',
    isActive: true,
    ...overrides,
  }
  clientsBySlug.set(client.slug, client)
  clientsById.set(client.id, client)
  return client
}

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://inventario.example.com/api/agent/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  clientsBySlug.clear()
  clientsById.clear()
  agentAuths.length = 0
  vi.clearAllMocks()
})

describe('POST /api/agent/register — item 5 (RF003): enrollment', () => {
  it('chave de provisionamento VALIDA cria AgentAuth e devolve apiKey em texto puro', async () => {
    const plaintextKey = 'chave-de-provisionamento-valida-123456'
    const hash = await hashSecret(plaintextKey)
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: hash })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'Agente Novo', client: 'cliente-a', enrollmentKey: plaintextKey })
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.apiKey).toBeTruthy()
    expect(json.client).toMatchObject({ id: 'client-a', slug: 'cliente-a' })
    expect(agentAuths).toHaveLength(1)
    expect(agentAuths[0].clientId).toBe('client-a')
    // A apiKey nunca e' gravada em texto puro — so o hash.
    expect(agentAuths[0].apiKeyHash).not.toBe(json.apiKey)
  })

  it('chave de provisionamento INVALIDA rejeita com 401, sem criar AgentAuth', async () => {
    const hash = await hashSecret('chave-correta-armazenada-no-banco')
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: hash })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'Agente Novo', client: 'cliente-a', enrollmentKey: 'chave-totalmente-errada-000000' })
    )

    expect(response.status).toBe(401)
    expect(agentAuths).toHaveLength(0)
  })

  it('cliente inexistente retorna 404, sem criar AgentAuth', async () => {
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'Agente Novo', client: 'cliente-que-nao-existe', enrollmentKey: 'qualquer-coisa-16-chars' })
    )

    expect(response.status).toBe(404)
    expect(agentAuths).toHaveLength(0)
  })

  it('cliente desativado (isActive=false) rejeita com 403, sem criar AgentAuth', async () => {
    const hash = await hashSecret('chave-valida-para-cliente-inativo')
    seedClient({ id: 'client-b', slug: 'cliente-b', enrollmentKeyHash: hash, isActive: false })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(
      buildRequest({ name: 'Agente Novo', client: 'cliente-b', enrollmentKey: 'chave-valida-para-cliente-inativo' })
    )

    expect(response.status).toBe(403)
    expect(agentAuths).toHaveLength(0)
  })

  it('enrollmentKey ausente (sem admin secret) rejeita com 401, sem criar AgentAuth', async () => {
    const hash = await hashSecret('chave-existente-mas-nao-enviada')
    seedClient({ id: 'client-a', slug: 'cliente-a', enrollmentKeyHash: hash })

    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'Agente Novo', client: 'cliente-a' }))

    expect(response.status).toBe(401)
    expect(agentAuths).toHaveLength(0)
  })

  it('payload invalido (name curto demais) rejeita com 400 pelo Zod, sem tocar o banco', async () => {
    const { POST } = await import('@/app/api/agent/register/route')
    const response = await POST(buildRequest({ name: 'ab' }))

    expect(response.status).toBe(400)
    expect(fakePrisma.client.findFirst).not.toHaveBeenCalled()
    expect(agentAuths).toHaveLength(0)
  })
})
