import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 10, item 5 (RF011: rota POST /api/agent/metrics). Teste de
// integracao da rota REAL (app/api/agent/metrics/route.ts), Prisma mockado.
// agentMetricsSchema (lib/schemas/agent-metrics.ts) e' o schema REAL, nunca
// mockado — cobertura .parse()/.safeParse() isolada do schema em si fica em
// tests/agent-checkin-schema.test.ts (item 6); aqui o foco e' a rota
// completa: autenticacao, persistencia de MetricSample e o expurgo inline
// por retencao (RNF007, tangencial — nao duplicado a fundo aqui, e' o item
// 15 desta sprint).

type FakeDeviceRow = { id: string; agentAuthId: string; clientId: string | null }
type FakeClientRow = { id: string; metricsRetentionDays: number | null }
type FakeMetricSample = {
  id: string
  deviceId: string
  clientId: string | null
  cpuPercent: number | null
  collectedAt: Date
}

const { devicesByAgentAuthId, clientsById, metricSamples, authResultRef, fakePrisma } = vi.hoisted(() => {
  const devicesByAgentAuthId = new Map<string, FakeDeviceRow>()
  const clientsById = new Map<string, FakeClientRow>()
  const metricSamples: FakeMetricSample[] = []
  const authResultRef: { current: unknown } = { current: null }
  let counter = 0

  const fakePrisma = {
    device: {
      findUnique: vi.fn(async ({ where }: { where: { agentAuthId: string } }) => {
        const device = devicesByAgentAuthId.get(where.agentAuthId)
        return device ? { id: device.id, clientId: device.clientId } : null
      }),
    },
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clientsById.get(where.id)
        return client ? { metricsRetentionDays: client.metricsRetentionDays } : null
      }),
    },
    metricSample: {
      create: vi.fn(async ({ data }: { data: Omit<FakeMetricSample, 'id' | 'collectedAt'> & { collectedAt?: Date } }) => {
        const sample: FakeMetricSample = { id: `sample-${++counter}`, collectedAt: new Date(), ...data }
        metricSamples.push(sample)
        return sample
      }),
      deleteMany: vi.fn(async ({ where }: { where: { deviceId: string; collectedAt: { lt: Date } } }) => {
        const before = metricSamples.length
        for (let i = metricSamples.length - 1; i >= 0; i--) {
          const sample = metricSamples[i]
          if (sample.deviceId === where.deviceId && sample.collectedAt < where.collectedAt.lt) {
            metricSamples.splice(i, 1)
          }
        }
        return { count: before - metricSamples.length }
      }),
    },
  }

  return { devicesByAgentAuthId, clientsById, metricSamples, authResultRef, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) =>
    Response.json({ error: result.message }, { status: result.status }),
}))

function setAuthOk(agentAuthId = 'agent-1') {
  authResultRef.current = {
    ok: true,
    agentAuth: { id: agentAuthId, name: 'Agente Teste', clientId: 'client-a', clientName: 'Cliente A', clientSlug: 'cliente-a' },
  }
}

function seedDevice(row: FakeDeviceRow) {
  devicesByAgentAuthId.set(row.agentAuthId, row)
}

function buildRequest(body: unknown, apiKey = 'test-key') {
  return new NextRequest('https://inventario.example.com/api/agent/metrics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  devicesByAgentAuthId.clear()
  clientsById.clear()
  metricSamples.length = 0
  authResultRef.current = null
  vi.clearAllMocks()
})

describe('POST /api/agent/metrics — item 5 (RF011): payload valido', () => {
  it('amostra valida persiste MetricSample vinculada ao Device correto', async () => {
    setAuthOk('agent-metrics-1')
    seedDevice({ id: 'device-1', agentAuthId: 'agent-metrics-1', clientId: 'client-a' })

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(
      buildRequest({ hostname: 'PC-METRICS', cpuPercent: 42, ramUsadaGb: 8, ramTotalGb: 16, uptimeSegundos: 100 })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(metricSamples).toHaveLength(1)
    expect(metricSamples[0]).toMatchObject({ deviceId: 'device-1', clientId: 'client-a', cpuPercent: 42 })
  })

  it('X-Api-Key invalida rejeita com 401, sem criar MetricSample', async () => {
    authResultRef.current = { ok: false, status: 401, message: 'API Key inválida.' }

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(buildRequest({ hostname: 'PC-SEM-AUTH', cpuPercent: 10 }))

    expect(response.status).toBe(401)
    expect(metricSamples).toHaveLength(0)
  })

  it('Device ainda nao registrado (ciclo de metricas antes do primeiro checkin completo) retorna 202, sem erro', async () => {
    setAuthOk('agent-metrics-sem-device')
    // Nenhum seedDevice() — prisma.device.findUnique devolve null.

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(buildRequest({ hostname: 'PC-CEDO-DEMAIS', cpuPercent: 10 }))
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json).toMatchObject({ ok: false, reason: 'device_not_registered' })
    expect(metricSamples).toHaveLength(0)
  })

  it('payload invalido (cpuPercent fora de 0-100) rejeita com 400 pelo Zod, sem persistir', async () => {
    setAuthOk('agent-metrics-invalido')
    seedDevice({ id: 'device-invalido', agentAuthId: 'agent-metrics-invalido', clientId: 'client-a' })

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(buildRequest({ hostname: 'PC-INVALIDO', cpuPercent: 999 }))

    expect(response.status).toBe(400)
    expect(metricSamples).toHaveLength(0)
    expect(fakePrisma.device.findUnique).not.toHaveBeenCalled()
  })

  it('corpo que nao e JSON valido retorna 400', async () => {
    setAuthOk('agent-metrics-badjson')

    const { POST } = await import('@/app/api/agent/metrics/route')
    const response = await POST(
      new NextRequest('https://inventario.example.com/api/agent/metrics', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
        body: '{ isto nao e json',
      })
    )

    expect(response.status).toBe(400)
    expect(metricSamples).toHaveLength(0)
  })
})
