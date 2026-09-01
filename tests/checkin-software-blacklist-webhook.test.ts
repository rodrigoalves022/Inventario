import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 12, item 1 — Deteccao de Softwares Proibidos. Cobre a ponta a ponta
// que tests/alert-rules.test.ts (unitario, reconcileAlertEvents isolado) NAO
// cobre: a rota POST /api/agent/checkin de verdade repassando body.software
// pra reconcileAlertEvents, E disparando dispatchClientWebhookEndpoints
// ('device.warning') SO na abertura do AlertEvent — nunca em check-ins
// repetidos com a condicao persistente. Harness reduzido de
// tests/agent-checkin-route.test.ts, focado neste caminho.

type FakeDeviceRow = { id: string; agentAuthId: string; hostname: string; status: string }
type FakeAlertRule = { id: string; clientId: string; metric: string; severity: string; enabled: boolean; pattern: string | null }
type FakeAlertEvent = {
  id: string
  clientId: string
  deviceId: string
  ruleId: string | null
  metric: string
  severity: string
  message: string
  metadataJson: string | null
  resolvedAt: Date | null
}

const {
  devicesByAgentAuthId,
  alertRules,
  alertEvents,
  authResultRef,
  dispatchMock,
  fakePrisma,
} = vi.hoisted(() => {
  const devicesByAgentAuthId = new Map<string, FakeDeviceRow>()
  const alertRules: FakeAlertRule[] = []
  const alertEvents: FakeAlertEvent[] = []
  const authResultRef: { current: unknown } = { current: null }
  const dispatchMock = vi.fn(async (_clientId: string, _event: string, _payload: Record<string, unknown>) => undefined)
  let deviceCounter = 0
  let eventCounter = 0

  const noopDeleteMany = vi.fn(async () => ({ count: 0 }))
  const noopCreateMany = vi.fn(async () => ({ count: 0 }))
  const noopUpsert = vi.fn(async () => ({}))

  const fakePrisma = {
    device: {
      findUnique: vi.fn(async ({ where }: { where: { agentAuthId: string } }) => {
        const device = devicesByAgentAuthId.get(where.agentAuthId)
        if (!device) return null
        return { id: device.id, status: device.status }
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { agentAuthId: string }
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) => {
          const existing = devicesByAgentAuthId.get(where.agentAuthId)
          if (existing) {
            Object.assign(existing, update)
            return { id: existing.id, hostname: existing.hostname, status: existing.status }
          }
          const id = `device-${++deviceCounter}`
          const created: FakeDeviceRow = {
            id,
            agentAuthId: where.agentAuthId,
            hostname: create.hostname as string,
            status: create.status as string,
          }
          devicesByAgentAuthId.set(where.agentAuthId, created)
          return { id: created.id, hostname: created.hostname, status: created.status }
        }
      ),
    },
    hardware: { upsert: noopUpsert },
    network: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    disk: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    software: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    securityPosture: { upsert: noopUpsert },
    monitor: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    printer: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    usbDevice: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    localAccount: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
    collectionLog: { create: vi.fn(async () => ({ id: 'log-1' })) },
    agentCheckLog: { create: vi.fn(async () => ({ id: 'checklog-1' })) },
    alertRule: {
      findMany: vi.fn(async ({ where }: { where: { clientId: string; enabled: boolean } }) =>
        alertRules.filter((rule) => rule.clientId === where.clientId && rule.enabled === where.enabled)
      ),
    },
    alertEvent: {
      findMany: vi.fn(
        async ({ where }: { where: { deviceId: string; resolvedAt: null; ruleId: { in: string[] } } }) =>
          alertEvents.filter(
            (event) =>
              event.deviceId === where.deviceId &&
              event.resolvedAt === null &&
              event.ruleId !== null &&
              where.ruleId.in.includes(event.ruleId)
          )
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeAlertEvent, 'id' | 'resolvedAt'> }) => {
        const event: FakeAlertEvent = { id: `evt-${++eventCounter}`, resolvedAt: null, ...data }
        alertEvents.push(event)
        return event
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { resolvedAt: Date } }) => {
        const event = alertEvents.find((candidate) => candidate.id === where.id)
        if (event) Object.assign(event, data)
        return event
      }),
    },
  }

  return { devicesByAgentAuthId, alertRules, alertEvents, authResultRef, dispatchMock, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) =>
    Response.json({ error: result.message }, { status: result.status }),
}))
vi.mock('@/lib/server-url', () => ({ getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com') }))
vi.mock('@/lib/agent-binary', () => ({ getAgentBinarySha256: vi.fn(async () => null) }))
// alertSettings null desativa o caminho reativo legado (statusTransitioned) e
// a varredura de disponibilidade — mantém o teste focado SO no webhook novo
// disparado por AlertRule (reconcileAlertEvents), sem contaminação.
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsByClientId: vi.fn(async () => null),
}))
vi.mock('@/lib/webhook-endpoints', () => ({
  dispatchClientWebhookEndpoints: dispatchMock,
}))

