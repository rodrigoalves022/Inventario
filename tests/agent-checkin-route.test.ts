import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 10 — itens 5 (RF003/RF004/RF011: rota POST /api/agent/checkin),
// 13 (RNF002: AgentCheckLog com motivo distinto pra JSON malformado vs.
// schema Zod invalido) e 14 (RNF006: idempotencia do upsert por
// agentAuthId). Teste de integracao da rota REAL
// (app/api/agent/checkin/route.ts), Prisma mockado no mesmo padrao de
// tests/checkin-availability-reconciliation.test.ts (Sprint 9) — reaproveita
// a estrutura de fakePrisma daquele arquivo, reduzida ao necessario para
// estes 3 itens. O schema Zod (agentCheckinSchema) e' o schema REAL, nunca
// mockado — e' exatamente o que o item 13 precisa exercitar de verdade.

type FakeDeviceRow = {
  id: string
  agentAuthId: string
  clientId: string | null
  hostname: string
  status: string
  serial: string | null
  fabricante: string | null
  updatedAt: Date
}

type FakeHardwareRow = {
  deviceId: string
  ramTotalGb: number | null
  processador: string | null
}

const { devicesByAgentAuthId, devicesById, hardwareByDeviceId, collectionLogs, agentCheckLogs, authResultRef, fakePrisma } =
  vi.hoisted(() => {
    const devicesByAgentAuthId = new Map<string, FakeDeviceRow>()
    const devicesById = new Map<string, FakeDeviceRow>()
    const hardwareByDeviceId = new Map<string, FakeHardwareRow>()
    const collectionLogs: Array<{ deviceId: string; status: string; mensagem: string | null }> = []
    const agentCheckLogs: Array<{ agentAuthId: string; deviceId: string | null; status: string; detailsJson: string | null }> = []
    const authResultRef: { current: unknown } = { current: null }
    let deviceCounter = 0

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
              serial: (create.serial as string | null) ?? null,
              fabricante: (create.fabricante as string | null) ?? null,
              updatedAt: new Date(),
            }
            devicesByAgentAuthId.set(where.agentAuthId, created)
            devicesById.set(id, created)
            return { id: created.id, hostname: created.hostname, status: created.status }
          }
        ),
      },
      hardware: {
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { deviceId: string }
            create: Record<string, unknown>
            update: Record<string, unknown>
          }) => {
            const existing = hardwareByDeviceId.get(where.deviceId)
            if (existing) {
              Object.assign(existing, update)
              return existing
            }
            const row: FakeHardwareRow = {
              deviceId: where.deviceId,
              ramTotalGb: (create.ramTotalGb as number | null) ?? null,
              processador: (create.processador as string | null) ?? null,
            }
            hardwareByDeviceId.set(where.deviceId, row)
            return row
          }
        ),
      },
      network: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      disk: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      software: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      securityPosture: { upsert: noopUpsert },
      monitor: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      printer: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      usbDevice: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      localAccount: { deleteMany: noopDeleteMany, createMany: noopCreateMany },
      collectionLog: {
        create: vi.fn(async ({ data }: { data: { deviceId: string; status: string; mensagem: string | null } }) => {
          collectionLogs.push({ deviceId: data.deviceId, status: data.status, mensagem: data.mensagem })
          return { id: `log-${collectionLogs.length}` }
        }),
      },
      agentCheckLog: {
        create: vi.fn(
          async ({
            data,
          }: {
            data: { agentAuthId: string; deviceId: string | null; status: string; detailsJson: string | null }
          }) => {
            agentCheckLogs.push({
              agentAuthId: data.agentAuthId,
              deviceId: data.deviceId,
              status: data.status,
              detailsJson: data.detailsJson,
            })
            return { id: `checklog-${agentCheckLogs.length}` }
          }
        ),
      },
      alertRule: { findMany: vi.fn(async () => []) },
      alertEvent: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
    }

    return { devicesByAgentAuthId, devicesById, hardwareByDeviceId, collectionLogs, agentCheckLogs, authResultRef, fakePrisma }
  })

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) =>
    Response.json({ error: result.message }, { status: result.status }),
}))
vi.mock('@/lib/server-url', () => ({ getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com') }))
vi.mock('@/lib/agent-binary', () => ({ getAgentBinarySha256: vi.fn(async () => null) }))
// alertSettings null desativa os dois caminhos que nao sao objeto deste
// arquivo (webhook reativo — item 8/Sprint 9 A.1 — e a varredura de
// disponibilidade — Sprint 9 A.1), mantendo o teste focado em persistencia
// do check-in, AgentCheckLog e idempotencia do upsert.
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsByClientId: vi.fn(async () => null),
}))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

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

function buildRequest(body: unknown, { rawBody, apiKey = 'test-key' }: { rawBody?: string; apiKey?: string } = {}) {
  return new NextRequest('https://inventario.example.com/api/agent/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: rawBody ?? JSON.stringify(body),
  })
}

