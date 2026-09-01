import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 9, item A.3. GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics
// e' a rota de LEITURA por sessao que alimenta o polling client-side da aba
// Metricas (DeviceMetricsSection, components/device-detail-tabs.tsx).
// Criterio de aceite: um ORG_ADMIN de OUTRA organizacao recebe 404 (nunca
// 403) — mesmo padrao de requireTenantContext(), aqui reimplementado sem
// notFound() porque essa funcao so funciona dentro de render de RSC, nao em
// Route Handler (mesmo padrao ja usado por
// app/api/clients/[id]/credentials/route.ts).

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = {
  id: string
  clientSlug: string
  status: string
  updatedAt: Date
  hardware: { ramTotalGb: number | null } | null
  disks: Array<{ espacoLivreGb: number | null }>
  logs: Array<{ coletadoEm: Date }>
}
type FakeMetricSample = {
  deviceId: string
  collectedAt: Date
  cpuPercent: number | null
  ramUsadaGb: number | null
  ramTotalGb: number | null
  discoUsadoGb: number | null
  discoLivreGb: number | null
  uptimeSegundos: number | null
}

const { clients, devices, metricSamples, alertSettingsByClientId, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const metricSamples: FakeMetricSample[] = []
  const alertSettingsByClientId = new Map<string, Record<string, unknown>>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

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
      // Aceita o formato real produzido por getTenantDeviceWhere(clientSlug)
      // (lib/tenant-scope.ts): { id, agentAuth: { is: { client: { is: { slug } } } } }.
      findFirst: vi.fn(async ({ where }: { where: { id: string; agentAuth?: { is?: { client?: { is?: { slug?: string } } } } } }) => {
        const device = devices.get(where.id)
        const requiredSlug = where.agentAuth?.is?.client?.is?.slug
        if (!device || device.clientSlug !== requiredSlug) return null
        return {
          id: device.id,
          status: device.status,
          updatedAt: device.updatedAt,
          hardware: device.hardware,
          disks: device.disks,
          logs: device.logs,
        }
      }),
    },
    metricSample: {
      findMany: vi.fn(async ({ where }: { where: { deviceId: string } }) =>
        metricSamples
          .filter((sample) => sample.deviceId === where.deviceId)
          .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime())
      ),
    },
  }

  return { clients, devices, metricSamples, alertSettingsByClientId, sessionRef, fakePrisma }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsByClientId: vi.fn(async (clientId: string | null | undefined) =>
    clientId && alertSettingsByClientId.has(clientId) ? { clientId, ...alertSettingsByClientId.get(clientId) } : null
  ),
}))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string }) {
  const device: FakeDevice = {
    status: 'online',
    updatedAt: new Date(),
    hardware: null,
    disks: [],
    logs: [],
    ...overrides,
  }
  devices.set(device.id, device)
  return device
}

function buildContext(clientSlug: string, deviceId: string) {
  return { params: Promise.resolve({ clientSlug, deviceId }) }
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  metricSamples.length = 0
  alertSettingsByClientId.clear()
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics — isolamento de tenant', () => {
  it('ORG_ADMIN de OUTRA organizacao recebe 404 (nunca 403), mesmo padrao de requireTenantContext', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const req = new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-1/metrics')
    const response = await GET(req, buildContext('cliente-a', 'device-1') as any)

    expect(response.status).toBe(404)
  })

  it('clientSlug inexistente e deviceId de outra organizacao respondem com o MESMO corpo (sem oraculo de existencia)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const resInexistente = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/slug-que-nao-existe/devices/device-1/metrics'),
      buildContext('slug-que-nao-existe', 'device-1') as any
    )
    const resOutraOrg = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-1/metrics'),
      buildContext('cliente-a', 'device-1') as any
    )

    expect(resInexistente.status).toBe(resOutraOrg.status)
    expect(await resInexistente.json()).toEqual(await resOutraOrg.json())
  })

  it('sem sessao valida recebe 404', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a' })
    sessionRef.user = null

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-1/metrics'),
      buildContext('cliente-a', 'device-1') as any
    )

    expect(response.status).toBe(404)
  })

  it('deviceId de outro tenant (mesmo com sessao valida no tenant certo) recebe 404', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedClient({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-a' })
    seedDevice({ id: 'device-b', clientSlug: 'cliente-b' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-b/metrics'),
      buildContext('cliente-a', 'device-b') as any
    )

    expect(response.status).toBe(404)
  })
})

describe('GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics — caminho positivo', () => {
  it('dispositivo do tenant correto retorna as amostras (ordem cronologica) e o snapshot de saude', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    const recent = new Date(Date.now() - 5 * 60 * 1000)
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', status: 'online', updatedAt: recent, logs: [{ coletadoEm: recent }] })
    metricSamples.push(
      { deviceId: 'device-1', collectedAt: new Date(Date.now() - 20 * 60 * 1000), cpuPercent: 10, ramUsadaGb: 2, ramTotalGb: 8, discoUsadoGb: 50, discoLivreGb: 50, uptimeSegundos: 3600 },
      { deviceId: 'device-1', collectedAt: recent, cpuPercent: 20, ramUsadaGb: 3, ramTotalGb: 8, discoUsadoGb: 55, discoLivreGb: 45, uptimeSegundos: 3900 }
    )
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-1/metrics'),
      buildContext('cliente-a', 'device-1') as any
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.metrics).toHaveLength(2)
    // Cronologico: a amostra mais antiga primeiro.
    expect(body.metrics[0].cpuPercent).toBe(10)
    expect(body.metrics[1].cpuPercent).toBe(20)
    expect(body.device).toMatchObject({ id: 'device-1', status: 'online', effectiveStatus: 'online' })
    expect(body.device.checkinLatencyMinutes).toBeLessThanOrEqual(5)
  })

  it('status efetivo reflete alertOfflineHours (RN010), nao o status bruto do banco', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    const stale = new Date(Date.now() - 30 * 3600 * 1000)
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', status: 'online', updatedAt: stale, logs: [{ coletadoEm: stale }] })
    alertSettingsByClientId.set('client-a', {
      alertsEnabled: true,
      alertWebhookEnabled: false,
      alertWebhookUrl: null,
      alertDiskThresholdGb: 10,
      alertRamThresholdGb: 4,
      alertOfflineHours: 24,
      metricsRetentionDays: 90,
    })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/[deviceId]/metrics/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/devices/device-1/metrics'),
      buildContext('cliente-a', 'device-1') as any
    )

    const body = await response.json()
    expect(body.device.status).toBe('online') // bruto, nunca alterado no banco
    expect(body.device.effectiveStatus).toBe('offline') // efetivo, calculado
    expect(body.device.checkinLatencyMinutes).toBeGreaterThanOrEqual(30 * 60 - 1)
  })
})
