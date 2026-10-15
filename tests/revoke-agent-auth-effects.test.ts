import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revokeAgentAuthAction } from '@/app/admin/clients/actions'

// Sprint A3, item 8 (RF030, RNF009). revokeAgentAuthAction ja existia
// (Sprint 6) e e estendida, na MESMA transacao:
//   (a) AgentCommand pending/running do agentAuthId -> expired. Sem isso eles
//       ficam abertos para sempre: o agente revogado recebe 403 antes de
//       consultar /commands/pending, que e quem expira comando vencido;
//   (b) AlertEvent abertos do Device dessa credencial -> resolvedAt, SEM
//       webhook (decisao 2 do usuario: "device.online" seria falso);
//   (c) idempotencia: credencial ja revogada nao muda revokedAt nem audita;
//   (d) revalidatePath tambem de /admin/clients/[id]/agents.
//
// O fake de transacao guarda um snapshot e restaura em caso de erro (rollback)
// e registra qualquer escrita feita FORA da transacao.

type FakeClient = { id: string; slug: string; organizationId: string }
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
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in (expected as Record<string, unknown>)) {
        return ((expected as { in: unknown[] }).in).includes(actual)
      }
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
    agentAuth: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const agentAuth = db.agentAuths.get(where.id)
        if (!agentAuth) return null
        const client = agentAuth.clientId ? db.clients.get(agentAuth.clientId) ?? null : null
        return {
          id: agentAuth.id,
          name: agentAuth.name,
          isActive: agentAuth.isActive,
          revokedAt: agentAuth.revokedAt,
          device: [...db.devices.values()].find((d) => d.agentAuthId === agentAuth.id)
            ? { id: [...db.devices.values()].find((d) => d.agentAuthId === agentAuth.id)!.id }
            : null,
          client: client ? { ...client } : null,
        }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeAgentAuth> }) => {
        noteWrite('agentAuth.update')
        const agentAuth = db.agentAuths.get(where.id)
        if (agentAuth) Object.assign(agentAuth, data)
        return agentAuth
      }),
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
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => {
      const snapshot = structuredClone({
        agentAuths: [...db.agentAuths.entries()],
        commands: db.commands,
        events: db.events,
        auditLogs: db.auditLogs,
      })
      tx.depth += 1
      try {
        return await fn(fakePrisma)
      } catch (error) {
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

const { revalidatePath, sendAlertWebhook, dispatchClientWebhookEndpoints } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  sendAlertWebhook: vi.fn(),
  dispatchClientWebhookEndpoints: vi.fn(async () => undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (state.sessionRef.user ? { user: state.sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: state.fakePrisma }))
vi.mock('@/lib/alert-webhook', () => ({ sendAlertWebhook }))
vi.mock('@/lib/webhook-endpoints', () => ({ dispatchClientWebhookEndpoints }))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
const ORG_ADMIN_A = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

function formData(agentAuthId: string) {
  const data = new FormData()
  data.set('agentAuthId', agentAuthId)
  return data
}

function seedBase() {
  const { db } = state
  db.clients.set('client-a', { id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
  db.agentAuths.set('agent-a', { id: 'agent-a', name: 'PC-A', isActive: true, revokedAt: null, clientId: 'client-a' })
  db.agentAuths.set('agent-b', { id: 'agent-b', name: 'PC-B', isActive: true, revokedAt: null, clientId: 'client-a' })
  db.devices.set('device-a', { id: 'device-a', agentAuthId: 'agent-a', clientId: 'client-a' })
  db.devices.set('device-b', { id: 'device-b', agentAuthId: 'agent-b', clientId: 'client-a' })
  db.commands.push(
    { id: 'cmd-pending', agentAuthId: 'agent-a', clientId: 'client-a', status: 'pending' },
    { id: 'cmd-running', agentAuthId: 'agent-a', clientId: 'client-a', status: 'running' },
    { id: 'cmd-done', agentAuthId: 'agent-a', clientId: 'client-a', status: 'done' },
    { id: 'cmd-failed', agentAuthId: 'agent-a', clientId: 'client-a', status: 'failed' },
    { id: 'cmd-outro-agente', agentAuthId: 'agent-b', clientId: 'client-a', status: 'pending' }
  )
  db.events.push(
    { id: 'evt-aberto-offline', clientId: 'client-a', deviceId: 'device-a', resolvedAt: null },
    { id: 'evt-aberto-regra', clientId: 'client-a', deviceId: 'device-a', resolvedAt: null },
    { id: 'evt-ja-resolvido', clientId: 'client-a', deviceId: 'device-a', resolvedAt: new Date('2026-10-01T00:00:00.000Z') },
    { id: 'evt-outro-device', clientId: 'client-a', deviceId: 'device-b', resolvedAt: null }
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
  vi.stubGlobal('fetch', fetchMock)
})

function command(id: string) {
  return state.db.commands.find((c) => c.id === id)
}

function event(id: string) {
  return state.db.events.find((e) => e.id === id)
}

describe('revokeAgentAuthAction — efeitos na mesma transacao (item 8)', () => {
  it('revoga, expira pending/running do agente, resolve os eventos abertos do device e grava um agent_auth.revoke', async () => {
    seedBase()

    const result = await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(result.error).toBeNull()
    const revoked = state.db.agentAuths.get('agent-a')
    expect(revoked?.isActive).toBe(false)
    expect(revoked?.revokedAt).toBeInstanceOf(Date)

    expect(command('cmd-pending')?.status).toBe('expired')
    expect(command('cmd-running')?.status).toBe('expired')
    expect(command('cmd-done')?.status).toBe('done')
    expect(command('cmd-failed')?.status).toBe('failed')
    expect(command('cmd-outro-agente')?.status).toBe('pending')

    expect(event('evt-aberto-offline')?.resolvedAt).toBeInstanceOf(Date)
    expect(event('evt-aberto-regra')?.resolvedAt).toBeInstanceOf(Date)
    expect(event('evt-ja-resolvido')?.resolvedAt?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(event('evt-outro-device')?.resolvedAt).toBeNull()

    // O outro agente do cliente nao e tocado.
    expect(state.db.agentAuths.get('agent-b')?.isActive).toBe(true)

    expect(state.db.auditLogs).toHaveLength(1)
    expect(state.db.auditLogs[0]).toMatchObject({
      action: 'agent_auth.revoke',
      targetType: 'agent_auth',
      targetId: 'agent-a',
      clientId: 'client-a',
    })
  })

  it('todas as escritas acontecem dentro da $transaction', async () => {
    seedBase()

    await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(state.fakePrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(state.tx.writesOutside).toEqual([])
  })

  it('falha no meio da transacao nao deixa a credencial revogada sem os efeitos (rollback)', async () => {
    seedBase()
    state.fakePrisma.alertEvent.updateMany.mockImplementationOnce(async () => {
      throw new Error('falha simulada')
    })

    const result = await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(result.error).toBeTruthy()
    expect(state.db.agentAuths.get('agent-a')?.isActive).toBe(true)
    expect(command('cmd-pending')?.status).toBe('pending')
    expect(state.db.auditLogs).toHaveLength(0)
  })

  it('resolver eventos na revogacao NAO dispara webhook', async () => {
    seedBase()

    await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendAlertWebhook).not.toHaveBeenCalled()
    expect(dispatchClientWebhookEndpoints).not.toHaveBeenCalled()
  })

  it('revalida /admin/clients e /admin/clients/[id]/agents', async () => {
    seedBase()

    await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/clients/client-a/agents')
  })

  it('agente sem Device: revoga e expira comandos sem erro', async () => {
    seedBase()
    state.db.devices.delete('device-a')

    const result = await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(result.error).toBeNull()
    expect(state.db.agentAuths.get('agent-a')?.isActive).toBe(false)
    expect(command('cmd-pending')?.status).toBe('expired')
    expect(state.db.auditLogs).toHaveLength(1)
  })
})

describe('revokeAgentAuthAction — idempotencia (item 8c)', () => {
  it('credencial ja revogada nao altera revokedAt nem grava AuditLog', async () => {
    seedBase()
    const original = new Date('2026-09-01T10:00:00.000Z')
    Object.assign(state.db.agentAuths.get('agent-a')!, { isActive: false, revokedAt: original })

    const result = await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(result.error).toBeNull()
    expect(state.db.agentAuths.get('agent-a')?.revokedAt).toBe(original)
    expect(state.db.agentAuths.get('agent-a')?.revokedAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
    expect(state.db.auditLogs).toHaveLength(0)
  })

  it('revogar duas vezes seguidas grava um unico agent_auth.revoke e mantem o primeiro revokedAt', async () => {
    seedBase()

    await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))
    const firstRevokedAt = state.db.agentAuths.get('agent-a')?.revokedAt
    await revokeAgentAuthAction({ error: null, message: null }, formData('agent-a'))

    expect(state.db.agentAuths.get('agent-a')?.revokedAt).toBe(firstRevokedAt)
    expect(state.db.auditLogs.filter((log) => log.action === 'agent_auth.revoke')).toHaveLength(1)
  })
})
