import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'
import { createWebhookEndpointAction } from '@/app/app/[clientSlug]/settings/actions'
import { decryptWebhookSecret, dispatchClientWebhookEndpoints, encryptWebhookSecret } from '@/lib/webhook-endpoints'

// aes-256-gcm precisa de um segredo mestre (lib/encrypted-secret.ts,
// reaproveitado por lib/webhook-endpoints.ts desde o Backlog item 7).
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-for-vitest-only'

// Sprint 11, item A + hardening (Backlog itens 5/6/7). Criterios cobertos:
// (a) criacao de WebhookEndpoint via Server Action, com o guard REAL
//     (canManageTenantAlerts nao e mockado — o mock de sessao/tenant e' o
//     unico jeito de o teste passar/falhar, mesmo padrao de
//     tests/rotate-enrollment-key.test.ts / tests/delete-alert-rule.test.ts);
// (b) disparo real via fetch mockado: o endpoint recebe o POST quando o
//     evento esta cadastrado e ativo, e NAO recebe quando o evento nao esta
//     em `events` ou quando isActive e' false;
// (c) validacao de assinatura: o header X-Webhook-Signature bate com o
//     HMAC-SHA256 calculado independentemente no teste usando o mesmo secret;
// (d) item 5 (SSRF): dispatch reavalia a URL a cada disparo e nao envia pra
//     endpoint bloqueado (teste dedicado da funcao de guard em si vive em
//     tests/webhook-url-guard.test.ts — aqui so a integracao com o dispatch);
// (e) item 6: limite de 20 WebhookEndpoint por tenant;
// (f) item 7: secret persistido CIFRADO (nao mais texto plano), decifrado
//     corretamente no disparo.
//
// node:dns/promises e mockado pra nao depender de resolucao real: por padrao
// resolve qualquer hostname pra um IP publico (203.0.113.10, TEST-NET-3),
// exceto quando um teste espec fico troca o mock pra simular um hostname que
// resolve pra IP privado.
const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(async (_hostname: string) => [{ address: '203.0.113.10', family: 4 }]),
}))
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }))

type FakeTenant = { id: string; name: string; slug: string; isActive: boolean; organizationId: string }
type FakeWebhookEndpoint = {
  id: string
  clientId: string
  url: string
  events: string[]
  isActive: boolean
  secret: string
}

const { tenants, endpoints, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const tenants = new Map<string, FakeTenant>()
  const endpoints = new Map<string, FakeWebhookEndpoint>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  let counter = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const tenant = Array.from(tenants.values()).find((entry) => entry.slug === where.slug)
        if (!tenant) return null
        return { ...tenant, organization: { isActive: true } }
      }),
    },
    webhookEndpoint: {
      create: vi.fn(async ({ data }: { data: Omit<FakeWebhookEndpoint, 'id'> }) => {
        const endpoint: FakeWebhookEndpoint = { id: `wh-${++counter}`, ...data }
        endpoints.set(endpoint.id, endpoint)
        return endpoint
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { clientId: string; isActive: boolean; events: { has: string } }
        }) =>
          Array.from(endpoints.values()).filter(
            (endpoint) =>
              endpoint.clientId === where.clientId &&
              endpoint.isActive === where.isActive &&
              endpoint.events.includes(where.events.has)
          )
      ),
      count: vi.fn(async ({ where }: { where: { clientId: string } }) =>
        Array.from(endpoints.values()).filter((endpoint) => endpoint.clientId === where.clientId).length
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { tenants, endpoints, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedTenant(overrides: Partial<FakeTenant> & { id: string; slug: string }) {
  const tenant: FakeTenant = { name: 'Cliente A', isActive: true, organizationId: 'org-a', ...overrides }
  tenants.set(tenant.id, tenant)
  return tenant
}

function buildCreateFormData(tenantSlug: string, url: string, events: string[]) {
  const formData = new FormData()
  formData.set('tenantSlug', tenantSlug)
  formData.set('url', url)
  for (const event of events) formData.append('events', event)
  return formData
}

const idleState = { status: 'idle' as const, message: null, secret: null }

beforeEach(() => {
  tenants.clear()
  endpoints.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
  lookupMock.mockReset()
  lookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }])
})

