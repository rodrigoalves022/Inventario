import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { revokeAgentAuthAction } from '@/app/admin/clients/actions'
import { hashApiKey, validateAgentApiKey } from '@/lib/auth'

type FakeClient = {
  id: string
  slug: string
  organizationId: string
  isActive?: boolean
}

type FakeAgentAuth = {
  id: string
  name: string
  isActive: boolean
  revokedAt: Date | null
  clientId: string | null
  apiKeyHash?: string
}

// vi.mock(...) e hoisted para o topo do arquivo pelo Vitest, antes de
// qualquer import estatico. Estado mutavel usado dentro das factories de
// mock precisa vir de vi.hoisted() por isso — senao a factory fecharia
// sobre uma const ainda nao inicializada (TDZ) no momento em que o import
// real (ex.: '@/app/admin/clients/actions') e resolvido. Mesmo padrao de
// tests/rotate-enrollment-key.test.ts.
const { clients, agentAuths, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const agentAuths = new Map<string, FakeAgentAuth>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    agentAuth: {
      // Suporta os dois formatos de `where` usados pelo codigo real: `{ id }`
      // (revokeAgentAuthAction) e `{ apiKeyHash }` (validateAgentApiKey, em
      // lib/auth.ts) — necessario para o teste de regressao que encadeia as
      // duas funcoes reais contra o mesmo estado em memoria.
      findUnique: vi.fn(async ({ where }: { where: { id?: string; apiKeyHash?: string } }) => {
        const agentAuth = where.id
          ? agentAuths.get(where.id)
          : [...agentAuths.values()].find((candidate) => candidate.apiKeyHash === where.apiKeyHash)
        if (!agentAuth) return null
        const client = agentAuth.clientId ? clients.get(agentAuth.clientId) ?? null : null
        return {
          id: agentAuth.id,
          name: agentAuth.name,
          isActive: agentAuth.isActive,
          clientId: agentAuth.clientId,
          client: client
            ? { id: client.id, slug: client.slug, organizationId: client.organizationId, name: client.slug, isActive: client.isActive ?? true }
            : null,
        }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeAgentAuth> }) => {
        const agentAuth = agentAuths.get(where.id)
        if (agentAuth) Object.assign(agentAuth, data)
        return agentAuth
      }),
      // Sprint A3, item 8: a revogacao passou a usar updateMany condicionado a
      // isActive: true (idempotencia sem corrida) e a expirar comandos e
      // resolver eventos na mesma transacao. Os efeitos sao cobertos por
      // tests/revoke-agent-auth-effects.test.ts; aqui so o necessario para os
      // testes de isolamento e de regressao continuarem rodando.
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; isActive?: boolean }; data: Partial<FakeAgentAuth> }) => {
        const agentAuth = agentAuths.get(where.id)
        if (!agentAuth || (where.isActive !== undefined && agentAuth.isActive !== where.isActive)) return { count: 0 }
        Object.assign(agentAuth, data)
        return { count: 1 }
      }),
    },
    agentCommand: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    alertEvent: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { clients, agentAuths, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string }) {
  const client: FakeClient = {
    slug: 'cliente',
    organizationId: 'org-a',
    ...overrides,
  }
  clients.set(client.id, client)
  return client
}

function seedAgentAuth(overrides: Partial<FakeAgentAuth> & { id: string }) {
  const agentAuth: FakeAgentAuth = {
    name: 'Agente',
    isActive: true,
    revokedAt: null,
    clientId: null,
    ...overrides,
  }
  agentAuths.set(agentAuth.id, agentAuth)
  return agentAuth
}

function buildFormData(agentAuthId: string) {
  const formData = new FormData()
  formData.set('agentAuthId', agentAuthId)
  return formData
}

