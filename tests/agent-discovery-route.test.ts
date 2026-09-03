import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 14 (RF028/RN017): teste de integracao da rota REAL
// (app/api/agent/discovery/route.ts), Prisma mockado. `agentDiscoverySchema`
// (lib/schemas/agent-discovery.ts) e' o schema REAL, nunca mockado — o ponto
// destes casos e' justamente que a validacao e os DOIS gates fail-closed
// (clientId nulo, discoveryEnabled=false) rodem de verdade.
//
// NOTA sobre rate limit: a rota aplica `rateLimit('discovery:<agentAuthId>')`
// com limite de 5/hora, usando o Map em memoria REAL de lib/rate-limit.ts (nao
// mockado). Por isso CADA teste usa um agentAuthId proprio — reusar o mesmo id
// entre casos faria o 6o teste receber 429 em vez do status que ele afirma.

type FakeClientRow = { id: string; discoveryEnabled: boolean }
type FakeDiscoveredDevice = {
  id: string
  clientId: string
  ip: string
  mac: string | null
  hostname: string | null
  vendor: string | null
  deviceType: string
  snmpSysDescr: string | null
  openPorts: string | null
  firstSeenAt: Date
  lastSeenAt: Date
}

const { clientsById, discoveredDevices, authResultRef, fakePrisma } = vi.hoisted(() => {
  const clientsById = new Map<string, FakeClientRow>()
  const discoveredDevices: FakeDiscoveredDevice[] = []
  const authResultRef: { current: unknown } = { current: null }
  let counter = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clientsById.get(where.id)
        return client ? { discoveryEnabled: client.discoveryEnabled } : null
      }),
    },
    discoveredDevice: {
      // Reproduz a semantica do upsert por @@unique([clientId, ip]): a chave
      // composta vem em `where.clientId_ip`, o `create` so roda quando a linha
      // nao existe, e o `update` NUNCA toca firstSeenAt.
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { clientId_ip: { clientId: string; ip: string } }
          create: Omit<FakeDiscoveredDevice, 'id'>
          update: Partial<FakeDiscoveredDevice>
        }) => {
          const existing = discoveredDevices.find(
            (row) => row.clientId === where.clientId_ip.clientId && row.ip === where.clientId_ip.ip
          )

          if (existing) {
            Object.assign(existing, update)
            return existing
          }

          const created: FakeDiscoveredDevice = { id: `discovered-${++counter}`, ...create }
          discoveredDevices.push(created)
          return created
        }
      ),
    },
  }

  return { clientsById, discoveredDevices, authResultRef, fakePrisma }
})

vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => authResultRef.current),
  authErrorResponse: (result: { status: number; message: string }) =>
    Response.json({ error: result.message }, { status: result.status }),
}))

function setAuthOk(agentAuthId: string, clientId: string | null = 'client-a') {
  authResultRef.current = {
    ok: true,
    agentAuth: {
      id: agentAuthId,
      name: 'Agente Teste',
      clientId,
      clientName: clientId ? 'Cliente A' : null,
      clientSlug: clientId ? 'cliente-a' : null,
    },
  }
}

function seedClient(id: string, discoveryEnabled: boolean) {
  clientsById.set(id, { id, discoveryEnabled })
}

function buildRequest(body: unknown, apiKey = 'test-key') {
  return new NextRequest('https://inventario.example.com/api/agent/discovery', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  })
}

function payload(devices: unknown[], hostname = 'PC-SCANNER') {
  return { hostname, agentVersion: '1.0.0', subnet: '192.168.1.0/24', devices }
}

beforeEach(() => {
  clientsById.clear()
  discoveredDevices.length = 0
  authResultRef.current = null
  vi.clearAllMocks()
})

describe('POST /api/agent/discovery — autenticacao', () => {
  it('X-Api-Key invalida rejeita com 401, sem gravar DiscoveredDevice', async () => {
    authResultRef.current = { ok: false, status: 401, message: 'API Key inválida.' }

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.10', deviceType: 'PRINTER' }])))

    expect(response.status).toBe(401)
    expect(discoveredDevices).toHaveLength(0)
    expect(fakePrisma.discoveredDevice.upsert).not.toHaveBeenCalled()
  })

  it('requisicao sem X-Api-Key rejeita com 401, sem gravar', async () => {
    authResultRef.current = { ok: false, status: 401, message: 'API Key ausente.' }

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(
      new NextRequest('https://inventario.example.com/api/agent/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload([{ ip: '192.168.1.10' }])),
      })
    )

    expect(response.status).toBe(401)
    expect(discoveredDevices).toHaveLength(0)
  })
})