describe('createWebhookEndpointAction — guard real (canManageTenantAlerts)', () => {
  it('ORG_ADMIN da propria organizacao cadastra o webhook, segredo gerado no servidor, devolvido so nesta resposta', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/inventario', ['device.offline', 'device.online'])
    )

    expect(result.status).toBe('success')
    expect(result.secret).toBeTruthy()
    expect(result.secret).toMatch(/^[0-9a-f]{64}$/) // crypto.randomBytes(32).toString('hex')

    expect(endpoints.size).toBe(1)
    const created = Array.from(endpoints.values())[0]
    expect(created.clientId).toBe('client-a')
    // Item 7 (Backlog): persistido CIFRADO, nao em texto plano nem hash —
    // HMAC precisa do valor de volta, mas nao pode ficar legivel em repouso.
    expect(created.secret).not.toBe(result.secret)
    expect(decryptWebhookSecret(created.secret)).toBe(result.secret)
    expect(created.events).toEqual(['device.offline', 'device.online'])

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'webhook.create', targetType: 'webhook_endpoint', clientId: 'client-a' })
  })

  it('ORG_OPERATOR (fora do escopo de canManageTenantAlerts, que delega a canManageTenant) NAO consegue cadastrar', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(result.secret).toBeFalsy()
    expect(endpoints.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_ADMIN de OUTRA organizacao NAO consegue cadastrar webhook no tenant de outra org', async () => {
    seedTenant({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-b', 'https://hooks.example.com/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('rejeita payload sem nenhum evento selecionado, sem tocar o banco', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(idleState, buildCreateFormData('cliente-a', 'https://hooks.example.com/x', []))

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
  })

  // Backlog item 5 (SSRF) — integracao do guard dentro do Zod da action, no
  // cadastro. O teste isolado da funcao de guard em si vive em
  // tests/webhook-url-guard.test.ts; aqui so confirma que a action realmente
  // usa o guard e nao escreve no banco quando ele rejeita.
  it('rejeita cadastro com http:// (protocolo nao permitido), sem tocar o banco', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'http://hooks.example.com/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
  })

  it('rejeita cadastro cujo hostname resolve para IP privado/interno, sem tocar o banco', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://metadata.internal.example/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
  })
})

describe('createWebhookEndpointAction — limite de endpoints por tenant (Backlog item 6)', () => {
  const MAX = 20

  it('permite cadastrar ate o limite (20), o 21o e rejeitado sem escrever no banco', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    for (let i = 0; i < MAX; i++) {
      const result = await createWebhookEndpointAction(
        idleState,
        buildCreateFormData('cliente-a', `https://hooks.example.com/hook-${i}`, ['device.offline'])
      )
      expect(result.status).toBe('success')
    }

    expect(endpoints.size).toBe(MAX)

    const overLimit = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/hook-21', ['device.offline'])
    )

    expect(overLimit.status).toBe('error')
    expect(overLimit.message).toMatch(/limite/i)
    expect(endpoints.size).toBe(MAX) // nao escreveu no banco

    expect(auditLogs).toHaveLength(MAX) // nenhum audit log extra para a tentativa rejeitada
  })

  it('conta endpoints DESATIVADOS tambem — desativar e recriar nao contorna o limite', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    for (let i = 0; i < MAX; i++) {
      await createWebhookEndpointAction(
        idleState,
        buildCreateFormData('cliente-a', `https://hooks.example.com/hook-${i}`, ['device.offline'])
      )
    }
    // Desativa todos — se o limite contasse so ativos, o proximo cadastro passaria.
    for (const endpoint of endpoints.values()) endpoint.isActive = false

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/hook-extra', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(MAX)
  })
})

