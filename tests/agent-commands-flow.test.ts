import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { enqueueDeviceCommandAction } from '@/app/app/[clientSlug]/assets/[id]/actions'
import { GET as getPendingCommand } from '@/app/api/agent/commands/pending/route'
import { POST as postCommandResult } from '@/app/api/agent/commands/[id]/result/route'
import { hashApiKey } from '@/lib/auth'
import { AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'

// Sprint 10, item 9. RF017 — fluxo real de comandos remotos (enfileirar,
// reivindicar, reportar resultado) nunca teve teste automatizado.
// tests/agent-command-allowlist-parity.test.ts (Sprint 8) so cobre a
// paridade ESTATICA da allowlist TS/Go, nao este fluxo. Guard sob teste
// (canOperateTenant, lib/permissions.ts) e' a implementacao REAL, nunca mockada
// — so Prisma e auth() sao dublados, mesmo padrao de
// tests/rotate-enrollment-key.test.ts e tests/revoke-agent-auth.test.ts.

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = { id: string; hostname: string; clientSlug: string; agentAuthId: string; clientId: string }
type FakeAgentAuth = { id: string; name: string; isActive: boolean; clientId: string | null; apiKeyHash: string }
type FakeCommand = {
  id: string
  agentAuthId: string
  clientId: string
  type: string
  paramsJson: string | null
  status: string
  resultJson: string | null
  requestedByUserId: string | null
  createdAt: Date
  expiresAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

const { clients, devices, agentAuths, commands, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const agentAuths = new Map<string, FakeAgentAuth>()
  const commands = new Map<string, FakeCommand>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  let counter = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const client = [...clients.values()].find((candidate) => candidate.slug === where.slug)
        if (!client) return null
        return {
          id: client.id,
          name: client.name,
          slug: client.slug,
          isActive: client.isActive,
          organizationId: client.organizationId,
          organization: { isActive: true },
        }
      }),
    },
    device: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: string; agentAuth?: { is?: { client?: { is?: { slug?: string } } } } }
        }) => {
          const device = devices.get(where.id)
          const requiredSlug = where.agentAuth?.is?.client?.is?.slug
          if (!device || device.clientSlug !== requiredSlug) return null
          return {
            id: device.id,
            hostname: device.hostname,
            agentAuthId: device.agentAuthId,
            agentAuth: { clientId: device.clientId },
          }
        }
      ),
    },
    agentAuth: {
      findUnique: vi.fn(async ({ where }: { where: { apiKeyHash: string } }) => {
        const agentAuth = [...agentAuths.values()].find((candidate) => candidate.apiKeyHash === where.apiKeyHash)
        if (!agentAuth) return null
        const client = agentAuth.clientId ? clients.get(agentAuth.clientId) ?? null : null
        return {
          id: agentAuth.id,
          name: agentAuth.name,
          isActive: agentAuth.isActive,
          clientId: agentAuth.clientId,
          client: client ? { id: client.id, name: client.name, slug: client.slug, isActive: client.isActive } : null,
        }
      }),
    },
    agentCommand: {
      create: vi.fn(async ({ data }: { data: Partial<FakeCommand> & { agentAuthId: string; clientId: string; type: string } }) => {
        const command: FakeCommand = {
          id: `cmd-${++counter}`,
          status: 'pending',
          paramsJson: null,
          resultJson: null,
          requestedByUserId: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          expiresAt: new Date(Date.now() + AGENT_COMMAND_TTL_MS),
          ...data,
        } as FakeCommand
        commands.set(command.id, command)
        return command
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        // POST commands/[id]/result: where = { id, agentAuthId }
        if ('id' in where) {
          const command = commands.get(where.id as string)
          if (!command || command.agentAuthId !== where.agentAuthId) return null
          return { ...command }
        }
        // GET commands/pending: where = { agentAuthId, status, expiresAt: { gt } }
        const expiresAtGt = (where.expiresAt as { gt?: Date } | undefined)?.gt
        const candidates = [...commands.values()].filter(
          (command) =>
            command.agentAuthId === where.agentAuthId &&
            command.status === where.status &&
            (!expiresAtGt || command.expiresAt > expiresAtGt)
        )
        candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        return candidates[0] ? { ...candidates[0] } : null
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeCommand> }) => {
        let count = 0
        if ('id' in where) {
          // Claim atomico: UPDATE ... WHERE id = ? AND status = 'pending'.
          const command = commands.get(where.id as string)
          if (command && command.status === where.status) {
            Object.assign(command, data)
            count = 1
          }
          return { count }
        }
        // Sweep de expiracao: WHERE agentAuthId = ? AND status = 'pending' AND expiresAt < now.
        const expiresAtLt = (where.expiresAt as { lt?: Date } | undefined)?.lt
        for (const command of commands.values()) {
          if (
            command.agentAuthId === where.agentAuthId &&
            command.status === where.status &&
            (!expiresAtLt || command.expiresAt < expiresAtLt)
          ) {
            Object.assign(command, data)
            count += 1
          }
        }
        return { count }
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeCommand> }) => {
        const command = commands.get(where.id)
        if (command) Object.assign(command, data)
        return command
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { clients, devices, agentAuths, commands, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string; agentAuthId: string; clientId: string }) {
  const device: FakeDevice = { hostname: `HOST-${overrides.id}`, ...overrides }
  devices.set(device.id, device)
  return device
}

