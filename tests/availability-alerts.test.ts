import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileAvailabilityEvents } from '@/lib/availability-alerts'
import { DEFAULT_ALERT_SETTINGS, type InventoryAlertSettings } from '@/lib/inventory-alerts'

// Sprint 9, item A.1. reconcileAvailabilityEvents fecha o gap do caminho
// reativo em app/api/agent/checkin/route.ts, que so reage ao PROPRIO
// dispositivo que faz check-in — uma maquina que simplesmente PARA de
// reportar nunca dispararia nada sozinha. Testado sem Prisma real, mesmo
// padrao de tests/device-report.test.ts/tests/permissions.test.ts: entrada
// sintetica, fakePrisma em memoria.

type FakeDevice = {
  id: string
  hostname: string
  clientId: string
  updatedAt: Date
  logs: Array<{ coletadoEm: Date }>
  disks: Array<{ espacoLivreGb: number | null }>
  /** AgentAuth.isActive do device (Sprint A3, item 9). Padrao: true. */
  agentAuthActive?: boolean
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

const { devices, alertEvents, fakePrisma } = vi.hoisted(() => {
  const devices = new Map<string, FakeDevice>()
  const alertEvents: FakeAlertEvent[] = []
  let counter = 0

  const fakePrisma = {
    device: {
      findMany: vi.fn(async ({ where }: { where: { clientId: string; agentAuth?: { isActive?: boolean } } }) =>
        [...devices.values()]
          .filter((device) => device.clientId === where.clientId)
          .filter(
            (device) =>
              where.agentAuth?.isActive === undefined ||
              (device.agentAuthActive ?? true) === where.agentAuth.isActive
          )
          .map((device) => ({
            id: device.id,
            hostname: device.hostname,
            updatedAt: device.updatedAt,
            logs: device.logs,
            disks: device.disks,
          }))
      ),
    },
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
        const event: FakeAlertEvent = { id: `evt-${++counter}`, firedAt: new Date(), resolvedAt: null, ...data }
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

  return { devices, alertEvents, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientId: string }) {
  const device: FakeDevice = {
    hostname: `HOST-${overrides.id}`,
    updatedAt: new Date(),
    logs: [],
    disks: [],
    ...overrides,
  }
  devices.set(device.id, device)
  return device
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000)
}

function settings(overrides: Partial<InventoryAlertSettings> = {}): InventoryAlertSettings {
  return { ...DEFAULT_ALERT_SETTINGS, ...overrides }
}

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

beforeEach(() => {
  devices.clear()
  alertEvents.length = 0
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

describe('reconcileAvailabilityEvents — device_offline (dispositivo silencioso, sem novo checkin proprio)', () => {
  it('abre AlertEvent sintetico quando um dispositivo cruza alertOfflineHours', async () => {
    seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(30) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other', // outro dispositivo do cliente fez o checkin
    })

    expect(alertEvents).toHaveLength(1)
    expect(alertEvents[0]).toMatchObject({
      clientId: 'client-a',
      deviceId: 'd-stale',
      ruleId: null,
      metric: 'device_offline',
      resolvedAt: null,
    })
  })

  it('nao duplica o evento num segundo ciclo enquanto a condicao persiste', async () => {
    seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(30) })
    const params = {
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    }

    await reconcileAvailabilityEvents(params)
    await reconcileAvailabilityEvents(params)

    expect(alertEvents).toHaveLength(1)
  })

  it('resolve o evento (resolvedAt preenchido) quando o dispositivo volta a coletar dentro do limiar', async () => {
    const device = seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(30) })
    const params = {
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    }

    await reconcileAvailabilityEvents(params)
    expect(alertEvents[0].resolvedAt).toBeNull()

    // O proprio dispositivo volta a coletar (esta e' a chamada onde ele e'
    // o checkedInDeviceId, seu updatedAt teria sido tocado pelo upsert real).
    device.updatedAt = new Date()
    await reconcileAvailabilityEvents({ ...params, checkedInDeviceId: 'd-stale' })

    expect(alertEvents).toHaveLength(1)
    expect(alertEvents[0].resolvedAt).not.toBeNull()
  })

  it('nao dispara para um dispositivo cuja ultima coleta ainda esta dentro do limiar', async () => {
    seedDevice({ id: 'd-ok', clientId: 'client-a', updatedAt: hoursAgo(2) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    })

    expect(alertEvents).toHaveLength(0)
  })
})