describe('dispatchClientWebhookEndpoints — disparo real via fetch mockado', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('envia POST para um endpoint ATIVO cujo events inclui o evento disparado', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.offline', 'device.low_disk'],
      isActive: true,
      secret: encryptWebhookSecret('segredo-teste'),
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline', hostname: 'PC-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/on')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ event: 'device.offline', hostname: 'PC-1' })
  })

  it('NAO envia quando o evento disparado nao esta na lista `events` do endpoint', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.low_disk'], // nao inclui device.offline
      isActive: true,
      secret: encryptWebhookSecret('segredo-teste'),
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('NAO envia quando o endpoint esta isActive: false, mesmo com o evento cadastrado', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.offline'],
      isActive: false,
      secret: encryptWebhookSecret('segredo-teste'),
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isolamento multi-tenant: nao envia para endpoint de outro clientId', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-b',
      url: 'https://hooks.example.com/outro-cliente',
      events: ['device.offline'],
      isActive: true,
      secret: encryptWebhookSecret('segredo-teste'),
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('dispatchClientWebhookEndpoints — validacao de assinatura (X-Webhook-Signature)', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('o header X-Webhook-Signature bate com o HMAC-SHA256 calculado independentemente com o mesmo secret (decifrado do valor cifrado em repouso)', async () => {
    const secret = 'segredo-de-teste-para-hmac'
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/assinado',
      events: ['device.warning'],
      isActive: true,
      secret: encryptWebhookSecret(secret), // persistido cifrado (item 7) — dispatch decifra antes de assinar
    })

    const payload = { event: 'device.warning', device: { id: 'device-1', hostname: 'PC-1' } }
    await dispatchClientWebhookEndpoints('client-a', 'device.warning', payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]
    const sentSignature = init.headers['X-Webhook-Signature']
    const sentBody = init.body as string

    const expectedSignature = crypto.createHmac('sha256', secret).update(sentBody).digest('hex')
    expect(sentSignature).toBe(expectedSignature)

    // Um segredo ERRADO nao pode produzir a mesma assinatura — prova que a
    // assinatura de fato depende do secret do endpoint, nao e' um valor fixo.
    const wrongSignature = crypto.createHmac('sha256', 'segredo-errado').update(sentBody).digest('hex')
    expect(sentSignature).not.toBe(wrongSignature)
  })
})

describe('dispatchClientWebhookEndpoints — SSRF guard reavaliado a cada disparo (Backlog item 5)', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('NAO envia quando o hostname do endpoint resolve (agora) para um IP privado, mesmo com evento/isActive corretos', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://rebind.attacker.example/hook',
      events: ['device.offline'],
      isActive: true,
      secret: encryptWebhookSecret('segredo-teste'),
    })
    // Simula DNS rebinding: o hostname passou a resolver pra um IP interno
    // desde o cadastro do endpoint — a checagem de dispatch pega isso porque
    // resolve de novo a cada disparo, nao confia no que foi validado antes.
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nao lanca e nao afeta outros endpoints do mesmo fan-out quando um deles e bloqueado', async () => {
    endpoints.set('wh-blocked', {
      id: 'wh-blocked',
      clientId: 'client-a',
      url: 'https://blocked.example/hook',
      events: ['device.offline'],
      isActive: true,
      secret: encryptWebhookSecret('segredo-1'),
    })
    endpoints.set('wh-ok', {
      id: 'wh-ok',
      clientId: 'client-a',
      url: 'https://hooks.example.com/hook',
      events: ['device.offline'],
      isActive: true,
      secret: encryptWebhookSecret('segredo-2'),
    })
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === 'blocked.example'
        ? [{ address: '10.0.0.5', family: 4 }]
        : [{ address: '203.0.113.10', family: 4 }]
    )

    await expect(
      dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/hook')
  })
})
