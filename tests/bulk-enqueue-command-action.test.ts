import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bulkEnqueueDeviceCommandAction } from '@/app/app/[clientSlug]/computers/actions'
import { AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'

// Sprint 12, item 2 — Execucao de Comandos Remotos em Lote (Bulk Commands).
// Guard sob teste (canOperateTenant, lib/permissions.ts) e' a implementacao
// REAL, nunca mockada — mesmo padrao de tests/agent-commands-flow.test.ts
// (enqueueDeviceCommandAction, disparo de UM device por vez). Este arquivo
// cobre o disparo em LOTE: escopo estrito por tenant (ids de fora sao
// silenciosamente ignorados, decisao documentada na Sprint 12), criacao
// atomica de N AgentCommand + 1 AuditLog agregado.

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = { id: string; hostname: string; clientSlug: string; agentAuthId: string; clientId: string }
type FakeCommand = {
  id: string
  agentAuthId: string
  clientId: string
  type: string
  paramsJson: string | null
  status: string
  requestedByUserId: string | null
  expiresAt: Date
}

const { clients, devices, commands, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const commands = new Map<string, FakeCommand>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  let counter = 0

  const fakePrisma: Record<string, unknown> = {
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
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { id: { in: string[] }; agentAuth?: unknown }
        }) => {
          const requiredSlug = (where.agentAuth as { is?: { client?: { is?: { slug?: string } } } } | undefined)?.is
            ?.client?.is?.slug
          return [...devices.values()]
            .filter((device) => where.id.in.includes(device.id) && device.clientSlug === requiredSlug)
            .map((device) => ({
              id: device.id,
              hostname: device.hostname,
              agentAuthId: device.agentAuthId,
              agentAuth: { clientId: device.clientId },
            }))
        }
      ),
    },
    agentCommand: {
      create: vi.fn(async ({ data }: { data: Partial<FakeCommand> & { agentAuthId: string; clientId: string; type: string } }) => {
        const command: FakeCommand = {
          id: `cmd-${++counter}`,
          status: 'pending',
          paramsJson: null,
          requestedByUserId: null,
          expiresAt: new Date(Date.now() + AGENT_COMMAND_TTL_MS),
          ...data,
        } as FakeCommand
        commands.set(command.id, command)
        return command
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { clients, devices, commands, auditLogs, sessionRef, fakePrisma }
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

function buildFormData(overrides: {
  tenantSlug?: string
  deviceIds?: string[]
  type?: string
  serviceName?: string
  scriptId?: string
}) {
  const formData = new FormData()
  formData.set('tenantSlug', overrides.tenantSlug ?? 'cliente-a')
  for (const id of overrides.deviceIds ?? ['device-1', 'device-2']) {
    formData.append('deviceIds', id)
  }
  formData.set('type', overrides.type ?? 'collect_now')
  if (overrides.serviceName) formData.set('serviceName', overrides.serviceName)
  if (overrides.scriptId) formData.set('scriptId', overrides.scriptId)
  return formData
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  commands.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('bulkEnqueueDeviceCommandAction — guardada por canOperateTenant (real)', () => {
  it('ORG_OPERATOR enfileira comando para todos os deviceIds validos: N AgentCommand pending + 1 AuditLog agregado', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    seedDevice({ id: 'device-2', clientSlug: 'cliente-a', agentAuthId: 'agent-2', clientId: 'client-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const before = Date.now()
    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1', 'device-2'] })
    )
    const after = Date.now()

    expect(result.status).toBe('success')
    expect(commands.size).toBe(2)
    const created = [...commands.values()]
    expect(created.map((c) => c.agentAuthId).sort()).toEqual(['agent-1', 'agent-2'])
    for (const command of created) {
      expect(command).toMatchObject({ clientId: 'client-a', type: 'collect_now', status: 'pending' })
      expect(command.expiresAt.getTime()).toBeGreaterThanOrEqual(before + AGENT_COMMAND_TTL_MS)
      expect(command.expiresAt.getTime()).toBeLessThanOrEqual(after + AGENT_COMMAND_TTL_MS)
    }

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'command.bulk_enqueue', targetType: 'device', clientId: 'client-a' })
    // recordAuditLog (lib/audit-log.ts) serializa `metadata` em `metadataJson`
    // (string) antes de persistir — mesmo padrao de AuditLog.metadataJson em
    // todo o projeto, nao uma coluna JSON nativa.
    const metadata = JSON.parse(auditLogs[0].metadataJson as string) as Record<string, unknown>
    expect(metadata.appliedCount).toBe(2)
    expect(metadata.ignoredCount).toBe(0)
    expect((metadata.deviceIds as string[]).sort()).toEqual(['device-1', 'device-2'])
    expect((metadata.hostnames as string[]).sort()).toEqual(['HOST-device-1', 'HOST-device-2'])
  })

  it('deviceId de OUTRO tenant no meio da selecao e ignorado silenciosamente, resto do lote prossegue', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    seedDevice({ id: 'device-intruso', clientSlug: 'cliente-b', agentAuthId: 'agent-x', clientId: 'client-b' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1', 'device-intruso'] })
    )

    expect(result.status).toBe('success')
    expect(commands.size).toBe(1)
    expect([...commands.values()][0].agentAuthId).toBe('agent-1')

    const metadata = JSON.parse(auditLogs[0].metadataJson as string) as Record<string, unknown>
    expect(metadata.appliedCount).toBe(1)
    expect(metadata.ignoredCount).toBe(1)
    expect(metadata.deviceIds).toEqual(['device-1'])
  })

  it('todos os deviceIds fora do tenant: erro, nenhum AgentCommand nem AuditLog criado', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    seedDevice({ id: 'device-intruso', clientSlug: 'cliente-b', agentAuthId: 'agent-x', clientId: 'client-b' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-intruso'] })
    )

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
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

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1'] })
    )

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('ator de OUTRA organizacao e bloqueado, sem escrita', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = { id: 'user-b', email: 'operador@org-b.local', role: 'ORG_OPERATOR', organizationId: 'org-b' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1'] })
    )

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
  })

  it('ORG_ADMIN (canManageTenant, superset de canOperateTenant) tambem consegue disparar em lote', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = { id: 'user-admin', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1'] })
    )

    expect(result.status).toBe('success')
    expect(commands.size).toBe(1)
  })

  it('comando invalido (fora do catalogo fechado de lib/agent-commands.ts) e rejeitado, sem escrita', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1'], type: 'rm_rf_slash' })
    )

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
  })

  it('nenhum deviceId enviado: erro de validacao Zod, sem chamar device.findMany', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: [] })
    )

    expect(result.status).toBe('error')
    expect(commands.size).toBe(0)
  })

  it('restart_service em lote grava serviceName em paramsJson pra cada AgentCommand', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', agentAuthId: 'agent-1', clientId: 'client-a' })
    seedDevice({ id: 'device-2', clientSlug: 'cliente-a', agentAuthId: 'agent-2', clientId: 'client-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await bulkEnqueueDeviceCommandAction(
      { status: 'idle', message: null },
      buildFormData({ deviceIds: ['device-1', 'device-2'], type: 'restart_service', serviceName: 'Spooler' })
    )

    expect(result.status).toBe('success')
    for (const command of commands.values()) {
      expect(JSON.parse(command.paramsJson!)).toEqual({ serviceName: 'Spooler' })
    }
  })
})