function setAuthOk(overrides: Partial<{ id: string; clientId: string | null; clientName: string | null; clientSlug: string | null }> = {}) {
  authResultRef.current = {
    ok: true,
    agentAuth: {
      id: overrides.id ?? 'agent-1',
      name: 'Agente Teste',
      clientId: overrides.clientId ?? 'client-a',
      clientName: overrides.clientName ?? 'Cliente A',
      clientSlug: overrides.clientSlug ?? 'cliente-a',
    },
  }
}

function buildRequest(body: unknown) {
  return new NextRequest('https://inventario.example.com/api/agent/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

function seedRule(overrides: Partial<FakeAlertRule> & { id: string; clientId: string }) {
  const rule: FakeAlertRule = { metric: 'software_blacklisted', severity: 'warning', enabled: true, pattern: null, ...overrides }
  alertRules.push(rule)
  return rule
}

beforeEach(() => {
  devicesByAgentAuthId.clear()
  alertRules.length = 0
  alertEvents.length = 0
  authResultRef.current = null
  vi.clearAllMocks()
})

describe('POST /api/agent/checkin — software_blacklisted dispara webhook SO na abertura (Sprint 12)', () => {
  it('software proibido detectado: abre AlertEvent e dispara dispatchClientWebhookEndpoints com device.warning', async () => {
    setAuthOk({ id: 'agent-sw-1', clientId: 'client-a', clientSlug: 'cliente-a' })
    seedRule({ id: 'rule-sw', clientId: 'client-a', pattern: 'AnyDesk' })

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(
      buildRequest({
        hostname: 'PC-SW-01',
        agentVersion: '1.0.0',
        software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
      })
    )

    expect(response.status).toBe(200)
    expect(alertEvents).toHaveLength(1)
    expect(JSON.parse(alertEvents[0].metadataJson!)).toEqual({ softwareNome: 'AnyDesk', softwareVersao: '7.1.0' })

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    const [clientId, event, payload] = dispatchMock.mock.calls[0]
    expect(clientId).toBe('client-a')
    expect(event).toBe('device.warning')
    expect(payload).toMatchObject({
      event: 'device.warning',
      tenant: { id: 'client-a', slug: 'cliente-a' },
      device: { hostname: 'PC-SW-01' },
      alert: { metric: 'software_blacklisted', message: expect.stringContaining('AnyDesk') },
    })
  })

  it('check-in SEM software proibido: nenhum AlertEvent, dispatchClientWebhookEndpoints NAO chamado', async () => {
    setAuthOk({ id: 'agent-sw-2', clientId: 'client-a', clientSlug: 'cliente-a' })
    seedRule({ id: 'rule-sw', clientId: 'client-a', pattern: 'AnyDesk' })

    const { POST } = await import('@/app/api/agent/checkin/route')
    await POST(
      buildRequest({
        hostname: 'PC-SW-02',
        agentVersion: '1.0.0',
        software: [{ nome: 'Google Chrome', versao: '120.0' }],
      })
    )

    expect(alertEvents).toHaveLength(0)
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('regra desabilitada nunca dispara webhook, mesmo com software proibido presente', async () => {
    setAuthOk({ id: 'agent-sw-3', clientId: 'client-a', clientSlug: 'cliente-a' })
    seedRule({ id: 'rule-sw', clientId: 'client-a', pattern: 'AnyDesk', enabled: false })

    const { POST } = await import('@/app/api/agent/checkin/route')
    await POST(
      buildRequest({
        hostname: 'PC-SW-03',
        agentVersion: '1.0.0',
        software: [{ nome: 'AnyDesk', versao: '7.1.0' }],
      })
    )

    expect(alertEvents).toHaveLength(0)
    expect(dispatchMock).not.toHaveBeenCalled()
  })
})
