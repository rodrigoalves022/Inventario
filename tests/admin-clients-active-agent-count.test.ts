import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint A1, F1 (contagem do dialogo de rotacao). A coluna "Agentes" de
// /admin/clients conta `_count.agents` SEM filtro, incluindo AgentAuth
// revogados (isActive: false). O dialogo de confirmacao precisa do numero de
// maquinas que CONTINUAM funcionando depois da rotacao: AgentAuth com
// isActive: true, o mesmo criterio de app/api/clients/[id]/status/route.ts.

type FakeAgentAuth = { id: string; clientId: string | null; isActive: boolean }
type FakeClient = { id: string; name: string; slug: string; organizationId: string }

const { clients, agentAuths, fakePrisma } = vi.hoisted(() => {
  const clients: FakeClient[] = []
  const agentAuths: FakeAgentAuth[] = []

  function matchesClientFilter(clientId: string | null, filter: unknown) {
    if (filter && typeof filter === 'object' && 'in' in filter) {
      return (filter as { in: string[] }).in.includes(clientId ?? '')
    }
    return filter === undefined || filter === clientId
  }

  const fakePrisma = {
    client: {
      findMany: vi.fn(async ({ where }: { where?: { organizationId?: string } }) =>
        clients
          .filter((c) => !where?.organizationId || c.organizationId === where.organizationId)
          .map((c) => ({
            ...c,
            isActive: true,
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
            _count: { agents: agentAuths.filter((a) => a.clientId === c.id).length },
          }))
      ),
    },
    agentAuth: {
      groupBy: vi.fn(
        async ({ where }: { where: { clientId?: unknown; isActive?: boolean } }) => {
          const counts = new Map<string, number>()
          for (const auth of agentAuths) {
            if (!matchesClientFilter(auth.clientId, where.clientId)) continue
            if (where.isActive !== undefined && auth.isActive !== where.isActive) continue
            if (!auth.clientId) continue
            counts.set(auth.clientId, (counts.get(auth.clientId) ?? 0) + 1)
          }
          return [...counts.entries()].map(([clientId, count]) => ({ clientId, _count: { _all: count } }))
        }
      ),
    },
  }

  return { clients, agentAuths, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

beforeEach(() => {
  clients.length = 0
  agentAuths.length = 0
  vi.clearAllMocks()
})

describe('getClients — contagem de AgentAuth ativos para o dialogo de rotacao', () => {
  it('cliente com 2 credenciais ativas e 1 revogada: activeAgentCount = 2 (agentCount da coluna segue 3)', async () => {
    const { getClients } = await import('@/app/admin/clients/queries')
    clients.push({ id: 'c1', name: 'Teste A0 Rotação', slug: 'teste-a0-rotacao', organizationId: 'org-a' })
    agentAuths.push(
      { id: 'a1', clientId: 'c1', isActive: true },
      { id: 'a2', clientId: 'c1', isActive: true },
      { id: 'a3', clientId: 'c1', isActive: false }
    )

    const rows = await getClients({ id: 'u', role: 'ORG_ADMIN', organizationId: 'org-a' } as never)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.activeAgentCount).toBe(2)
    expect(rows[0]?.agentCount).toBe(3)
  })

  it('cliente sem credencial ativa: activeAgentCount = 0', async () => {
    const { getClients } = await import('@/app/admin/clients/queries')
    clients.push({ id: 'c2', name: 'Vazio', slug: 'vazio', organizationId: 'org-a' })
    agentAuths.push({ id: 'a4', clientId: 'c2', isActive: false })

    const rows = await getClients({ id: 'u', role: 'ORG_ADMIN', organizationId: 'org-a' } as never)

    expect(rows[0]?.activeAgentCount).toBe(0)
  })

  it('a contagem fica escopada aos clientes ja filtrados por organizacao (RNF004)', async () => {
    const { getClients } = await import('@/app/admin/clients/queries')
    clients.push(
      { id: 'c-a', name: 'Da Org A', slug: 'da-org-a', organizationId: 'org-a' },
      { id: 'c-b', name: 'Da Org B', slug: 'da-org-b', organizationId: 'org-b' }
    )
    agentAuths.push({ id: 'a5', clientId: 'c-b', isActive: true })

    const rows = await getClients({ id: 'u', role: 'ORG_ADMIN', organizationId: 'org-a' } as never)

    expect(rows.map((row) => row.id)).toEqual(['c-a'])
    const groupByArgs = fakePrisma.agentAuth.groupBy.mock.calls[0]?.[0] as {
      where: { clientId: { in: string[] }; isActive: boolean }
    }
    expect(groupByArgs.where.isActive).toBe(true)
    expect(groupByArgs.where.clientId.in).toEqual(['c-a'])
  })
})
