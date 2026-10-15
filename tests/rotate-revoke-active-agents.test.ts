import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rotateEnrollmentKeyAction } from '@/app/admin/clients/actions'

// Sprint A3, item 10 (N4 / RN019). A rotacao da chave ganha um campo
// opcional, validado por Zod, para revogar tambem os AgentAuth ativos do
// cliente. Desmarcado (ausente do FormData): comportamento atual, sem tocar
// AgentAuth, AgentCommand nem AlertEvent. Marcado: na MESMA $transaction da
// troca de chave, revoga os ativos com os efeitos do item 8 e grava um
// agent_auth.revoke por credencial com via 'rotation' (decisao 4), mais
// revokedCount no credentials.rotate.

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

type FakeClient = {
  id: string
  name: string
  slug: string
  organizationId: string
  enrollmentKeyHash: string
  activeProvisioningKeyEnc: string | null
}
type FakeAgentAuth = { id: string; name: string; isActive: boolean; revokedAt: Date | null; clientId: string | null }
type FakeDevice = { id: string; agentAuthId: string; clientId: string }
type FakeCommand = { id: string; agentAuthId: string; clientId: string; status: string }
type FakeEvent = { id: string; clientId: string; deviceId: string; resolvedAt: Date | null }

const state = vi.hoisted(() => {
  const db = {
    clients: new Map<string, FakeClient>(),
    agentAuths: new Map<string, FakeAgentAuth>(),
    devices: new Map<string, FakeDevice>(),
    commands: [] as FakeCommand[],
    events: [] as FakeEvent[],
    auditLogs: [] as Array<Record<string, unknown>>,
  }
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const tx = { depth: 0, writesOutside: [] as string[] }

  function noteWrite(name: string) {
    if (tx.depth === 0) tx.writesOutside.push(name)
  }

  function matchValue(actual: unknown, expected: unknown): boolean {
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && 'in' in (expected as object)) {
      return (expected as { in: unknown[] }).in.includes(actual)
    }
    return actual === expected
  }

  function matches(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'device') {
        const device = db.devices.get(record.deviceId as string)
        return !!device && matches(device as unknown as Record<string, unknown>, expected as Record<string, unknown>)
      }
      return matchValue(record[key], expected)
    })
  }

  function updateMany<T extends Record<string, unknown>>(name: string, rows: T[], where: Record<string, unknown>, data: Partial<T>) {
    noteWrite(name)
    let count = 0
    for (const row of rows) {
      if (matches(row, where)) {
        Object.assign(row, data)
        count += 1
      }
    }
    return { count }
  }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = db.clients.get(where.id)
        return client ? { ...client } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeClient> }) => {
        noteWrite('client.update')
        const client = db.clients.get(where.id)
        if (client) Object.assign(client, data)
        return client
      }),
    },
    agentAuth: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...db.agentAuths.values()].filter((row) => matches(row, where)).map((row) => ({ ...row }))
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeAgentAuth> }) =>
        updateMany('agentAuth.updateMany', [...db.agentAuths.values()], where, data)
      ),
    },
    agentCommand: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeCommand> }) =>
        updateMany('agentCommand.updateMany', db.commands, where, data)
      ),
    },
    alertEvent: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeEvent> }) =>
        updateMany('alertEvent.updateMany', db.events, where, data)
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        noteWrite('auditLog.create')
        db.auditLogs.push(data)
        return data
      }),
    },
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, encrypted: string, _setAt: Date, clientId: string) => {
      noteWrite('$executeRaw')
      const client = db.clients.get(clientId)
      if (client) client.activeProvisioningKeyEnc = encrypted
      return 1
    }),
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => {
      const snapshot = structuredClone({
        clients: [...db.clients.entries()],
        agentAuths: [...db.agentAuths.entries()],
        commands: db.commands,
        events: db.events,
        auditLogs: db.auditLogs,
      })
      tx.depth += 1
      try {
        return await fn(fakePrisma)
      } catch (error) {
        db.clients = new Map(snapshot.clients)
        db.agentAuths = new Map(snapshot.agentAuths)
        db.commands = snapshot.commands
        db.events = snapshot.events
        db.auditLogs = snapshot.auditLogs
        throw error
      } finally {
        tx.depth -= 1
      }
    }),
  }

  return { db, sessionRef, tx, fakePrisma }
})