async function seedAgentAuth(overrides: Partial<FakeAgentAuth> & { id: string; plaintextKey: string }) {
  const apiKeyHash = await hashApiKey(overrides.plaintextKey)
  const agentAuth: FakeAgentAuth = { name: `Agent ${overrides.id}`, isActive: true, clientId: null, ...overrides, apiKeyHash }
  agentAuths.set(agentAuth.id, agentAuth)
  return agentAuth
}

function buildEnqueueFormData(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData()
  formData.set('tenantSlug', overrides.tenantSlug ?? 'cliente-a')
  formData.set('assetId', overrides.assetId ?? 'device-1')
  formData.set('type', overrides.type ?? 'collect_now')
  if (overrides.serviceName) formData.set('serviceName', overrides.serviceName)
  if (overrides.scriptId) formData.set('scriptId', overrides.scriptId)
  return formData
}

function seedCommand(overrides: Partial<FakeCommand> & { id: string; agentAuthId: string; clientId: string }) {
  const command: FakeCommand = {
    type: 'collect_now',
    paramsJson: null,
    status: 'pending',
    resultJson: null,
    requestedByUserId: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + AGENT_COMMAND_TTL_MS),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
  commands.set(command.id, command)
  return command
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  agentAuths.clear()
  commands.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('enqueueDeviceCommandAction — guardada por canOperateTenant (real)', () => {
  it('ORG_OPERATOR consegue enfileirar: AgentCommand pending, expiresAt = +15min, AuditLog command.enqueue', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const before = Date.now()
    const result = await enqueueDeviceCommandAction({ status: 'idle', message: null }, buildEnqueueFormData())
    const after = Date.now()

    expect(result.status).toBe('success')
    const created = [...commands.values()]
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ agentAuthId: 'agent-1', clientId: 'client-a', type: 'collect_now', status: 'pending' })
    expect(created[0].expiresAt.getTime()).toBeGreaterThanOrEqual(before + AGENT_COMMAND_TTL_MS)
    expect(created[0].expiresAt.getTime()).toBeLessThanOrEqual(after + AGENT_COMMAND_TTL_MS)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'command.enqueue',
      targetType: 'device',
      targetId: 'device-1',
      clientId: 'client-a',
    })
  })

  it('CLIENT_VIEWER (fora de canOperateTenant) e bloqueado, nenhum AgentCommand criado', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = {
      id: 'user-viewer',
      email: 'portal@org-a.local',
      role: 'CLIENT_VIEWER',
      organizationId: 'org-a',
      clientId: 'client-a',
    }

    const result = await enqueueDeviceCommandAction({ status: 'idle', message: null }, buildEnqueueFormData())

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('ator de OUTRA organizacao e bloqueado, sem escrita', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = { id: 'user-b', email: 'operador@org-b.local', role: 'ORG_OPERATOR', organizationId: 'org-b' }

    const result = await enqueueDeviceCommandAction({ status: 'idle', message: null }, buildEnqueueFormData())

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
  })
})

