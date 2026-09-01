import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 9, item A.1. Teste de integracao de POST /api/agent/checkin
// confirmando que (1) a varredura de disponibilidade/disco roda para o
// clientId INTEIRO (nao so o dispositivo que fez o checkin desta requisicao)
// e (2) o caminho reativo ORIGINAL (webhook por transicao de status do
// PROPRIO dispositivo) continua se comportando exatamente como antes, sem
// duplicar disparo quando a varredura tambem identifica o mesmo dispositivo.
// fakePrisma cobre so as tabelas realmente tocadas pelo payload usado em cada
// teste — mesmo padrao de tests/revoke-agent-auth.test.ts/
// tests/delete-alert-rule.test.ts (vi.hoisted por causa do hoisting de
// vi.mock).

type FakeDeviceRow = {
  id: string
  agentAuthId: string
  clientId: string | null
  hostname: string
  status: string
  updatedAt: Date
  disks: Array<{ espacoLivreGb: number | null }>
  logs: Array<{ coletadoEm: Date }>
}

type FakeAlertEvent = {
  id: string
  clientId: string
  deviceId: string
  ruleId: string | null
  metric: string
  severity: string
  message: string
  firedAt: Date
  resolvedAt: Date | null
}

const { devicesByAgentAuthId, devicesById, alertEvents, authResultRef, fakePrisma } = vi.hoisted(() => {
  const devicesByAgentAuthId = new Map<string, FakeDeviceRow>()
  const devicesById = new Map<string, FakeDeviceRow>()
  const alertEvents: FakeAlertEvent[] = []
  const authResultRef: { current: unknown } = { current: null }
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
            clientId: (create.clientId as string | null) ?? null,
            hostname: create.hostname as string,
            status: create.status as string,
            updatedAt: new Date(),
            disks: [],
            logs: [],
          }
          devicesByAgentAuthId.set(where.agentAuthId, created)
          devicesById.set(id, created)
          return { id: created.id, hostname: created.hostname, status: created.status }
        }
      ),
      findMany: vi.fn(async ({ where }: { where: { clientId: string } }) =>
        [...devicesById.values()]
          .filter((device) => device.clientId === where.clientId)
          .map((device) => ({
            id: device.id,
            hostname: device.hostname,
            updatedAt: device.updatedAt,
            logs: device.logs,
            disks: device.disks,
          }))
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
    collectionLog: {
      create: vi.fn(async ({ data }: { data: { deviceId: string } }) => {
        const device = devicesById.get(data.deviceId)
        if (device) device.logs.unshift({ coletadoEm: new Date() })
        return { id: 'log-1' }
      }),
    },
    agentCheckLog: { create: vi.fn(async () => ({ id: 'checklog-1' })) },
    alertRule: { findMany: vi.fn(async () => []) },
    alertEvent: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { clientId: string; resolvedAt: null; ruleId: null; metric: { in: string[] } }
        }) =>
          alertEvents.filter(
            (event) =>
              event.clientId === where.clientId &&
              event.resolvedAt === null &&
              event.ruleId === null &&
              where.metric.in.includes(event.metric)
          )
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeAlertEvent, 'id' | 'firedAt' | 'resolvedAt'> }) => {
        const event: FakeAlertEvent = { id: `evt-${++eventCounter}`, firedAt: new Date(), resolvedAt: null, ...data }
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

  return { devicesByAgentAuthId, devicesById, alertEvents, authResultRef, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) =>
    Response.json({ error: result.message }, { status: result.status }),
}))
vi.mock('@/lib/server-url', () => ({ getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com') }))
vi.mock('@/lib/agent-binary', () => ({ getAgentBinarySha256: vi.fn(async () => null) }))

type FakeAlertSettingsRow = {
  alertsEnabled: boolean
  alertWebhookEnabled: boolean
  alertWebhookUrl: string | null
  alertDiskThresholdGb: number
  alertRamThresholdGb: number
  alertOfflineHours: number
  metricsRetentionDays: number
}

const alertSettingsByClientId = new Map<string, FakeAlertSettingsRow>()
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsByClientId: vi.fn(async (clientId: string | null | undefined) =>
    clientId ? { clientId, ...alertSettingsByClientId.get(clientId) } : null
  ),
}))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

