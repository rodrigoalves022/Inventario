import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint A3, item 2 (RF029). Lista de AgentAuth de UM cliente ja autorizado
// pela pagina (canManageTenant). A consulta filtra por clientId; nenhum
// AgentAuth de outro cliente aparece. Ultima coleta = CollectionLog mais
// recente, com fallback em Device.updatedAt (mesmo padrao de
// lib/tenant-device-rows.ts); sem Device, nao ha ultima coleta. AgentCheckLog
// nao e lido (so grava em erro).

type FakeAgentAuth = {
  id: string
  clientId: string | null
  name: string
  isActive: boolean
  createdAt: Date
  revokedAt: Date | null
  device: null | {
    hostname: string
    agentVersion: string | null
    updatedAt: Date
    logs: Array<{ coletadoEm: Date }>
  }
}

const { agentAuths, fakePrisma } = vi.hoisted(() => {
  const agentAuths: FakeAgentAuth[] = []
  const fakePrisma = {
    agentAuth: {
      findMany: vi.fn(async ({ where }: { where: { clientId?: string } }) =>
        agentAuths
          .filter((auth) => where.clientId !== undefined && auth.clientId === where.clientId)
          .map((auth) => ({
            id: auth.id,
            name: auth.name,
            isActive: auth.isActive,
            createdAt: auth.createdAt,
            revokedAt: auth.revokedAt,
            device: auth.device
              ? {
                  hostname: auth.device.hostname,
                  agentVersion: auth.device.agentVersion,
                  updatedAt: auth.device.updatedAt,
                  // O fake devolve so o primeiro (a query pede take: 1, desc).
                  logs: [...auth.device.logs]
                    .sort((a, b) => b.coletadoEm.getTime() - a.coletadoEm.getTime())
                    .slice(0, 1),
                }
              : null,
          }))
      ),
    },
    agentCheckLog: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
  }
  return { agentAuths, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seed(overrides: Partial<FakeAgentAuth> & { id: string }) {
  agentAuths.push({
    clientId: 'client-a',
    name: `Agente ${overrides.id}`,
    isActive: true,
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    revokedAt: null,
    device: null,
    ...overrides,
  })
}

beforeEach(() => {
  agentAuths.length = 0
  vi.clearAllMocks()
})

describe('getClientAgents — escopo por clientId (RF029, RNF004)', () => {
  it('filtra por clientId do cliente autorizado e nao devolve AgentAuth de outro cliente', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    seed({ id: 'a-1', clientId: 'client-a' })
    seed({ id: 'b-1', clientId: 'client-b' })
    seed({ id: 'orfao', clientId: null })

    const rows = await getClientAgents('client-a')

    expect(rows.map((row) => row.id)).toEqual(['a-1'])
    const args = fakePrisma.agentAuth.findMany.mock.calls[0]?.[0] as unknown as { where: Record<string, unknown> }
    expect(args.where).toEqual({ clientId: 'client-a' })
  })

  it('pede ativos primeiro e depois createdAt desc, com select explicito', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    await getClientAgents('client-a')

    const args = fakePrisma.agentAuth.findMany.mock.calls[0]?.[0] as unknown as {
      orderBy: unknown
      select: Record<string, unknown>
      include?: unknown
    }
    expect(args.orderBy).toEqual([{ isActive: 'desc' }, { createdAt: 'desc' }])
    expect(args.select).toBeDefined()
    expect(args.include).toBeUndefined()
    // Nunca o hash da apiKey.
    expect(args.select).not.toHaveProperty('apiKeyHash')
  })

  it('inclui revogados, com revokedAt', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    seed({ id: 'rev', isActive: false, revokedAt: new Date('2026-10-10T08:00:00.000Z') })

    const [row] = await getClientAgents('client-a')

    expect(row).toMatchObject({ id: 'rev', isActive: false, revokedAt: '2026-10-10T08:00:00.000Z' })
  })
})

describe('getClientAgents — ultima coleta', () => {
  it('com CollectionLog, usa o coletadoEm mais recente', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    seed({
      id: 'com-log',
      device: {
        hostname: 'PC-01',
        agentVersion: '1.4.0',
        updatedAt: new Date('2026-10-14T00:00:00.000Z'),
        logs: [
          { coletadoEm: new Date('2026-10-12T10:00:00.000Z') },
          { coletadoEm: new Date('2026-10-13T10:00:00.000Z') },
        ],
      },
    })

    const [row] = await getClientAgents('client-a')

    expect(row).toMatchObject({
      hasDevice: true,
      hostname: 'PC-01',
      agentVersion: '1.4.0',
      lastCollectionAt: '2026-10-13T10:00:00.000Z',
    })
    const args = fakePrisma.agentAuth.findMany.mock.calls[0]?.[0] as unknown as {
      select: { device: { select: { logs: { orderBy: unknown; take: number } } } }
    }
    expect(args.select.device.select.logs.take).toBe(1)
    expect(args.select.device.select.logs.orderBy).toEqual({ coletadoEm: 'desc' })
  })

  it('sem CollectionLog e com Device, cai em Device.updatedAt', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    seed({
      id: 'sem-log',
      device: { hostname: 'PC-02', agentVersion: null, updatedAt: new Date('2026-10-14T00:00:00.000Z'), logs: [] },
    })

    const [row] = await getClientAgents('client-a')

    expect(row?.lastCollectionAt).toBe('2026-10-14T00:00:00.000Z')
  })

  it('sem Device, nao ha ultima coleta (null) e AgentCheckLog nao e lido', async () => {
    const { getClientAgents } = await import('@/app/admin/clients/queries')
    seed({ id: 'sem-device', device: null })

    const [row] = await getClientAgents('client-a')

    expect(row).toMatchObject({ hasDevice: false, hostname: null, agentVersion: null, lastCollectionAt: null })
    expect(fakePrisma.agentCheckLog.findMany).not.toHaveBeenCalled()
    expect(fakePrisma.agentCheckLog.findFirst).not.toHaveBeenCalled()
    const args = fakePrisma.agentAuth.findMany.mock.calls[0]?.[0] as unknown as { select: Record<string, unknown> }
    expect(args.select).not.toHaveProperty('checkLogs')
  })
})
