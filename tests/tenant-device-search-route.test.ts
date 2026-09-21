import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * GET /api/tenant/[clientSlug]/devices/search — busca de dispositivos da
 * paleta de comando (Ctrl+K), Backlog item 13.
 *
 * O que estes testes travam:
 *
 *  1. ISOLAMENTO (RNF004). O `clientSlug` da URL e' apenas o NOME do tenant
 *     pedido, nunca a credencial. Sessao de outra organizacao recebe 404 — o
 *     mesmo 404 de um slug inexistente, para que a diferenca de status nao
 *     revele a existencia de tenants alheios.
 *  2. ESCOPO DA CONSULTA. O `where` que chega ao Prisma tem que carregar o
 *     filtro de `getTenantDeviceWhere(clientSlug)`. Sem essa assercao, uma
 *     regressao que trocasse o where por uma busca global passaria pelos
 *     testes de status acima sem ser notada.
 *  3. TERMO CURTO devolve 200 com lista vazia, nao 400: a paleta consulta a
 *     cada tecla, e um termo em digitacao e' estado normal, nao erro.
 */

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = {
  id: string
  clientSlug: string
  hostname: string
  sistema: string | null
  ip: string | null
  updatedAt: Date
}

const { clients, devices, sessionRef, fakePrisma, lastFindManyArgs } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const lastFindManyArgs: { value: unknown } = { value: null }

  type DeviceWhere = {
    agentAuth?: { is?: { client?: { is?: { slug?: string } } } }
    OR?: Array<Record<string, unknown>>
  }

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
      findMany: vi.fn(async (args: { where: DeviceWhere; take?: number }) => {
        lastFindManyArgs.value = args
        const requiredSlug = args.where.agentAuth?.is?.client?.is?.slug
        const term = extractTerm(args.where.OR)

        return [...devices.values()]
          .filter((device) => device.clientSlug === requiredSlug)
          .filter((device) => {
            if (!term) return true
            const lowered = term.toLowerCase()
            return (
              device.hostname.toLowerCase().includes(lowered) ||
              (device.ip ?? '').toLowerCase().includes(lowered)
            )
          })
          .slice(0, args.take ?? 8)
          .map((device) => ({
            id: device.id,
            hostname: device.hostname,
            hardware: { sistema: device.sistema },
            networks: device.ip ? [{ ip: device.ip }] : [],
          }))
      }),
    },
  }

  function extractTerm(or: Array<Record<string, unknown>> | undefined): string | null {
    if (!or) return null
    for (const clause of or) {
      const hostname = clause.hostname as { contains?: string } | undefined
      if (hostname?.contains) return hostname.contains
    }
    return null
  }

  return { clients, devices, sessionRef, fakePrisma, lastFindManyArgs }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string; hostname: string }) {
  const device: FakeDevice = {
    sistema: 'Windows 11 Pro',
    ip: null,
    updatedAt: new Date(),
    ...overrides,
  }
  devices.set(device.id, device)
  return device
}

function buildContext(clientSlug: string) {
  return { params: Promise.resolve({ clientSlug }) }
}

function request(slug: string, query: string) {
  return new NextRequest(
    `https://inventario.example.com/api/tenant/${slug}/devices/search?q=${encodeURIComponent(query)}`
  )
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  lastFindManyArgs.value = null
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('GET /api/tenant/[clientSlug]/devices/search — isolamento de tenant', () => {
  it('ORG_ADMIN de OUTRA organizacao recebe 404 e nao chega a consultar dispositivos', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'SRV-FINANCEIRO' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const response = await GET(request('cliente-a', 'SRV'), buildContext('cliente-a') as never)

    expect(response.status).toBe(404)
    // A guarda roda ANTES da consulta: um forasteiro nem toca no banco.
    expect(fakePrisma.device.findMany).not.toHaveBeenCalled()
  })

  it('slug inexistente e slug de outra organizacao devolvem o MESMO 404 (anti-oracle)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const inexistente = await GET(request('nao-existe', 'SRV'), buildContext('nao-existe') as never)
    const outraOrg = await GET(request('cliente-a', 'SRV'), buildContext('cliente-a') as never)

    expect(inexistente.status).toBe(404)
    expect(outraOrg.status).toBe(404)
  })

  it('sessao ausente recebe 404', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = null

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const response = await GET(request('cliente-a', 'SRV'), buildContext('cliente-a') as never)

    expect(response.status).toBe(404)
  })
})

describe('GET /api/tenant/[clientSlug]/devices/search — escopo e resultado', () => {
  it('o where enviado ao Prisma carrega o filtro de tenant, nao uma busca global', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'SRV-FINANCEIRO', ip: '10.0.0.5' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    await GET(request('cliente-a', 'SRV'), buildContext('cliente-a') as never)

    const args = lastFindManyArgs.value as { where: { agentAuth?: { is?: { client?: { is?: { slug?: string } } } } } }
    expect(args.where.agentAuth?.is?.client?.is?.slug).toBe('cliente-a')
  })

  it('nao devolve dispositivo de outro tenant que casaria com o termo', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'SRV-A' })
    seedDevice({ id: 'device-2', clientSlug: 'cliente-b', hostname: 'SRV-B' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const response = await GET(request('cliente-a', 'SRV'), buildContext('cliente-a') as never)
    const body = (await response.json()) as { devices: Array<{ id: string }> }

    expect(response.status).toBe(200)
    expect(body.devices.map((device) => device.id)).toEqual(['device-1'])
  })

  it('classifica servidor e computador pelo mesmo predicado das listagens', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({
      id: 'device-srv',
      clientSlug: 'cliente-a',
      hostname: 'MAQ-SRV',
      sistema: 'Windows Server 2019 Standard',
    })
    seedDevice({ id: 'device-pc', clientSlug: 'cliente-a', hostname: 'MAQ-PC', sistema: 'Windows 11 Pro' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const response = await GET(request('cliente-a', 'MAQ'), buildContext('cliente-a') as never)
    const body = (await response.json()) as { devices: Array<{ id: string; isServer: boolean }> }

    const byId = new Map(body.devices.map((device) => [device.id, device.isServer]))
    expect(byId.get('device-srv')).toBe(true)
    expect(byId.get('device-pc')).toBe(false)
  })

  it('termo com menos de 2 caracteres devolve 200 com lista vazia, nao 400', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'SRV-A' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/devices/search/route')
    const response = await GET(request('cliente-a', 'S'), buildContext('cliente-a') as never)
    const body = (await response.json()) as { devices: unknown[] }

    expect(response.status).toBe(200)
    expect(body.devices).toEqual([])
    // Termo curto nem chega a virar consulta.
    expect(fakePrisma.device.findMany).not.toHaveBeenCalled()
  })
})