describe('reconcileAvailabilityEvents — low_disk (dispositivo diferente do que fez o checkin)', () => {
  it('gera AlertEvent quando um dispositivo QUE NAO fez o checkin tem disco abaixo do limiar', async () => {
    seedDevice({
      id: 'd-checkin',
      clientId: 'client-a',
      updatedAt: hoursAgo(0),
      disks: [{ espacoLivreGb: 200 }],
    })
    seedDevice({
      id: 'd-outro',
      clientId: 'client-a',
      updatedAt: hoursAgo(1),
      disks: [{ espacoLivreGb: 5 }],
    })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertDiskThresholdGb: 10 }),
      checkedInDeviceId: 'd-checkin',
    })

    const diskEvents = alertEvents.filter((event) => event.metric === 'low_disk')
    expect(diskEvents).toHaveLength(1)
    expect(diskEvents[0].deviceId).toBe('d-outro')
  })

  it('NAO gera AlertEvent de low_disk para o dispositivo que acabou de fazer o checkin (coberto pelo caminho reativo existente)', async () => {
    seedDevice({
      id: 'd-checkin',
      clientId: 'client-a',
      updatedAt: hoursAgo(0),
      disks: [{ espacoLivreGb: 2 }], // abaixo do limiar
    })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertDiskThresholdGb: 10 }),
      checkedInDeviceId: 'd-checkin',
    })

    expect(alertEvents.filter((event) => event.metric === 'low_disk')).toHaveLength(0)
  })

  it('resolve o evento de low_disk quando o disco volta a ficar acima do limiar', async () => {
    const device = seedDevice({
      id: 'd-outro',
      clientId: 'client-a',
      updatedAt: hoursAgo(1),
      disks: [{ espacoLivreGb: 5 }],
    })
    const params = {
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertDiskThresholdGb: 10 }),
      checkedInDeviceId: 'd-checkin',
    }

    await reconcileAvailabilityEvents(params)
    expect(alertEvents.filter((event) => event.metric === 'low_disk')).toHaveLength(1)

    device.disks = [{ espacoLivreGb: 50 }]
    await reconcileAvailabilityEvents(params)

    const diskEvents = alertEvents.filter((event) => event.metric === 'low_disk')
    expect(diskEvents).toHaveLength(1)
    expect(diskEvents[0].resolvedAt).not.toBeNull()
  })
})

describe('reconcileAvailabilityEvents — webhook e configuracao do tenant', () => {
  it('dispara o webhook quando um evento sintetico abre, reaproveitando alertWebhookUrl', async () => {
    seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(30) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({
        alertOfflineHours: 24,
        alertWebhookEnabled: true,
        alertWebhookUrl: 'https://hooks.example.com/alert',
      }),
      checkedInDeviceId: 'd-other',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://hooks.example.com/alert', expect.any(Object))
  })

  it('NAO dispara webhook quando alertWebhookEnabled e falso, mas ainda assim cria o AlertEvent', async () => {
    seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(30) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24, alertWebhookEnabled: false, alertWebhookUrl: null }),
      checkedInDeviceId: 'd-other',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(alertEvents).toHaveLength(1)
  })

  it('nao roda nenhuma reconciliacao quando alertsEnabled e falso para o tenant', async () => {
    seedDevice({ id: 'd-stale', clientId: 'client-a', updatedAt: hoursAgo(300) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertsEnabled: false, alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    })

    expect(alertEvents).toHaveLength(0)
    expect(fakePrisma.device.findMany).not.toHaveBeenCalled()
  })

  it('isolamento multi-tenant: so varre dispositivos do clientId informado', async () => {
    seedDevice({ id: 'd-a', clientId: 'client-a', updatedAt: hoursAgo(30) })
    seedDevice({ id: 'd-b', clientId: 'client-b', updatedAt: hoursAgo(30) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    })

    expect(alertEvents).toHaveLength(1)
    expect(alertEvents[0].deviceId).toBe('d-a')
  })
})

// Sprint A3, item 9 (decisao 1 do usuario). Uma maquina com AgentAuth
// revogado nunca mais coleta: sem o filtro, ela passaria do alertOfflineHours
// e abriria um device_offline com webhook no proximo check-in de qualquer
// outra maquina do cliente (alerta fantasma criado pela propria revogacao).
describe('reconcileAvailabilityEvents — AgentAuth revogado (alerta fantasma)', () => {
  it('device de AgentAuth revogado e sem coleta alem do limiar nao abre AlertEvent nem dispara webhook', async () => {
    seedDevice({ id: 'd-revogado', clientId: 'client-a', updatedAt: hoursAgo(300), agentAuthActive: false })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({
        alertOfflineHours: 24,
        alertWebhookEnabled: true,
        alertWebhookUrl: 'https://hooks.example.com/alert',
      }),
      checkedInDeviceId: 'd-other',
    })

    expect(alertEvents).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('o device ativo do mesmo cliente continua sendo avaliado', async () => {
    seedDevice({ id: 'd-revogado', clientId: 'client-a', updatedAt: hoursAgo(300), agentAuthActive: false })
    seedDevice({ id: 'd-ativo', clientId: 'client-a', updatedAt: hoursAgo(30), agentAuthActive: true })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-other',
    })

    expect(alertEvents).toHaveLength(1)
    expect(alertEvents[0]).toMatchObject({ deviceId: 'd-ativo', metric: 'device_offline' })
  })

  it('a consulta de devices filtra agentAuth.isActive = true, alem do clientId', async () => {
    seedDevice({ id: 'd-ativo', clientId: 'client-a', updatedAt: hoursAgo(1) })

    await reconcileAvailabilityEvents({
      clientId: 'client-a',
      clientName: 'Cliente A',
      clientSlug: 'cliente-a',
      settings: settings({ alertOfflineHours: 24 }),
      checkedInDeviceId: 'd-ativo',
    })

    const args = fakePrisma.device.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(args.where).toEqual({ clientId: 'client-a', agentAuth: { isActive: true } })
  })
})