function seedDevice(row: Partial<FakeDeviceRow> & { id: string; agentAuthId: string; clientId: string }) {
  const device: FakeDeviceRow = {
    hostname: `HOST-${row.id}`,
    status: 'online',
    updatedAt: new Date(),
    disks: [],
    logs: [],
    ...row,
  }
  devicesByAgentAuthId.set(device.agentAuthId, device)
  devicesById.set(device.id, device)
  return device
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000)
}

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('https://inventario.example.com/api/agent/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

function defaultSettings(overrides: Partial<FakeAlertSettingsRow> = {}): FakeAlertSettingsRow {
  return {
    alertsEnabled: true,
    alertWebhookEnabled: true,
    alertWebhookUrl: 'https://hooks.example.com/alert',
    alertDiskThresholdGb: 10,
    alertRamThresholdGb: 4,
    alertOfflineHours: 24,
    metricsRetentionDays: 90,
    ...overrides,
  }
}

beforeEach(() => {
  devicesByAgentAuthId.clear()
  devicesById.clear()
  alertEvents.length = 0
  alertSettingsByClientId.clear()
  authResultRef.current = null
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

describe('POST /api/agent/checkin — varredura de disponibilidade/disco (Sprint 9, A.1)', () => {
  it('roda a varredura para TODOS os dispositivos do clientId, nao so o que fez o checkin', async () => {
    authResultRef.current = {
      ok: true,
      agentAuth: { id: 'agent-1', name: 'Agente 1', clientId: 'client-a', clientName: 'Cliente A', clientSlug: 'cliente-a' },
    }
    alertSettingsByClientId.set('client-a', defaultSettings())

    // d1: o que vai fazer o checkin nesta requisicao (fresco, sem problema).
    seedDevice({ id: 'd1', agentAuthId: 'agent-1', clientId: 'client-a', updatedAt: new Date() })
    // d2: silencioso ha mais tempo que alertOfflineHours — nunca faria
    // checkin sozinho, so e' pego pela varredura disparada pelo checkin de d1.
    seedDevice({ id: 'd2', agentAuthId: 'agent-2', clientId: 'client-a', updatedAt: hoursAgo(48) })
    // d3: disco critico, tambem nao e' quem esta fazendo o checkin.
    seedDevice({ id: 'd3', agentAuthId: 'agent-3', clientId: 'client-a', updatedAt: hoursAgo(1), disks: [{ espacoLivreGb: 2 }] })

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-D1', agentVersion: '1.0.0' }))

    expect(response.status).toBe(200)
    expect(alertEvents).toHaveLength(2)
    expect(alertEvents.find((event) => event.deviceId === 'd2')).toMatchObject({ metric: 'device_offline', ruleId: null })
    expect(alertEvents.find((event) => event.deviceId === 'd3')).toMatchObject({ metric: 'low_disk', ruleId: null })
    // d1 (o que fez o checkin) nao ganha evento sintetico nenhum: device_offline
    // nao dispara (acabou de coletar) e low_disk e' propositalmente pulado
    // para ele (coberto pelo caminho reativo).
    expect(alertEvents.find((event) => event.deviceId === 'd1')).toBeUndefined()

    // 2 webhooks da varredura (device_offline de d2 + low_disk de d3); d1 nao
    // teve transicao de status (sem warningIssues no payload), entao o
    // caminho reativo nao soma um terceiro disparo.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('isolamento multi-tenant: a varredura nunca cruza dispositivos de outro clientId', async () => {
    authResultRef.current = {
      ok: true,
      agentAuth: { id: 'agent-1', name: 'Agente 1', clientId: 'client-a', clientName: 'Cliente A', clientSlug: 'cliente-a' },
    }
    alertSettingsByClientId.set('client-a', defaultSettings())

    seedDevice({ id: 'd1', agentAuthId: 'agent-1', clientId: 'client-a', updatedAt: new Date() })
    seedDevice({ id: 'd-outro-cliente', agentAuthId: 'agent-99', clientId: 'client-b', updatedAt: hoursAgo(48) })

    const { POST } = await import('@/app/api/agent/checkin/route')
    await POST(buildRequest({ hostname: 'PC-D1', agentVersion: '1.0.0' }))

    expect(alertEvents.every((event) => event.clientId === 'client-a')).toBe(true)
    expect(alertEvents.find((event) => event.deviceId === 'd-outro-cliente')).toBeUndefined()
  })
})

describe('POST /api/agent/checkin — regressao do caminho reativo original (webhook por transicao de status)', () => {
  it('continua disparando so na transicao previousDevice.status !== nextStatus do PROPRIO dispositivo, com o mesmo payload de antes', async () => {
    authResultRef.current = {
      ok: true,
      agentAuth: { id: 'agent-1', name: 'Agente 1', clientId: 'client-a', clientName: 'Cliente A', clientSlug: 'cliente-a' },
    }
    // alertOfflineHours bem alto para nao gerar ruido de device_offline
    // sintetico neste teste — o foco aqui e' so o caminho reativo.
    alertSettingsByClientId.set('client-a', defaultSettings({ alertOfflineHours: 720 }))
    seedDevice({ id: 'd1', agentAuthId: 'agent-1', clientId: 'client-a', status: 'online', updatedAt: new Date() })

    const { POST } = await import('@/app/api/agent/checkin/route')
    // Disco abaixo do limiar no PROPRIO payload do dispositivo que esta
    // fazendo o checkin -> dispara o caminho reativo (transicao online -> warning).
    const response = await POST(
      buildRequest({
        hostname: 'PC-D1',
        agentVersion: '1.0.0',
        discos: [{ unidade: 'C:', capacidadeGb: 100, espacoLivreGb: 2 }],
      })
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/alert')
    const payload = JSON.parse(init.body as string)
    expect(payload).toMatchObject({
      event: 'device.warning',
      tenant: { id: 'client-a', name: 'Cliente A', slug: 'cliente-a' },
      device: { id: 'd1', hostname: 'PC-D1', status: 'warning' },
    })
    expect(payload.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'low_disk' })])
    )

    // Nenhum AlertEvent sintetico foi criado para d1 por causa disso — o
    // caminho reativo dele so e' um marcador de status transitorio de
    // check-in, sem AlertEvent (mesma bifurcacao ja documentada em
    // docs/PRODUCT.md 3.6); a varredura tambem nao cria um para ele porque
    // low_disk e' propositalmente pulado no dispositivo que acabou de checar.
    expect(alertEvents).toHaveLength(0)
  })

  it('nao dispara webhook quando o status do proprio dispositivo nao muda', async () => {
    authResultRef.current = {
      ok: true,
      agentAuth: { id: 'agent-1', name: 'Agente 1', clientId: 'client-a', clientName: 'Cliente A', clientSlug: 'cliente-a' },
    }
    alertSettingsByClientId.set('client-a', defaultSettings())
    seedDevice({ id: 'd1', agentAuthId: 'agent-1', clientId: 'client-a', status: 'online', updatedAt: new Date() })

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-D1', agentVersion: '1.0.0' }))

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