beforeEach(() => {
  clients.clear()
  agentAuths.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('revokeAgentAuthAction — isolamento multi-tenant (canManageTenant)', () => {
  it('ORG_ADMIN de uma organizacao NAO consegue revogar AgentAuth de outra organizacao', async () => {
    seedClient({ id: 'client-b', organizationId: 'org-b' })
    const agentAuth = seedAgentAuth({ id: 'agent-b', clientId: 'client-b' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-b'))

    expect(result.error).toBeTruthy()
    expect(result.message).toBeNull()
    // Nenhuma escrita no AgentAuth: nem isActive nem revokedAt mudam.
    expect(agentAuths.get('agent-b')?.isActive).toBe(true)
    expect(agentAuths.get('agent-b')?.revokedAt).toBeNull()
    expect(agentAuth.isActive).toBe(true)
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_ADMIN da PROPRIA organizacao consegue revogar e gera AuditLog', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    seedAgentAuth({ id: 'agent-a', clientId: 'client-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-a'))

    expect(result.error).toBeNull()
    expect(agentAuths.get('agent-a')?.isActive).toBe(false)
    expect(agentAuths.get('agent-a')?.revokedAt).toBeInstanceOf(Date)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'agent_auth.revoke',
      targetType: 'agent_auth',
      targetId: 'agent-a',
      clientId: 'client-a',
    })
  })

  it('PLATFORM_ADMIN consegue revogar AgentAuth de qualquer organizacao', async () => {
    seedClient({ id: 'client-b', organizationId: 'org-b' })
    seedAgentAuth({ id: 'agent-b', clientId: 'client-b' })
    sessionRef.user = { id: 'user-platform', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }

    const result = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-b'))

    expect(result.error).toBeNull()
    expect(agentAuths.get('agent-b')?.isActive).toBe(false)
    expect(agentAuths.get('agent-b')?.revokedAt).toBeInstanceOf(Date)
    expect(auditLogs).toHaveLength(1)
  })

  it('CLIENT_VIEWER nunca consegue revogar (fora do escopo de canManageTenant)', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    seedAgentAuth({ id: 'agent-a', clientId: 'client-a' })
    sessionRef.user = { id: 'user-viewer', email: 'portal@org-a.local', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' }

    const result = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-a'))

    expect(result.error).toBeTruthy()
    expect(agentAuths.get('agent-a')?.isActive).toBe(true)
    expect(auditLogs).toHaveLength(0)
  })

  it('AgentAuth inexistente retorna a MESMA mensagem de erro de "sem permissao" (sem oraculo de existencia)', async () => {
    seedClient({ id: 'client-a', organizationId: 'org-a' })
    seedAgentAuth({ id: 'agent-a', clientId: 'client-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const notFoundResult = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-inexistente'))

    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }
    const forbiddenResult = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-a'))

    expect(notFoundResult.error).toBe(forbiddenResult.error)
    expect(auditLogs).toHaveLength(0)
  })
})

describe('revokeAgentAuthAction — regressao de check-in via validateAgentApiKey', () => {
  it('um AgentAuth revogado por revokeAgentAuthAction passa a ser rejeitado (403) num check-in simulado', async () => {
    const plaintextApiKey = 'agent-plaintext-key-para-teste'
    const apiKeyHash = await hashApiKey(plaintextApiKey)

    seedClient({ id: 'client-a', organizationId: 'org-a', isActive: true })
    seedAgentAuth({ id: 'agent-a', clientId: 'client-a', isActive: true, revokedAt: null, apiKeyHash })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const checkinBefore = await validateAgentApiKey(
      new NextRequest('https://inventario.example.com/api/agent/checkin', {
        headers: { 'x-api-key': plaintextApiKey },
      })
    )
    expect(checkinBefore.ok).toBe(true)

    const revokeResult = await revokeAgentAuthAction({ error: null, message: null }, buildFormData('agent-a'))
    expect(revokeResult.error).toBeNull()

    const checkinAfter = await validateAgentApiKey(
      new NextRequest('https://inventario.example.com/api/agent/checkin', {
        headers: { 'x-api-key': plaintextApiKey },
      })
    )

    // Mesmo comportamento de rejeicao (403, "API Key revogada...") que os dois
    // precedentes reais revogados por SQL manual (DEV-CLAUDE-AGENT,
    // WSL-LINUX-TEST) ja recebiam — a origem do isActive=false muda (agora
    // passa por esta acao com auditoria), o comportamento de autenticacao nao.
    expect(checkinAfter.ok).toBe(false)
    if (!checkinAfter.ok) {
      expect(checkinAfter.status).toBe(403)
      expect(checkinAfter.message).toMatch(/revogada/i)
    }
  })
})
