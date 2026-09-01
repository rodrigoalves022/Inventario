import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 10, item 15 (RNF007): expurgo inline de MetricSample por
// metricsRetentionDays, dentro de POST /api/agent/metrics (nao ha cron
// separado neste projeto — RNF007 ja documenta isso). Confirma que uma
// amostra mais antiga que metricsRetentionDays do Client e removida na
// ingestao SEGUINTE, e que uma amostra dentro do periodo nao e tocada.

type FakeMetricSample = { id: string; deviceId: string; clientId: string | null; collectedAt: Date; cpuPercent: number | null }
type FakeDevice = { id: string; agentAuthId: string; clientId: string | null }
type FakeClient = { id: string; metricsRetentionDays: number | null }

const { devices, clients, samples, authResultRef, fakePrisma } = vi.hoisted(() => {
  const devices = new Map<string, FakeDevice>()
  const clients = new Map<string, FakeClient>()
  const samples: FakeMetricSample[] = []
  const authResultRef: { current: unknown } = { current: null }
  let sampleCounter = 0

  const fakePrisma = {
    device: {
      findUnique: vi.fn(async ({ where }: { where: { agentAuthId: string } }) => {
        const device = [...devices.values()].find((d) => d.agentAuthId === where.agentAuthId)
        return device ? { id: device.id, clientId: device.clientId } : null
      }),
    },
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clients.get(where.id)
        return client ? { metricsRetentionDays: client.metricsRetentionDays } : null
      }),
    },
    metricSample: {
      create: vi.fn(async ({ data }: { data: { deviceId: string; clientId: string | null; cpuPercent: number | null } }) => {
        const sample: FakeMetricSample = {
          id: `sample-${++sampleCounter}`,
          deviceId: data.deviceId,
          clientId: data.clientId,
          cpuPercent: data.cpuPercent,
          collectedAt: new Date(),
        }
        samples.push(sample)
        return sample
      }),
      deleteMany: vi.fn(async ({ where }: { where: { deviceId: string; collectedAt: { lt: Date } } }) => {
        const before = samples.length
        for (let i = samples.length - 1; i >= 0; i--) {
          const sample = samples[i]
          if (sample.deviceId === where.deviceId && sample.collectedAt.getTime() < where.collectedAt.lt.getTime()) {
            samples.splice(i, 1)
          }
        }
        return { count: before - samples.length }
      }),
    },
  }

  return { devices, clients, samples, authResultRef, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) => Response.json({ error: result.message }, { status: result.status }),
}))

function setAuthOk(agentAuthId: string) {
  authResultRef.current = { ok: true, agentAuth: { id: agentAuthId } }
}

function buildRequest(agentAuthId: string, body: Record<string, unknown> = {}) {
  return new NextRequest('https://inventario.example.com/api/agent/metrics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify({
      hostname: 'PC-METRICS',
      cpuPercent: 50,
      ramUsadaGb: 4,
      ramTotalGb: 8,
      discoUsadoGb: 100,
      discoLivreGb: 100,
      uptimeSegundos: 3600,
      ...body,
    }),
  })
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

beforeEach(() => {
  devices.clear()
  clients.clear()
  samples.length = 0
  authResultRef.current = null
  vi.clearAllMocks()
})

describe('POST /api/agent/metrics — expurgo inline por metricsRetentionDays', () => {
  it('amostra mais antiga que metricsRetentionDays do Client e removida na ingestao seguinte', async () => {
    clients.set('client-a', { id: 'client-a', metricsRetentionDays: 30 })
    devices.set('device-1', { id: 'device-1', agentAuthId: 'agent-1', clientId: 'client-a' })
    samples.push({ id: 'old-sample', deviceId: 'device-1', clientId: 'client-a', collectedAt: daysAgo(31), cpuPercent: 10 })
    setAuthOk('agent-1')

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(buildRequest('agent-1'))

    expect(response.status).toBe(200)
    expect(samples.find((s) => s.id === 'old-sample')).toBeUndefined()
    // A amostra recem-inserida por este POST continua no banco.
    expect(samples.some((s) => s.deviceId === 'device-1')).toBe(true)
  })

  it('amostra dentro do periodo de retencao NAO e tocada', async () => {
    clients.set('client-a', { id: 'client-a', metricsRetentionDays: 30 })
    devices.set('device-1', { id: 'device-1', agentAuthId: 'agent-1', clientId: 'client-a' })
    samples.push({ id: 'recent-sample', deviceId: 'device-1', clientId: 'client-a', collectedAt: daysAgo(5), cpuPercent: 20 })
    setAuthOk('agent-1')

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(buildRequest('agent-1'))

    expect(response.status).toBe(200)
    expect(samples.find((s) => s.id === 'recent-sample')).toBeDefined()
  })

  it('sem metricsRetentionDays configurado no Client, usa o default de 90 dias — amostra de 91 dias e removida, de 89 nao', async () => {
    clients.set('client-a', { id: 'client-a', metricsRetentionDays: null })
    devices.set('device-1', { id: 'device-1', agentAuthId: 'agent-1', clientId: 'client-a' })
    samples.push(
      { id: 'sample-91d', deviceId: 'device-1', clientId: 'client-a', collectedAt: daysAgo(91), cpuPercent: 10 },
      { id: 'sample-89d', deviceId: 'device-1', clientId: 'client-a', collectedAt: daysAgo(89), cpuPercent: 15 }
    )
    setAuthOk('agent-1')

    const { POST } = await import('@/app/api/agent/metrics/route')
    await POST(buildRequest('agent-1'))

    expect(samples.find((s) => s.id === 'sample-91d')).toBeUndefined()
    expect(samples.find((s) => s.id === 'sample-89d')).toBeDefined()
  })

  it('expurgo e escopado por deviceId: amostra antiga de OUTRO dispositivo (mesmo cliente) nao e removida por este check-in', async () => {
    clients.set('client-a', { id: 'client-a', metricsRetentionDays: 30 })
    devices.set('device-1', { id: 'device-1', agentAuthId: 'agent-1', clientId: 'client-a' })
    samples.push({ id: 'old-other-device', deviceId: 'device-2', clientId: 'client-a', collectedAt: daysAgo(60), cpuPercent: 5 })
    setAuthOk('agent-1')

    const { POST } = await import('@/app/api/agent/metrics/route')
    await POST(buildRequest('agent-1'))

    expect(samples.find((s) => s.id === 'old-other-device')).toBeDefined()
  })
})