describe('POST /api/agent/discovery — gates fail-closed (RN017)', () => {
  it('agente sem clientId (legado, registrado sem tenant) e rejeitado com 202, sem gravar linha orfa', async () => {
    setAuthOk('agent-discovery-sem-client', null)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.10', deviceType: 'PRINTER' }])))
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json).toMatchObject({ ok: false, reason: 'agent_without_client' })
    expect(discoveredDevices).toHaveLength(0)
    expect(fakePrisma.discoveredDevice.upsert).not.toHaveBeenCalled()
    // Nem chega a consultar o Client: sem tenant nao ha o que consultar.
    expect(fakePrisma.client.findUnique).not.toHaveBeenCalled()
  })

  it('tenant com discoveryEnabled=false e rejeitado com 202, sem gravar nada', async () => {
    setAuthOk('agent-discovery-desligado', 'client-desligado')
    seedClient('client-desligado', false)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(
      buildRequest(
        payload([
          { ip: '192.168.1.10', deviceType: 'PRINTER' },
          { ip: '192.168.1.20', deviceType: 'SWITCH' },
        ])
      )
    )
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json).toMatchObject({ ok: false, reason: 'discovery_disabled' })
    expect(discoveredDevices).toHaveLength(0)
    expect(fakePrisma.discoveredDevice.upsert).not.toHaveBeenCalled()
  })

  it('Client inexistente cai no mesmo ramo fail-closed, sem gravar', async () => {
    setAuthOk('agent-discovery-client-fantasma', 'client-que-nao-existe')

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.10' }])))
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json).toMatchObject({ ok: false, reason: 'discovery_disabled' })
    expect(discoveredDevices).toHaveLength(0)
  })
})