describe('GET /api/agent/commands/pending — claim atomico', () => {
  it('duas requisicoes concorrentes pelo MESMO comando: so uma reivindica, a outra recebe null', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-race', plaintextKey: 'race-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-race', agentAuthId: agentAuth.id, clientId: 'client-a' })

    const req1 = new NextRequest('https://inventario.example.com/api/agent/commands/pending', {
      headers: { 'x-api-key': 'race-key' },
    })
    const req2 = new NextRequest('https://inventario.example.com/api/agent/commands/pending', {
      headers: { 'x-api-key': 'race-key' },
    })

    const [res1, res2] = await Promise.all([getPendingCommand(req1), getPendingCommand(req2)])
    const [body1, body2] = await Promise.all([res1.json(), res2.json()])

    const winners = [body1, body2].filter((body) => body.command !== null)
    const losers = [body1, body2].filter((body) => body.command === null)

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(winners[0].command.id).toBe('cmd-race')
    expect(commands.get('cmd-race')?.status).toBe('running')
  })

  it('comando pending com expiresAt vencido nunca e entregue, e e marcado expired automaticamente', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-expired', plaintextKey: 'expired-key', clientId: 'client-a' })
    seedCommand({
      id: 'cmd-expired',
      agentAuthId: agentAuth.id,
      clientId: 'client-a',
      expiresAt: new Date(Date.now() - 1000),
    })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/pending', {
      headers: { 'x-api-key': 'expired-key' },
    })
    const res = await getPendingCommand(req)
    const body = await res.json()

    expect(body.command).toBeNull()
    expect(commands.get('cmd-expired')?.status).toBe('expired')
  })

  it('comando pending dentro do prazo e entregue e passa para running', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-ok', plaintextKey: 'ok-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-ok', agentAuthId: agentAuth.id, clientId: 'client-a', type: 'restart_computer' })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/pending', {
      headers: { 'x-api-key': 'ok-key' },
    })
    const res = await getPendingCommand(req)
    const body = await res.json()

    expect(body.command).toMatchObject({ id: 'cmd-ok', type: 'restart_computer' })
    expect(commands.get('cmd-ok')?.status).toBe('running')
  })
})

describe('POST /api/agent/commands/[id]/result — grava resultado e AuditLog command.result', () => {
  it('resultado valido (status done) grava resultJson, completedAt e AuditLog command.result', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-result', plaintextKey: 'result-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-result', agentAuthId: agentAuth.id, clientId: 'client-a', status: 'running' })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/cmd-result/result', {
      method: 'POST',
      headers: { 'x-api-key': 'result-key', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done', output: 'ok' }),
    })
    const res = await postCommandResult(req, { params: Promise.resolve({ id: 'cmd-result' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const command = commands.get('cmd-result')
    expect(command?.status).toBe('done')
    expect(command?.completedAt).not.toBeNull()
    expect(JSON.parse(command!.resultJson!)).toMatchObject({ output: 'ok', errorMessage: null })

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'command.result',
      targetType: 'agent_command',
      targetId: 'cmd-result',
      clientId: 'client-a',
    })
  })

  it('resultado com status failed grava errorMessage e transiciona para failed', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-fail', plaintextKey: 'fail-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-fail', agentAuthId: agentAuth.id, clientId: 'client-a', status: 'running' })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/cmd-fail/result', {
      method: 'POST',
      headers: { 'x-api-key': 'fail-key', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'failed', errorMessage: 'servico nao encontrado' }),
    })
    const res = await postCommandResult(req, { params: Promise.resolve({ id: 'cmd-fail' }) })

    expect(res.status).toBe(200)
    const command = commands.get('cmd-fail')
    expect(command?.status).toBe('failed')
    expect(JSON.parse(command!.resultJson!)).toMatchObject({ errorMessage: 'servico nao encontrado' })
  })

  it('payload invalido (status fora do enum) e rejeitado com 400, sem alterar o comando nem gravar AuditLog', async () => {
    const agentAuth = await seedAgentAuth({ id: 'agent-bad', plaintextKey: 'bad-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-bad', agentAuthId: agentAuth.id, clientId: 'client-a', status: 'running' })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/cmd-bad/result', {
      method: 'POST',
      headers: { 'x-api-key': 'bad-key', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'success' }), // fora do enum ('done' | 'failed')
    })
    const res = await postCommandResult(req, { params: Promise.resolve({ id: 'cmd-bad' }) })

    expect(res.status).toBe(400)
    expect(commands.get('cmd-bad')?.status).toBe('running')
    expect(auditLogs).toHaveLength(0)
  })

  it('comando de outro agentAuthId (nao encontrado no escopo) retorna 404, sem escrita', async () => {
    const agentAuthOwner = await seedAgentAuth({ id: 'agent-owner', plaintextKey: 'owner-key', clientId: 'client-a' })
    await seedAgentAuth({ id: 'agent-intruder', plaintextKey: 'intruder-key', clientId: 'client-a' })
    seedCommand({ id: 'cmd-owner', agentAuthId: agentAuthOwner.id, clientId: 'client-a', status: 'running' })

    const req = new NextRequest('https://inventario.example.com/api/agent/commands/cmd-owner/result', {
      method: 'POST',
      headers: { 'x-api-key': 'intruder-key', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
    const res = await postCommandResult(req, { params: Promise.resolve({ id: 'cmd-owner' }) })

    expect(res.status).toBe(404)
    expect(commands.get('cmd-owner')?.status).toBe('running')
    expect(auditLogs).toHaveLength(0)
  })
})