beforeEach(() => {
  devicesByAgentAuthId.clear()
  devicesById.clear()
  hardwareByDeviceId.clear()
  collectionLogs.length = 0
  agentCheckLogs.length = 0
  authResultRef.current = null
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

describe('POST /api/agent/checkin — item 5 (RF003/RF004/RF011): payload valido', () => {
  it('X-Api-Key valida + payload valido cria o Device e retorna 200 com deviceId', async () => {
    setAuthOk({ id: 'agent-valid-1' })

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(
      buildRequest({
        hostname: 'PC-VALIDO',
        agentVersion: '1.0.0',
        sistema: 'Windows 11 Pro',
        processador: 'Intel i5',
        ramTotalGb: 16,
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.deviceId).toBeTruthy()
    expect(devicesByAgentAuthId.get('agent-valid-1')?.hostname).toBe('PC-VALIDO')
    expect(hardwareByDeviceId.size).toBe(1)
    expect(collectionLogs).toHaveLength(1)
    expect(collectionLogs[0].status).toBe('success')
    // Nenhum AgentCheckLog para um check-in bem-sucedido — so grava em
    // caminho de erro (ver describe abaixo, itens 13/6).
    expect(agentCheckLogs).toHaveLength(0)
  })

  it('X-Api-Key invalida/ausente retorna 401 e nao persiste nada', async () => {
    authResultRef.current = { ok: false, status: 401, message: 'API Key inválida.' }

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-SEM-AUTH' }))

    expect(response.status).toBe(401)
    expect(devicesByAgentAuthId.size).toBe(0)
    expect(fakePrisma.device.upsert).not.toHaveBeenCalled()
  })

  it('X-Api-Key revogada retorna 403 e nao persiste nada', async () => {
    authResultRef.current = { ok: false, status: 403, message: 'API Key revogada. Contate o administrador.' }

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest({ hostname: 'PC-REVOGADO' }))

    expect(response.status).toBe(403)
    expect(fakePrisma.device.upsert).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/checkin — item 13 (RNF002): AgentCheckLog com motivo distinto', () => {
  it('corpo que nao e JSON valido grava status "invalid_json", retorna 400, sem persistir Device', async () => {
    setAuthOk({ id: 'agent-badjson-1' })

    const { POST } = await import('@/app/api/agent/checkin/route')
    const response = await POST(buildRequest(null, { rawBody: '{ isto nao e json valido' }))

    expect(response.status).toBe(400)
    expect(fakePrisma.device.upsert).not.toHaveBeenCalled()
    expect(agentCheckLogs).toHaveLength(1)
    expect(agentCheckLogs[0].status).toBe('invalid_json')
    expect(agentCheckLogs[0].detailsJson).toBeNull()
  })

  it('JSON valido mas que falha o schema Zod grava status "invalid_payload" (motivo DIFERENTE de invalid_json), retorna 400, sem persistir Device', async () => {
    setAuthOk({ id: 'agent-badschema-1' })

    const { POST } = await import('@/app/api/agent/checkin/route')
    // hostname ausente -> falha agentCheckinSchema (campo obrigatorio),
    // mas o corpo em si e' JSON perfeitamente valido.
    const response = await POST(buildRequest({ agentVersion: '1.0.0' }))

    expect(response.status).toBe(400)
    expect(fakePrisma.device.upsert).not.toHaveBeenCalled()
    expect(agentCheckLogs).toHaveLength(1)
    expect(agentCheckLogs[0].status).toBe('invalid_payload')
    expect(agentCheckLogs[0].detailsJson).toBeTruthy()
  })

  it('achado confirmado: os dois motivos NUNCA sao o mesmo texto — prova direta da distincao exigida pelo RNF002', async () => {
    setAuthOk({ id: 'agent-distinct-1' })
    const { POST } = await import('@/app/api/agent/checkin/route')

    await POST(buildRequest(null, { rawBody: 'nao e json' }))
    await POST(buildRequest({ agentVersion: '1.0.0' })) // sem hostname

    expect(agentCheckLogs).toHaveLength(2)
    const [jsonInvalido, schemaInvalido] = agentCheckLogs
    expect(jsonInvalido.status).toBe('invalid_json')
    expect(schemaInvalido.status).toBe('invalid_payload')
    expect(jsonInvalido.status).not.toBe(schemaInvalido.status)
  })
})

describe('POST /api/agent/checkin — item 14 (RNF006): idempotencia do upsert por agentAuthId', () => {
  it('reenviar o MESMO payload duas vezes atualiza o MESMO Device (upsert), sem criar um segundo registro; CollectionLog grava uma linha por tentativa (insert puro)', async () => {
    setAuthOk({ id: 'agent-idempotente-1' })
    const { POST } = await import('@/app/api/agent/checkin/route')

    const payload = { hostname: 'PC-IDEMPOTENTE', agentVersion: '1.0.0', serial: 'SN-FIXO-001' }

    const firstResponse = await POST(buildRequest(payload))
    const firstJson = await firstResponse.json()
    expect(firstResponse.status).toBe(200)

    const secondResponse = await POST(buildRequest(payload))
    const secondJson = await secondResponse.json()
    expect(secondResponse.status).toBe(200)

    // Mesmo deviceId nas duas respostas — nao houve segundo registro criado.
    expect(secondJson.deviceId).toBe(firstJson.deviceId)
    expect(devicesById.size).toBe(1)
    expect(fakePrisma.device.upsert).toHaveBeenCalledTimes(2)

    // update() foi de fato exercitado na segunda chamada, nao create():
    // upsert() no fake so cai no ramo de update quando ja existe entrada em
    // devicesByAgentAuthId para o mesmo agentAuthId, confirmando a chave de
    // idempotencia usada e' agentAuthId (nao um novo id por requisicao).
    expect(devicesByAgentAuthId.get('agent-idempotente-1')?.id).toBe(firstJson.deviceId)

    // CollectionLog e' insert puro (nao upsert): cada checkin, mesmo
    // repetido, soma uma linha nova de historico — 2 chamadas -> 2 linhas.
    expect(collectionLogs).toHaveLength(2)
    expect(collectionLogs.every((log) => log.deviceId === firstJson.deviceId)).toBe(true)
  })
})