const { sendAlertWebhook, dispatchClientWebhookEndpoints } = vi.hoisted(() => ({
  sendAlertWebhook: vi.fn(),
  dispatchClientWebhookEndpoints: vi.fn(async () => undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (state.sessionRef.user ? { user: state.sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: state.fakePrisma }))
vi.mock('@/lib/alert-webhook', () => ({ sendAlertWebhook }))
vi.mock('@/lib/webhook-endpoints', () => ({ dispatchClientWebhookEndpoints }))

const initialState = { error: null, message: null, package: null }
const ORG_ADMIN_A = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
const ORIGINAL_REVOKED_AT = new Date('2026-09-01T10:00:00.000Z')

function formData(clientId: string, extra: Record<string, string> = {}) {
  const data = new FormData()
  data.set('serverUrl', 'https://inventario.example.com')
  data.set('clientId', clientId)
  for (const [key, value] of Object.entries(extra)) data.set(key, value)
  return data
}

function seed() {
  const { db } = state
  db.clients.set('client-a', {
    id: 'client-a',
    name: 'Cliente A',
    slug: 'cliente-a',
    organizationId: 'org-a',
    enrollmentKeyHash: 'hash-original',
    activeProvisioningKeyEnc: null,
  })
  db.clients.set('client-b', {
    id: 'client-b',
    name: 'Cliente B',
    slug: 'cliente-b',
    organizationId: 'org-a',
    enrollmentKeyHash: 'hash-b',
    activeProvisioningKeyEnc: null,
  })
  db.agentAuths.set('a-1', { id: 'a-1', name: 'PC-1', isActive: true, revokedAt: null, clientId: 'client-a' })
  db.agentAuths.set('a-2', { id: 'a-2', name: 'PC-2', isActive: true, revokedAt: null, clientId: 'client-a' })
  db.agentAuths.set('a-velho', {
    id: 'a-velho',
    name: 'PC-VELHO',
    isActive: false,
    revokedAt: ORIGINAL_REVOKED_AT,
    clientId: 'client-a',
  })
  db.agentAuths.set('b-1', { id: 'b-1', name: 'PC-B', isActive: true, revokedAt: null, clientId: 'client-b' })
  db.devices.set('d-1', { id: 'd-1', agentAuthId: 'a-1', clientId: 'client-a' })
  db.devices.set('d-2', { id: 'd-2', agentAuthId: 'a-2', clientId: 'client-a' })
  db.devices.set('d-b', { id: 'd-b', agentAuthId: 'b-1', clientId: 'client-b' })
  db.commands.push(
    { id: 'c-1', agentAuthId: 'a-1', clientId: 'client-a', status: 'pending' },
    { id: 'c-2', agentAuthId: 'a-2', clientId: 'client-a', status: 'running' },
    { id: 'c-done', agentAuthId: 'a-2', clientId: 'client-a', status: 'done' },
    { id: 'c-b', agentAuthId: 'b-1', clientId: 'client-b', status: 'pending' }
  )
  db.events.push(
    { id: 'e-1', clientId: 'client-a', deviceId: 'd-1', resolvedAt: null },
    { id: 'e-2', clientId: 'client-a', deviceId: 'd-2', resolvedAt: null },
    { id: 'e-b', clientId: 'client-b', deviceId: 'd-b', resolvedAt: null }
  )
}

beforeEach(() => {
  const { db, sessionRef, tx } = state
  db.clients.clear()
  db.agentAuths.clear()
  db.devices.clear()
  db.commands = []
  db.events = []
  db.auditLogs = []
  sessionRef.user = ORG_ADMIN_A
  tx.depth = 0
  tx.writesOutside.length = 0
  vi.clearAllMocks()
  seed()
})

describe('rotateEnrollmentKeyAction — checkbox DESMARCADO (comportamento atual)', () => {
  it('troca a chave e nao toca AgentAuth, AgentCommand nem AlertEvent', async () => {
    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a'))

    expect(result.error).toBeNull()
    expect(state.db.clients.get('client-a')?.enrollmentKeyHash).not.toBe('hash-original')
    expect(state.fakePrisma.agentAuth.findMany).not.toHaveBeenCalled()
    expect(state.fakePrisma.agentAuth.updateMany).not.toHaveBeenCalled()
    expect(state.fakePrisma.agentCommand.updateMany).not.toHaveBeenCalled()
    expect(state.fakePrisma.alertEvent.updateMany).not.toHaveBeenCalled()
    expect(state.db.agentAuths.get('a-1')?.isActive).toBe(true)
  })

  it('grava so o credentials.rotate de hoje, com o mesmo metadata', async () => {
    await rotateEnrollmentKeyAction(initialState, formData('client-a'))

    expect(state.db.auditLogs).toHaveLength(1)
    expect(state.db.auditLogs[0]).toMatchObject({
      action: 'credentials.rotate',
      targetType: 'client',
      targetId: 'client-a',
      clientId: 'client-a',
      metadataJson: JSON.stringify({ clientSlug: 'cliente-a' }),
    })
  })
})

describe('rotateEnrollmentKeyAction — checkbox MARCADO (RN019)', () => {
  it('revoga todos os ativos do cliente, expira comandos e resolve eventos, sem tocar o ja revogado nem outro cliente', async () => {
    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeNull()
    expect(state.db.clients.get('client-a')?.enrollmentKeyHash).not.toBe('hash-original')

    for (const id of ['a-1', 'a-2']) {
      expect(state.db.agentAuths.get(id)?.isActive).toBe(false)
      expect(state.db.agentAuths.get(id)?.revokedAt).toBeInstanceOf(Date)
    }
    expect(state.db.agentAuths.get('a-velho')?.revokedAt?.toISOString()).toBe(ORIGINAL_REVOKED_AT.toISOString())

    expect(state.db.commands.find((c) => c.id === 'c-1')?.status).toBe('expired')
    expect(state.db.commands.find((c) => c.id === 'c-2')?.status).toBe('expired')
    expect(state.db.commands.find((c) => c.id === 'c-done')?.status).toBe('done')
    expect(state.db.events.find((e) => e.id === 'e-1')?.resolvedAt).toBeInstanceOf(Date)
    expect(state.db.events.find((e) => e.id === 'e-2')?.resolvedAt).toBeInstanceOf(Date)

    // Outro cliente: intocado.
    expect(state.db.agentAuths.get('b-1')?.isActive).toBe(true)
    expect(state.db.commands.find((c) => c.id === 'c-b')?.status).toBe('pending')
    expect(state.db.events.find((e) => e.id === 'e-b')?.resolvedAt).toBeNull()
    expect(state.db.clients.get('client-b')?.enrollmentKeyHash).toBe('hash-b')
  })

  it('auditoria (decisao 4): um agent_auth.revoke por credencial com via "rotation" e revokedCount no credentials.rotate', async () => {
    await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    const revokes = state.db.auditLogs.filter((log) => log.action === 'agent_auth.revoke')
    expect(revokes.map((log) => log.targetId).sort()).toEqual(['a-1', 'a-2'])
    for (const log of revokes) {
      expect(log).toMatchObject({ targetType: 'agent_auth', clientId: 'client-a', actorUserId: 'user-a' })
      expect(JSON.parse(log.metadataJson as string)).toMatchObject({ via: 'rotation', clientSlug: 'cliente-a' })
    }

    const rotate = state.db.auditLogs.filter((log) => log.action === 'credentials.rotate')
    expect(rotate).toHaveLength(1)
    expect(JSON.parse(rotate[0]?.metadataJson as string)).toEqual({ clientSlug: 'cliente-a', revokedCount: 2 })
  })

  it('todas as escritas acontecem dentro de UMA $transaction', async () => {
    await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(state.fakePrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(state.tx.writesOutside).toEqual([])
  })

  it('falha nas revogacoes nao deixa a chave trocada', async () => {
    state.fakePrisma.agentCommand.updateMany.mockImplementationOnce(async () => {
      throw new Error('falha simulada')
    })

    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeTruthy()
    expect(result.package).toBeNull()
    expect(state.db.clients.get('client-a')?.enrollmentKeyHash).toBe('hash-original')
    expect(state.db.clients.get('client-a')?.activeProvisioningKeyEnc).toBeNull()
    expect(state.db.agentAuths.get('a-1')?.isActive).toBe(true)
    expect(state.db.auditLogs).toHaveLength(0)
  })

  it('falha na troca da chave nao deixa agentes revogados', async () => {
    state.fakePrisma.$executeRaw.mockImplementationOnce(async () => {
      throw new Error('falha simulada')
    })

    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeTruthy()
    expect(state.db.clients.get('client-a')?.enrollmentKeyHash).toBe('hash-original')
    expect(state.db.agentAuths.get('a-1')?.isActive).toBe(true)
    expect(state.db.agentAuths.get('a-2')?.isActive).toBe(true)
    expect(state.db.commands.find((c) => c.id === 'c-1')?.status).toBe('pending')
    expect(state.db.auditLogs).toHaveLength(0)
  })

  it('resolver eventos na rotacao nao dispara webhook', async () => {
    await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(sendAlertWebhook).not.toHaveBeenCalled()
    expect(dispatchClientWebhookEndpoints).not.toHaveBeenCalled()
  })

  // Achado 1 do security-auditor: uma revogacao individual concorrente que faz
  // commit entre a leitura dos ativos e a gravacao nao pode gerar um
  // agent_auth.revoke "via rotation" para uma credencial que esta transacao
  // nao revogou, nem inflar o revokedCount.
  it('corrida: credencial revogada por outra operacao no meio nao ganha log nem conta no revokedCount', async () => {
    state.fakePrisma.agentAuth.findMany.mockImplementationOnce(async ({ where }: { where: Record<string, unknown> }) => {
      const snapshot = [...state.db.agentAuths.values()]
        .filter((row) => row.clientId === (where as { clientId?: string }).clientId && row.isActive)
        .map((row) => ({ ...row }))
      // Revogacao individual concorrente de a-2 depois da leitura.
      Object.assign(state.db.agentAuths.get('a-2')!, { isActive: false, revokedAt: ORIGINAL_REVOKED_AT })
      return snapshot
    })

    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeNull()
    const revokes = state.db.auditLogs.filter((log) => log.action === 'agent_auth.revoke')
    expect(revokes.map((log) => log.targetId)).toEqual(['a-1'])
    expect(state.db.agentAuths.get('a-2')?.revokedAt).toBe(ORIGINAL_REVOKED_AT)
    const rotate = state.db.auditLogs.find((log) => log.action === 'credentials.rotate')
    expect(JSON.parse(rotate?.metadataJson as string)).toEqual({ clientSlug: 'cliente-a', revokedCount: 1 })
  })

  it('cliente sem agente ativo: rotaciona e grava revokedCount 0', async () => {
    Object.assign(state.db.agentAuths.get('a-1')!, { isActive: false, revokedAt: ORIGINAL_REVOKED_AT })
    Object.assign(state.db.agentAuths.get('a-2')!, { isActive: false, revokedAt: ORIGINAL_REVOKED_AT })

    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeNull()
    expect(state.db.auditLogs.filter((log) => log.action === 'agent_auth.revoke')).toHaveLength(0)
    const rotate = state.db.auditLogs.find((log) => log.action === 'credentials.rotate')
    expect(JSON.parse(rotate?.metadataJson as string)).toEqual({ clientSlug: 'cliente-a', revokedCount: 0 })
  })
})

describe('rotateEnrollmentKeyAction — validacao Zod do campo novo', () => {
  it('valor invalido em revokeActiveAgents e recusado em pt-BR, sem efeito colateral', async () => {
    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'sim' }))

    expect(result.error).toBeTruthy()
    expect(result.error).not.toMatch(/Invalid|Expected|received/)
    expect(state.db.clients.get('client-a')?.enrollmentKeyHash).toBe('hash-original')
    expect(state.db.agentAuths.get('a-1')?.isActive).toBe(true)
    expect(state.fakePrisma.$transaction).not.toHaveBeenCalled()
  })

  it('ORG_ADMIN de outra organizacao nao revoga nada, mesmo com o campo marcado', async () => {
    state.sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const result = await rotateEnrollmentKeyAction(initialState, formData('client-a', { revokeActiveAgents: 'true' }))

    expect(result.error).toBeTruthy()
    expect(state.db.agentAuths.get('a-1')?.isActive).toBe(true)
    expect(state.db.auditLogs).toHaveLength(0)
  })
})