describe('POST /api/agent/discovery — persistencia', () => {
  it('varredura valida grava uma linha por IP, escopada ao clientId do agente', async () => {
    setAuthOk('agent-discovery-ok', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(
      buildRequest(
        payload([
          {
            ip: '192.168.1.10',
            mac: 'AA:BB:CC:DD:EE:FF',
            hostname: 'impressora-rh',
            vendor: 'HP',
            deviceType: 'PRINTER',
            snmpSysDescr: 'HP ETHERNET MULTI-ENVIRONMENT',
            openPorts: '80,161,9100',
          },
          { ip: '192.168.1.1', deviceType: 'ROUTER' },
        ])
      )
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ ok: true, upserted: 2 })
    expect(discoveredDevices).toHaveLength(2)
    expect(discoveredDevices[0]).toMatchObject({
      clientId: 'client-ligado',
      ip: '192.168.1.10',
      mac: 'AA:BB:CC:DD:EE:FF',
      hostname: 'impressora-rh',
      vendor: 'HP',
      deviceType: 'PRINTER',
      openPorts: '80,161,9100',
    })
    expect(discoveredDevices[1]).toMatchObject({ clientId: 'client-ligado', ip: '192.168.1.1', deviceType: 'ROUTER' })
  })

  it('deviceType ausente cai no default UNKNOWN do schema, nunca em string vazia', async () => {
    setAuthOk('agent-discovery-default-tipo', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.77' }])))

    expect(response.status).toBe(200)
    expect(discoveredDevices[0].deviceType).toBe('UNKNOWN')
    // Campos nao apurados viram null, nunca "" — mesmo principio de
    // "nao apurado != vazio" do restante da coleta.
    expect(discoveredDevices[0].mac).toBeNull()
    expect(discoveredDevices[0].vendor).toBeNull()
  })

  it('segunda varredura do mesmo IP faz UPDATE (upsert por clientId+ip): preserva firstSeenAt e atualiza lastSeenAt', async () => {
    setAuthOk('agent-discovery-upsert', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')

    const first = await POST(
      buildRequest(payload([{ ip: '192.168.1.10', hostname: 'nome-antigo', deviceType: 'UNKNOWN' }]))
    )
    expect(first.status).toBe(200)
    expect(discoveredDevices).toHaveLength(1)

    const originalFirstSeenAt = discoveredDevices[0].firstSeenAt
    const originalLastSeenAt = discoveredDevices[0].lastSeenAt

    // Garante que o relogio avance entre os dois ciclos, para o assert de
    // lastSeenAt ser sobre uma mudanca real, nao sobre o mesmo milissegundo.
    await new Promise((resolve) => setTimeout(resolve, 5))

    const second = await POST(
      buildRequest(
        payload([
          {
            ip: '192.168.1.10',
            hostname: 'nome-novo',
            vendor: 'Cisco',
            deviceType: 'SWITCH',
            snmpSysDescr: 'Cisco IOS Software',
            openPorts: '22,80,161',
          },
        ])
      )
    )

    expect(second.status).toBe(200)
    // Nao duplicou: continua UMA linha para aquele (clientId, ip).
    expect(discoveredDevices).toHaveLength(1)
    expect(discoveredDevices[0].firstSeenAt.getTime()).toBe(originalFirstSeenAt.getTime())
    expect(discoveredDevices[0].lastSeenAt.getTime()).toBeGreaterThan(originalLastSeenAt.getTime())
    expect(discoveredDevices[0]).toMatchObject({
      hostname: 'nome-novo',
      vendor: 'Cisco',
      deviceType: 'SWITCH',
      snmpSysDescr: 'Cisco IOS Software',
      openPorts: '22,80,161',
    })

    // O upsert nunca recebe firstSeenAt no bloco de update.
    const updateArgs = fakePrisma.discoveredDevice.upsert.mock.calls[1][0] as { update: Record<string, unknown> }
    expect(updateArgs.update).not.toHaveProperty('firstSeenAt')
  })

  it('o mesmo IP em dois tenants diferentes sao linhas distintas (isolamento multi-tenant)', async () => {
    seedClient('client-um', true)
    seedClient('client-dois', true)

    const { POST } = await import('@/app/api/agent/discovery/route')

    setAuthOk('agent-tenant-um', 'client-um')
    await POST(buildRequest(payload([{ ip: '192.168.1.10', deviceType: 'PRINTER' }])))

    setAuthOk('agent-tenant-dois', 'client-dois')
    await POST(buildRequest(payload([{ ip: '192.168.1.10', deviceType: 'NAS' }])))

    expect(discoveredDevices).toHaveLength(2)
    expect(discoveredDevices.map((row) => row.clientId).sort()).toEqual(['client-dois', 'client-um'])
  })

  it('payload sem dispositivos (varredura que nao achou nada) e aceito, sem gravar', async () => {
    setAuthOk('agent-discovery-vazio', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest({ hostname: 'PC-SCANNER', subnet: '192.168.1.0/24' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ ok: true, upserted: 0 })
    expect(discoveredDevices).toHaveLength(0)
  })
})

describe('POST /api/agent/discovery — validacao Zod (payload nao confiavel)', () => {
  it('IP fora do formato IPv4 rejeita com 400, sem tocar o banco', async () => {
    setAuthOk('agent-discovery-ip-invalido', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.999', deviceType: 'PRINTER' }])))

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
    expect(fakePrisma.client.findUnique).not.toHaveBeenCalled()
    expect(fakePrisma.discoveredDevice.upsert).not.toHaveBeenCalled()
  })

  it('deviceType fora do catalogo fechado rejeita com 400 (nunca grava tipo desconhecido)', async () => {
    setAuthOk('agent-discovery-tipo-invalido', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload([{ ip: '192.168.1.10', deviceType: 'MAINFRAME' }])))

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
  })

  it('hostname ausente (campo obrigatorio) rejeita com 400', async () => {
    setAuthOk('agent-discovery-sem-hostname', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest({ devices: [{ ip: '192.168.1.10' }] }))

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
  })

  it('array de dispositivos acima do teto (512) rejeita com 400', async () => {
    setAuthOk('agent-discovery-array-gigante', 'client-ligado')
    seedClient('client-ligado', true)

    const devices = Array.from({ length: 513 }, (_unused, index) => ({
      ip: `10.0.${Math.floor(index / 254)}.${(index % 254) + 1}`,
      deviceType: 'UNKNOWN',
    }))

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(buildRequest(payload(devices)))

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
  })

  it('sysDescr acima do limite (1024) rejeita com 400 — nao trunca silenciosamente', async () => {
    setAuthOk('agent-discovery-sysdescr-gigante', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(
      buildRequest(payload([{ ip: '192.168.1.10', snmpSysDescr: 'A'.repeat(1025) }]))
    )

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
  })

  it('corpo que nao e JSON valido retorna 400', async () => {
    setAuthOk('agent-discovery-badjson', 'client-ligado')
    seedClient('client-ligado', true)

    const { POST } = await import('@/app/api/agent/discovery/route')
    const response = await POST(
      new NextRequest('https://inventario.example.com/api/agent/discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
        body: '{ isto nao e json',
      })
    )

    expect(response.status).toBe(400)
    expect(discoveredDevices).toHaveLength(0)
  })
})
